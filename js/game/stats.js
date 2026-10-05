/**
 * 属性计算管线。
 *
 * 设计原则：只保存「来源」（基础值 / 装备 / buff），最终属性按需重算、只做缓存。
 * 结算顺序固定：base → 累加所有 flat → 乘所有 mul → 取整保底。
 * 顺序固定才能保证同一套来源在任何路径下得出相同结果。
 */

/** 参与结算的属性键 */
export const STAT_KEYS = ['maxHp', 'maxMp', 'atk', 'def', 'mag'];

/**
 * @param {object} base       等级推导出的基础值
 * @param {object} equipment  { weapon, armor, ring } -> item | null
 * @param {Array}  buffs      [{ flat?, mul? }, ...]
 * @returns {object} 最终属性（已取整）
 */
export function computeStats(base, equipment = {}, buffs = []) {
  const out = {};
  for (const k of STAT_KEYS) out[k] = base[k] || 0;

  const mul = {};

  // 1) 装备：先累 flat，收集 mul
  for (const slot in equipment) {
    const it = equipment[slot];
    if (!it) continue;
    applyFlat(out, it.flat);
    collectMul(mul, it.mul);
  }

  // 2) buff：同样先 flat，收集 mul
  for (const b of buffs) {
    applyFlat(out, b.flat);
    collectMul(mul, b.mul);
  }

  // 3) 乘法
  for (const k in mul) out[k] = (out[k] || 0) * mul[k];

  // 4) 取整 + 保底
  out.maxHp = Math.max(1, Math.round(out.maxHp));
  out.maxMp = Math.max(0, Math.round(out.maxMp));
  out.atk = Math.max(0, Math.round(out.atk));
  out.def = Math.max(0, Math.round(out.def));
  out.mag = Math.max(0, Math.round(out.mag));
  return out;
}

function applyFlat(out, flat) {
  if (!flat) return;
  for (const k in flat) out[k] = (out[k] || 0) + flat[k];
}

function collectMul(mul, add) {
  if (!add) return;
  for (const k in add) mul[k] = (mul[k] || 1) * add[k];
}

/**
 * 防御减伤：把「原始伤害」按防御换算为「实际伤害」，至少 1 点。
 * 用百分比曲线而非线性减法，避免高防时出现免疫。
 */
export function mitigate(rawDmg, def) {
  return Math.max(1, Math.round(rawDmg * (100 / (100 + def))));
}
