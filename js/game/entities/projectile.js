import Entity from './entity';
import { MAGIC } from '../../config/constants';

/**
 * 副武器：魔法弹（上 + B 发射）。
 *
 * 水平飞行，命中敌人造成「玩家魔法力 mag」点伤害后消失；
 * 撞墙或超时/越界自动回收。
 *
 * 外观 / 弹速 / 存活等参数由 profile（来自 player.getMagicProfile()，即当前副武器）
 * 决定；未装备副武器时回落到 MAGIC 默认值。
 */
export default class MagicBolt extends Entity {
  constructor(x, y, dir, damage, profile = {}) {
    const w = profile.w != null ? profile.w : MAGIC.w;
    const h = profile.h != null ? profile.h : MAGIC.h;
    super(x - w / 2, y - h / 2, w, h);
    this.dir = dir;
    this.damage = damage;
    this.element = profile.element != null ? profile.element : MAGIC.element;         // 战斗属性
    this.attackType = profile.attackType != null ? profile.attackType : MAGIC.attackType; // 攻击类型
    this.speed = profile.speed != null ? profile.speed : MAGIC.speed;
    this.life = profile.life != null ? profile.life : MAGIC.life;
    this.color = profile.color != null ? profile.color : MAGIC.color;

    // ---- 弹道行为（差异化）----
    this.behavior = profile.behavior != null ? profile.behavior : MAGIC.behavior;
    this.pierce = profile.pierce != null ? profile.pierce : MAGIC.pierce;
    this.burstRadius = profile.burstRadius != null ? profile.burstRadius : MAGIC.burstRadius;
    this.burstMul = profile.burstMul != null ? profile.burstMul : MAGIC.burstMul;
    this.slowMul = profile.slowMul != null ? profile.slowMul : MAGIC.slowMul;
    this.slowTime = profile.slowTime != null ? profile.slowTime : MAGIC.slowTime;
    this.chainCount = profile.chainCount != null ? profile.chainCount : MAGIC.chainCount;
    this.chainRange = profile.chainRange != null ? profile.chainRange : MAGIC.chainRange;
    this.chainMul = profile.chainMul != null ? profile.chainMul : MAGIC.chainMul;
    this._hit = new Set(); // 已命中过的敌人（穿透/防重复结算）
    this.hits = 0;

    this.vx = dir * this.speed;
    this.vy = 0;
    this.onGround = false;
  }

  /** 本弹是否已命中过该敌人（穿透弹复用） */
  hasHit(e) { return this._hit.has(e); }

  /** 记录命中（供穿透计数与去重） */
  markHit(e) { this._hit.add(e); this.hits++; }

  update(dt, world) {
    if (!this.active) return;

    this.life -= dt;
    if (this.life <= 0) {
      this.active = false;
      return;
    }

    this.x += this.vx * dt;

    // 撞墙消失
    const ts = world.map.tileSize;
    const col = Math.floor((this.x + this.w / 2) / ts);
    const row = Math.floor((this.y + this.h / 2) / ts);
    if (world.map.isSolid(col, row)) {
      // 爆裂弹撞墙也引爆
      if (this.behavior === 'burst' && world.magicBurst) {
        world.magicBurst(this, this.cx, this.cy, null);
      }
      this.active = false;
      return;
    }

    // 越界回收
    if (this.x < -32 || this.x > world.map.pixelWidth + 32) this.active = false;
  }

  render(renderer) {
    if (!this.active) return;
    // 尾焰（朝反方向拉长）
    renderer.drawRect(this.x - this.dir * 4, this.y + 1, this.w + 4, this.h - 2, this.color, 0.35);
    renderer.drawRect(this.x, this.y, this.w, this.h, this.color);
    renderer.drawRect(this.x + (this.dir > 0 ? this.w - 3 : 0), this.y + 1, 3, this.h - 2, '#eae6ff');
  }
}
