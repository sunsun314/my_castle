import Scene from './scene';
import { ELEMENT_LABEL, ATTACK_TYPE_LABEL } from '../elements';

const GEAR_SLOTS = ['weapon', 'armor', 'ring'];
const MAGIC_SLOTS = ['subweapon'];
const SLOT_LABEL = { weapon: '武器', armor: '防具', ring: '戒指', subweapon: '副武器' };

/**
 * 底部预留的 Banner 广告高度（虚拟像素）。
 * 后续接入广告时，在该矩形区域内创建并定位 wx.createBannerAd 即可。
 */
export const BANNER_H = 48;

/**
 * 背包 / 装备管理菜单（覆盖层场景）。
 *
 * 分两个「平行页面」（顶部 Tab 切换）：
 *  - 装备页（gear）：武器 / 防具 / 戒指 + 背包物品
 *  - 魔法页（magic）：副武器槽 + 背包中的魔法书（subweapon）
 *
 * 设计要点：
 *  - 作为「栈顶场景」存在。SceneManager.update 只驱动栈顶，因此本场景打开时，
 *    下方 PlayScene（战斗世界）自动冻结、不再结算；关闭（pop）后立刻恢复。
 *  - SceneManager.render 从栈底到栈顶依次绘制，本场景铺满不透明底，
 *    直接盖住当前所有战斗元素。
 *  - 交互统一走 input.tapIn(rect)：点 Tab → 切页；点物品 → 装备；点已装备 → 卸下；
 *    点右下角 × → 关闭。
 *  - 屏幕最底部预留一条 Banner 广告位（见 BANNER_H / _bannerRect），暂未插入真实广告。
 */
export default class InventoryScene extends Scene {
  constructor(app, player, tab = 'gear') {
    super(app);
    this.player = player;
    this.tab = tab === 'magic' ? 'magic' : 'gear';
  }

  // ---- 布局（update / render 共用，保证「点哪画哪」一致）----

  /** 关闭按钮：右下角（位于 Banner 广告位之上） */
  _closeRect(r) {
    return { x: r.width - 30, y: r.height - BANNER_H - 24, w: 22, h: 18 };
  }

  /** 底部 Banner 广告预留位：整宽贴底 */
  _bannerRect(r) {
    return { x: 0, y: r.height - BANNER_H, w: r.width, h: BANNER_H };
  }

  /** 顶部两个平行页面按钮：装备 / 魔法 */
  _tabRects(r) {
    const w = 46;
    const h = 14;
    const gap = 6;
    const startX = (r.width - (w * 2 + gap)) / 2;
    const y = 20;
    return [
      { tab: 'gear', label: '装备', rect: { x: startX, y, w, h } },
      { tab: 'magic', label: '魔法', rect: { x: startX + w + gap, y, w, h } },
    ];
  }

  /** 当前页要显示的装备槽 */
  _slots() {
    return this.tab === 'magic' ? MAGIC_SLOTS : GEAR_SLOTS;
  }

  /** 当前页要显示的背包物品（装备页排除副武器；魔法页只显示副武器） */
  _bagItems() {
    return this.player.inventory.filter((it) => (
      this.tab === 'magic' ? it.slot === 'subweapon' : it.slot !== 'subweapon'
    ));
  }

  _slotRects(r) {
    const x = 10;
    const w = Math.floor(r.width * 0.42);
    const top = 52;
    const h = 22;
    return this._slots().map((slot, i) => ({
      slot,
      rect: { x, y: top + i * (h + 4), w, h },
    }));
  }

  _itemRects(r) {
    const x = Math.floor(r.width * 0.5) + 4;
    const w = r.width - x - 10;
    const top = 52;
    const h = 16;
    return this._bagItems().map((item, i) => ({
      item,
      rect: { x, y: top + i * (h + 3), w, h },
    }));
  }

  /** 物品右列描述文案 */
  _desc(item) {
    if (item.slot === 'subweapon') {
      const el = item.element ? ELEMENT_LABEL[item.element] : '无';
      const at = ATTACK_TYPE_LABEL[item.attackType] || '';
      const mag = (item.flat && item.flat.mag) || 0;
      const cost = item.magic && item.magic.cost != null ? item.magic.cost : '—';
      return `${el}${at} 魔+${mag} 耗${cost}`;
    }
    if (item.attack) {
      const el = item.element ? ELEMENT_LABEL[item.element] : '无';
      const at = ATTACK_TYPE_LABEL[item.attackType] || '';
      return `${el}${at} 攻+${(item.flat && item.flat.atk) || 0} 距${item.attack.reach}`;
    }
    return item.slot ? SLOT_LABEL[item.slot] : (item.type === 'buff' ? '药水' : '道具');
  }

  // ---- 更新：只处理菜单交互（世界由栈机制冻结）----

  update() {
    const input = this.app.input;
    const r = this.app.renderer;

    if (input.tapIn(this._closeRect(r))) { this.close(); return; }

    // Tab：切换平行页面
    for (const t of this._tabRects(r)) {
      if (input.tapIn(t.rect)) { this.tab = t.tab; return; }
    }

    for (const row of this._slotRects(r)) {
      if (input.tapIn(row.rect)) { this.player.unequip(row.slot); return; }
    }
    for (const row of this._itemRects(r)) {
      if (input.tapIn(row.rect)) { this.player.useItem(row.item); return; }
    }
  }

