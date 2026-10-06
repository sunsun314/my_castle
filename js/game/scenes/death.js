import OverlayScene from './overlay';

/**
 * 死亡菜单（覆盖层场景）。
 *
 * 玩家血量归零后由 PlayScene 压入栈顶：作为栈顶场景，SceneManager 只驱动它，
 * 下方战斗世界（物理 / 敌人 / 计时）自动冻结 = 「停止一切活动」。
 *
 * 画面结构（自上而下）：
 *   ┌─────────────────────────────┐
 *   │      顶部 Banner 广告位       │  ← drawTopBanner（基类提供）
 *   ├─────────────────────────────┤
 *   │         你已阵亡             │
 *   │    ┌───────────────────┐    │
 *   │    │     从头开始       │    │  ← 清空存档 + 全新一局
 *   │    ├───────────────────┤    │
 *   │    │  从最近的存档开始   │    │  ← 读取存档并还原（无存档时置灰不可点）
 *   │    └───────────────────┘    │
 *   ├─────────────────────────────┤
 *   │      底部 Banner 广告位       │  ← drawBanner（基类提供）
 *   └─────────────────────────────┘
 *
 * 本场景不画关闭按钮：必须二选一才能继续。
 */
export default class DeathScene extends OverlayScene {
  constructor(app, world) {
    super(app, '你已阵亡');
    this.world = world;
    // 进菜单时冻结一次存档可用性：选项文字与交互判定共用同一快照
    this.hasSave = world.hasSave();
  }

  /** 两个选项的命中矩形（位于上下 Banner 之间的内容区，居中竖排） */
  _optionRects(r) {
    const top = this._topBannerRect(r);
    const bottom = this._bannerRect(r);
    const w = Math.min(190, r.width - 56);
    const h = 26;
    const gap = 12;
    const centerY = (top.y + top.h + bottom.y) / 2;
    const x = (r.width - w) / 2;
    return {
      restart: { x, y: centerY - h - gap / 2, w, h },
      cont: { x, y: centerY + gap / 2, w, h },
    };
  }

  update() {
    const input = this.app.input;
    const r = this.app.renderer;
    const rects = this._optionRects(r);

    if (input.tapIn(rects.restart)) {
      this.world.restartGame();
      this.close();
      return;
    }
    if (this.hasSave && input.tapIn(rects.cont)) {
      this.world.continueGame();
      this.close();
    }
  }

  render(r) {
    // 蒙版：半透明压暗下方场景（仍隐约可见「阵亡现场」）
    r.drawRect(0, 0, r.width, r.height, '#05060c', 0.82);

    const rects = this._optionRects(r);
    const cx = r.width / 2;

    // 标题
    r.drawText('你已阵亡', cx, rects.restart.y - 36, {
      align: 'center', color: '#e5484d', font: 'bold 20px sans-serif',
    });
    r.drawText('选择接下来要怎么做', cx, rects.restart.y - 17, {
      align: 'center', color: '#8a8f98', font: '9px sans-serif',
    });

    // 两个选项
    this._drawOption(r, rects.restart, '从头开始', '#ff7043', false);
    this._drawOption(
      r, rects.cont,
      this.hasSave ? '从最近的存档开始' : '暂无存档',
      this.hasSave ? '#4aa3ff' : '#3a3f55',
      !this.hasSave
    );

    // 顶部 / 底部 Banner 广告位（画在内容之后，确保在最上层）
    this.drawTopBanner(r);
    this.drawBanner(r);
  }

  _drawOption(r, rect, label, accent, disabled) {
    r.drawRect(rect.x, rect.y, rect.w, rect.h, disabled ? '#141726' : '#1c2740');
    r.drawRect(rect.x, rect.y, 3, rect.h, accent);
    r.drawText(label, rect.x + rect.w / 2, rect.y + rect.h / 2, {
      align: 'center', baseline: 'middle',
      color: disabled ? '#555b6b' : '#e6e6e6',
      font: 'bold 11px sans-serif',
    });
  }
}
