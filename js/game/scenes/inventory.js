import Scene from './scene';

const SLOTS = ['weapon', 'armor', 'ring'];
const SLOT_LABEL = { weapon: '武器', armor: '防具', ring: '戒指' };

/**
 * 背包 / 装备管理菜单（覆盖层场景）。
 *
 * 设计要点：
 *  - 作为「栈顶场景」存在。SceneManager.update 只驱动栈顶，因此本场景打开时，
 *    下方 PlayScene（战斗世界）自动冻结、不再结算；关闭（pop）后立刻恢复。
 *  - SceneManager.render 从栈底到栈顶依次绘制，本场景铺满不透明底，
 *    直接盖住当前所有战斗元素。
 *  - 交互统一走 input.tapIn(rect)：点背包物品 → 装备；点已装备 → 卸下；点 × → 关闭。
 */
export default class InventoryScene extends Scene {
  constructor(app, player) {
    super(app);
    this.player = player;
  }

  // ---- 布局（update / render 共用，保证「点哪画哪」一致）----

  _closeRect(r) {
    return { x: r.width - 30, y: 6, w: 22, h: 18 };
  }

  _slotRects(r) {
    const x = 10;
    const w = Math.floor(r.width * 0.42);
    const top = 40;
    const h = 22;
    return SLOTS.map((slot, i) => ({
      slot,
      rect: { x, y: top + i * (h + 4), w, h },
    }));
  }

  _itemRects(r) {
    const x = Math.floor(r.width * 0.5) + 4;
    const w = r.width - x - 10;
    const top = 40;
    const h = 16;
    return this.player.inventory.map((item, i) => ({
      item,
      rect: { x, y: top + i * (h + 3), w, h },
    }));
  }

  // ---- 更新：只处理菜单交互（世界由栈机制冻结）----

  update() {
    const input = this.app.input;
    const r = this.app.renderer;

    if (input.tapIn(this._closeRect(r))) { this.close(); return; }

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

    // 全屏不透明底 —— 直接覆盖当前所有战斗元素
    r.drawRect(0, 0, r.width, r.height, '#0e1020');

    // 标题
    r.drawText('背包 / 装备', r.width / 2, 8, {
      align: 'center', color: '#e6e6e6', font: 'bold 11px sans-serif',
    });

    // 关闭按钮
    const cr = this._closeRect(r);
    r.drawRect(cr.x, cr.y, cr.w, cr.h, '#3a3f55');
    r.drawText('×', cr.x + cr.w / 2, cr.y + cr.h / 2, {
      align: 'center', baseline: 'middle', color: '#ffffff', font: 'bold 13px sans-serif',
    });

    // 左列：已装备的槽位
    r.drawText('已装备', 10, 28, { color: '#8a8f98', font: mono });
    for (const { slot, rect } of this._slotRects(r)) {
      const it = p.equipment[slot];
      r.drawRect(rect.x, rect.y, rect.w, rect.h, it ? '#1c2740' : '#171a26');
      r.drawRect(rect.x, rect.y, 3, rect.h, it ? '#4aa3ff' : '#2a2e3d');
      r.drawText(SLOT_LABEL[slot], rect.x + 8, rect.y + 3, { color: '#8a8f98', font: mono });
      r.drawText(it ? it.name : '（空）', rect.x + 40, rect.y + 3, {
        color: it ? '#e6e6e6' : '#555b6b', font: mono,
      });
    }

    // 右列：背包
    const rx = Math.floor(r.width * 0.5) + 4;
    r.drawText('背包', rx, 28, { color: '#8a8f98', font: mono });
    const items = this._itemRects(r);
    if (!items.length) {
      r.drawText('（空）', rx, 42, { color: '#555b6b', font: mono });
    }
    for (const { item, rect } of items) {
      const tag = item.slot
        ? SLOT_LABEL[item.slot]
        : (item.type === 'buff' ? '药水' : '道具');
      r.drawRect(rect.x, rect.y, rect.w, rect.h, '#171a26');
      r.drawText(item.name, rect.x + 6, rect.y + 3, { color: '#e6e6e6', font: mono });
      r.drawText(tag, rect.x + rect.w - 6, rect.y + 3, {
        align: 'right', color: '#8a8f98', font: '8px monospace',
      });
    }

    // 底部：属性预览（换装即时生效的反馈）+ 操作提示
    const s = p.stats;
    r.drawText(
      `HP ${Math.ceil(p.hp)}/${s.maxHp}   ATK ${s.atk}   DEF ${s.def}   MAG ${s.mag}`,
      r.width / 2, r.height - 26,
      { align: 'center', color: '#a9c7ff', font: mono },
    );
    r.drawText('点背包物品→装备；点已装备→卸下；点 × 关闭', r.width / 2, r.height - 14, {
      align: 'center', color: '#555b6b', font: '8px monospace',
    });
  }
}
