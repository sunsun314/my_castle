import Entity from './entity';
import { GRAVITY, MAX_FALL, PLAYER, MAGIC, TRANSFORM, PROGRESSION, COLORS } from '../../config/constants';
import { computeStats } from '../stats';
import { resolveDamage, DamageKind } from '../damage';
import BuffList from '../buffs';
import { ITEMS } from '../../config/items';

// 玩家状态机（骨架先覆盖地面/空中/攻击/下蹲，后续扩展 dash/wallSlide 等）
export const PlayerState = {
  IDLE: 'idle',
  RUN: 'run',
  JUMP: 'jump',
  FALL: 'fall',
  ATTACK: 'attack',
  CROUCH: 'crouch',
  DEMON: 'demon',   // 魔法魔神形态
  DASH: 'dash',     // 突进魔神形态
  HURT: 'hurt',
  DEAD: 'dead',
};

const AIR_INPUT = PLAYER.airControl;

export default class Player extends Entity {
  constructor(x, y) {
    super(x, y, PLAYER.w, PLAYER.h);

    // ---- 属性来源（基础值由等级推导；结果只做缓存）----
    this.level = 1;
    this.exp = 0;
    this.abilities = { doubleJump: true, bigJump: true, magic: true, transform: true, dash: false };
    this.equipment = { weapon: null, armor: null, ring: null, subweapon: null };
    this.inventory = [];        // 背包：拥有但未装备的物品
    this.buffs = new BuffList();
    this._seedStartingGear();

    this.stats = { maxHp: 1, maxMp: 0, atk: 0, def: 0, mag: 0 };
    this.recomputeStats();

    this.hp = this.stats.maxHp;
    this.mp = this.stats.maxMp;

    this.spawnX = x;
    this.spawnY = y;

    this.state = PlayerState.IDLE;
    this.coyote = 0;            // 剩余土狼时间
    this.jumpBuffer = 0;        // 剩余跳跃缓冲时间
    this.jumpBufferBig = false; // 缓冲的这一次跳是否为「上+跳」大跳
    this.airJumpsLeft = 0;      // 剩余空中跳次数
    this._jumpCut = true;       // 当前这次跳是否允许松手截断（大跳不截断）
    this.attackTimer = 0;       // 攻击判定持续时间（近战时 = 当前武器生效时间）
    this.attackId = 0;          // 挥砍序号，用于「每刀只结算一次」
    this.meleeActive = false;   // 本次攻击是否为近战（魔法时关闭近战判定）
    this.crouching = false;     // 是否处于下蹲（碰撞体高度减半 = 受击范围减半）
    this.magicCd = 0;           // 副武器施法冷却
    this.invuln = 0;            // 剩余无敌时间
    this.lastDamageApplied = 0; // 最近一次实际扣减量（供伤害飘字读取）

    // ---- 变身（魔神）----
    this.demonMode = null;      // null | 'mage'（上+变身）| 'dash'（长按突进）
    this.demonCd = 0;           // 变身冷却
    this.demonDashTimer = 0;    // 突进剩余时间
    this.demonInvuln = false;   // 突进中无敌
    this.dashId = 0;            // 突进序号（同一突进对同一敌人只结算一次）
    this._transformHold = 0;    // 变身键按住时长（长按判定）
  }

  // ================= 属性系统 =================

  /** 等级 -> 基础值（装备/buff 之外的部分） */
  _baseForLevel(level) {
    const b = PLAYER.base;
    const g = PLAYER.growth;
    const n = level - 1;
    return {
      maxHp: b.maxHp + g.maxHp * n,
      maxMp: b.maxMp + g.maxMp * n,
      atk: b.atk + g.atk * n,
      def: b.def + g.def * n,
      mag: b.mag + g.mag * n,
    };
  }

  /** 重算最终属性（来源变化时调用；只缓存结果） */
  recomputeStats() {
    const base = this._baseForLevel(this.level);
    this.stats = computeStats(base, this.equipment, this.buffs.list);
    if (Number.isFinite(this.hp)) this.hp = Math.min(this.hp, this.stats.maxHp);
    if (Number.isFinite(this.mp)) this.mp = Math.min(this.mp, this.stats.maxMp);
  }

