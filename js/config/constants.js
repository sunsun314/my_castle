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
  attackDuration: 0.18,
  attackReach: 22,   // 攻击盒水平长度
  attackHeight: 18,  // 攻击盒高度

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
  eye: '#2a0b0d',
  deathColor: '#ffd166',
};

export const COLORS = {
  sky: '#20222f',
  player: '#4aa3ff',
  playerFace: '#0b1020',
  attack: '#ffe066',
};
