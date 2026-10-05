import Camera from '../engine/camera';
import { DISPLAY } from '../engine/display';
import { TILE, PLAYER, ENEMY } from '../config/constants';
import { LEVEL1 } from '../config/level1';
import Tilemap from './tilemap';
import Player from './entities/player';
import Enemy from './entities/enemy';
import MagicBolt from './entities/projectile';

/**
 * 游戏世界：持有地图、实体集合与相机，并驱动它们的更新、渲染与战斗结算。
 * 场景（PlayScene）只负责编排世界与 UI；世界本身不关心输入来源与渲染后端。
 */
export default class World {
  constructor(app) {
    this.app = app;
    this.input = app.input;
    this.map = new Tilemap(LEVEL1);

    this.player = this._spawnPlayer();
    this.enemies = this._spawnEnemies();
    this.entities = [this.player, ...this.enemies];
    this.projectiles = []; // 副武器弹丸（上+B 魔法）

    this.camera = new Camera(DISPLAY.viewWidth, DISPLAY.viewHeight);
    this.time = 0;
    this.hitStop = 0; // 命中顿帧（秒），短暂冻结世界以强化打击感
  }

  _spawnPlayer() {
    const sx = this.map.spawn.col * TILE + (TILE - PLAYER.w) / 2;
    const sy = (this.map.spawn.row + 1) * TILE - PLAYER.h;
    return new Player(sx, sy);
  }

  _spawnEnemies() {
    return this.map.enemySpawns.map(({ col, row }) => {
      const x = col * TILE + (TILE - ENEMY.w) / 2;
      const y = (row + 1) * TILE - ENEMY.h;
      return new Enemy(x, y);
    });
  }

  /** 还活着的敌人数量 */
  get aliveEnemies() {
    return this.enemies.filter((e) => e.active && e.hp > 0 && !e.dead).length;
  }

  /** 发射一枚副武器魔法弹（上+B 触发），伤害取自玩家魔法力 */
  spawnMagic(player) {
    const dir = player.facing;
    const x = dir > 0 ? player.x + player.w + 2 : player.x - 2;
    const y = player.y + player.h * 0.35;
    this.projectiles.push(new MagicBolt(x, y, dir, player.stats.mag));
  }

  update(dt) {
    // 命中顿帧：短暂冻结整个世界
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }

    this.time += dt;
    for (const e of this.entities) {
      if (e.active && e.update) e.update(dt, this);
    }

    // 副武器弹丸：更新 + 回收失效项
    for (const pr of this.projectiles) {
      if (pr.active) pr.update(dt, this);
    }
    if (this.projectiles.some((pr) => !pr.active)) {
      this.projectiles = this.projectiles.filter((pr) => pr.active);
    }

    this._resolveCombat();
    this.camera.follow(this.player, this.map, dt);
  }

  /** 战斗结算：近战/魔法弹 × 敌人；敌人 × 玩家 */
  _resolveCombat() {
    const p = this.player;

    // 1) 玩家近战攻击 -> 检测是否命中敌人（同一刀对同一敌人只结算一次）
    if (p.attackTimer > 0 && p.meleeActive && p.hp > 0) {
      const hb = p.getAttackHitbox();
      for (const e of this.enemies) {
        if (e.dead || e.hp <= 0 || e.lastHitSwing === p.attackId) continue;
        if (this._overlapRect(hb, e)) {
          if (e.hurt(p.stats.atk, p.cx)) {
            e.lastHitSwing = p.attackId;
            this.hitStop = 0.05;
            if (e.hp <= 0) p.gainExp(e.exp); // 击杀奖励
          }
        }
      }
    }

    // 1b) 副武器魔法弹 -> 命中敌人（伤害在弹丸上，命中后弹丸消失）
    for (const pr of this.projectiles) {
      if (!pr.active) continue;
      for (const e of this.enemies) {
        if (e.dead || e.hp <= 0) continue;
        if (this._overlapRect(pr, e)) {
          if (e.hurt(pr.damage, pr.cx)) {
            this.hitStop = 0.04;
            pr.active = false;
            if (e.hp <= 0) p.gainExp(e.exp);
          }
          break;
        }
      }
    }

    // 2) 敌人碰到玩家 -> 玩家受伤（按玩家防御减伤；玩家自身有无敌帧保护）
    for (const e of this.enemies) {
      if (e.dead || e.hp <= 0) continue;
      if (p.overlaps(e)) p.hurtByContact(e.contactDamage, e.cx);
    }
  }

  _overlapRect(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  render(renderer) {
    this.map.render(renderer, this.camera);
    for (const e of this.entities) {
      if (e.active && e.render) e.render(renderer, this);
    }
    for (const pr of this.projectiles) {
      if (pr.active && pr.render) pr.render(renderer, this);
    }
  }
}
