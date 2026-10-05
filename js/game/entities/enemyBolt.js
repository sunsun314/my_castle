// 兼容旧引用：怪物远程弹已泛化为「离体攻击」框架，实现见 enemyAttack.js。
//   new EnemyBolt(x, y, dir, { damage, speed, color }) 等价于 kind='bolt' 的直线弹。
// 新代码请直接 import EnemyAttack from './enemyAttack'，用 kind 选择形态。
export { default } from './enemyAttack';
