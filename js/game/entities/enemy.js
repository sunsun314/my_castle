import Entity from './entity';
import { GRAVITY, MAX_FALL, ENEMY } from '../../config/constants';

/**
 * 巡逻小怪（M3 战斗闭环的最小敌人）。
 *
 * 行为：
 *  - 在地面上左右巡逻，撞墙或到悬崖边自动掉头
 *  - 被玩家攻击命中：掉血 + 白闪 + 击退硬直
 *  - 血量归零：播放死亡演出后消失
 *
 * 复用 Entity 的分轴瓦片碰撞（moveX/moveY），自身只负责 AI 与受伤逻辑。
 */
export default class Enemy extends Entity {
  constructor(x, y, opts = {}) {
    super(x, y, opts.w || ENEMY.w, opts.h || ENEMY.h);

    this.maxHp = opts.hp != null ? opts.hp : ENEMY.hp;
    this.hp = this.maxHp;
    this.speed = opts.speed != null ? opts.speed : ENEMY.speed;
    this.contactDamage = opts.contactDamage != null
      ? opts.contactDamage
      : (opts.atk != null ? opts.atk : ENEMY.contactDamage); // 接触伤害（碰到玩家时扣玩家血）
    this.exp = opts.exp != null ? opts.exp : ENEMY.exp;   // 击杀奖励经验

    this.dir = -1;          // -1 左 / 1 右
    this.facing = this.dir;
    this.hurtTimer = 0;     // 受击硬直（被击退期间不主动移动）
    this.lastHitSwing = -1; // 被哪一次挥砍命中过（保证每刀只结算一次）
    this.flash = 0;         // 白闪计时
    this.deadTimer = 0;     // 死亡演出计时
  }

  update(dt, world) {
    if (this.dead) return;
    const map = world.map;

    if (this.flash > 0) this.flash -= dt;

    // ---- 死亡演出：上浮淡出，结束后标记 dead ----
    if (this.hp <= 0) {
      this.deadTimer += dt;
      this.vy += GRAVITY * dt;
      if (this.vy > MAX_FALL) this.vy = MAX_FALL;
      this.moveX(dt, map);
      this.moveY(dt, map);
      if (this.deadTimer >= ENEMY.deathTime) {
        this.dead = true;
        this.active = false;
      }
      return;
    }

    // ---- 受击硬直：只受重力/击退，不主动走 ----
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      this.vy += GRAVITY * dt;
      if (this.vy > MAX_FALL) this.vy = MAX_FALL;
      this.moveX(dt, map);
      this.moveY(dt, map);
      return;
    }

    // ---- 巡逻 AI ----
    // 临崖掉头
    if (this.onGround && this._wouldFall(map)) this._turn();
    this.vx = this.speed * this.dir;
    this.facing = this.dir;
    this.moveX(dt, map);
    if (this.vx === 0) this._turn(); // 撞墙：moveX 已把 vx 归零

    // 重力 + 地形
    this.vy += GRAVITY * dt;
    if (this.vy > MAX_FALL) this.vy = MAX_FALL;
    this.moveY(dt, map);
  }

  _turn() {
    this.dir *= -1;
    this.vx = 0;
  }

  /** 前方脚下有没有可站立的地面（没有=悬崖，掉头） */
  _wouldFall(map) {
    const ts = map.tileSize;
    const probeX = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
    const col = Math.floor(probeX / ts);
    const row = Math.floor((this.y + this.h + 1) / ts);
    return !(map.isSolid(col, row) || map.isPlatform(col, row));
  }

  /**
   * 受到伤害。
   * @param {number} dmg 伤害值
   * @param {number} fromX 伤害来源的 x（用于判断击退方向）
   * @returns {boolean} 本次是否真正生效
   */
  hurt(dmg = 1, fromX = this.cx) {
    if (this.hp <= 0 || this.dead) return false;
    this.hp -= dmg;
    this.flash = 0.12;
    this.hurtTimer = 0.15;
    const dir = fromX <= this.cx ? 1 : -1; // 从左边打来 -> 往右退
    this.vx = dir * ENEMY.knockback;
    this.vy = -130;
    return true;
  }

  render(renderer) {
    if (this.dead) return;

    // 死亡：金色淡出
    if (this.hp <= 0) {
      const t = Math.min(1, this.deadTimer / ENEMY.deathTime);
      renderer.drawRect(this.x, this.y - t * 6, this.w, this.h, ENEMY.deathColor, 1 - t);
      return;
    }

    // 受击白闪
    const color = this.flash > 0 ? '#ffffff' : ENEMY.color;
    renderer.drawRect(this.x, this.y, this.w, this.h, color);

    // 眼睛（指示朝向）
    const ex = this.facing > 0 ? this.x + this.w - 5 : this.x + 2;
    renderer.drawRect(ex, this.y + 4, 3, 3, ENEMY.eye);

    // 掉血后显示小血条
    if (this.hp < this.maxHp) {
      renderer.drawRect(this.x, this.y - 4, this.w, 2, '#000000');
      renderer.drawRect(this.x, this.y - 4, this.w * (this.hp / this.maxHp), 2, '#6ee7b7');
    }
  }
}
