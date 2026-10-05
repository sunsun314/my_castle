// 全局游戏常量（单位：虚拟像素 / 秒）

export const TILE = 16;

export const GRAVITY = 980;
export const MAX_FALL = 380;

export const PLAYER = {
  w: 12,
  h: 22,
  moveSpeed: 110,    // 水平最大速度
  friction: 1400,    // 松开方向后的减速度
  airControl: 0.75,  // 空中操控系数
  jumpSpeed: 380,    // 起跳初速度（越大跳得越高）
  jumpCut: 1.8,      // 松开跳跃键时的额外重力倍率（可变跳跃高度）
  coyote: 0.1,       // 土狼时间（离地后仍可跳的宽限）
  jumpBuffer: 0.12,  // 跳跃缓冲（落地前提前按跳有效）
  invulnTime: 1.0,   // 受击无敌时长
  // 空手默认攻击参数；装备武器后由武器的 attack 覆盖（见 player.getAttackProfile）
  attackDuration: 0.14,
  attackReach: 16,   // 攻击盒水平长度
  attackHeight: 16,  // 攻击盒高度
  attackType: 'normal', // 空手 = 普通攻击
  crouchH: 11,       // 下蹲碰撞体高度（≈站立一半 → 受击盒减半）
  dropThroughTime: 0.18, // 下蹲跳下穿单向平台：忽略平台碰撞的时长
  dropThroughSpeed: 40,  // 下蹲跳下穿的初始向下速度（脱离平台）

  // ---- 能力：跳跃变体 ----
  bigJumpMul: 1.6,   // 大跳（上+跳）相对普通跳的初速度倍率
  airJumpMul: 1.0,   // 二段跳相对普通跳的初速度倍率
  bigJumpMp: 0,      // 大跳消耗魔力（0 = 免费）

  // ---- 基础属性 / 每级成长（派生结果由 stats.computeStats 计算）----
  // 生命改为「数值制」大血量池，便于尖刺按百分比扣减、并显示数值。
  base:   { maxHp: 100, maxMp: 20, atk: 1, def: 0, mag: 2 },
  growth: { maxHp: 20,  maxMp: 2,  atk: 0.5, def: 0.5, mag: 0.5 },
  mpRegen: 1,        // 魔力每秒回复
};

// 尖刺陷阱：固定按「最大生命」的百分比扣减（无视防御）
export const SPIKE = {
  pct: 0.1, // 10%
  attackType: 'normal', // 尖刺攻击归为「普通」类型
  element: null,
};

// 副武器：魔法弹（上 + B 触发）。伤害取自玩家魔法力 mag。
export const MAGIC = {
  w: 10,
  h: 6,
  speed: 200,      // 飞行速度
  life: 1.2,       // 存活时间（秒）
  cost: 4,         // 每次消耗魔力
  cooldown: 0.35,  // 施法冷却
  color: '#7c5cff',
  element: 'light',     // 默认光属性（可被戒指覆盖，见 player.getMagicProfile）
  attackType: 'normal', // 法术归为「普通」攻击类型
  // 弹道行为（默认直线弹；副武器可在 items 的 magic 里覆盖）：
  //  'bolt' 直线单体 / 'pierce' 穿透 / 'burst' 爆裂 / 'slow' 减速 / 'chain' 连锁
  behavior: 'bolt',
  pierce: 1,        // pierce：可穿透的敌人数
  burstRadius: 24,  // burst：爆炸半径（像素）
  burstMul: 0.6,    // burst：溅射伤害倍率
  slowMul: 0.5,     // slow：命中后速度倍率
  slowTime: 1.5,    // slow：减速持续（秒）
  chainCount: 2,    // chain：连锁跳数
  chainRange: 40,   // chain：连锁搜索半径（像素）
  chainMul: 0.6,    // chain：每跳伤害倍率
};

