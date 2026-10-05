/**
 * 2D 跟随相机。
 *
 * - 以目标中心为焦点，带中心死区（玩家在死区内相机不动，避免画面晃动）；
 * - 平滑插值跟随；
 * - 钳制在关卡边界内，保证不会露出关卡外的空白。
 */
export default class Camera {
  constructor(viewWidth, viewHeight) {
    this.x = 0; // 视口左上角的世界坐标
    this.y = 0;
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.deadX = 14;
    this.deadY = 10;
    this.smooth = 10; // 每秒收敛系数，越大越跟手
  }

  follow(target, map, dt) {
    const cx = target.x + target.w / 2;
    const cy = target.y + target.h / 2;

    let tx = this.x;
    let ty = this.y;

    const centerX = this.x + this.viewWidth / 2;
    const centerY = this.y + this.viewHeight / 2;

    if (cx < centerX - this.deadX) tx = cx + this.deadX - this.viewWidth / 2;
    else if (cx > centerX + this.deadX) tx = cx - this.deadX - this.viewWidth / 2;

    if (cy < centerY - this.deadY) ty = cy + this.deadY - this.viewHeight / 2;
    else if (cy > centerY + this.deadY) ty = cy - this.deadY - this.viewHeight / 2;

    tx = this._clamp(tx, 0, Math.max(0, map.pixelWidth - this.viewWidth));
    ty = this._clamp(ty, 0, Math.max(0, map.pixelHeight - this.viewHeight));

    const k = Math.min(1, dt * this.smooth);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
  }

  _clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }
}