  /**
   * 对比预览：返回「把该物品装上 / 使用后」的最终属性，**不改变任何状态**。
   * 装备：把物品放进它自己的槽位（同栏已有则视为替换）后再算一次；
   * 增益药水：若该 buff 已在生效则视为刷新（属性不变），否则临时加一份再算。
   * 返回 null 表示该物品不产生属性影响。
   */
  previewStats(item) {
    if (!item) return null;
    const base = this._baseForLevel(this.level);
    if (item.slot) {
      const equipment = Object.assign({}, this.equipment);
      equipment[item.slot] = item;
      return computeStats(base, equipment, this.buffs.list);
    }
    if (item.type === 'buff') {
      const active = this.buffs.list.some((b) => b.id === item.id);
      const buffs = active ? this.buffs.list : this.buffs.list.concat([{ flat: item.flat, mul: item.mul }]);
      return computeStats(base, this.equipment, buffs);
    }
    return null;
  }

  // ================= 背包与装备 =================

  /** 初始赠送：一进游戏背包里就有可换装的物品，便于体验装备机制 */
  _seedStartingGear() {
    this.addItem(ITEMS.dagger);
    this.addItem(ITEMS.iron_sword);
    this.addItem(ITEMS.flame_blade);
    this.addItem(ITEMS.frost_spear);
    this.addItem(ITEMS.thunder_maul);
    this.addItem(ITEMS.leather_armor);
    this.addItem(ITEMS.mage_ring);
    this.addItem(ITEMS.ember_tome);
    this.addItem(ITEMS.frost_tome);
    this.addItem(ITEMS.gale_tome);
    this.addItem(ITEMS.power_potion);
  }

  /** 背包：拥有但未装备的物品 */
  addItem(item) {
    if (item) this.inventory.push(item);
    return item;
  }

  removeItem(item) {
    const i = this.inventory.indexOf(item);
    if (i >= 0) { this.inventory.splice(i, 1); return true; }
    return false;
  }

  /** 装备：换下的旧装备自动放回背包 */
  equip(item) {
    if (!item || !item.slot) return false;
    const prev = this.equipment[item.slot];
    if (prev && prev !== item) this.inventory.push(prev);
    this.removeItem(item);
    this.equipment[item.slot] = item;
    this.recomputeStats();
    return true;
  }

  /** 卸下槽位装备，放回背包 */
  unequip(slot) {
    const it = this.equipment[slot];
    if (!it) return false;
    this.equipment[slot] = null;
    this.inventory.push(it);
    this.recomputeStats();
    return true;
  }

  /** 使用背包物品：装备走 equip；限时药水则消耗并施加 buff */
  useItem(item) {
    if (!item) return false;
    if (item.type === 'buff') {
      this.removeItem(item);
      this.addBuff({
        id: item.id, name: item.name, time: item.time,
        flat: item.flat, mul: item.mul, color: item.color,
      });
      return true;
    }
    if (item.slot) return this.equip(item);
    return false;
  }

  addBuff(def) {
    this.buffs.add(def);
    this.recomputeStats();
  }

  /** 升到下一级所需经验 */
  expToNext() {
    const n = this.level - 1;
    return Math.floor(PROGRESSION.expBase + n * n * PROGRESSION.expExp);
  }

  /** 获得经验；返回是否升级 */
  gainExp(n) {
    this.exp += n;
    let leveled = false;
    while (this.exp >= this.expToNext()) {
      this.exp -= this.expToNext();
      this.level += 1;
      leveled = true;
    }
    if (leveled) {
      this.recomputeStats();
      this.hp = this.stats.maxHp;
      this.mp = this.stats.maxMp;
    }
    return leveled;
  }

  // ================= 更新 =================

  update(dt, world) {
    const input = world.input;
    const map = world.map;

    // ---- 计时器 ----
    if (this.invuln > 0) this.invuln -= dt;
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.magicCd > 0) this.magicCd -= dt;
    if (this.dropThrough > 0) this.dropThrough -= dt;
    if (this.demonCd > 0) this.demonCd -= dt;
    this.jumpBuffer -= dt;

