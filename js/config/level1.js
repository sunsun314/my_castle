// 关卡数据：每个字符 = 一个 16×16 瓦片
//   '.' 空气   '#' 实心   '=' 单向平台   '^' 尖刺   'P' 玩家出生点   'E' 敌人出生点
// 约束：每行字符数必须一致（列数），行数即地图高度。
export const LEVEL1 = [
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '......................................=====.....',
  '................====............................',
  '................................................',
  '........=====.............=====.................',
  '................................................',
  '..P.......E.....E.......E..^^^..E......EE.EE.E.E',
  '####################....##########...###########',
  '####################....##########...###########',
];

// 每个敌人出生点（按 enemySpawns 出现顺序）对应的弱点配置（纯数据，至多两个）：
//   kind: 'element' | 'attack'；value 见 game/elements.js
//   element: light/dark/fire/water/wind/thunder/earth
//   attack : slash/heavy/normal
// 命中 1 个弱点 -> 150%，命中 2 个 -> 300%（结算见 world._resolveCombat + game/elements.js）
// 注意：顺序必须与下方 LEVEL1_ENEMY_TYPES（按出生列从左到右）严格一一对应。
export const LEVEL1_ENEMY_WEAKNESSES = [
  // col10 巡逻兵：斩击 + 火（烈焰剑可同时命中两个 -> 300%）
  [{ kind: 'attack', value: 'slash' }, { kind: 'element', value: 'fire' }],
  // col16 冲锋兽：雷
  [{ kind: 'element', value: 'thunder' }],
  // col24 风刃使：重击
  [{ kind: 'attack', value: 'heavy' }],
  // col32 跳跳蛛：风
  [{ kind: 'element', value: 'wind' }],
  // col39 吊诡（天花板）：重击
  [{ kind: 'attack', value: 'heavy' }],
  // col40 巫妖：光
  [{ kind: 'element', value: 'light' }],
  // col42 游魂：斩击
  [{ kind: 'attack', value: 'slash' }],
  // col43 炎魔（吐火）：水
  [{ kind: 'element', value: 'water' }],
  // col45 恶鸦（俯冲）：暗
  [{ kind: 'element', value: 'dark' }],
  // col47 BOSS 魔王：光（第二阶段会切换为暗，见 config/enemies.js phases）
  [{ kind: 'element', value: 'light' }],
];

// 每个敌人出生点（按 enemySpawns 出现顺序）对应的**怪物类型**（见 config/enemies.js）。
// 与 LEVEL1_ENEMY_WEAKNESSES 一一对应；缺省 'patrol'。
// 地图第 15 行自左向右：col10 / col16 / col24 / col32 / col39 / col40 / col42 / col43 / col45 / col47。
//   col39 吊诡吸天花板；col43 炎魔吐火；col45 恶鸦俯冲；col47 BOSS 魔王（多阶段）独自镇守最右端。
export const LEVEL1_ENEMY_TYPES = ['patrol', 'charger', 'blader', 'jumper', 'ceiling', 'shooter', 'flyer', 'flamer', 'diver', 'boss'];