  /** 关闭：仅弹出自己，露出下方战斗场景并恢复其 update */
  close() {
    const stack = this.app.scenes.scenes;
    if (stack[stack.length - 1] === this) this.app.scenes.pop();
  }

  // ---- 渲染：全屏不透明覆盖 ----

  render(r) {
    const p = this.player;
    const mono = '9px monospace';
    const magic = this.tab === 'magic';
    const contentBottom = r.height - BANNER_H; // 内容区底部（Banner 之上）

    // 全屏不透明底 —— 直接覆盖当前所有战斗元素
    r.drawRect(0, 0, r.width, r.height, '#0e1020');

    // 标题
    r.drawText('菜单', r.width / 2, 6, {
      align: 'center', color: '#e6e6e6', font: 'bold 11px sans-serif',
    });

    // 平行页面 Tab：装备 / 魔法
    for (const t of this._tabRects(r)) {
      const active = this.tab === t.tab;
      r.drawRect(t.rect.x, t.rect.y, t.rect.w, t.rect.h, active ? '#2a4a7a' : '#171a26');
      r.drawRect(t.rect.x, t.rect.y, t.rect.w, 2, active ? '#4aa3ff' : '#2a2e3d');
      r.drawText(t.label, t.rect.x + t.rect.w / 2, t.rect.y + t.rect.h / 2, {
        align: 'center', baseline: 'middle',
        color: active ? '#ffffff' : '#8a8f98', font: '9px sans-serif',
      });
    }

    // 关闭按钮（右下角）
    const cr = this._closeRect(r);
    r.drawRect(cr.x, cr.y, cr.w, cr.h, '#3a3f55');
    r.drawText('×', cr.x + cr.w / 2, cr.y + cr.h / 2, {
      align: 'center', baseline: 'middle', color: '#ffffff', font: 'bold 13px sans-serif',
    });

    // 左列：已装备的槽位（魔法页只有「副武器」一格）
    r.drawText(magic ? '已装备 · 魔法' : '已装备', 10, 40, { color: '#8a8f98', font: mono });
    for (const { slot, rect } of this._slotRects(r)) {
      const it = p.equipment[slot];
      r.drawRect(rect.x, rect.y, rect.w, rect.h, it ? '#1c2740' : '#171a26');
      r.drawRect(rect.x, rect.y, 3, rect.h, it ? '#4aa3ff' : '#2a2e3d');
      r.drawText(SLOT_LABEL[slot], rect.x + 8, rect.y + 3, { color: '#8a8f98', font: mono });
      r.drawText(it ? it.name : '（空）', rect.x + 48, rect.y + 3, {
        color: it ? '#e6e6e6' : '#555b6b', font: mono,
      });
    }

    // 魔法页：当前生效的魔法属性摘要
    if (magic) {
      const prof = p.getMagicProfile();
      const el = prof.element ? ELEMENT_LABEL[prof.element] : '无';
      const at = ATTACK_TYPE_LABEL[prof.attackType] || '';
      r.drawText(`当前魔法：${el}${at}  耗${prof.cost}  冷却${prof.cooldown}s`, 10, 82, {
        color: '#a9c7ff', font: mono,
      });
      r.drawText('点魔法书→装备；点副武器槽→卸下', 10, 96, { color: '#555b6b', font: '8px monospace' });
    }

    // 右列：背包
    const rx = Math.floor(r.width * 0.5) + 4;
    r.drawText(magic ? '魔法书' : '背包', rx, 40, { color: '#8a8f98', font: mono });
    const items = this._itemRects(r);
    if (!items.length) {
      r.drawText('（空）', rx, 54, { color: '#555b6b', font: mono });
    }
    for (const { item, rect } of items) {
      r.drawRect(rect.x, rect.y, rect.w, rect.h, '#171a26');
      r.drawText(item.name, rect.x + 6, rect.y + 3, { color: '#e6e6e6', font: mono });
      r.drawText(this._desc(item), rect.x + rect.w - 6, rect.y + 3, {
        align: 'right', color: '#8a8f98', font: '8px monospace',
      });
    }

    // 底部：属性预览（换装即时生效的反馈）+ 操作提示（均位于 Banner 之上）
    const s = p.stats;
    r.drawText(
      `HP ${Math.ceil(p.hp)}/${s.maxHp}   ATK ${s.atk}   DEF ${s.def}   MAG ${s.mag}`,
      r.width / 2, contentBottom - 26,
      { align: 'center', color: '#a9c7ff', font: mono },
    );
    r.drawText('点物品→装备；点已装备→卸下；顶部切换「装备 / 魔法」；点右下角 × 关闭', r.width / 2, contentBottom - 14, {
      align: 'center', color: '#555b6b', font: '8px monospace',
    });

    // 屏幕最底部：Banner 广告预留位（后续在此 _bannerRect 内创建真实广告）
    const br = this._bannerRect(r);
    r.drawRect(br.x, br.y, br.w, br.h, '#141726');
    r.drawRect(br.x, br.y, br.w, 1, '#2a2e3d'); // 与内容区顶边分隔线
    r.drawText('广告位（Banner 预留）', br.x + br.w / 2, br.y + br.h / 2, {
      align: 'center', baseline: 'middle', color: '#3a3f55', font: '8px monospace',
    });
  }
}
