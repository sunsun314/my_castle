import Entity from './entity';
import { GRAVITY, MAX_FALL, ENEMY } from '../../config/constants';
import { ENEMY_TYPES } from '../../config/enemies';

/**
 * 怪物实体（多类型 + 主动攻击）。
 *
 * 数值 / 配色 / 行为标识 / 攻击块来自 `config/enemies.js` 的 `ENEMY_TYPES`
 * （按 opts.type 选择，缺省 'patrol'）。行为在 update 里按 `behavior` 分派：
 *   patrol / flyer / charger / shooter / jumper / ceiling / diver
 *
 * 攻击机制与怪物**强绑定**：每个类型用同一个四段状态机
 *   idle → windup(前摇) → active(生效) → recovery(后摇)
 * 但每个阶段的**具体效果**由该类型的行为分支独占实现，参数来自其 `attack` 块。
 * 前摇 / 后摇都刻意加长：玩家有反应窗口规避，后摇是安全输出窗口。
 *
 * 触发方式统一为「玩家进入攻击范围即发动」（见 `_inRange`）。
 *
 * 战斗属性：
 *  - weaknesses：至多两个弱点，命中按 150% / 300% 结算（见 game/elements.js）。
 *  - attackType / element：本怪碰撞攻击与远程弹的属性（统一「普通」、无属性）。
 */
export default class Enemy extends Entity {
  constructor(x, y, opts = {}) {
    const typeKey = opts.type || 'patrol';
    const type = ENEMY_TYPES[typeKey] || ENEMY_TYPES.patrol;
    super(x, y, opts.w || type.w || ENEMY.w, opts.h || type.h || ENEMY.h);

    this.type = typeKey;              // 类型 key
    this.typeDef = type;              // 类型定义（数值 / 行为参数）
    this.behavior = type.behavior || 'patrol';

    // ---- 数值：opts（测试/关卡覆写）> 类型定义 > ENEMY 默认 ----
    this.maxHp = opts.hp != null ? opts.hp : (type.hp != null ? type.hp : ENEMY.hp);
    this.hp = this.maxHp;
    this.speed = opts.speed != null ? opts.speed : (type.speed != null ? type.speed : ENEMY.speed);
    this.contactDamage = opts.contactDamage != null
      ? opts.contactDamage
      : (opts.atk != null ? opts.atk : (type.contactDamage != null ? type.contactDamage : ENEMY.contactDamage));
    this.exp = opts.exp != null ? opts.exp : (type.exp != null ? type.exp : ENEMY.exp);
    this.knockback = type.knockback != null ? type.knockback : ENEMY.knockback;
    this.color = type.color || ENEMY.color;
    this.deathColor = type.deathColor || ENEMY.deathColor;

    // ---- 战斗属性 ----
    this.weaknesses = opts.weaknesses || ENEMY.weaknesses;   // [{ kind, value }]
    this.attackType = opts.attackType || ENEMY.attackType;   // 碰撞/远程攻击类型（普通）
    this.element = opts.element != null ? opts.element : ENEMY.element;

    // ---- 攻击块（与类型强绑定）----
    this.attack = type.attack || { kind: 'none' };
    this.attackKind = this.attack.kind;

    // ---- 通用状态 ----
    this.dir = -1;          // -1 左 / 1 右（移动朝向）
    this.facing = this.dir; // 朝向（远程/前摇时会朝玩家瞄准，与移动朝向解耦）
    this.hurtTimer = 0;     // 受击硬直
    this.lastHitSwing = -1; // 被哪一次挥砍命中过（每刀只结算一次）
    this.lastHitDash = -1;  // 被哪一次突进命中过（每次突进只结算一次）
    this.flash = 0;         // 白闪计时
    this.deadTimer = 0;     // 死亡演出计时
    this.slowTimer = 0;     // 减速剩余时间
    this.slowMul = 1;       // 减速期间速度倍率
    this.animT = 0;         // 行为动画时钟

    // ---- 攻击状态机：idle -> windup -> active -> recovery ----
    this.attackState = 'idle';
    this.attackTimer = 0;
    this.attackCd = 0;

    // ---- 各机制专属状态 ----
    this._anchored = false; // ceiling：是否已吸附到天花板
    this.aimX = 0;          // diver：俯冲方向
    this.aimY = 0;

    // 飞行类：抬升到地面之上，并记录悬浮中心
    if (type.spawnLift) this.y -= type.spawnLift;
    this.baseY = this.y;
  }

