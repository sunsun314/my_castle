import Scene from './scene';
import { ELEMENT_LABEL, ATTACK_TYPE_LABEL } from '../elements';
import { ITEM_SLOTS } from '../../config/items';
import { STAT_KEYS } from '../stats';

const SLOT_LABEL = { weapon: '武器', armor: '防具', ring: '戒指', subweapon: '副武器' };
const STAT_LABEL = { maxHp: '生命', maxMp: '魔上限', atk: '攻击', def: '防御', mag: '魔力' };

/**
 * 分类页签：由 ITEM_SLOTS 驱动（新增一种装备槽会自动多出一个页签），
 * 末尾再补一个「道具」页签收纳无槽位的使用类物品（药水等）。
 */
const CATEGORIES = [
  ...ITEM_SLOTS.map((slot) => ({ key: slot, label: SLOT_LABEL[slot] || slot, slot })),
  { key: 'item', label: '道具', slot: null },
];
const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
// 旧入口别名（HUD「背包 / 魔法」按钮）
const TAB_ALIAS = { gear: 'weapon', magic: 'subweapon' };

/**
 * 底部预留的 Banner 广告高度（虚拟像素）。
 * 后续接入广告时，在该矩形区域内创建并定位 wx.createBannerAd 即可。
 */
export const BANNER_H = 48;

/**
 * 背包 / 装备管理菜单（覆盖层场景）。
 *
 * 顶部是**按装备栏分类**的页签：武器 / 防具 / 戒指 / 副武器 / 道具。
 * 每个页签左列显示该栏的已装备槽（点一下卸下）与**对比预览**，右列显示背包中
 * 属于该栏的物品。物品采用「点一次选中看对比、再点一次装备 / 使用」的两段式操作。
 *
 * 设计要点：
 *  - 作为「栈顶场景」存在。SceneManager.update 只驱动栈顶，因此本场景打开时，
 *    下方 PlayScene（战斗世界）自动冻结、不再结算；关闭（pop）后立刻恢复。
 *  - SceneManager.render 从栈底到栈顶依次绘制，本场景铺满不透明底，
 *    直接盖住当前所有战斗元素。
 *  - 交互统一走 input.tapIn(rect)：点页签切分类；点物品选中（预览）→ 再点装备；
 *    点已装备槽卸下；点右下角 × 关闭。
 *  - 屏幕最底部预留一条 Banner 广告位（见 BANNER_H / _bannerRect）。
 */
