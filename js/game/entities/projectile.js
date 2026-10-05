import Entity from './entity';
import { MAGIC } from '../../config/constants';

/**
 * 副武器：魔法弹（上 + B 发射）。
 *
 * 水平飞行，命中敌人造成「玩家魔法力 mag」点伤害后消失；
 * 撞墙或超时/越界自动回收。
 */
export default class MagicBolt extends Entity {
  constructor(x, y, dir, damage) {
    super(x - MAGIC.w / 2, y - MAGIC.h / 2, MAGIC.w, MAGIC.h);
    this.dir = dir;
    this.damage = damage;
    this.life = MAGIC.life;
    this.vx = dir * MAGIC.speed;
    this.vy = 0;
    this.onGround = false;
  }

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
      this.active = false;
      return;
    }

    // 越界回收
    if (this.x < -32 || this.x > world.map.pixelWidth + 32) this.active = false;
  }

  render(renderer) {
    if (!this.active) return;
    // 尾焰（朝反方向拉长）
    renderer.drawRect(this.x - this.dir * 4, this.y + 1, this.w + 4, this.h - 2, MAGIC.color, 0.35);
    renderer.drawRect(this.x, this.y, this.w, this.h, MAGIC.color);
    renderer.drawRect(this.x + (this.dir > 0 ? this.w - 3 : 0), this.y + 1, 3, this.h - 2, '#eae6ff');
  }
}
