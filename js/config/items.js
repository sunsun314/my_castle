/**
 * 物品 / 装备定义表。
 *
 * 每个条目：
 *   slot  装备槽位（weapon / armor / ring）——有 slot 的即可装备
 *   flat  加法修正（+X）
 *   mul   乘法修正（×X，最后统一相乘）
 *   type  'buff' 表示这是一瓶限时增益（用 addBuff 施加，不进装备槽）
 *   time  buff 持续秒数
 *
 * 结算顺序固定：先累加所有 flat，再乘所有 mul（见 game/stats.js）。
 * 骨架阶段用纯数据，后续可加 icon / 掉落权重 / 价格。
 */
export const ITEM_SLOTS = ['weapon', 'armor', 'ring'];

export const ITEMS = {
  iron_sword: {
    id: 'iron_sword',
    name: '铁剑',
    slot: 'weapon',
    flat: { atk: 2 },
  },
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

  // 限时增益（非装备）
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