  /** 本怪攻击的战斗属性（供玩家受伤结算/展示使用） */
  getAttackInfo() {
    return { element: this.element, attackType: this.attackType };
  }

  update(dt, world) {
    if (this.dead) return;
    const map = world.map;

    if (this.flash > 0) this.flash -= dt;
    if (this.slowTimer > 0) this.slowTimer -= dt;
    if (this.attackCd > 0) this.attackCd -= dt;
    this.animT += dt;

    // ---- 死亡演出：上浮淡出，结束后标记 dead ----
    if (this.hp <= 0) {
      this.deadTimer += dt;
      this._applyGravity(dt);
      this.moveX(dt, map);
      this.moveY(dt, map);
      if (this.deadTimer >= ENEMY.deathTime) {
        this.dead = true;
        this.active = false;
      }
      return;
    }

    // ---- 受击硬直：只受重力/击退，不主动走（但保留攻击计时，避免卡死）----
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      this._applyGravity(dt);
      this.moveX(dt, map);
      this.moveY(dt, map);
      return;
    }

    switch (this.behavior) {
      case 'flyer': this._updateFlyer(dt, map); break;
      case 'charger': this._updateCharger(dt, world, map); break;
      case 'shooter': this._updateShooter(dt, world, map); break;
      case 'jumper': this._updateJumper(dt, world, map); break;
      case 'ceiling': this._updateCeiling(dt, world, map); break;
      case 'diver': this._updateDiver(dt, world, map); break;
      default: this._updatePatrol(dt, map);
    }
  }

  // ================= 攻击触发（统一入口）=================

  /** 玩家是否进入本怪攻击范围（有主动攻击的怪才判定） */
  _inRange(world) {
    const a = this.attack;
    if (!a || a.kind === 'none') return false;
    const p = world.player;
    if (!p || p.hp <= 0) return false;
    const dx = p.cx - this.cx;
    const dy = p.cy - this.cy;
    const r = a.range != null ? a.range : 96;
    const vr = a.vRange != null ? a.vRange : 40;
    return Math.abs(dx) <= r && Math.abs(dy) <= vr;
  }

  _canStart() {
    return this.attackState === 'idle' && this.attackCd <= 0 && this.attackKind !== 'none';
  }

  /** 进入前摇：停下并（可选）面向玩家 */
  _beginWindup(world, aim = true) {
    this.attackState = 'windup';
    this.attackTimer = this.attack.windup != null ? this.attack.windup : 0.6;
    this.vx = 0;
    if (aim && world.player) {
      this.dir = world.player.cx >= this.cx ? 1 : -1;
      this.facing = this.dir;
    }
  }

  /** 退入后摇 */
  _beginRecovery() {
    this.attackState = 'recovery';
    this.attackTimer = this.attack.recovery != null ? this.attack.recovery : 0.8;
    this.vx = 0;
  }

  /** 后摇结束，回到待机并进入冷却 */
  _endAttack() {
    this.attackState = 'idle';
    this.attackCd = this.attack.cooldown || 0;
  }

  // ================= 各类型行为 =================

  /** 地面巡逻：撞墙 / 临崖掉头（基类默认行为，保持原手感） */
  _updatePatrol(dt, map) {
    if (this.onGround && this._wouldFall(map)) this._turn();
    this.vx = this.speed * this.dir * this._slow();
    this.facing = this.dir;
    this.moveX(dt, map);
    if (this.vx === 0) this._turn();
    this._applyGravity(dt);
    this.moveY(dt, map);
  }

  /** 飞行漂浮：无重力；水平巡逻撞墙掉头，垂直按正弦起伏（弹簧趋近，仍走瓦片碰撞） */
  _updateFlyer(dt, map) {
    const def = this.typeDef;
    this.vx = this.speed * this.dir * this._slow();
    this.facing = this.dir;
    this.moveX(dt, map);
    if (this.vx === 0) this._turn();

    const range = def.flyRange != null ? def.flyRange : 24;
    const freq = def.flyFreq != null ? def.flyFreq : 1.5;
    const target = this.baseY + Math.sin(this.animT * freq * Math.PI * 2) * range;
    this.vy = Math.max(-100, Math.min(100, (target - this.y) * 6));
    this.moveY(dt, map);
  }

  /** 冲锋：巡逻 -> 侦测玩家 -> 前摇蓄力 -> 高速冲锋 -> 后摇硬直 */
  _updateCharger(dt, world, map) {
    const a = this.attack;
    const slow = this._slow();

    if (this.attackState === 'idle') {
      if (this.onGround && this._wouldFall(map)) this._turn();
      this.vx = this.speed * this.dir * slow;
      this.facing = this.dir;
      this.moveX(dt, map);
      if (this.vx === 0) this._turn();
      if (this.onGround && this._canStart() && this._inRange(world)) this._beginWindup(world);
    } else if (this.attackState === 'windup') {
      this.vx = 0;
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackState = 'active';
        this.attackTimer = a.active;
      }
    } else if (this.attackState === 'active') {
      this.vx = this.dir * (a.dashSpeed || 200) * slow;
      this.attackTimer -= dt;
      this.moveX(dt, map);
      if (this.vx === 0 || this.attackTimer <= 0) this._beginRecovery();
    } else { // recovery
      this.vx = 0;
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) this._endAttack();
    }

    this._applyGravity(dt);
    this.moveY(dt, map);
  }

  /** 远程：巡逻；玩家进入射程 -> 前摇蓄光（持续瞄准）-> 发射 -> 后摇 */
  _updateShooter(dt, world, map) {
    const a = this.attack;
    const p = world.player;
    const slow = this._slow();

    if (this.attackState === 'idle') {
      if (this.onGround && this._wouldFall(map)) this._turn();
      this.vx = this.speed * this.dir * slow;
      this.moveX(dt, map);
      if (this.vx === 0) this._turn();
      const inR = this._inRange(world);
      this.facing = inR ? (p.cx >= this.cx ? 1 : -1) : this.dir;
      if (this.onGround && this._canStart() && inR) this._beginWindup(world);
    } else if (this.attackState === 'windup') {
      this.vx = 0;
      this.facing = p.cx >= this.cx ? 1 : -1; // 前摇期间持续瞄准（玩家可走位躲开）
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackState = 'active';
        this.attackTimer = a.active;
        world.spawnEnemyBolt(this);
        this.flash = Math.max(this.flash, 0.08); // 开火闪光
      }
    } else if (this.attackState === 'active') {
      this.vx = 0;
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) this._beginRecovery();
    } else { // recovery
      this.vx = 0;
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) this._endAttack();
    }

    this._applyGravity(dt);
    this.moveY(dt, map);
  }

  /** 跳跃：巡逻；玩家进入射程 -> 蹲伏前摇 -> 扑跳 -> 落地后摇 */
  _updateJumper(dt, world, map) {
    const a = this.attack;
    const slow = this._slow();

    if (this.attackState === 'idle') {
      if (this.onGround && this._wouldFall(map)) this._turn();
      this.vx = this.speed * this.dir * slow;
      this.facing = this.dir;
      this.moveX(dt, map);
      if (this.vx === 0) this._turn();
      if (this.onGround && this._canStart() && this._inRange(world)) this._beginWindup(world);
    } else if (this.attackState === 'windup') {
      this.vx = 0;
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackState = 'active';
        this.attackTimer = a.active;
        this.vy = -(a.hopSpeedY || 268);
        this.vx = this.dir * (a.hopSpeedX || 104) * slow;
        this.onGround = false;
      }
    } else if (this.attackState === 'active') {
      this.attackTimer -= dt;
      this.moveX(dt, map);
    } else { // recovery
      this.vx = 0;
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) this._endAttack();
    }

    this._applyGravity(dt);
    this.moveY(dt, map);

    // 扑跳落地 / 到时 -> 后摇
    if (this.attackState === 'active' && (this.attackTimer <= 0 || this.onGround)) {
      this._beginRecovery();
    }
  }

  /** 天花板怪：吸附天花板，玩家来到正下方 -> 抖动前摇 -> 坠落砸击 -> 爬回 */
  _updateCeiling(dt, world, map) {
    const a = this.attack;
    if (!this._anchored) this._snapToCeiling(map);

    if (this.attackState === 'idle') {
      this._climb(dt, a.returnSpeed != null ? a.returnSpeed : 70);
      if (this._canStart() && this._inRange(world)) this._beginWindup(world, false);
    } else if (this.attackState === 'windup') {
      this.vx = 0;
      this.vy = 0;
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackState = 'active';
        this.attackTimer = a.active != null ? a.active : 0.75;
        this.vy = a.dropSpeed != null ? a.dropSpeed : 300;
      }
    } else if (this.attackState === 'active') {
      this.vy = a.dropSpeed != null ? a.dropSpeed : 300;
      this.moveY(dt, map);
      this.attackTimer -= dt;
      if (this.onGround || this.attackTimer <= 0) {
        this.vy = 0;
        this._beginRecovery();
      }
    } else { // recovery：爬回天花板
      this.attackTimer -= dt;
      this._climb(dt, a.returnSpeed != null ? a.returnSpeed : 70);
      if (this.y <= this.baseY + 0.5 || this.attackTimer <= 0) {
        this.vy = 0;
        this._endAttack();
      }
    }
  }

  /** 飞行俯冲：空中漂浮；玩家进入范围 -> 悬停前摇 -> 朝玩家俯冲 -> 拉升后摇 */
  _updateDiver(dt, world, map) {
    const a = this.attack;
    const slow = this._slow();

    if (this.attackState === 'idle') {
      this.vx = this.speed * this.dir * slow;
      this.facing = this.dir;
      this.moveX(dt, map);
      if (this.vx === 0) this._turn();

      const range = this.typeDef.flyRange != null ? this.typeDef.flyRange : 24;
      const freq = this.typeDef.flyFreq != null ? this.typeDef.flyFreq : 1.2;
      const target = this.baseY + Math.sin(this.animT * freq * Math.PI * 2) * range;
      this.vy = Math.max(-100, Math.min(100, (target - this.y) * 6));
      this.moveY(dt, map);

      if (this._canStart() && this._inRange(world)) this._beginWindup(world);
    } else if (this.attackState === 'windup') {
      this.vx = 0;
      this.vy = 0;
      const p = world.player;
      this.facing = p.cx >= this.cx ? 1 : -1;
      this.aimX = p.cx - this.cx;
      this.aimY = p.cy - this.cy;
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackState = 'active';
        this.attackTimer = a.active != null ? a.active : 0.6;
        const len = Math.hypot(this.aimX, this.aimY) || 1;
        const sp = a.diveSpeed != null ? a.diveSpeed : 320;
        this.vx = (this.aimX / len) * sp;
        this.vy = (this.aimY / len) * sp;
      }
    } else if (this.attackState === 'active') {
      const pvx = this.vx, pvy = this.vy;
      this.attackTimer -= dt;
      this.moveX(dt, map);
      this.moveY(dt, map);
      const hitWall = (this.vx === 0 && pvx !== 0) || (this.vy === 0 && pvy !== 0);
      if (this.attackTimer <= 0 || this.onGround || hitWall) this._beginRecovery();
    } else { // recovery：拉升回巡航高度
      this.attackTimer -= dt;
      this.vx = 0;
      this.vy = -(a.riseSpeed != null ? a.riseSpeed : 90);
      this.moveY(dt, map);
      if (this.y <= this.baseY || this.attackTimer <= 0) {
        this.vy = 0;
        this._endAttack();
      }
    }
  }

  // ================= 工具 =================

  _slow() {
    return this.slowTimer > 0 ? this.slowMul : 1;
  }

  _applyGravity(dt) {
    this.vy += GRAVITY * dt;
    if (this.vy > MAX_FALL) this.vy = MAX_FALL;
  }

  /** 天花板怪：向上找到最近实心/平台块并贴在其底部，记录锚点 baseY */
  _snapToCeiling(map) {
    const ts = map.tileSize;
    const col = Math.floor(this.cx / ts);
    const startRow = Math.floor(this.y / ts);
    for (let r = startRow; r >= 0; r--) {
      if (map.isSolid(col, r) || map.isPlatform(col, r)) {
        this.y = (r + 1) * ts;
        break;
      }
    }
    this.baseY = this.y;
    this.vy = 0;
    this._anchored = true;
  }

  /** 以给定速度向上爬（天花板怪归位）；直接改 y 并夹紧到锚点，避免单向平台不挡向上的问题 */
  _climb(dt, speed) {
    if (this.y > this.baseY) {
      this.y = Math.max(this.baseY, this.y - speed * dt);
    }
    this.vy = 0;
  }

  _turn() {
    this.dir *= -1;
    this.vx = 0;
  }

  /** 施加减速（取更强的倍率、更长的剩余时间） */
  applySlow(mul = 0.5, time = 1.5) {
    this.slowMul = Math.min(this.slowMul, mul);
    this.slowTimer = Math.max(this.slowTimer, time);
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
    this.vx = dir * this.knockback;
    this.vy = -130;
    return true;
  }

  render(renderer) {
    if (this.dead) return;

    // 死亡：淡出
    if (this.hp <= 0) {
      const t = Math.min(1, this.deadTimer / ENEMY.deathTime);
      renderer.drawRect(this.x, this.y - t * 6, this.w, this.h, this.deathColor, 1 - t);
      return;
    }

    // 前摇抖动（提前预警；冲锋怪用颜色高亮代替抖动）
    let ox = 0, oy = 0;
    const winding = this.attackState === 'windup';
    if (winding && this.behavior !== 'charger') {
      const s = Math.sin(this.animT * 42) * 1.5;
      ox = s;
      oy = this.behavior === 'ceiling' ? 0 : s;
    }

    // 配色：受击白闪 > 前摇高亮 > 减速冰蓝 > 本色
    let color = this.slowTimer > 0 ? ENEMY.slowColor : this.color;
    if (winding && this.typeDef.colorCharge) color = this.typeDef.colorCharge;
    if (this.flash > 0) color = '#ffffff';

    const rx = this.x + ox;
    const ry = this.y + oy;
    renderer.drawRect(rx, ry, this.w, this.h, color);

    // 眼睛（指示朝向）
    const ex = this.facing > 0 ? rx + this.w - 5 : rx + 2;
    renderer.drawRect(ex, ry + 4, 3, 3, ENEMY.eye);

    // 前摇/生效中的机制专属提示
    if (this.behavior === 'charger' && (this.attackState === 'windup' || this.attackState === 'active')) {
      const c = this.typeDef.colorCharge || '#fbbf24';
      renderer.drawRect(this.cx - 1, this.y - 5, 2, 4, c, this.attackState === 'active' ? 0.9 : 0.5);
    }
    if (this.behavior === 'shooter') {
      const mx = this.facing > 0 ? rx + this.w : rx - 3;
      const mw = winding ? 4 : 3; // 蓄光时炮口变大
      renderer.drawRect(mx, ry + 4, mw, 3, this.typeDef.attack.projColor || '#67e8f9');
    }
    if (this.behavior === 'ceiling' && winding) {
      // 下坠预警：正下方一段警示
      renderer.drawRect(this.cx - 1, this.y + this.h, 2, 10, this.typeDef.colorCharge || '#fda4af');
    }
    if (this.behavior === 'diver' && winding) {
      // 俯冲预警：指向玩家的方向标
      const len = Math.hypot(this.aimX, this.aimY) || 1;
      renderer.drawRect(this.cx + (this.aimX / len) * 8 - 1, this.cy + (this.aimY / len) * 8 - 1, 3, 3,
        this.typeDef.colorCharge || '#fecdd3');
    }

    // 掉血后显示小血条
    if (this.hp < this.maxHp) {
      renderer.drawRect(this.x, this.y - 4, this.w, 2, '#000000');
      renderer.drawRect(this.x, this.y - 4, this.w * (this.hp / this.maxHp), 2, '#6ee7b7');
    }
  }
}
