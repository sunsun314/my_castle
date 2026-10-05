/**
 * 固定步长游戏主循环。
 *
 * 逻辑以固定 STEP（默认 1/60 秒）推进，与屏幕刷新率解耦：
 *  - 120Hz 手机上物理速度不会变快；
 *  - 掉帧时用 while 追帧（限制上限，避免死亡螺旋）。
 * render 收到 alpha（0~1）可用于插值渲染，本骨架先不做插值。
 */
export default class GameLoop {
  constructor({ update, render, step = 1 / 60, maxFrame = 0.25, maxSteps = 5 }) {
    this.update = update;
    this.render = render;
    this.step = step;
    this.maxFrame = maxFrame;
    this.maxSteps = maxSteps;

    this.acc = 0;
    this.last = 0;
    this.running = false;
    this.fps = 0;
    this._fpsAcc = 0;
    this._fpsFrames = 0;

    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = Date.now();
    requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
  }

  _tick() {
    if (!this.running) return;

    const now = Date.now();
    let frameTime = (now - this.last) / 1000;
    this.last = now;
    if (frameTime > this.maxFrame) frameTime = this.maxFrame;

    // FPS 统计（每 0.5s 刷新一次）
    this._fpsAcc += frameTime;
    this._fpsFrames += 1;
    if (this._fpsAcc >= 0.5) {
      this.fps = Math.round(this._fpsFrames / this._fpsAcc);
      this._fpsAcc = 0;
      this._fpsFrames = 0;
    }

    this.acc += frameTime;
    let steps = 0;
    while (this.acc >= this.step && steps < this.maxSteps) {
      this.update(this.step);
      this.acc -= this.step;
      steps += 1;
    }
    // 追不上就丢弃余量，防止雪崩
    if (steps >= this.maxSteps) this.acc = 0;

    this.render(this.acc / this.step);

    requestAnimationFrame(this._tick);
  }
}
