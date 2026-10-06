import Scene from './scene';

/**
 * 底部预留的 Banner 广告高度（虚拟像素）。
 * 后续接入广告时，在该矩形区域内创建并定位 wx.createBannerAd 即可。
 * 背包菜单（InventoryScene）与地图菜单（MapScene）共用同一个预留位。
 */
export const BANNER_H = 48;

/**
 * 覆盖层菜单基类（菜单骨架）。
 *
 * 统一的「菜单外壳」：全屏不透明底 + 屏蔽游戏输入 + 右下角关闭按钮 + 底部 Banner 广告位。
 * 子类只实现自己的内容（背包 = 物品/装备管理；地图 = 世界地图），
 * 交互统一走 input.tapIn(rect)，关闭走基类 close()。
 *
 * 与场景栈的配合（见 SceneManager）：
 *  - 作为栈顶场景时，update 只驱动栈顶 → 下方战斗世界自动冻结、不再结算；
 *  - render 从栈底到栈顶绘制，本类铺满不透明底，直接盖住战斗画面；
 *  - enter() 屏蔽游戏输入（跳跃/攻击/变身/摇杆），避免动作按钮的大判定半径
 *    抢走菜单控件的触点（曾出真 bug）；exit() 恢复。
 */
export default class OverlayScene extends Scene {
  constructor(app, title = '菜单') {
    super(app);
    this.modalTitle = title;
  }

  /** 进入菜单：屏蔽游戏输入（动作按钮 / 摇杆） */
  enter() {
    this.app.input.setGameInputEnabled(false);
  }

  /** 退出菜单：恢复游戏输入 */
  exit() {
    this.app.input.setGameInputEnabled(true);
  }

  /**
   * 关闭按钮矩形：右下角、位于「变」按钮正上方。
   * 由动作按钮（input.buttonsDefs 里 name==='transform'）的实际坐标反推，
   * 避免写死坐标（按钮一挪就失配）；同时避开其 r×1.5 的大判定圈。
   */
  _closeRect(r) {
    const w = 24, h = 16;
    const defs = (this.app && this.app.input && this.app.input.buttonsDefs) || [];
    const tf = defs.find((b) => b.name === 'transform');
    if (tf) {
      // 底部停在「变」按钮判定圆顶部上方 4px
      const y = Math.max(6, tf.y - tf.r * 1.5 - h - 4);
      return { x: tf.x - w / 2, y, w, h };
    }
    return { x: r.width - 32, y: r.height - 120, w, h };
  }

  /** 底部 Banner 广告预留位：整宽贴底 */
  _bannerRect(r) {
    return { x: 0, y: r.height - BANNER_H, w: r.width, h: BANNER_H };
  }

  /** 关闭：仅弹出自己，露出下方战斗场景并恢复其 update */
  close() {
    const stack = this.app.scenes.scenes;
    if (stack[stack.length - 1] === this) this.app.scenes.pop();
  }

  /** 子类 update 开头调用：命中关闭按钮则关闭并返回 true（本帧已处理，直接 return） */
  handleCloseInput() {
    if (this.app.input.tapIn(this._closeRect(this.app.renderer))) {
      this.close();
      return true;
    }
    return false;
  }

  /** 画公共标题（顶部居中） */
  drawTitle(r) {
    r.drawText(this.modalTitle, r.width / 2, 6, {
      align: 'center', color: '#e6e6e6', font: 'bold 11px sans-serif',
    });
  }

  /** 画公共关闭按钮（右下角） */
  drawClose(r) {
    const cr = this._closeRect(r);
    r.drawRect(cr.x, cr.y, cr.w, cr.h, '#3a3f55');
    r.drawText('×', cr.x + cr.w / 2, cr.y + cr.h / 2, {
      align: 'center', baseline: 'middle', color: '#ffffff', font: 'bold 13px sans-serif',
    });
    return cr;
  }

  /** 画公共 Banner 广告预留位（整宽贴底） */
  drawBanner(r) {
    const br = this._bannerRect(r);
    r.drawRect(br.x, br.y, br.w, br.h, '#141726');
    r.drawRect(br.x, br.y, br.w, 1, '#2a2e3d'); // 与内容区顶边的分隔线
    r.drawText('广告位（Banner 预留）', br.x + br.w / 2, br.y + br.h / 2, {
      align: 'center', baseline: 'middle', color: '#3a3f55', font: '8px monospace',
    });
    return br;
  }
}
