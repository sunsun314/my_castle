import { SPIKE } from '../config/constants';
import { mitigate } from './stats';

/**
 * 伤害机制：不同来源的扣减规则不同，统一在这里表达。
 *
 *  CONTACT 敌人接触：原始伤害经「防御」减伤（100/(100+def)），至少 1 点。
 *  RANGED  怪物远程弹：同样经「防御」减伤（与接触同管线，仅语义区分）。
 *  SPIKE   尖刺陷阱：无视防御，固定按「最大生命」的百分比扣减（默认 10%）。
 *  FALL    坠出地图：不扣血，仅把玩家复位（具体处理见 player.fallOut）。
 *
 * 之后新增机制（毒、落石、Boss 技能……）都在这里加一条 case，
 * 避免把「怎么扣血」散落到各个实体里。
 */
export const DamageKind = {
  CONTACT: 'contact',
  RANGED: 'ranged',
  SPIKE: 'spike',
  FALL: 'fall',
};

/**
 * 计算某机制的实际扣减量（只算数值，不含无敌帧等状态判断）。
 * @param {string} kind DamageKind
 * @param {object} ctx  { raw, def, maxHp }
 * @returns {number} 实际扣减的生命值（FALL 恒为 0）
 */
export function resolveDamage(kind, ctx = {}) {
  switch (kind) {
    case DamageKind.CONTACT:
    case DamageKind.RANGED:
      return mitigate(ctx.raw || 0, ctx.def || 0);
    case DamageKind.SPIKE:
      return Math.max(1, Math.round((ctx.maxHp || 0) * SPIKE.pct));
    case DamageKind.FALL:
    default:
      return 0;
  }
}
