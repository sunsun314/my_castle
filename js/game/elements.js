/**
 * 元素与攻击类型系统（战斗属性）。
 *
 * 元素（ELEMENTS）：光 / 暗 / 火 / 水 / 风 / 电 / 土
 * 攻击类型（ATTACK_TYPES）：斩击 / 重击 / 普通
 *
 * 怪物可拥有至多两个「弱点」（weaknesses），每个弱点要么是元素弱点、要么是攻击类型弱点：
 *   { kind: 'element', value: 'fire' }
 *   { kind: 'attack',  value: 'slash' }
 *
 * 命中结算倍率：
 *   命中 0 个弱点 -> 100%
 *   命中 1 个弱点 -> 150%
 *   命中 2 个弱点 -> 300%
 *
 * 约定：所有怪物的碰撞攻击与尖刺陷阱都归为「普通」攻击类型（见 config/constants.js）。
 */

export const ELEMENTS = ['light', 'dark', 'fire', 'water', 'wind', 'thunder', 'earth'];

export const ELEMENT_LABEL = {
  light: '光',
  dark: '暗',
  fire: '火',
  water: '水',
  wind: '风',
  thunder: '电',
  earth: '土',
};

export const ATTACK_TYPES = ['slash', 'heavy', 'normal'];

export const ATTACK_TYPE_LABEL = {
  slash: '斩击',
  heavy: '重击',
  normal: '普通',
};

export const WEAKNESS_KIND = {
  ELEMENT: 'element',
  ATTACK: 'attack',
};

/** 弱点倍率表：按命中弱点个数取倍率 */
export function weaknessMultiplier(hits) {
  if (hits >= 2) return 3.0;
  if (hits === 1) return 1.5;
  return 1.0;
}

/**
 * 统计一次攻击命中了目标多少个弱点。
 * @param {object} attack      { element, attackType }
 * @param {Array}  weaknesses  [{ kind, value }, ...]
 * @returns {number} 命中弱点个数（0 起）
 */
export function countWeaknessHits(attack, weaknesses) {
  if (!attack || !weaknesses || !weaknesses.length) return 0;
  let n = 0;
  for (const w of weaknesses) {
    if (!w) continue;
    if (w.kind === WEAKNESS_KIND.ELEMENT) {
      if (attack.element && attack.element === w.value) n += 1;
    } else if (w.kind === WEAKNESS_KIND.ATTACK) {
      if (attack.attackType && attack.attackType === w.value) n += 1;
    }
  }
  return n;
}

/**
 * 按目标弱点结算最终伤害：基础伤害 × 弱点倍率，至少 1 点。
 * @param {number} baseDmg
 * @param {object} attack      { element, attackType }
 * @param {Array}  weaknesses
 * @returns {number}
 */
export function applyWeakness(baseDmg, attack, weaknesses) {
  const hits = countWeaknessHits(attack, weaknesses);
  if (hits <= 0) return Math.max(1, Math.round(baseDmg));
  return Math.max(1, Math.round(baseDmg * weaknessMultiplier(hits)));
}
