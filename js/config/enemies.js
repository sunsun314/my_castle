import { ENEMY } from './constants';

/**
 * 怪物类型表（纯数据）。每个类型 = 数值覆盖 + 行为标识 `behavior` + 攻击块 `attack`。
 *
 * 行为（动作逻辑）在 `game/entities/enemy.js` 里按 `behavior` 分派：
 *   'patrol'  地面巡逻（撞墙 / 临崖掉头）——基类默认行为
 *   'flyer'   飞行漂浮（无重力，垂直正弦起伏，撞墙掉头），无主动攻击，仅接触伤害
 *   'charger' 冲锋（侦测到玩家 -> 前摇蓄力 -> 高速冲锋 -> 后摇硬直）
 *   'shooter' 远程（缓慢巡逻，玩家进入射程 -> 前摇蓄光 -> 发射能量弹 -> 后摇）
 *   'jumper'  跳跃（地面滑行，玩家进入射程 -> 蹲伏前摇 -> 扑跳 -> 落地后摇）
 *   'ceiling' 天花板怪（吸附于天花板下方，玩家经过下方 -> 抖动前摇 -> 坠落砸击 -> 爬回）
 *   'diver'   飞行俯冲（空中漂浮，玩家进入射程 -> 悬停前摇 -> 俯冲 -> 拉升后摇）
 *
 * 攻击机制与怪物**强绑定**：每个类型的 `attack.kind` + 各自参数（range/windup/active/recovery…）
 * 由该类型的行为分支独占实现，不做「通用攻击」。
 *
 * 约定：新增一种怪只需在此加一条，并在关卡 `LEVEL1_ENEMY_TYPES` 里引用其 key。
 * 未指定的数值回落到 `constants.ENEMY` 默认值；碰撞攻击统一「普通」类型（见 constants）。
 *
 * attack 字段：
 *   kind      机制标识（'none' 表示无主动攻击）
 *   range     水平触发距离（像素）
 *   vRange    垂直触发容差（像素）
 *   windup    前摇时长（秒，明显加长，给玩家反应窗口）
 *   active    生效时长（秒，各机制含义不同）
 *   recovery  后摇时长（秒，明显加长，是玩家的输出窗口）
 *   cooldown  两次攻击之间的冷却
 *   …各机制专属参数（dashSpeed / proj* / hopSpeed* / dropSpeed / diveSpeed…）
 */
