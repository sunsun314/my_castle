import { DAMAGE_TEXT } from '../../config/constants';

/**
 * 战斗飘字（伤害数字）。
 *
 * 显示约定（由 world.spawnDamageText 传入颜色）：
 *   - 白色：玩家「对怪物」造成的伤害
 *   - 红色：己方（玩家）受到的伤害
 *
 * 运动：以向上初速度抛出 + 重力拉回 -> 抛物线跳动；
 *       生命周期末段线性淡出，结束即 active=false 被回收。
 *
 * 纯展示对象：不参与碰撞，也不参与任何战斗结算。
 */
export default class DamageText {
  constructor(x, y, value, opts = {}) {
    this.x = x;
    this.y = y;
    this.value = Math.round(value);
    this.color = opts.color || DAMAGE_TEXT.colorEnemy;

    // 水平方向随机漂移（可用 driftSign 固定方向）
    const sign = opts.driftSign != null ? opts.driftSign : (Math.random() < 0.5 ? -1 : 1);
    const drift = opts.drift != null ? opts.drift : DAMAGE_TEXT.drift;
    this.vx = opts.vx != null ? opts.vx : sign * drift * (0.5 + Math.random() * 0.5);
    this.vy = opts.vy != null ? opts.vy : DAMAGE_TEXT.riseSpeed;

    this.maxLife = opts.life != null ? opts.life : DAMAGE_TEXT.life;
    this.life = this.maxLife;
    this.active = true;
  }

  update(dt) {
    if (!this.active) return;
    this.life -= dt;
    if (this.life <= 0) {
      this.life = 0;
      this.active = false;
      return;
    }
    // 抛物线：竖直方向恒受重力，越过顶点后回落
    this.vy += DAMAGE_TEXT.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  /** 生命周期进度 0 -> 1 */
  get progress() {
    return 1 - this.life / this.maxLife;
  }

  /** 当前不透明度：前段保持不透明，后段线性淡出 */
  get alpha() {
    const t = this.progress;
    if (t <= DAMAGE_TEXT.fadeStart) return 1;
    const k = (t - DAMAGE_TEXT.fadeStart) / (1 - DAMAGE_TEXT.fadeStart);
    return Math.max(0, Math.min(1, 1 - k));
  }

  render(renderer) {
    if (!this.active) return;
    renderer.drawText(String(this.value), this.x, this.y, {
      align: 'center',
      baseline: 'middle',
      color: this.color,
      font: DAMAGE_TEXT.font,
      alpha: this.alpha,
    });
  }
}
