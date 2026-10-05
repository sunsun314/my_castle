/**
 * 物品 / 装备定义表。
 *
 * 每个条目：
 *   slot        装备槽位（weapon / armor / ring）——有 slot 的即可装备
 *   flat        加法修正（+X）
 *   mul         乘法修正（×X，最后统一相乘）
 *   attack      【武器专用】攻击参数，随武器走：
 *                 reach    攻击盒水平长度（越大打得越远）
 *                 height   攻击盒高度
 *                 duration 生效时长（秒，越小出手越快）
 *   attackType  【武器专用】攻击类型：slash 斩击 / heavy 重击 / normal 普通
 *   element     【武器专用】元素属性：light/dark/fire/water/wind/thunder/earth，null = 无属性
 *   type        'buff' 表示这是一瓶限时增益（用 addBuff 施加，不进装备槽）
 *   time        buff 持续秒数
 *
 * 结算顺序固定：先累加所有 flat，再乘所有 mul（见 game/stats.js）。
 * 攻击参数由 entities/player.js 的 getAttackProfile() 读取；未装备武器时
 * 回落到 PLAYER.attack* 的空手默认值（普通攻击、无属性）。
 * 命中怪物弱点时的倍率结算见 game/elements.js。
 */
export const ITEM_SLOTS = ['weapon', 'armor', 'ring', 'subweapon'];

export const ITEMS = {
  // ---------------- 无属性武器 ----------------
  dagger: {
    id: 'dagger',
    name: '匕首',
    slot: 'weapon',
    attackType: 'slash',
    element: null,
    flat: { atk: 1 },
    attack: { reach: 15, height: 14, duration: 0.10 }, // 短、快
  },
  iron_sword: {
    id: 'iron_sword',
    name: '铁剑',
    slot: 'weapon',
    attackType: 'slash',
    element: null,
    flat: { atk: 2 },
    attack: { reach: 24, height: 18, duration: 0.18 }, // 均衡基准
  },
  spear: {
    id: 'spear',
    name: '长枪',
    slot: 'weapon',
    attackType: 'slash',
    element: null,
    flat: { atk: 3 },
    attack: { reach: 36, height: 12, duration: 0.24 }, // 长、细、稍慢
  },
  great_sword: {
    id: 'great_sword',
    name: '巨剑',
    slot: 'weapon',
    attackType: 'heavy',
    element: null,
    flat: { atk: 5 },
    attack: { reach: 28, height: 28, duration: 0.30 }, // 宽大、慢、高伤
  },

  // ---------------- 元素武器（用于打击对应的属性弱点）----------------
  flame_blade: {
    id: 'flame_blade',
    name: '烈焰剑',
    slot: 'weapon',
    attackType: 'slash',
    element: 'fire',
    flat: { atk: 4 },
    attack: { reach: 24, height: 18, duration: 0.20 },
  },
  frost_spear: {
    id: 'frost_spear',
    name: '寒霜枪',
    slot: 'weapon',
    attackType: 'slash',
    element: 'water',
    flat: { atk: 3 },
    attack: { reach: 34, height: 12, duration: 0.22 },
  },
  gale_dagger: {
    id: 'gale_dagger',
    name: '疾风匕',
    slot: 'weapon',
    attackType: 'slash',
    element: 'wind',
    flat: { atk: 2 },
    attack: { reach: 15, height: 14, duration: 0.09 },
  },
  thunder_maul: {
    id: 'thunder_maul',
    name: '雷锤',
    slot: 'weapon',
    attackType: 'heavy',
    element: 'thunder',
    flat: { atk: 6 },
    attack: { reach: 26, height: 26, duration: 0.32 },
  },
  earth_hammer: {
    id: 'earth_hammer',
    name: '岩锤',
    slot: 'weapon',
    attackType: 'heavy',
    element: 'earth',
    flat: { atk: 5 },
    attack: { reach: 24, height: 24, duration: 0.30 },
  },
  holy_blade: {
    id: 'holy_blade',
    name: '圣光剑',
    slot: 'weapon',
    attackType: 'slash',
    element: 'light',
    flat: { atk: 4 },
    attack: { reach: 26, height: 18, duration: 0.20 },
  },
  shadow_scythe: {
    id: 'shadow_scythe',
    name: '暗影镰',
    slot: 'weapon',
    attackType: 'heavy',
    element: 'dark',
    flat: { atk: 6 },
    attack: { reach: 30, height: 30, duration: 0.34 },
  },

  // ---------------- 副武器（魔法书：决定上+B 魔法弹的属性 / 手感）----------------
  ember_tome: {
    id: 'ember_tome',
    name: '火焰法典',
    slot: 'subweapon',
    element: 'fire',
    attackType: 'normal',
    flat: { mag: 3 },
    magic: { cost: 4, cooldown: 0.35, speed: 210, color: '#ff6a3d', behavior: 'burst', burstRadius: 26, burstMul: 0.6 },
  },
  frost_tome: {
    id: 'frost_tome',
    name: '寒霜法典',
    slot: 'subweapon',
    element: 'water',
    attackType: 'normal',
    flat: { mag: 4 },
    magic: { cost: 5, cooldown: 0.5, speed: 170, life: 1.4, color: '#4fc3ff', behavior: 'slow', slowMul: 0.4, slowTime: 1.6 },
  },
  gale_tome: {
    id: 'gale_tome',
    name: '疾风法典',
    slot: 'subweapon',
    element: 'wind',
    attackType: 'normal',
    flat: { mag: 2 },
    magic: { cost: 3, cooldown: 0.22, speed: 270, color: '#7ee787', behavior: 'pierce', pierce: 3 },
  },
  thunder_tome: {
    id: 'thunder_tome',
    name: '雷击法典',
    slot: 'subweapon',
    element: 'thunder',
    attackType: 'normal',
    flat: { mag: 4 },
    magic: { cost: 5, cooldown: 0.45, speed: 240, color: '#ffd34d', behavior: 'chain', chainCount: 2, chainRange: 46, chainMul: 0.6 },
  },

  // ---------------- 防具 / 饰品 ----------------
  leather_armor: {
    id: 'leather_armor',
    name: '皮甲',
    slot: 'armor',
    flat: { def: 25, maxHp: 20 }, // 数值制血量下的护甲：+20 生命、防御 25（约减伤 20%）
  },
  mage_ring: {
    id: 'mage_ring',
    name: '法师戒指',
    slot: 'ring',
    mul: { mag: 1.2 },
  },

  // ---------------- 限时增益（非装备） ----------------
  power_potion: {
    id: 'power_potion',
    name: '力量药水',
    type: 'buff',
    time: 10,
    flat: { atk: 2 },
  },
  haste_potion: {
    id: 'haste_potion',
    name: '加速药水',
    type: 'buff',
    time: 6,
    mul: { mag: 1.5 },
  },
};
