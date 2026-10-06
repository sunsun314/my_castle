import OverlayScene from './overlay';
import { ROOMS, getRoom } from '../../config/rooms';

/**
 * 世界地图菜单（覆盖层场景）。
 *
 * 与背包菜单**同源的骨架**（继承 OverlayScene：全屏遮罩 / 屏蔽游戏输入 /
 * 右下角关闭按钮 / 底部 Banner 广告位），内容为「世界地图」：把房间按左右顺序
 * 横向排成一条线，房间之间画连通线，高亮**当前所在房间**并标出玩家位置。
 *
 * 房间数据集中在 config/rooms.js，界面随数据自动变化（加房间/改邻接无需改这里）。
 */
export default class MapScene extends OverlayScene {
  constructor(app, world) {
    super(app, '菜单 · 地图');
    this.world = world;
    this.player = world.player;
    this.map = world.map;
  }

  update() {
    if (this.handleCloseInput()) return;
  }

  /** 玩家当前所在房间 */
  currentRoom() {
    return getRoom(this.world.roomId);
  }

  /** 地图区（内容区，位于标题之下、信息行与 Banner 之上） */
  _panelRect(r) {
    const top = 26;
    const bottom = this._bannerRect(r).y - 22; // 给下方一行信息留位置
    return { x: 12, y: top, w: r.width - 24, h: Math.max(40, bottom - top) };
  }

  render(r) {
    // 全屏不透明底 —— 盖住下方战斗画面
    r.drawRect(0, 0, r.width, r.height, '#0e1020');

    this.drawTitle(r);
    this.drawClose(r);

    const panel = this._panelRect(r);
    this._renderMap(r, panel);
    this._renderInfo(r, panel);

    // 底部 Banner 广告预留位（与背包一致）
    this.drawBanner(r);
  }

  /** 横向线性排布：每间房一个格子，之间画连通线，高亮当前房间 */
  _renderMap(r, panel) {
    const curId = this.world.roomId;
    const n = ROOMS.length;
    const gap = Math.max(6, panel.w * 0.02);
    const cw = (panel.w - gap * (n - 1)) / n;
    const cy = panel.y + panel.h / 2;
    const ch = Math.min(panel.h - 12, cw * 0.75);
    const boxY = cy - ch / 2;

    r.drawRect(panel.x, panel.y, panel.w, panel.h, '#12141f'); // 地图底
    r.drawRect(panel.x, panel.y, panel.w, 1, '#2a2e3d');

    // 先画房间之间的连通线（有邻接才亮）
    for (let i = 0; i < n - 1; i++) {
      const x = panel.x + i * (cw + gap);
      const linked = ROOMS[i].right === ROOMS[i + 1].id;
      r.drawRect(x + cw, cy - 1, gap, 2, linked ? '#4aa3ff' : '#2a2e3d');
    }

    ROOMS.forEach((rm, i) => {
      const x = panel.x + i * (cw + gap);
      const active = rm.id === curId;
      r.drawRect(x, boxY, cw, ch, active ? '#24406b' : '#181c2b');
      r.drawRect(x, boxY, cw, 2, active ? '#4aa3ff' : '#2a2e3d');
      r.drawText(rm.name, x + cw / 2, boxY + ch / 2 - 6, {
        align: 'center', baseline: 'middle',
        color: active ? '#ffffff' : '#8a8f98', font: '9px sans-serif',
      });
      r.drawText(active ? '● 当前' : '未探索', x + cw / 2, boxY + ch / 2 + 7, {
        align: 'center', baseline: 'middle',
        color: active ? '#7ee787' : '#555b6b', font: '8px monospace',
      });
    });

    // 玩家圆点：映射到当前房间格子内的相对位置
    const box = ROOMS.findIndex((rm) => rm.id === curId);
    if (box >= 0) {
      const x = panel.x + box * (cw + gap);
      const nx = this.map.pixelWidth ? this.player.cx / this.map.pixelWidth : 0;
      const px = x + Math.max(0, Math.min(1, nx)) * cw;
      r.drawCircle(px, cy, 3, { fill: '#ffd166', alpha: 0.95 });
      r.drawCircle(px, cy, 3, { stroke: '#0b1020', alpha: 0.8, lineWidth: 1 });
    }
  }

  /** 当前房间名 + 房间序号 */
  _renderInfo(r, panel) {
    const cur = this.currentRoom();
    const y = panel.y + panel.h + 4;
    const idx = ROOMS.findIndex((rm) => rm.id === this.world.roomId);
    r.drawText(`当前房间：${cur ? cur.name : '未知区域'}`, 12, y, {
      align: 'left', color: '#e6e6e6', font: '9px sans-serif',
    });
    r.drawText(`${idx + 1}/${ROOMS.length}`, r.width - 12, y, {
      align: 'right', color: '#8a8f98', font: '9px monospace',
    });
  }
}
