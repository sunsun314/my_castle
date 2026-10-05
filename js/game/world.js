import Camera from '../engine/camera';
import { DISPLAY } from '../engine/display';
import { TILE, PLAYER, ENEMY, TRANSFORM, DAMAGE_TEXT } from '../config/constants';
import { LEVEL1, LEVEL1_ENEMY_WEAKNESSES, LEVEL1_ENEMY_TYPES } from '../config/level1';
import { ENEMY_TYPES } from '../config/enemies';
import Tilemap from './tilemap';
import Player from './entities/player';
import Enemy from './entities/enemy';
import EnemyBolt from './entities/enemyBolt';
import MagicBolt from './entities/projectile';
import DamageText from './entities/damageText';
import { applyWeakness } from './elements';

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
    this.enemyBolts = [];  // 怪物远程弹
    this.damageTexts = []; // 战斗飘字（伤害数字）
    this.magicFx = [];     // 法术特效（爆裂环 / 连锁电弧）

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
    return this.map.enemySpawns.map(({ col, row }, i) => {
      const type = LEVEL1_ENEMY_TYPES[i] || 'patrol';       // 类型来自关卡配置
      const def = ENEMY_TYPES[type] || ENEMY_TYPES.patrol;  // 类型定义（取尺寸）
      const w = def.w || ENEMY.w;
      const h = def.h || ENEMY.h;
      const x = col * TILE + (TILE - w) / 2;
      const y = (row + 1) * TILE - h;
      const weaknesses = LEVEL1_ENEMY_WEAKNESSES[i] || []; // 弱点来自关卡配置
      return new Enemy(x, y, { weaknesses, type });
    });
  }

  /** 还活着的敌人数量 */
  get aliveEnemies() {
    return this.enemies.filter((e) => e.active && e.hp > 0 && !e.dead).length;
  }

  /**
   * 弹出战斗飘字。
   * @param {number} x,y 世界坐标
   * @param {number} value 伤害值（<=0 不生成）
   * @param {object} opts { color, driftSign, vx, vy, life }
   */
  spawnDamageText(x, y, value, opts = {}) {
    const v = Math.round(value);
    if (!(v > 0)) return null;
    const text = new DamageText(x, y + DAMAGE_TEXT.offsetY, v, opts);
    this.damageTexts.push(text);
    return text;
  }

  /** 己方（玩家）受伤飘字：统一红色 */
  spawnPlayerDamage(x, y, value) {
    return this.spawnDamageText(x, y, value, { color: DAMAGE_TEXT.colorPlayer });
  }

  /** 发射一枚副武器魔法弹（上+B 触发），伤害取自玩家魔法力、属性取自 getMagicProfile */
  spawnMagic(player) {
    const dir = player.facing;
    const x = dir > 0 ? player.x + player.w + 2 : player.x - 2;
    const y = player.y + player.h * 0.35;
    const info = player.getMagicProfile();
    this.projectiles.push(new MagicBolt(x, y, dir, player.stats.mag, info));
  }

  /** 怪物远程弹（远程怪发射）：水平飞行、命中玩家/撞墙/超时回收 */
  spawnEnemyBolt(enemy) {
    const a = enemy.attack || {}; // 弹道参数与怪物强绑定（存在其 attack 块里）
    const dir = enemy.facing >= 0 ? 1 : -1;
    const x = dir > 0 ? enemy.x + enemy.w + 2 : enemy.x - 2;
    const y = enemy.y + enemy.h * 0.4;
    this.enemyBolts.push(new EnemyBolt(x, y, dir, {
      speed: a.projSpeed,
      damage: a.projDamage,
      color: a.projColor,
    }));
    return this.enemyBolts[this.enemyBolts.length - 1];
  }

  update(dt) {
    // 命中顿帧：短暂冻结整个世界（飘字也一并冻结，强化打击感）
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

    // 怪物远程弹：更新 + 回收失效项
    for (const b of this.enemyBolts) {
      if (b.active) b.update(dt, this);
    }
    if (this.enemyBolts.some((b) => !b.active)) {
      this.enemyBolts = this.enemyBolts.filter((b) => b.active);
    }

    this._resolveCombat();

    // 战斗飘字：更新 + 回收失效项
    for (const t of this.damageTexts) t.update(dt);
    if (this.damageTexts.some((t) => !t.active)) {
      this.damageTexts = this.damageTexts.filter((t) => t.active);
    }

    // 法术特效（爆裂环 / 连锁电弧）：更新 + 回收失效项
    for (const fx of this.magicFx) fx.life -= dt;
    if (this.magicFx.some((fx) => fx.life <= 0)) {
      this.magicFx = this.magicFx.filter((fx) => fx.life > 0);
    }

    this.camera.follow(this.player, this.map, dt);
  }

  /** 战斗结算：近战/魔法弹 × 敌人（含弱点倍率）；敌人 × 玩家 */
  _resolveCombat() {
    const p = this.player;

    // 1) 玩家近战攻击 -> 命中敌人（同一刀对同一敌人只结算一次；按武器属性 + 目标弱点结算）
    if (p.attackTimer > 0 && p.meleeActive && p.hp > 0) {
      const hb = p.getAttackHitbox();
      const prof = p.getAttackProfile();
      const atkInfo = { element: prof.element, attackType: prof.attackType };
      for (const e of this.enemies) {
        if (e.dead || e.hp <= 0 || e.lastHitSwing === p.attackId) continue;
        if (this._overlapRect(hb, e)) {
          const dmg = applyWeakness(p.getAttackDamage(), atkInfo, e.weaknesses);
          const ex = e.cx, ey = e.y;
          if (e.hurt(dmg, p.cx)) {
            e.lastHitSwing = p.attackId;
            this.hitStop = 0.05;
            this.spawnDamageText(ex, ey, dmg); // 白色：对怪物造成的伤害
            if (e.hp <= 0) p.gainExp(e.exp); // 击杀奖励
          }
        }
      }
    }

    // 1a) 突进魔神：撞到的怪物受巨额伤害（同一突进对每个敌人只结算一次）
    if (p.demonMode === 'dash' && p.hp > 0) {
      const atkInfo = { element: TRANSFORM.element, attackType: TRANSFORM.attackType };
      const dmg = p.getDashDamage();
      for (const e of this.enemies) {
        if (e.dead || e.hp <= 0 || e.lastHitDash === p.dashId) continue;
        if (this._overlapRect(p, e)) {
          const ex = e.cx, ey = e.y;
          const final = applyWeakness(dmg, atkInfo, e.weaknesses);
          if (e.hurt(final, p.cx)) {
            e.lastHitDash = p.dashId;
            this.hitStop = 0.05;
            this.spawnDamageText(ex, ey, final); // 白色：对怪物造成的伤害
            if (e.hp <= 0) p.gainExp(e.exp);
          }
        }
      }
    }

    // 1b) 副武器魔法弹 -> 命中敌人（伤害在弹丸上；同样吃弱点倍率）
    //     弹道行为：bolt 单体 / pierce 穿透 / burst 爆裂 / slow 减速 / chain 连锁
    for (const pr of this.projectiles) {
      if (!pr.active) continue;
      const atkInfo = { element: pr.element, attackType: pr.attackType };
      for (const e of this.enemies) {
        if (e.dead || e.hp <= 0) continue;
        if (pr.hasHit && pr.hasHit(e)) continue;
        if (!this._overlapRect(pr, e)) continue;
        const dmg = applyWeakness(pr.damage, atkInfo, e.weaknesses);
        const ex = e.cx, ey = e.y;
        if (e.hurt(dmg, pr.cx)) {
          if (pr.markHit) pr.markHit(e);
          this.hitStop = 0.04;
          this.spawnDamageText(ex, ey, dmg); // 白色：对怪物造成的伤害
          if (e.hp <= 0) p.gainExp(e.exp);
          if (pr.behavior === 'burst') {
            this.magicBurst(pr, ex, ey, e); // 中心已全额结算，爆裂只溅射周围
            pr.active = false;
          } else if (pr.behavior === 'slow') {
            e.applySlow(pr.slowMul, pr.slowTime);
            pr.active = false;
          } else if (pr.behavior === 'chain') {
            this.magicChain(pr, e, atkInfo); // 命中后电弧跳向附近敌人
            pr.active = false;
          } else if (pr.behavior === 'pierce') {
            if (pr.hits >= pr.pierce) pr.active = false; // 穿透次数用尽才消失
          } else {
            pr.active = false;
          }
        }
        break; // 本帧只结算一个敌人；穿透弹靠 hasHit 在后续帧继续命中
      }
    }

    // 2) 敌人碰到玩家 -> 玩家受伤（怪物的碰撞攻击统一为「普通」类型、无属性）
    for (const e of this.enemies) {
      if (e.dead || e.hp <= 0) continue;
      if (p.overlaps(e)) {
        const px = p.cx, py = p.y;
        if (p.hurtByContact(e.contactDamage, e.cx)) {
          this.spawnPlayerDamage(px, py, p.lastDamageApplied); // 红色：己方受到的伤害
        }
      }
    }

    // 3) 怪物远程弹 -> 玩家受伤（经防御减伤；命中后弹丸消失）
    for (const b of this.enemyBolts) {
      if (!b.active || p.hp <= 0) continue;
      if (p.overlaps(b)) {
        const px = p.cx, py = p.y;
        if (p.hurtByRanged(b.damage, b.cx)) {
          this.spawnPlayerDamage(px, py, p.lastDamageApplied); // 红色：己方受到的伤害
          b.active = false;
        }
      }
    }
  }

  _overlapRect(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  /**
   * 爆裂弹：以 (x, y) 为中心，对半径内敌人造成溅射伤害（中心目标已全额结算，用 exclude 排除）。
   * @param {MagicBolt} pr 弹丸（提供伤害 / 属性 / 倍率 / 颜色）
   * @param {Enemy|null} exclude 不重复受伤的中心目标
   */
  magicBurst(pr, x, y, exclude) {
    const r = pr.burstRadius;
    const atkInfo = { element: pr.element, attackType: pr.attackType };
    for (const e of this.enemies) {
      if (e === exclude || e.dead || e.hp <= 0) continue;
      const dx = e.cx - x, dy = e.cy - y;
      if (dx * dx + dy * dy > r * r) continue;
      const dmg = applyWeakness(pr.damage * pr.burstMul, atkInfo, e.weaknesses);
      if (e.hurt(dmg, x)) {
        if (pr.markHit) pr.markHit(e);
        this.spawnDamageText(e.cx, e.y, dmg);
        if (e.hp <= 0) this.player.gainExp(e.exp);
      }
    }
    this.magicFx.push({ kind: 'ring', x, y, r, life: 0.18, max: 0.18, color: pr.color });
  }

  /** 连锁弹：从命中目标起，反复跳向 chainRange 内最近的未命中敌人 */
  magicChain(pr, from, atkInfo) {
    let src = from;
    const used = new Set([from]);
    for (let i = 0; i < pr.chainCount; i++) {
      let best = null;
      let bestD = pr.chainRange * pr.chainRange;
      for (const e of this.enemies) {
        if (e.dead || e.hp <= 0 || used.has(e)) continue;
        const dx = e.cx - src.cx, dy = e.cy - src.cy;
        const d = dx * dx + dy * dy;
        if (d <= bestD) { bestD = d; best = e; }
      }
      if (!best) break;
      const dmg = applyWeakness(pr.damage * pr.chainMul, atkInfo, best.weaknesses);
      const bx = best.cx, by = best.y + best.h / 2;
      if (best.hurt(dmg, src.cx)) {
        if (pr.markHit) pr.markHit(best);
        this.spawnDamageText(best.cx, best.y, dmg);
        if (best.hp <= 0) this.player.gainExp(best.exp);
      }
      this.magicFx.push({ kind: 'arc', x1: src.cx, y1: src.cy, x2: bx, y2: by, life: 0.14, max: 0.14, color: pr.color });
      used.add(best);
      src = best;
    }
  }

  /** 绘制法术特效（世界坐标，随相机变换） */
  _renderMagicFx(renderer) {
    for (const fx of this.magicFx) {
      const t = Math.max(0, fx.life / fx.max);
      if (fx.kind === 'ring') {
        renderer.drawCircle(fx.x, fx.y, Math.max(1, fx.r * (1 - t)), {
          stroke: fx.color, alpha: t, lineWidth: 2,
        });
      } else if (fx.kind === 'arc') {
        const seg = 5;
        for (let i = 0; i <= seg; i++) {
          const a = i / seg;
          const x = fx.x1 + (fx.x2 - fx.x1) * a + (i % 2 ? 2 : -2);
          const y = fx.y1 + (fx.y2 - fx.y1) * a;
          renderer.drawRect(x - 1, y - 1, 2, 2, '#ffffff', t);
        }
      }
    }
  }

  render(renderer) {
    this.map.render(renderer, this.camera);
    for (const e of this.entities) {
      if (e.active && e.render) e.render(renderer, this);
    }
    for (const pr of this.projectiles) {
      if (pr.active && pr.render) pr.render(renderer, this);
    }
    for (const b of this.enemyBolts) {
      if (b.active && b.render) b.render(renderer, this);
    }
    this._renderMagicFx(renderer); // 法术特效（爆裂环 / 连锁电弧）
    for (const t of this.damageTexts) t.render(renderer); // 飘字画在最上层
  }
}
