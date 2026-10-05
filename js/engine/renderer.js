import { DISPLAY } from './display';

/**
 * 渲染器接口（抽象层）。
 *
 * 游戏逻辑只依赖下列方法，不直接接触 ctx。
 * 未来若要迁移到 WebGL，只需实现一个同接口的 WebGLRenderer 并替换，
 * 无需改动任何游戏/场景代码。
 */
export class Renderer {
  beginFrame() {}
  pushCamera(camera) {}
  popCamera() {}
  drawRect(x, y, w, h, color, alpha) {}
  drawCircle(cx, cy, r, opts) {}
  drawSprite(img, sx, sy, sw, sh, dx, dy, dw, dh) {}
  drawText(text, x, y, opts) {}
}

/**
 * Canvas2D 实现。所有坐标均为虚拟像素。
 */
export default class CanvasRenderer extends Renderer {
  constructor(canvas) {
    super();
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = DISPLAY.viewWidth;
    this.height = DISPLAY.viewHeight;
  }

  beginFrame() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, DISPLAY.screenWidth, DISPLAY.screenHeight);
    ctx.scale(DISPLAY.scale, DISPLAY.scale);
  }

  pushCamera(camera) {
    const ctx = this.ctx;
    ctx.save();
    // 取整避免亚像素抖动
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
  }

  popCamera() {
    this.ctx.restore();
  }

  drawRect(x, y, w, h, color, alpha = 1) {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  }

  drawCircle(cx, cy, r, opts = {}) {
    const ctx = this.ctx;
    ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (opts.fill) {
      ctx.fillStyle = opts.fill;
      ctx.fill();
    }
    if (opts.stroke) {
      ctx.lineWidth = opts.lineWidth || 1.5;
      ctx.strokeStyle = opts.stroke;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawSprite(img, sx, sy, sw, sh, dx, dy, dw, dh) {
    this.ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  drawImage(img, dx, dy, dw, dh) {
    this.ctx.drawImage(img, dx, dy, dw, dh);
  }

  drawText(text, x, y, opts = {}) {
    const ctx = this.ctx;
    ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
    ctx.fillStyle = opts.color || '#ffffff';
    ctx.font = opts.font || '10px sans-serif';
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'top';
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
  }
}