export default class InventoryScene extends Scene {
  constructor(app, player, tab = 'weapon') {
    super(app);
    this.player = player;
    let key = TAB_ALIAS[tab] || tab;
    if (!CATEGORY_KEYS.includes(key)) key = 'weapon';
    this.tab = key;
    this.selected = null; // 当前选中（用于对比预览）的物品
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

  /** 顶部各分类页签的命中矩形 */
  _tabRects(r) {
    const gap = 6;
    const w = Math.min(46, Math.floor((r.width - 20 - gap * (CATEGORIES.length - 1)) / CATEGORIES.length));
    const h = 14;
    const total = w * CATEGORIES.length + gap * (CATEGORIES.length - 1);
    const startX = (r.width - total) / 2;
    const y = 20;
    return CATEGORIES.map((c, i) => ({
      key: c.key,
      label: c.label,
      rect: { x: startX + i * (w + gap), y, w, h },
    }));
  }

  /** 当前分类对应的装备槽（「道具」页签无槽位，返回 null） */
  _curSlot() {
    const c = CATEGORIES.find((x) => x.key === this.tab);
    return c ? c.slot : null;
  }

  /** 当前页要显示的装备槽（无槽位的「道具」页返回空数组） */
  _slots() {
    const s = this._curSlot();
    return s ? [s] : [];
  }

  /** 当前页要显示的背包物品（严格按装备栏归类；「道具」页收无槽位物品） */
  _bagItems() {
    const slot = this._curSlot();
    return this.player.inventory.filter((it) => (slot ? it.slot === slot : !it.slot));
  }

  _slotRects(r) {
    const x = 10;
    const w = Math.floor(r.width * 0.42);
    return this._slots().map((slot, i) => ({
      slot,
      rect: { x, y: 52 + i * 26, w, h: 22 },
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

  /** 物品右列描述文案（按装备栏给不同重点） */
  _desc(item) {
    const el = item.element ? ELEMENT_LABEL[item.element] : '';
    const at = item.attackType ? (ATTACK_TYPE_LABEL[item.attackType] || '') : '';
    if (item.slot === 'weapon') {
      const reach = item.attack ? item.attack.reach : '—';
      return `${el}${at} 攻+${(item.flat && item.flat.atk) || 0} 距${reach}`;
    }
    if (item.slot === 'subweapon') {
      const cost = item.magic && item.magic.cost != null ? item.magic.cost : '—';
      return `${el}${at} 魔+${(item.flat && item.flat.mag) || 0} 耗${cost}`;
    }
    const parts = [];
    if (item.flat) for (const k in item.flat) parts.push(`${STAT_LABEL[k] || k}+${item.flat[k]}`);
    if (item.mul) for (const k in item.mul) parts.push(`${STAT_LABEL[k] || k}×${item.mul[k]}`);
    if (item.type === 'buff') return `增益${item.time}s ${parts.join(' ')}`;
    return parts.join(' ') || '道具';
  }

  // ---- 更新：只处理菜单交互（世界由栈机制冻结）----

  update() {
    const input = this.app.input;
    const r = this.app.renderer;

    if (input.tapIn(this._closeRect(r))) { this.close(); return; }

    // 分类页签：切换时清空选中
    for (const t of this._tabRects(r)) {
      if (input.tapIn(t.rect)) { this.tab = t.key; this.selected = null; return; }
    }
    for (const row of this._slotRects(r)) {
      if (input.tapIn(row.rect)) { this.player.unequip(row.slot); this.selected = null; return; }
    }
    // 物品：第一次点选中（看对比），再点同一件才装备 / 使用
    for (const row of this._itemRects(r)) {
      if (input.tapIn(row.rect)) {
        if (this.selected === row.item) {
          this.player.useItem(row.item);
          this.selected = null;
        } else {
          this.selected = row.item;
        }
        return;
      }
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
    const slot = this._curSlot();
    const cur = CATEGORIES.find((c) => c.key === this.tab) || CATEGORIES[0];
    const contentBottom = r.height - BANNER_H; // 内容区底部（Banner 之上）

    // 全屏不透明底 —— 直接覆盖当前所有战斗元素
    r.drawRect(0, 0, r.width, r.height, '#0e1020');

    // 标题
    r.drawText('菜单 · 背包 / 装备', r.width / 2, 6, {
      align: 'center', color: '#e6e6e6', font: 'bold 11px sans-serif',
    });

    // 分类页签：武器 / 防具 / 戒指 / 副武器 / 道具
    for (const t of this._tabRects(r)) {
      const active = this.tab === t.key;
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

    // 左列：当前分类的已装备槽（「道具」页改为显示生效中的增益）
    r.drawText(slot ? `已装备 · ${cur.label}` : '生效中的增益', 10, 40, { color: '#8a8f98', font: mono });
    if (slot) {
      for (const { slot: s, rect } of this._slotRects(r)) {
        const it = p.equipment[s];
        r.drawRect(rect.x, rect.y, rect.w, rect.h, it ? '#1c2740' : '#171a26');
        r.drawRect(rect.x, rect.y, 3, rect.h, it ? '#4aa3ff' : '#2a2e3d');
        r.drawText(SLOT_LABEL[s], rect.x + 8, rect.y + 3, { color: '#8a8f98', font: mono });
        r.drawText(it ? it.name : '（空）', rect.x + 48, rect.y + 3, {
          color: it ? '#e6e6e6' : '#555b6b', font: mono,
        });
      }
    } else {
      const buffs = (p.buffs && p.buffs.list) || [];
      if (!buffs.length) {
        r.drawText('（无）', 10, 54, { color: '#555b6b', font: mono });
      }
      buffs.slice(0, 5).forEach((b, i) => {
        r.drawText(`${b.name}  ${Math.ceil(b.timeLeft)}s`, 10, 54 + i * 14, { color: '#f0c674', font: mono });
      });
    }

    // 左列下半：对比预览（选中物品 → 换上/使用后的属性变化）
    this._renderPreview(r, 84);

    // 右列：背包中属于当前装备栏的物品
    const rx = Math.floor(r.width * 0.5) + 4;
    r.drawText(`背包 · ${cur.label}`, rx, 40, { color: '#8a8f98', font: mono });
    const items = this._itemRects(r);
    if (!items.length) {
      r.drawText('（空）', rx, 54, { color: '#555b6b', font: mono });
    }
    for (const { item, rect } of items) {
      const isSel = this.selected === item;
      r.drawRect(rect.x, rect.y, rect.w, rect.h, isSel ? '#20304d' : '#171a26');
      if (isSel) r.drawRect(rect.x, rect.y, 3, rect.h, '#ffd166');
      r.drawText(`${isSel ? '▸' : ''}${item.name}`, rect.x + 6, rect.y + 3, {
        color: isSel ? '#ffffff' : '#e6e6e6', font: mono,
      });
      r.drawText(this._desc(item), rect.x + rect.w - 6, rect.y + 3, {
        align: 'right', color: '#8a8f98', font: '8px monospace',
      });
    }

    // 副武器页：当前生效的魔法摘要（放在底部属性之上）
    if (this.tab === 'subweapon') {
      const prof = p.getMagicProfile();
      const el = prof.element ? ELEMENT_LABEL[prof.element] : '无';
      const at = ATTACK_TYPE_LABEL[prof.attackType] || '';
      r.drawText(`当前魔法：${el}${at}  耗${prof.cost}  冷却${prof.cooldown}s`, r.width / 2, contentBottom - 38, {
        align: 'center', color: '#a9c7ff', font: mono,
      });
    }

    // 底部：属性预览（换装即时生效的反馈）+ 操作提示（均位于 Banner 之上）
    const s = p.stats;
    r.drawText(
      `HP ${Math.ceil(p.hp)}/${s.maxHp}   ATK ${s.atk}   DEF ${s.def}   MAG ${s.mag}`,
      r.width / 2, contentBottom - 26,
      { align: 'center', color: '#a9c7ff', font: mono },
    );
    r.drawText('点物品选中看对比，再点同一件装备/使用；点已装备槽卸下；顶部切分类', r.width / 2, contentBottom - 14, {
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

  /** 对比预览面板：显示选中物品换上 / 使用后的逐项属性变化（绿升红降） */
  _renderPreview(r, top) {
    const p = this.player;
    const mono = '9px monospace';
    r.drawText('对比预览', 10, top, { color: '#8a8f98', font: mono });
    const item = this.selected;
    if (!item) {
      r.drawText('（点物品查看变化）', 10, top + 14, { color: '#555b6b', font: '8px monospace' });
      return;
    }
    const preview = p.previewStats(item);
    const equipped = item.slot ? p.equipment[item.slot] : null;
    const head = item.slot
      ? `${equipped ? equipped.name : '（空）'} → ${item.name}`
      : `${item.name}（使用后）`;
    r.drawText(head, 10, top + 13, { color: '#e6e6e6', font: mono });
    for (let i = 0; i < STAT_KEYS.length; i++) {
      const k = STAT_KEYS[i];
      const a = p.stats[k];
      const b = preview ? preview[k] : a;
      const d = b - a;
      const color = d > 0 ? '#7ee787' : (d < 0 ? '#ff5a5a' : '#8a8f98');
      const tail = d === 0 ? '' : ` (${d > 0 ? '+' : ''}${d})`;
      r.drawText(`${STAT_LABEL[k]} ${a}→${b}${tail}`, 10, top + 26 + i * 12, {
        color, font: '9px monospace',
      });
    }
  }
}