export const ENEMY_TYPES = {
  // —— 基础：地面巡逻兵（无主动攻击，仅接触伤害）——
  patrol: {
    name: '巡逻兵',
    behavior: 'patrol',
    // 沿用 ENEMY 默认（红）
    attack: { kind: 'none' },
  },

  // —— 飞行：游魂（漂浮的接触型威胁，不主动攻击）——
  flyer: {
    name: '游魂',
    behavior: 'flyer',
    w: 14, h: 12,
    hp: 2, contactDamage: 8, exp: 5,
    speed: 34,
    knockback: 60,
    color: '#8b5cf6',
    spawnLift: 34,   // 生成时抬升，悬浮在地面上方
    flyRange: 24,    // 垂直起伏振幅（像素）
    flyFreq: 1.5,    // 每秒起伏频率
    attack: { kind: 'none' },
  },

  // —— 冲锋：冲锋兽（视野内 -> 蓄力冲锋）——
  charger: {
    name: '冲锋兽',
    behavior: 'charger',
    w: 16, h: 16,
    hp: 3, contactDamage: 14, exp: 7,
    speed: 40,
    knockback: 110,
    color: '#f97316',
    colorCharge: '#fbbf24',
    attack: {
      kind: 'charge',
      range: 96, vRange: 30,   // 侦测范围
      windup: 0.75,            // 前摇：停下蓄势（加长，可被躲开）
      active: 0.55,            // 冲锋持续
      recovery: 1.1,           // 后摇：撞停后硬直（加长）
      cooldown: 0.6,
      dashSpeed: 200,
    },
  },

  // —— 远程：巫妖（进入射程 -> 蓄光 -> 发射）——
  shooter: {
    name: '巫妖',
    behavior: 'shooter',
    w: 14, h: 18,
    hp: 2, contactDamage: 8, exp: 8,
    speed: 18,
    knockback: 70,
    color: '#22d3ee',
    attack: {
      kind: 'shoot',
      emit: 'bolt',            // 离体攻击形态（见 config/enemyAttacks.js）
      range: 150, vRange: 44,  // 射程
      windup: 0.7,             // 前摇：蓄光并持续瞄准（加长）
      active: 0.12,            // 发射瞬间
      recovery: 0.85,          // 后摇：僵直（加长）
      cooldown: 0.6,
      projSpeed: 150,          // 覆盖 bolt 默认值
      projDamage: 8,
      projColor: '#67e8f9',
    },
  },

  // —— 跳跃：跳跳蛛（进入射程 -> 蹲伏 -> 扑跳）——
  jumper: {
    name: '跳跳蛛',
    behavior: 'jumper',
    w: 14, h: 14,
    hp: 2, contactDamage: 10, exp: 6,
    speed: 30,
    knockback: 90,
    color: '#a3e635',
    attack: {
      kind: 'lunge',
      range: 116, vRange: 40,
      windup: 0.6,             // 前摇：蹲伏（加长）
      active: 0.9,             // 滞空扑跳
      recovery: 0.8,           // 后摇：落地僵直（加长）
      cooldown: 0.7,
      hopSpeedX: 104,
      hopSpeedY: 268,
    },
  },

  // —— 天花板：吊诡（吸附天花板，守株待兔式砸击）——
  ceiling: {
    name: '吊诡',
    behavior: 'ceiling',
    w: 14, h: 14,
    hp: 3, contactDamage: 12, exp: 8,
    speed: 0,
    knockback: 80,
    color: '#e879f9',
    colorCharge: '#fda4af',
    attach: 'ceiling',       // 吸附于天花板（生成时自动向上找实心/平台并贴住）
    attack: {
      kind: 'drop',
      range: 40, vRange: 150,  // 只打「正下方」经过的玩家
      windup: 0.85,            // 前摇：抖动预警（加长）
      active: 0.75,            // 下落砸击
      recovery: 1.2,           // 后摇：爬回天花板（加长）
      cooldown: 1.0,
      dropSpeed: 300,
      returnSpeed: 70,
    },
  },

  // —— 飞行俯冲：恶鸦（空中漂浮 -> 俯冲扑击）——
  diver: {
    name: '恶鸦',
    behavior: 'diver',
    w: 16, h: 12,
    hp: 3, contactDamage: 14, exp: 9,
    speed: 46,
    knockback: 100,
    color: '#fb7185',
    colorCharge: '#fecdd3',
    spawnLift: 40,
    flyRange: 26,
    flyFreq: 1.2,
    attack: {
      kind: 'dive',
      range: 160, vRange: 96,  // 侦测范围（较广）
      windup: 0.7,             // 前摇：悬停蓄势（加长）
      active: 0.6,             // 俯冲
      recovery: 1.0,           // 后摇：拉升回巡航高度（加长）
      cooldown: 0.9,
      diveSpeed: 320,
      riseSpeed: 90,
    },
  },

  // —— 离体·吐火：炎魔（原地喷出持续伤害火焰区）——
  flamer: {
    name: '炎魔',
    behavior: 'emitter',
    w: 16, h: 18,
    hp: 3, contactDamage: 10, exp: 9,
    speed: 16,
    knockback: 80,
    color: '#ef4444',
    colorCharge: '#fca5a5',
    attack: {
      kind: 'emit',
      emit: 'flame',           // 形态：吐火（持续伤害区）
      range: 84, vRange: 30,
      windup: 0.85,            // 前摇：聚气（加长）
      active: 0.6,             // 生效：持续喷火
      recovery: 1.1,           // 后摇：喘息（加长）
      cooldown: 0.8,
      interval: 0.15,          // 每 0.15s 生成一段火焰区
      offset: { x: 18, y: 0 }, // 枪口在身前
    },
  },

  // —— 离体·风刃：风刃使（正弦飞行、可穿透的双发风刃）——
  blader: {
    name: '风刃使',
    behavior: 'emitter',
    w: 14, h: 18,
    hp: 3, contactDamage: 9, exp: 9,
    speed: 24,
    knockback: 80,
    color: '#22c55e',
    colorCharge: '#86efac',
    attack: {
      kind: 'emit',
      emit: 'windblade',       // 形态：风刃（正弦波动 + 穿透）
      range: 176, vRange: 46,
      windup: 0.7,             // 前摇：结印（加长）
      active: 0.15,            // 生效：掷出
      recovery: 0.9,           // 后摇（加长）
      cooldown: 0.7,
      count: 2, spread: 10,    // 双发风刃
      offset: { x: 14, y: 0 },
    },
  },

  // —— BOSS：多阶段（血量阈值切换招式 / 弱点 / 配色；切换时短暂无敌咆哮）——
  //   phases 至少两段：at=进入该阶段的血量比例；moves 循环出招；
  //   每个 move 复用四段状态机参数，kind 决定生效效果：
  //     'lunge' 冲撞 / 'emit' 外放离体攻击 / 'slam' 砸地（起跳落地放冲击波）
  boss: {
    name: '魔王·阿撒兹',
    behavior: 'boss',
    w: 28, h: 34,
    hp: 60, contactDamage: 16, exp: 200,
    speed: 22,
    knockback: 0,
    heavy: true,              // 受击不位移、不硬直（不会被连击到死）
    color: '#7c3aed',
    colorCharge: '#c4b5fd',
    phases: [
      {
        name: '傲慢', at: 1,
        transition: 1.0, invuln: 1.2, speed: 22, color: '#7c3aed',
        weaknesses: [{ kind: 'element', value: 'light' }],
        moves: [
          { kind: 'lunge', windup: 0.7, active: 0.5, recovery: 1.0, cooldown: 0.7,
            range: 120, vRange: 40, dashSpeed: 190 },
          { kind: 'emit', emit: 'fireball', count: 3, spread: 12, offset: { x: 16, y: -4 },
            windup: 0.75, active: 0.15, recovery: 0.95, cooldown: 0.6, range: 180, vRange: 60 },
        ],
      },
      {
        name: '狂暴', at: 0.5,
        transition: 1.2, invuln: 1.4, speed: 34, color: '#dc2626',
        weaknesses: [{ kind: 'element', value: 'dark' }],
        moves: [
          { kind: 'emit', emit: 'flame', interval: 0.12, offset: { x: 20, y: 0 },
            windup: 0.7, active: 0.8, recovery: 1.0, cooldown: 0.6, range: 110, vRange: 40 },
          { kind: 'slam', emit: 'shockwave',
            windup: 0.8, active: 0.5, recovery: 1.1, cooldown: 0.8, range: 96, vRange: 60, hopSpeedY: 240 },
          { kind: 'lunge', windup: 0.55, active: 0.6, recovery: 0.8, cooldown: 0.5,
            range: 160, vRange: 44, dashSpeed: 260 },
        ],
      },
    ],
  },
};

/** 类型 key -> 定义（含默认回落），供 world 生成时取尺寸等 */
export function enemyTypeDef(key) {
  return ENEMY_TYPES[key] || ENEMY_TYPES.patrol;
}

/** 供外部（world）在不知道尺寸时取默认值 */
export const ENEMY_DEFAULT = ENEMY;
