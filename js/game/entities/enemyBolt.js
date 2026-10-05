import Entity from './entity';

/**
 * 怪物远程弹（远程怪发射）。
 *
 * 水平飞行，命中玩家造成伤害；撞墙 / 超时自动回收。
 * 数值来自发射者类型定义（projSpeed / projDamage / projColor）。
 */
export default class EnemyBolt extends Entity {
  constructor(x, y, dir, opts = {}) {
    const w = opts.w != null ? opts.w : 8;
    const h = opts.h != null ? opts.h : 4;
    super(x - w / 2, y - h / 2, w, h);
    this.dir = dir > 0 ? 1 : -1;
    this.facing = this.dir;
    this.speed = opts.speed != null ? opts.speed : 150;
    this.damage = opts.damage != null ? opts.damage : 8;
    this.color = opts.color || '#67e8f9';
    this.life = opts.life != null ? opts.life : 2.2;
    this.vx = this.dir * this.speed;
    this.vy = 0;
  }

  update(dt, world) {
    this.life -= dt;
    if (this.life <= 0) { this.active = false; return; }

    this.vx = this.dir * this.speed;
    this.vy = 0;
    this.moveX(dt, world.map);
    if (this.vx === 0) { this.active = false; return; } // 撞墙
    this.moveY(dt, world.map);
  }

  render(renderer) {
    if (!this.active) return;
    renderer.drawRect(this.x, this.y, this.w, this.h, this.color);
  }
}
