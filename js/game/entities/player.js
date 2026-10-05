import Entity from './entity';
import { GRAVITY, MAX_FALL, PLAYER, MAGIC, PROGRESSION, COLORS } from '../../config/constants';
import { computeStats } from '../stats';
import { resolveDamage, DamageKind } from '../damage';
import BuffList from '../buffs';
import { ITEMS } from '../../config/items';

// 玩家状态机（骨架先覆盖地面/空中/攻击，后续扩展 dash/wallSlide 等）
export const PlayerState = {
  IDLE: 'idle',
  RUN: 'run',
  JUMP: 'jump',
  FALL: 'fall',
  ATTACK: 'attack',
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
    this.abilities = { doubleJump: true, bigJump: true, magic: true, dash: false };
    this.equipment = { weapon: null, armor: null, ring: null };
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
    this.attackTimer = 0;       // 攻击判定持续时间
    this.attackId = 0;          // 挥砍序号，用于「每刀只结算一次」
    this.meleeActive = false;   // 本次攻击是否为近战（魔法时关闭近战判定）
    this.magicCd = 0;           // 副武器施法冷却
    this.invuln = 0;            // 剩余无敌时间
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

  // ================= 背包与装备 =================

  /** 初始赠送：一进游戏背包里就有可换装的物品，便于体验装备机制 */
  _seedStartingGear() {
    this.addItem(ITEMS.iron_sword);
    this.addItem(ITEMS.leather_armor);
    this.addItem(ITEMS.mage_ring);
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
    this.jumpBuffer -= dt;

    // ---- Buff 倒计时（过期则重算属性）+ 魔力回复 ----
    this.buffs.update(dt);
    if (this.buffs.consumeDirty()) this.recomputeStats();
    if (this.stats.maxMp > 0 && this.mp < this.stats.maxMp) {
      this.mp = Math.min(this.stats.maxMp, this.mp + PLAYER.mpRegen * dt);
    }

    // ---- 落地/离地：土狼时间、二段跳次数、可变跳截断 ----
    if (this.onGround) {
      this.coyote = PLAYER.coyote;
      this.airJumpsLeft = this.abilities.doubleJump ? 1 : 0;
      this._jumpCut = true;
    } else {
      this.coyote -= dt;
    }

    // ---- 水平输入 ----
    const ax = input.axisX;
    const control = this.onGround ? 1 : AIR_INPUT;
    if (Math.abs(ax) > 0.01) {
      this.vx = ax * PLAYER.moveSpeed;
      this.facing = ax > 0 ? 1 : -1;
    } else {
      const drop = PLAYER.friction * control * dt;
      if (this.vx > 0) this.vx = Math.max(0, this.vx - drop);
      else if (this.vx < 0) this.vx = Math.min(0, this.vx + drop);
    }

    // ---- 跳跃：按下瞬间采样「是否上+跳」（大跳变体）----
    if (input.pressed('jump')) {
      this.jumpBuffer = PLAYER.jumpBuffer;
      this.jumpBufferBig = input.up;
    }
    if (this.jumpBuffer > 0) {
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

    // 上升中松开跳跃键 -> 额外重力（大跳不截断）
    const jumpHeld = input.down('jump');
    let gravity = GRAVITY;
    if (this._jumpCut && !jumpHeld && this.vy < 0) gravity *= PLAYER.jumpCut;

    // ---- 攻击：B = 近战；上+B = 副武器魔法（消耗 MP，伤害走 mag）----
    if (input.pressed('attack') && this.attackTimer <= 0) {
      const wantMagic = input.up && this.abilities.magic
        && this.magicCd <= 0 && this.mp >= MAGIC.cost;
      if (wantMagic) {
        this.mp -= MAGIC.cost;
        this.magicCd = MAGIC.cooldown;
        this.attackTimer = PLAYER.attackDuration;
        this.meleeActive = false;
        world.spawnMagic(this);
      } else {
        this.attackTimer = PLAYER.attackDuration;
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
    if (this.invuln <= 0 && this._touchingHazard(map)) this.hurtBySpike();
    // 坠出地图：不扣血，仅复位回出生点
    if (this.y > map.pixelHeight + 48) this.fallOut();

    this._updateState();
  }

  _doJump(mul = 1, cut = true) {
    this.vy = -PLAYER.jumpSpeed * mul;
    this.coyote = 0;
    this.onGround = false;
    this._jumpCut = cut;
  }

  _updateState() {
    if (this.hp <= 0) {
      this.state = PlayerState.DEAD;
    } else if (this.invuln > 0) {
      this.state = PlayerState.HURT;
    } else if (this.attackTimer > 0 && this.onGround) {
      this.state = PlayerState.ATTACK;
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

  /** 攻击判定盒（世界坐标） */
  getAttackHitbox() {
    const reach = PLAYER.attackReach;
    const hh = PLAYER.attackHeight;
    const x = this.facing > 0 ? this.x + this.w : this.x - reach;
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
    if (this.invuln > 0 && !opts.force) return false;

    this.hp -= final;
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
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.invuln = PLAYER.invulnTime;
    return true;
  }

  respawn() {
    this.hp = this.stats.maxHp;
    this.mp = this.stats.maxMp;
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.invuln = 1.5;
  }

  render(renderer) {
    // 无敌期间闪烁
    if (this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0) return;

    renderer.drawRect(this.x, this.y, this.w, this.h, COLORS.player);

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