    // ---- Buff 倒计时（过期则重算属性）+ 魔力回复 ----
    this.buffs.update(dt);
    if (this.buffs.consumeDirty()) this.recomputeStats();
    if (this.stats.maxMp > 0 && this.mp < this.stats.maxMp) {
      this.mp = Math.min(this.stats.maxMp, this.mp + PLAYER.mpRegen * dt);
    }

    // ---- 变身（魔神）：形态持续耗蓝 / 突进计时 / 输入判定 ----
    if (this.demonMode === 'mage') {
      this.mp -= TRANSFORM.drain * dt;
      if (this.mp <= 0) { this.mp = 0; this._endDemon(); }
    } else if (this.demonMode === 'dash') {
      this.demonDashTimer -= dt;
      if (this.demonDashTimer <= 0) this._endDemon();
    }
    this._updateTransform(dt, input);

    // ---- 落地/离地：土狼时间、二段跳次数、可变跳截断 ----
    if (this.onGround) {
      this.coyote = PLAYER.coyote;
      this.airJumpsLeft = this.abilities.doubleJump ? 1 : 0;
      this._jumpCut = true;
    } else {
      this.coyote -= dt;
    }

    // 「近战生效时间」：武器攻击判定存续期间锁定跳跃与移动（不能以此打断），
    // 只有副武器（上+B 魔法）能打断它；生效时长随武器不同。
    const meleeActive = this.meleeActive && this.attackTimer > 0;

    // ---- 下蹲：地面 + 摇杆「正下 ±30° 锥」时触发 ----
    // 碰撞体高度减半（受击盒减半）；脚底位置不变、顶部下沉；站起前检查头顶空间。
    if (this.onGround && input.downward) {
      this._setCrouch(true);
    } else if (this.crouching && this._canStand(map)) {
      this._setCrouch(false);
    }

    // ---- 下蹲 + 跳：从单向平台向下穿越（下蹲时按跳 = 下穿，而非起跳）----
    if (this.crouching && input.pressed('jump') && this._onPlatform(map)) {
      this._startDropThrough();
    }

    // ---- 水平输入（生效时间内忽略移动输入，攻击不可被移动取消）----
    const dashing = this.demonMode === 'dash';
    if (dashing) {
      // 突进魔神：锁定朝向、持续向前猛冲（撞墙仍由 moveX 处理）
      this.vx = this.facing * TRANSFORM.dashSpeed;
      this.vy = 0;
    } else {
      const ax = meleeActive ? 0 : input.axisX;
      const control = this.onGround ? 1 : AIR_INPUT;
      if (Math.abs(ax) > 0.01) {
        this.vx = ax * PLAYER.moveSpeed;
        this.facing = ax > 0 ? 1 : -1;
      } else {
        const drop = PLAYER.friction * control * dt;
        if (this.vx > 0) this.vx = Math.max(0, this.vx - drop);
        else if (this.vx < 0) this.vx = Math.min(0, this.vx + drop);
      }
    }

    // ---- 跳跃：按下瞬间采样「是否上+跳」（大跳变体）----
    // 生效时间内跳跃被锁定：不采样、不执行（已有缓冲也不消耗）；下蹲时也不能跳。
    if (!dashing && !meleeActive && !this.crouching && input.pressed('jump')) {
      this.jumpBuffer = PLAYER.jumpBuffer;
      this.jumpBufferBig = input.up;
    }
    if (!dashing && !meleeActive && !this.crouching && this.jumpBuffer > 0) {
      if (this.coyote > 0) {
        // 地面/土狼时间：普通跳 或 大跳（需能力 + 魔力足够）
        const canBig = this.jumpBufferBig && this.abilities.bigJump
          && (PLAYER.bigJumpMp <= 0 || this.mp >= PLAYER.bigJumpMp);
        if (canBig && PLAYER.bigJumpMp > 0) this.mp -= PLAYER.bigJumpMp;
        this._doJump(canBig ? PLAYER.bigJumpMul : 1, !canBig);
        this.jumpBuffer = 0;
      } else if (this.abilities.doubleJump && this.airJumpsLeft > 0) {
        // 空中二段跳（大跳不在此触发，避免能力叠加飞出关卡）
        this.airJumpsLeft -= 1;
        this._doJump(PLAYER.airJumpMul, true);
        this.jumpBuffer = 0;
      }
    }

