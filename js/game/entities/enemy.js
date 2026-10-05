import Entity from './entity';
import { GRAVITY, MAX_FALL, ENEMY } from '../../config/constants';
import { ENEMY_TYPES } from '../../config/enemies';

/**
 * 怪物实体（多类型 + 主动攻击）。
 *
 * 数值 / 配色 / 行为标识 / 攻击块来自 `config/enemies.js` 的 `ENEMY_TYPES`
 * （按 opts.type 选择，缺省 'patrol'）。行为在 update 里按 `behavior` 分派：
 *   patrol / flyer / charger / shooter / jumper / ceiling / diver / emitter / boss
 *
 * 'emitter'（离体攻击发射者）：进入射程 -> 前摇 -> 外放 attack.emit 定义的弹体/伤害区 -> 后摇。
 * 具体形态在 config/enemyAttacks.js 注册表里（吐火 flame / 风刃 windblade / 火球 fireball …）。
 *
 * 'boss'（多阶段 BOSS）：血量跌破阈值 -> 短暂无敌咆哮（阶段切换）-> 换用该阶段的招式表 /
 * 弱点 / 配色继续战斗。招式表循环出招，每招仍是四段状态机，kind 决定生效效果：
 *   lunge 冲撞 / emit 外放离体攻击 / slam 起跳砸地放冲击波。见 config/enemies.js 的 phases。
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
    this._emitTimer = 0;    // emitter：连续喷射（interval>0）的节拍
    this._emitted = false;  // emitter：单发（volley）是否已发射

    // ---- BOSS：多阶段 ----
    this.heavy = !!type.heavy;   // 受击不位移 / 不硬直
    this.invuln = 0;             // 无敌剩余时间（阶段切换时）
    this.phases = type.phases || null;
    this.phaseIndex = 0;
    this.phaseTransition = 0;    // >0 表示正在切换阶段（咆哮）
    this.nextPhase = 0;
    this.moveIndex = 0;          // 当前阶段招式游标
    this._slamming = false;      // slam：是否处于起跳->落地窗口
    if (this.phases && this.phases.length) {
      if (this.phases.length < 2) {
        // 兜底：BOSS 至少两阶段（复制首段并设 50% 阈值）
        this.phases = [this.phases[0], Object.assign({ at: 0.5 }, this.phases[0])];
      }
      const mv0 = (this.phases[0].moves && this.phases[0].moves[0]) || { kind: 'none' };
      this.attack = mv0;
      this.attackKind = mv0.kind;
      if (this.phases[0].weaknesses) this.weaknesses = this.phases[0].weaknesses;
    }

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
    if (this.invuln > 0) this.invuln -= dt;
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
      case 'emitter': this._updateEmitter(dt, world, map); break;
      case 'boss': this._updateBoss(dt, world, map); break;
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

  /**
   * 离体攻击发射者：巡逻 -> 前摇 -> 外放 attack.emit（单发 / 连发 / 多发）-> 后摇。
   * 形态与参数来自 attack 块 + config/enemyAttacks.js；机制与怪物强绑定。
   *   interval > 0：生效期内每隔 interval 秒喷一次（吐火等持续型）
   *   count/spread ：一次喷多发（风刃双发等）
   */
  _updateEmitter(dt, world, map) {
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
      this.facing = p.cx >= this.cx ? 1 : -1; // 前摇期间持续瞄准
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackState = 'active';
        this.attackTimer = a.active != null ? a.active : 0.2;
        this._emitTimer = 0; // 进入生效期立即喷第一发
        this._emitted = false;
      }
    } else if (this.attackState === 'active') {
      this.vx = 0;
      this.attackTimer -= dt;
      const interval = a.interval || 0;
      if (interval > 0) {
        this._emitTimer -= dt;
        if (this._emitTimer <= 0) {
          world.spawnEnemyAttack(this);
          this._emitTimer = interval;
        }
      } else if (!this._emitted) {
        world.spawnEnemyAttack(this);
        this._emitted = true;
      }
      if (this.attackTimer <= 0) this._beginRecovery();
    } else { // recovery
      this.vx = 0;
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) this._endAttack();
    }

    this._applyGravity(dt);
    this.moveY(dt, map);
  }

  // ================= BOSS（多阶段）=================

  /**
   * 多阶段 BOSS 主循环：
   *   1) 正在切换阶段 -> 咆哮（无敌、原地）
   *   2) 血量跌破阈值 -> 进入下一阶段切换
   *   3) 否则按当前阶段的招式表循环出招（每招四段状态机）
   */
  _updateBoss(dt, world, map) {
    const p = world.player;

    // 1) 阶段切换咆哮（全程无敌，不受击）
    if (this.phaseTransition > 0) {
      this.phaseTransition -= dt;
      this.vx = 0;
      this.invuln = Math.max(this.invuln, 0.05);
      this._applyGravity(dt);
      this.moveY(dt, map);
      if (this.phaseTransition <= 0) {
        this._applyPhase(this.nextPhase);
        this.attackState = 'idle';
        this.attackTimer = 0;
        this.attackCd = 0.7;
      }
      return;
    }

    // 2) 血量跌破阈值 -> 触发阶段切换
    const frac = this.maxHp > 0 ? this.hp / this.maxHp : 0;
    const want = this._phaseFor(frac);
    if (want > this.phaseIndex) { this._beginPhaseTransition(want); return; }

    const mv = this.attack;
    const slow = this._slow();

    if (this.attackState === 'idle') {
      // 朝玩家缓慢逼近；到悬崖边停住（不跳崖）
      if (p && p.hp > 0) this.dir = p.cx >= this.cx ? 1 : -1;
      const heldAtLedge = this.onGround && this._wouldFall(map);
      this.facing = this.dir;
      this.vx = heldAtLedge ? 0 : this.speed * this.dir * slow;
      this.moveX(dt, map);
      if (!heldAtLedge && this.vx === 0) this._turn();
      if (this.onGround && this._canStart() && this._inRange(world)) this._beginWindup(world);
    } else if (this.attackState === 'windup') {
      this.vx = 0;
      if (p) this.facing = p.cx >= this.cx ? 1 : -1; // 前摇持续瞄准
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackState = 'active';
        this.attackTimer = mv.active != null ? mv.active : 0.3;
        this._emitTimer = 0;
        this._emitted = false;
        this._startMove(world, mv); // 生效瞬间效果（冲撞冲量 / 起跳 / 首发射击）
      }
    } else if (this.attackState === 'active') {
      this._tickMove(dt, world, map, mv); // 生效期持续效果
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) this._beginRecovery();
    } else { // recovery
      this.vx = 0;
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this._endAttack();
        this.moveIndex += 1;                 // 循环下一招
        this.attack = this._curMove();
        this.attackKind = this.attack.kind;
      }
    }

    this._applyGravity(dt);
    this.moveY(dt, map);
  }

  /** 当前阶段该出的招（循环） */
  _curMove() {
    const ph = this.phases ? this.phases[this.phaseIndex] : null;
    const moves = ph && ph.moves && ph.moves.length ? ph.moves : [{ kind: 'none' }];
    return moves[this.moveIndex % moves.length];
  }

  /** 由血量比例求应处阶段（阈值 at：血量 <= at 即进入该阶段，取最深满足者） */
  _phaseFor(frac) {
    let idx = 0;
    for (let i = 0; i < this.phases.length; i++) {
      const at = this.phases[i].at != null ? this.phases[i].at : (i === 0 ? 1 : 0);
      if (frac <= at) idx = i;
    }
    return idx;
  }

  /** 切换阶段：更新弱点 / 配色 / 速度，并重置招式游标 */
  _applyPhase(i) {
    this.phaseIndex = i;
    const ph = this.phases[i] || {};
    if (ph.weaknesses) this.weaknesses = ph.weaknesses;
    if (ph.color) this.color = ph.color;
    if (ph.speed != null) this.speed = ph.speed;
    this.moveIndex = 0;
    this.attack = this._curMove();
    this.attackKind = this.attack.kind;
  }

  /** 进入阶段切换：短暂无敌咆哮（打断当前招） */
  _beginPhaseTransition(want) {
    this.nextPhase = want;
    const ph = this.phases[want] || {};
    const t = ph.transition != null ? ph.transition : 1.0;
    this.phaseTransition = t;
    this.invuln = Math.max(this.invuln, t + 0.15); // 切换全程无敌
    this.attackState = 'idle';
    this.attackTimer = 0;
    this.attackCd = 0;
    this.vx = 0;
    this.flash = Math.max(this.flash, 0.25);
  }

  /** 招式生效瞬间：冲撞冲量 / 起跳 / 首发离体攻击 */
  _startMove(world, mv) {
    const p = world.player;
    if (mv.kind === 'lunge') {
      if (p) { this.dir = p.cx >= this.cx ? 1 : -1; this.facing = this.dir; }
      this.vx = this.dir * (mv.dashSpeed != null ? mv.dashSpeed : 180);
    } else if (mv.kind === 'slam') {
      this.vy = -(mv.hopSpeedY != null ? mv.hopSpeedY : 220);
      this.onGround = false;
      this._slamming = true;
    } else if (mv.kind === 'emit') {
      world.spawnEnemyAttack(this, mv.emit, mv);
      this._emitted = true;
    }
  }

  /** 招式生效期持续效果（连喷 / 冲撞位移 / 落地放冲击波） */
  _tickMove(dt, world, map, mv) {
    if (mv.kind === 'emit') {
      const interval = mv.interval || 0;
      if (interval > 0) {
        this._emitTimer -= dt;
        if (this._emitTimer <= 0) {
          world.spawnEnemyAttack(this, mv.emit, mv);
          this._emitTimer = interval;
        }
      }
    } else if (mv.kind === 'lunge') {
      this.vx = this.dir * (mv.dashSpeed != null ? mv.dashSpeed : 180);
      this.moveX(dt, map);
      if (this.vx === 0) this.attackTimer = 0; // 撞墙提前结束
    } else if (mv.kind === 'slam') {
      if (this._slamming && this.onGround) {
        world.spawnEnemyAttack(this, mv.emit || 'shockwave', mv); // 落地冲击波
        this._slamming = false;
        this.attackTimer = 0;
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
    if (this.invuln > 0) return false; // BOSS 阶段切换无敌：这一击无效
    this.hp -= dmg;
    this.flash = 0.12;
    if (this.heavy) return true;       // 重型（BOSS）：不位移、不硬直，可反击
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
    if (this.behavior === 'shooter' || this.behavior === 'emitter') {
      const a = this.attack;
      const mc = a.projColor || (a.emit === 'flame' ? '#ff8a3d' : (a.emit === 'windblade' ? '#7ee787' : '#67e8f9'));
      const mx = this.facing > 0 ? rx + this.w : rx - 3;
      const mw = winding ? 4 : 3; // 蓄力时炮口变大
      renderer.drawRect(mx, ry + 4, mw, 3, mc);
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
    if (this.behavior === 'boss') {
      // 阶段切换：外扩预警环
      if (this.phaseTransition > 0) {
        const ph = this.phases[this.nextPhase] || {};
        const total = ph.transition != null ? ph.transition : 1.0;
        const t = 1 - Math.max(0, Math.min(1, this.phaseTransition / total));
        renderer.drawCircle(this.cx, this.cy, this.w * (0.5 + t * 0.9), {
          stroke: this.typeDef.colorCharge || '#f87171', alpha: 0.9 - t * 0.6, lineWidth: 2,
        });
      }
      // 招式前摇提示：冲撞 / 砸地 / 发射
      if (winding) {
        const mv = this.attack;
        const c = this.typeDef.colorCharge || '#fca5a5';
        if (mv.kind === 'lunge') renderer.drawRect(this.cx - 1, this.y - 7, 2, 5, c);
        else if (mv.kind === 'slam') renderer.drawRect(this.x, this.y + this.h + 1, this.w, 2, c);
        else renderer.drawRect(this.facing > 0 ? rx + this.w : rx - 4, ry + this.h * 0.5 - 1, 4, 3, c);
      }
    }

    // 掉血后显示小血条
    if (this.hp < this.maxHp) {
      renderer.drawRect(this.x, this.y - 4, this.w, 2, '#000000');
      renderer.drawRect(this.x, this.y - 4, this.w * (this.hp / this.maxHp), 2, '#6ee7b7');
    }
  }
}
