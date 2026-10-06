import { ITEMS } from '../config/items';
import { PLAYER } from '../config/constants';
import { SAVE_KEY, write, read, erase } from '../engine/storage';

/**
 * 存档系统。
 *
 * 设计：
 *  - 存档 = 一份可 JSON 序列化的快照 `{ version, savedAt, roomId, player }`。
 *  - 玩家状态只存**来源**（等级 / 经验 / 装备 id / 背包 id / 能力 / buff / 当前 HP·MP），
 *    读取时经同一条属性管线 recomputeStats() 重算派生结果，保证与实战一致。
 *  - 物品按 id 存取（ITEMS[id]），避免把整份物品定义写进存档、也便于物品表改版。
 *  - 序列化/反序列化是纯数据函数，方便单测与将来做版本迁移。
 *
 * 载体：本地缓存单 key（免费、够用）。跨设备继承才需要换云存档——只需替换
 * engine/storage.js 的实现，本文件不动。
 */

export const SAVE_VERSION = 1;

// ================= 玩家 =================

/** 玩家 -> 可序列化快照（只存来源，不存派生 stats） */
export function serializePlayer(p) {
  return {
    level: p.level,
    exp: p.exp,
    hp: p.hp,
    mp: p.mp,
    abilities: { ...p.abilities },
    equipment: {
      weapon: p.equipment.weapon ? p.equipment.weapon.id : null,
      armor: p.equipment.armor ? p.equipment.armor.id : null,
      ring: p.equipment.ring ? p.equipment.ring.id : null,
      subweapon: p.equipment.subweapon ? p.equipment.subweapon.id : null,
    },
    inventory: p.inventory.map((it) => it.id), // 背包（拥有未装备）
    buffs: p.buffs.list.map((b) => ({
      id: b.id, name: b.name, color: b.color,
      timeLeft: b.timeLeft, flat: b.flat, mul: b.mul,
    })),
  };
}

/** 快照 -> 玩家（重算派生属性，再落到当前 HP/MP） */
export function deserializePlayer(p, d) {
  if (!d) return false;

  p.level = d.level && d.level > 0 ? d.level : 1;
  p.exp = d.exp || 0;
  if (d.abilities) p.abilities = { ...p.abilities, ...d.abilities };

  // 装备与背包：按 id 还原为 ITEMS 里的共享定义；未知 id 直接忽略（兼容物品表改版）
  p.equipment = { weapon: null, armor: null, ring: null, subweapon: null };
  for (const slot of Object.keys(p.equipment)) {
    const id = d.equipment && d.equipment[slot];
    if (id && ITEMS[id]) p.equipment[slot] = ITEMS[id];
  }
  p.inventory = (d.inventory || []).map((id) => ITEMS[id]).filter(Boolean);

  // Buff：先清空再用 addBuff 逐条灌入（保持 timeLeft / 重算属性）
  p.buffs.clear();
  for (const b of (d.buffs || [])) {
    p.addBuff({ id: b.id, name: b.name, color: b.color, time: b.timeLeft, flat: b.flat, mul: b.mul });
  }
  p.recomputeStats();

  // 落地清掉临时状态，避免读档瞬间带着变身 / 攻击 / 击退
  if (p._clearDemon) p._clearDemon();
  p.crouching = false;
  p.h = PLAYER.h;
  p.state = 'idle';
  p.attackTimer = 0;
  p.magicCd = 0;
  p.demonCd = 0;
  p.vx = 0;
  p.vy = 0;
  p.invuln = 0.8;

  p.hp = d.hp != null ? Math.max(1, Math.min(d.hp, p.stats.maxHp)) : p.stats.maxHp;
  p.mp = d.mp != null ? Math.max(0, Math.min(d.mp, p.stats.maxMp)) : p.stats.maxMp;
  return true;
}

// ================= 整局 =================

/** 世界 -> 完整存档快照 */
export function serializeGame(world) {
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    roomId: world.roomId,
    player: serializePlayer(world.player),
  };
}

/** 写入存档；返回是否成功 */
export function writeSave(world) {
  return write(SAVE_KEY, serializeGame(world));
}

/** 读取存档快照；无存档 / 版本不符返回 null */
export function readSave() {
  const d = read(SAVE_KEY);
  if (!d || typeof d !== 'object') return null;
  if (d.version == null || d.version > SAVE_VERSION) return null;
  return d;
}

/** 把快照应用到世界：先按存档房间重建地图，再灌入玩家状态 */
export function applySave(world, d) {
  if (!d) return false;
  if (d.roomId) world.loadRoom(d.roomId, { entry: 'start' });
  return deserializePlayer(world.player, d.player);
}

/** 是否存在可读存档 */
export function hasSave() {
  return !!readSave();
}

/** 清空存档 */
export function eraseSave() {
  return erase(SAVE_KEY);
}