    // 上升中松开跳跃键 -> 额外重力（大跳不截断）；突进期间不受重力
    const jumpHeld = input.down('jump');
    let gravity = dashing ? 0 : GRAVITY;
    if (!dashing && this._jumpCut && !jumpHeld && this.vy < 0) gravity *= PLAYER.jumpCut;

    // ---- 攻击：B = 近战；上+B = 副武器魔法（消耗 MP，伤害走 mag）----
    // 副武器可在近战「生效时间」内打断并取消其判定；反向（近战打断魔法）不允许。
    // 下蹲不影响攻击：仍可发动普通攻击（攻击盒会随身体一起下沉）。
    if (!dashing && input.pressed('attack')) {
      const magicProf = this.getMagicProfile();
      const wantMagic = input.up && this.abilities.magic
        && this.magicCd <= 0 && this.mp >= magicProf.cost;
      if (wantMagic && (this.attackTimer <= 0 || meleeActive)) {
        this.mp -= magicProf.cost;
        this.magicCd = magicProf.cooldown;
        this.attackTimer = PLAYER.attackDuration;
        this.meleeActive = false;          // 取消近战判定 = 打断
        world.spawnMagic(this);
      } else if (this.attackTimer <= 0) {
        // 近战：生效时长跟随武器（不同武器出手/判定时间不同）
        this.attackTimer = this.getAttackProfile().duration;
        this.attackId += 1;
        this.meleeActive = true;
      }
    }

    // ---- 位移与地形碰撞 ----
    this.vy += gravity * dt;
    if (this.vy > MAX_FALL) this.vy = MAX_FALL;
    this.moveX(dt, map);
    this.moveY(dt, map);

    // ---- 危险判定 ----
    // 尖刺：固定扣减最大生命的百分比（无视防御），受无敌帧保护
    if (!this.isInvincible() && this._touchingHazard(map)) {
      const hx = this.cx, hy = this.y;
      if (this.hurtBySpike()) world.spawnPlayerDamage(hx, hy, this.lastDamageApplied);
    }
    // 坠出地图：不扣血，仅复位回出生点
    if (this.y > map.pixelHeight + 48) this.fallOut();