// 变身（魔神）：第三个动作按钮，一种新的魔法类型（自身形态变化，而非抛射弹）。
// 两种交互——
//  · 上 + 变身：进入「魔法魔神」形态，普通攻击改写为「普通」类型、伤害 = 魔法强度 mag × attackMul，
//              形态期间持续耗蓝，魔力耗尽自动解除。
//  · 长按变身：进入「突进魔神」，锁定朝向持续向前猛冲、期间无敌，撞到的怪物受巨额伤害。
export const TRANSFORM = {
  // — 上 + 变身（魔法魔神）—
  cost: 8,             // 启动消耗魔力
  drain: 6,            // 形态期间每秒耗蓝
  attackMul: 1.6,      // 普攻伤害 = mag × 该倍率
  attackReach: 30,     // 普攻范围（改写为普通攻击的手感）
  attackHeight: 26,
  attackDuration: 0.18,
  attackType: 'normal', // 形态期间普攻类型统一为「普通」
  element: null,        // 无属性
  colorMage: '#b14cff', // 魔法魔神身体色

  // — 长按（突进魔神）—
  holdTime: 0.30,      // 长按判定阈值（秒），超过即触发突进
  dashCost: 8,         // 突进启动消耗魔力
  dashSpeed: 320,      // 突进水平速度
  dashDuration: 0.45,  // 突进持续（秒）
  dashDamageMul: 3.0,  // 突进撞怪伤害 = mag × 该倍率（巨额）
  colorDash: '#ff3d6e',// 突进魔神身体色

  cooldown: 1.0,       // 变身结束后的再变身冷却
};

// 经验曲线：升到 level+1 所需经验
export const PROGRESSION = {
  expBase: 8,  // 1 级升 2 级所需
  expExp: 2,   // 每级额外增量系数
};

// 瓦片类型 -> 颜色（骨架阶段用纯色块，后续替换为贴图）
export const TILE_COLORS = {
  '#': '#4a4e69', // 实心
  '=': '#9a8c72', // 单向平台
  '^': '#c1436d', // 尖刺
};

// 敌人（巡逻小怪）参数
export const ENEMY = {
  w: 14,
  h: 14,
  hp: 2,             // 需要打几下才死（敌人自己的血量，与玩家血量刻度无关）
  contactDamage: 10, // 接触伤害：碰到玩家时按此值经防御减伤
  exp: 4,            // 击杀获得的经验
  speed: 28,         // 巡逻速度
  knockback: 90,     // 受击击退速度
  deathTime: 0.35,   // 死亡演出时长
  color: '#e5484d',  // 身体（红色，一眼能认出是怪）
  slowColor: '#7fd7ff', // 被减速时的身体色（冰蓝）
  eye: '#2a0b0d',
  deathColor: '#ffd166',
  // 怪物攻击：碰撞攻击统一为「普通」类型、无属性
  attackType: 'normal',
  element: null,
  // 默认无弱点；具体弱点由关卡出生点配置（见 config/level1.js）
  weaknesses: [],
};

export const COLORS = {
  sky: '#20222f',
  player: '#4aa3ff',
  playerFace: '#0b1020',
  attack: '#ffe066',
};

// 战斗飘字（伤害数字）：白色 = 对怪物造成的伤害，红色 = 己方受到的伤害。
// 运动为「上抛 + 重力」的抛物线，末段随时间淡出。
export const DAMAGE_TEXT = {
  life: 0.85,             // 存活时长（秒）
  riseSpeed: -78,         // 初始上抛速度（负 = 向上）
  gravity: 260,           // 重力，形成抛物线回落
  drift: 26,              // 水平漂移速度（左右随机）
  colorEnemy: '#ffffff',  // 对怪物造成的伤害
  colorPlayer: '#ff5a5a', // 己方（玩家）受到的伤害
  font: 'bold 9px monospace',
  fadeStart: 0.35,        // 生命周期进度超过该比例后开始淡出
  offsetY: -4,            // 生成时相对实体顶部的偏移
};
