import Entity from './entity';
import { enemyAttackDef } from '../../config/enemyAttacks';

/**
 * 「离体攻击」实体（怪物外放的弹体 / 持续伤害区）。
 *
 * 形态与运动完全由 `config/enemyAttacks.js` 的定义驱动（可被 opts 覆盖），
 * 于是「新增一种离体攻击」= 加一条数据，不必改这里的逻辑；
 * 接素材时给定义补 `sprite`，或在此 render 里加一个 shape 分支即可。
 *
 * 运动方式（motion）：
 *   straight  直线飞行（撞墙/超时回收；可 pierce 穿透）
 *   arc       抛物线（受 gravity，落地/超时回收）
 *   sine      正弦波动飞行（waveAmp / waveFreq）
 *   static    原地持续伤害区（tick 间隔结算，不移动、命中不消失）
 *
 * 兼容旧接口：`new EnemyBolt(x, y, dir, { damage, speed, color })` 仍可用
 * （等价于 kind='bolt' 的直线弹）。
 */
export default class EnemyAttack extends Entity {
  constructor(x, y, dir, opts = {}) {
    const def = opts.def || enemyAttackDef(opts.kind || 'bolt');
    const w = pick(opts.w, def.w, 8);
    const h = pick(opts.h, def.h, 4);
    super(x - w / 2, y - h / 2, w, h); // 以 (x,y) 为中心

    this.kind = opts.kind || 'bolt';
    this.def = def;
    this.dir = dir >= 0 ? 1 : -1;
    this.facing = this.dir;

    // 形态 / 运动
    this.motion = opts.motion || def.motion || 'straight';
    this.shape = opts.shape || def.shape || 'rect';
    this.speed = pick(opts.speed, def.speed, 150);
    this.life = pick(opts.life, def.life, 2.2);
    this.maxLife = this.life;
    this.gravity = pick(opts.gravity, def.gravity, 0);
    this.waveAmp = pick(opts.waveAmp, def.waveAmp, 0);
    this.waveFreq = pick(opts.waveFreq, def.waveFreq, 8);

    // 伤害 / 命中
    this.damage = pick(opts.damage, def.damage, 8);
    this.color = opts.color || def.color || '#67e8f9';
    this.pierce = pick(opts.pierce, def.pierce, 0);
    this.tick = pick(opts.tick, def.tick, 0);
    this.onHit = opts.onHit || def.onHit || 'none';
    this.burstRadius = pick(opts.burstRadius, def.burstRadius, 0);
    this.burstMul = pick(opts.burstMul, def.burstMul, 0);
    this.sprite = opts.sprite || def.sprite || null;

    this.isZone = this.motion === 'static';
    this.vx = this.isZone ? 0 : this.dir * this.speed;
    this.vy = pick(opts.vy, def.vy, 0);

    // 命中记录（穿透 / 去重）
    this.hits = 0;
    this._hit = new Set();

    // 持续伤害区节拍
    this._tickCd = this.tick > 0 ? this.tick : 0;
    this.tickReady = false;

    this._phase = 0; // sine 相位
    this._t = 0;     // 动画时钟
  }

  hasHit(target) { return this._hit.has(target); }
  markHit(target) { if (target) this._hit.add(target); this.hits += 1; }
  get canPierceMore() { return this.hits < this.pierce; }

  update(dt, world) {
    this.life -= dt;
    this._t += dt;
    if (this.life <= 0) { this.active = false; return; }

    // 持续伤害区：原地按 tick 节拍准备结算
    if (this.tick > 0) {
      this.tickReady = false;
      this._tickCd -= dt;
      if (this._tickCd <= 0) { this.tickReady = true; this._tickCd = this.tick; }
    }
    if (this.isZone) return; // 原地不动

    if (this.motion === 'arc') {
      this.vy += this.gravity * dt;
    } else if (this.motion === 'sine') {
      this._phase += dt;
      this.vy = Math.sin(this._phase * this.waveFreq * Math.PI * 2) * this.waveAmp;
    }

    this.vx = this.dir * this.speed;
    this.moveX(dt, world.map);
    if (this.vx === 0) { this.active = false; return; } // 撞墙

    this.moveY(dt, world.map);
    if (this.onGround && this.motion === 'arc') this.active = false; // 火球落地消失
  }

  render(renderer) {
    if (!this.active) return;
    // 末段淡出，避免突然消失
    const fade = this.maxLife > 0 ? Math.max(0, Math.min(1, this.life / 0.12)) : 1;

    // 接素材后：优先用 sprite（渲染器支持时）
    if (this.sprite && renderer.drawSprite) {
      renderer.drawSprite(this.sprite, this.x, this.y, this.w, this.h, { alpha: fade, flip: this.dir < 0 });
      return;
    }

    if (this.shape === 'circle') {
      renderer.drawCircle(this.cx, this.cy, this.w / 2, { fill: this.color, alpha: fade });
    } else if (this.shape === 'blade') {
      renderer.drawRect(this.x, this.y, this.w, this.h, this.color, fade);
      const tipX = this.dir > 0 ? this.x : this.x + this.w - 3;
      renderer.drawRect(tipX, this.y + 1, 3, this.h - 2, '#ffffff', fade * 0.8);
    } else if (this.shape === 'flame') {
      const flick = 0.6 + 0.4 * Math.sin(this._t * 30);
      renderer.drawRect(this.x, this.y, this.w, this.h, this.color, fade * 0.45 * flick);
      renderer.drawRect(this.x + 3, this.y + 2, this.w - 6, this.h - 4, '#ffd166', fade * 0.7 * flick);
    } else {
      renderer.drawRect(this.x, this.y, this.w, this.h, this.color, fade);
    }
  }
}

/** 取第一个非 null/undefined 的值 */
function pick(...vals) {
  for (const v of vals) if (v != null) return v;
  return undefined;
}
