/**
 * 「离体攻击」注册表（纯数据 + 框架）。
 *
 * 怪物的攻击分两类：
 *   1) **自身动作**：冲锋 / 俯冲 / 坠落砸击等（写在怪物的 behavior 分支里）。
 *   2) **离体攻击**：怪物外放出去的独立实体（弹体、持续伤害区……），即本表。
 *
 * 设计意图：把「长什么样、怎么飞、打多少、命中后如何」全部数据化，
 * 每个条目 = 一种离体攻击形态。怪物通过 `attack.emit` 引用条目 key，
 * 从而**机制与怪物强绑定**，而形态可以复用/替换。接素材时只需给条目补 `sprite`，
 * 或在 `entities/enemyAttack.js` 的 render 里加一个 shape 分支，逻辑无需改动。
 *
 * 字段说明（generic）：
 *   name        显示名（仅注释用途）
 *   shape       渲染形状：'rect' | 'circle' | 'blade' | 'flame'（预留 'sprite'）
 *   motion      运动方式：'straight' 直线 / 'arc' 抛物线(受 gravity) /
 *               'sine' 正弦波动 / 'static' 原地（持续伤害区）
 *   w,h         碰撞盒尺寸
 *   speed       水平速度（static 忽略）
 *   life        存活时长（秒）
 *   damage      单次伤害（经防御减伤，走既有伤害管线）
 *   color      占位配色（接素材后由 sprite 取代）
 *   sprite      预留：图集/图片 key，渲染器支持时优先绘制
 *   — 运动扩展 —
 *   gravity     arc 的重力加速度
 *   waveAmp     sine 的横向振幅
 *   waveFreq    sine 的频率
 *   — 命中扩展 —
 *   pierce      可穿透目标数（0=命中即消失）
 *   tick        >0 表示「持续伤害区」：每隔 tick 秒结算一次，命中后不消失
 *   onHit       预留：命中后的附加效果（'none' | 'burst' | 'slow' …）
 *   burstRadius/burstMul   onHit='burst' 时的溅射参数
 *   — 发射扩展（由 world.spawnEnemyAttack 读取）—
 *   count       一次发射几发
 *   spread      多发时的水平间隔
 *   offset      {x,y} 相对发射者的枪口偏移
 *
 * 新增一种离体攻击：在此加一条即可；再让某个怪 `attack.emit = '<key>'`。
 * 未命中的字段会回落到 `bolt`（或实体的内建默认值）。
 */
export const ENEMY_ATTACKS = {
  // —— 直线能量弹（远程怪的基础弹）——
  bolt: {
    name: '能量弹',
    shape: 'rect', motion: 'straight',
    w: 8, h: 4, speed: 150, life: 2.2, damage: 8,
    color: '#67e8f9',
    pierce: 0, tick: 0, onHit: 'none',
    sprite: null,
  },

  // —— 抛物线火球（落地/命中即消失，可溅射）——
  fireball: {
    name: '火球',
    shape: 'circle', motion: 'arc',
    w: 10, h: 10, speed: 170, life: 3.0, damage: 12,
    color: '#ff6a3d',
    gravity: 520,
    pierce: 0, tick: 0,
    onHit: 'burst', burstRadius: 22, burstMul: 0.6,
    sprite: null,
  },

  // —— 吐火（原地持续伤害区；发射者按住喷火期间反复生成）——
  flame: {
    name: '吐火',
    shape: 'flame', motion: 'static',
    w: 26, h: 16, life: 0.5, damage: 4,
    color: '#ff8a3d',
    tick: 0.18, pierce: 0, onHit: 'none',
    offset: { x: 18, y: 0 },
    sprite: null,
  },

  // —— 冲击波（BOSS 砸地：原地扩散的宽伤害区）——
  shockwave: {
    name: '冲击波',
    shape: 'rect', motion: 'static',
    w: 64, h: 8, life: 0.4, damage: 14,
    color: '#fbbf24',
    tick: 0, pierce: 0, onHit: 'none',
    offset: { x: 0, y: 9 },
    sprite: null,
  },

  // —— 风刃（正弦波动飞行，可穿透多个目标）——
  windblade: {
    name: '风刃',
    shape: 'blade', motion: 'sine',
    w: 16, h: 5, speed: 250, life: 2.0, damage: 9,
    color: '#7ee787',
    waveAmp: 7, waveFreq: 9,
    pierce: 2, tick: 0, onHit: 'none',
    sprite: null,
  },
};

/** 取离体攻击定义（缺省回落到 bolt） */
export function enemyAttackDef(key) {
  return ENEMY_ATTACKS[key] || ENEMY_ATTACKS.bolt;
}