    this._updateState();
  }

  // ================= 下蹲 =================

  /**
   * 切换下蹲：保持脚底（bottom）不变，只改顶部与高度。
   * 下蹲 -> 高度减半（受击盒减半）；站起 -> 恢复（调用方需先用 _canStand 检查头顶）。
   */
  _setCrouch(on) {
    if (on === this.crouching) return;
    const dh = PLAYER.h - PLAYER.crouchH;
    if (on) {
      this.y += dh;
      this.h = PLAYER.crouchH;
      this.crouching = true;
    } else {
      this.y -= dh;
      this.h = PLAYER.h;
      this.crouching = false;
    }
  }

  /** 头顶是否有足够空间站起（探测站起后新增的那段高度所在的瓦片行） */
  _canStand(map) {
    const dh = PLAYER.h - PLAYER.crouchH;
    const ts = map.tileSize;
    const newTop = this.y - dh;
    const c0 = Math.floor(this.x / ts);
    const c1 = Math.floor((this.x + this.w - 1) / ts);
    const rTop = Math.floor(newTop / ts);
    const rBot = Math.floor((this.y - 1) / ts);
    for (let r = rTop; r <= rBot; r++) {
      for (let c = c0; c <= c1; c++) {
        if (map.isSolid(c, r)) return false;
      }
    }
    return true;
  }

  /** 脚底是否正好踩在单向平台上（供「下蹲跳下穿」判断） */
  _onPlatform(map) {
    if (!this.onGround) return false;
    const ts = map.tileSize;
    const row = Math.floor((this.y + this.h) / ts);
    const c0 = Math.floor(this.x / ts);
    const c1 = Math.floor((this.x + this.w - 1) / ts);
    for (let c = c0; c <= c1; c++) {
      if (map.isPlatform(c, row) && !map.isSolid(c, row)) return true;
    }
    return false;
  }

  /** 触发下穿：短暂忽略单向平台 + 给一个向下初速度，脱离平台后自然下落 */
  _startDropThrough() {
    this.dropThrough = PLAYER.dropThroughTime;
    this.vy = Math.max(this.vy, PLAYER.dropThroughSpeed);
    this.onGround = false;
    this.coyote = 0;
    this._jumpCut = true;
  }

  _doJump(mul = 1, cut = true) {
    this.vy = -PLAYER.jumpSpeed * mul;
    this.coyote = 0;
    this.onGround = false;
    this._jumpCut = cut;
  }

  // ================= 变身（魔神）=================

  /**
   * 变身输入：
   *  - 上 + 变身（按下瞬间）：立即进入魔法魔神；
   *  - 长按变身（超过 holdTime）：进入突进魔神。
   * 两种形态互斥，需冷却结束且魔力足够。
   */
  _updateTransform(dt, input) {
    const held = input.down('transform');
    if (!this.abilities.transform || this.demonMode !== null) {
      if (!held) this._transformHold = 0;
      return;
    }
    if (input.pressed('transform')) {
      this._transformHold = 0;
      if (input.up && this.demonCd <= 0 && this.mp >= TRANSFORM.cost) {
        this._startMage();
        return;
      }
    } else if (held) {
      this._transformHold += dt;
      if (this._transformHold >= TRANSFORM.holdTime && this.demonCd <= 0 && this.mp >= TRANSFORM.dashCost) {
        this._startDash();
        return;
      }
    }
    if (!held) this._transformHold = 0;
  }

  /** 上 + 变身：魔法魔神（普攻改写为普通攻击、伤害随魔法强度、持续耗蓝） */
  _startMage() {
    this.mp -= TRANSFORM.cost;
    this.demonMode = 'mage';
    this.demonInvuln = false;
    this.demonDashTimer = 0;
    this._standUp();
    this.attackTimer = 0;
    this.meleeActive = false;
  }

  /** 长按变身：突进魔神（锁定朝向前冲、期间无敌、撞怪巨额伤害） */
  _startDash() {
    this.mp -= TRANSFORM.dashCost;
    this.demonMode = 'dash';
    this.demonDashTimer = TRANSFORM.dashDuration;
    this.demonInvuln = true;
    this.dashId += 1;
    this._standUp();
    this.attackTimer = 0;
    this.meleeActive = false;
    this.vx = this.facing * TRANSFORM.dashSpeed;
    this.vy = 0;
  }

  /** 结束魔神形态并进入冷却 */
  _endDemon() {
    if (this.demonMode === null) return;
    this._clearDemon();
    this.demonCd = TRANSFORM.cooldown;
  }

  /** 清除魔神形态（不进入冷却，供复活/坠落复位使用） */
  _clearDemon() {
    this.demonMode = null;
    this.demonDashTimer = 0;
    this.demonInvuln = false;
    this._transformHold = 0;
  }

  /** 取消下蹲并恢复站立高度（变身时用，脚底位置不变） */
  _standUp() {
    if (!this.crouching) return;
    this.y -= PLAYER.h - PLAYER.crouchH;
    this.h = PLAYER.h;
    this.crouching = false;
  }

  /** 是否无敌（受击无敌帧 或 突进魔神） */
  isInvincible() {
    return this.invuln > 0 || this.demonInvuln;
  }

  _updateState() {
    if (this.hp <= 0) {
      this.state = PlayerState.DEAD;
    } else if (this.demonMode === 'dash') {
      this.state = PlayerState.DASH;
    } else if (this.demonMode === 'mage') {
      this.state = PlayerState.DEMON;
    } else if (this.invuln > 0) {
      this.state = PlayerState.HURT;
    } else if (this.attackTimer > 0 && this.onGround) {
      this.state = PlayerState.ATTACK;
    } else if (this.crouching) {
      this.state = PlayerState.CROUCH;
    } else if (!this.onGround) {
      this.state = this.vy < 0 ? PlayerState.JUMP : PlayerState.FALL;
    } else if (Math.abs(this.vx) > 5) {
      this.state = PlayerState.RUN;
    } else {
      this.state = PlayerState.IDLE;
    }
  }

  _touchingHazard(map) {
    const ts = map.tileSize;
    const c0 = Math.floor(this.x / ts);
    const c1 = Math.floor((this.x + this.w - 1) / ts);
    const r0 = Math.floor(this.y / ts);
    const r1 = Math.floor((this.y + this.h - 1) / ts);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (map.isHazard(c, r)) return true;
      }
    }
    return false;
  }

  /**
   * 当前攻击参数：攻击范围 / 高度 / 生效时长（抬手）「跟着武器走」。
   * 装备了带 attack 的武器就用它的；否则回落到空手默认值（PLAYER.attack*）。
   */
  getAttackProfile() {
    // 魔法魔神形态：普攻改写为「普通」类型，范围/时长走变身参数
    if (this.demonMode === 'mage') {
      return {
        reach: TRANSFORM.attackReach,
        height: TRANSFORM.attackHeight,
        duration: TRANSFORM.attackDuration,
        element: TRANSFORM.element,
        attackType: TRANSFORM.attackType,
      };
    }
    const w = this.equipment.weapon;
    const a = (w && w.attack) || null;
    return {
      reach: a && a.reach != null ? a.reach : PLAYER.attackReach,
      height: a && a.height != null ? a.height : PLAYER.attackHeight,
      duration: a && a.duration != null ? a.duration : PLAYER.attackDuration,
      // 战斗属性跟随武器；空手 = 普通攻击、无属性
      element: w && w.element != null ? w.element : null,
      attackType: w && w.attackType ? w.attackType : PLAYER.attackType,
    };
  }

  /** 当前普攻伤害：魔法魔神 = 魔法强度 × attackMul；否则 = 攻击力 */
  getAttackDamage() {
    if (this.demonMode === 'mage') return Math.round(this.stats.mag * TRANSFORM.attackMul);
    return this.stats.atk;
  }

  /** 突进魔神撞怪伤害（巨额，随魔法强度上升） */
  getDashDamage() {
    return Math.round(this.stats.mag * TRANSFORM.dashDamageMul);
  }

  /**
   * 副武器（魔法弹）的战斗属性：默认光属性 / 普通类型，可被戒指的 element 覆盖。
   */
  getMagicProfile() {
    const sw = this.equipment.subweapon;
    const ring = this.equipment.ring;
    const m = (sw && sw.magic) || {};
    // 属性优先级：副武器 > 戒指（保留旧的元素戒指覆盖路径）> 默认光
    const element = (sw && sw.element != null)
      ? sw.element
      : (ring && ring.element ? ring.element : MAGIC.element);
    return {
      element,
      attackType: (sw && sw.attackType) ? sw.attackType : MAGIC.attackType,
      cost: m.cost != null ? m.cost : MAGIC.cost,
      cooldown: m.cooldown != null ? m.cooldown : MAGIC.cooldown,
      speed: m.speed != null ? m.speed : MAGIC.speed,
      life: m.life != null ? m.life : MAGIC.life,
      w: m.w != null ? m.w : MAGIC.w,
      h: m.h != null ? m.h : MAGIC.h,
      color: m.color != null ? m.color : MAGIC.color,
      behavior: m.behavior != null ? m.behavior : MAGIC.behavior,
      pierce: m.pierce != null ? m.pierce : MAGIC.pierce,
      burstRadius: m.burstRadius != null ? m.burstRadius : MAGIC.burstRadius,
      burstMul: m.burstMul != null ? m.burstMul : MAGIC.burstMul,
      slowMul: m.slowMul != null ? m.slowMul : MAGIC.slowMul,
      slowTime: m.slowTime != null ? m.slowTime : MAGIC.slowTime,
      chainCount: m.chainCount != null ? m.chainCount : MAGIC.chainCount,
      chainRange: m.chainRange != null ? m.chainRange : MAGIC.chainRange,
      chainMul: m.chainMul != null ? m.chainMul : MAGIC.chainMul,
    };
  }

  /** 攻击判定盒（世界坐标）：范围取自当前武器 */
  getAttackHitbox() {
    const prof = this.getAttackProfile();
    const reach = prof.reach;
    const hh = prof.height;
    const x = this.facing > 0 ? this.x + this.w : this.x - reach;
    // 判定盒竖直方向跟随当前身体：下蹲时身体变矮、顶部下沉，攻击盒随之整体下沉
    const y = this.y + (this.h - hh) / 2;
    return { x, y, w: reach, h: hh };
  }

  // ================= 受伤（按机制区分扣减规则）=================

  /**
   * 受击通用处理：无敌帧判定 + 扣血 + 击退。
   * @param {number} final 已经算好的扣减量
   * @param {object} opts { force 无视无敌帧, knockback 是否击退, invuln 自定义无敌时长 }
   * @returns {boolean} 本次是否真正生效
   */
  _applyDamage(final, opts = {}) {
    if (final <= 0) return false;
    if ((this.invuln > 0 || this.demonInvuln) && !opts.force) return false;

    this.hp -= final;
    this.lastDamageApplied = final;
    if (this.hp <= 0) {
      this.respawn();
      return true;
    }
    this.invuln = opts.invuln != null ? opts.invuln : PLAYER.invulnTime;
    if (opts.knockback !== false) {
      const dir = opts.knockbackDir != null ? opts.knockbackDir : -this.facing;
      this.vy = -180;
      this.vx = dir * 120;
    }
    return true;
  }

  /** 机制①：敌人接触伤害——原始伤害经「防御」减伤（击退方向远离来源） */
  hurtByContact(raw, fromX = this.cx) {
    const final = resolveDamage(DamageKind.CONTACT, { raw, def: this.stats.def });
    const dir = this.cx >= fromX ? 1 : -1;
    return this._applyDamage(final, { knockback: true, knockbackDir: dir });
  }

  /** 机制②：尖刺陷阱——无视防御，固定扣除最大生命的一定百分比 */
  hurtBySpike() {
    const final = resolveDamage(DamageKind.SPIKE, { maxHp: this.stats.maxHp });
    return this._applyDamage(final, { knockback: true });
  }

  /** 机制③：坠出地图——不扣血，仅复位到出生点（保留当前 HP/MP） */
  fallOut() {
    this._clearDemon();
    this.crouching = false;
    this.h = PLAYER.h;
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.invuln = PLAYER.invulnTime;
    return true;
  }

  respawn() {
    this._clearDemon();
    this.crouching = false;
    this.h = PLAYER.h;
    this.hp = this.stats.maxHp;
    this.mp = this.stats.maxMp;
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.invuln = 1.5;
  }

  render(renderer) {
    // 无敌期间闪烁（突进魔神保持可见，不闪烁）
    if (this.invuln > 0 && !this.demonInvuln && Math.floor(this.invuln * 20) % 2 === 0) return;

    // 魔神形态：换色 + 外发光光环
    const demonColor = this.demonMode === 'dash' ? TRANSFORM.colorDash
      : (this.demonMode === 'mage' ? TRANSFORM.colorMage : null);
    if (demonColor) {
      renderer.drawRect(this.x - 2, this.y - 2, this.w + 4, this.h + 4, demonColor, 0.28);
    }
    renderer.drawRect(this.x, this.y, this.w, this.h, demonColor || COLORS.player);

    // 朝向标记（眼睛）
    const ex = this.facing > 0 ? this.x + this.w - 6 : this.x + 3;
    renderer.drawRect(ex, this.y + 5, 3, 3, COLORS.playerFace);

    // 近战攻击判定盒可视化（魔法弹自身可见，不画此盒）
    if (this.attackTimer > 0 && this.meleeActive) {
      const hb = this.getAttackHitbox();
      renderer.drawRect(hb.x, hb.y, hb.w, hb.h, COLORS.attack, 0.55);
    }
  }
}
