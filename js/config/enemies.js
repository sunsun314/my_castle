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
      range: 150, vRange: 44,  // 射程
      windup: 0.7,             // 前摇：蓄光并持续瞄准（加长）
      active: 0.12,            // 发射瞬间
      recovery: 0.85,          // 后摇：僵直（加长）
      cooldown: 0.6,
      projSpeed: 150,
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
};

/** 类型 key -> 定义（含默认回落），供 world 生成时取尺寸等 */
export function enemyTypeDef(key) {
  return ENEMY_TYPES[key] || ENEMY_TYPES.patrol;
}

/** 供外部（world）在不知道尺寸时取默认值 */
export const ENEMY_DEFAULT = ENEMY;
