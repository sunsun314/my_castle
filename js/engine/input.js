import { DISPLAY } from './display';

const JOY_RADIUS = 28;
const JOY_DEADZONE = 0.16;
const UP_DEADZONE = 0.3;     // 判定「上」所需的最小上推幅度
const DOWN_DEADZONE = 0.3;   // 判定「下」所需的最小下推幅度
const DOWN_CONE = Math.tan(Math.PI / 6); // 正下 ±30° 锥（tan30°≈0.577）
const BTN_RADIUS = 18;

/**
 * 输入管理器：把微信的多点触控事件抽象为「一个虚拟摇杆 + 若干虚拟按钮」。
 *
 * 对游戏逻辑暴露：
 *   input.axisX          -1~1 横向输入（含死区）
 *   input.axisY          -1~1 纵向输入
 *   input.down(name)     按钮是否按住
 *   input.pressed(name)  按钮本帧是否刚按下（边沿触发）
 *   input.endFrame()     每帧结束调用一次，用于刷新边沿状态
 *
 * 关键点：用 touch 的 identifier 追踪每一根手指，保证「左手移动 + 右手按键」
 * 互不干扰、且松开某一根手指不会误松开其它手指。
 */
export default class Input {
  constructor() {
    this.axisX = 0;
    this.axisY = 0;
    this.buttons = {};   // name -> 是否按住
    this._prev = {};     // 上一帧状态（用于边沿判定）
    this.joystick = {
      active: false,
      id: null,
      baseX: 0,
      baseY: 0,
      knobX: 0,
      knobY: 0,
      radius: JOY_RADIUS,
    };
    this.buttonsDefs = [];
    this.taps = [];      // 本帧未被 A/B 按钮消费的点击（供背包按钮/菜单等 UI 命中）

    this.layout();
    this._bind();
  }

  /** 依据当前虚拟分辨率摆放右侧按钮（横屏后需重算） */
  layout() {
    const vw = DISPLAY.viewWidth;
    const vh = DISPLAY.viewHeight;
    this.buttonsDefs = [
      // 按钮顺序 = 命中优先级：A / B 保持不变，新增的「变身」放在最上方、优先级最低，
      // 避免大判定半径（r*1.5）下与 A/B 的边界采样相互抢占。
      { name: 'jump', label: 'A', x: vw - 34, y: vh - 36, r: BTN_RADIUS, id: null, down: false },
      { name: 'attack', label: 'B', x: vw - 78, y: vh - 26, r: BTN_RADIUS, id: null, down: false },
      { name: 'transform', label: '变', x: vw - 34, y: vh - 74, r: BTN_RADIUS, id: null, down: false },
    ];
    this.buttons = {};
    this._prev = {};
    for (const b of this.buttonsDefs) {
      this.buttons[b.name] = false;
      this._prev[b.name] = false;
    }
  }

  _changed(e) {
    if (e.changedTouches && e.changedTouches.length) return e.changedTouches;
    return e.touches || [];
  }

  _toVirtual(clientX, clientY) {
    const s = DISPLAY.scale;
    return { x: clientX / s, y: clientY / s };
  }

  _bind() {
    wx.onTouchStart((e) => this._onStart(e));
    wx.onTouchMove((e) => this._onMove(e));
    wx.onTouchEnd((e) => this._onEnd(e));
    wx.onTouchCancel((e) => this._onEnd(e));
  }

  _hitButton(vx, vy) {
    for (const b of this.buttonsDefs) {
      const dx = vx - b.x;
      const dy = vy - b.y;
      const rr = b.r * 1.5;
      if (dx * dx + dy * dy <= rr * rr) return b;
    }
    return null;
  }

  _onStart(e) {
    for (const t of this._changed(e)) {
      const { x, y } = this._toVirtual(t.clientX, t.clientY);

      // 1) 优先判定右侧按钮（A/B 属于游戏输入，不算 UI 点击）
      const b = this._hitButton(x, y);
      if (b && b.id === null) {
        b.id = t.identifier;
        b.down = true;
        this.buttons[b.name] = true;
        continue;
      }

      // 2) 其余触点记为「UI 点击」，供背包按钮 / 菜单命中检测
      this.taps.push({ x, y });

      // 3) 左半屏按下则激活悬浮摇杆（与 UI 点击按各自矩形独立判定，互不冲突）
      if (this.joystick.active) continue;
      if (x < DISPLAY.viewWidth * 0.5 && y > DISPLAY.viewHeight * 0.25) {
        this.joystick.active = true;
        this.joystick.id = t.identifier;
        this.joystick.baseX = x;
        this.joystick.baseY = y;
        this.joystick.knobX = x;
        this.joystick.knobY = y;
      }
    }
  }

  _onMove(e) {
    for (const t of this._changed(e)) {
      if (this.joystick.active && t.identifier === this.joystick.id) {
        const { x, y } = this._toVirtual(t.clientX, t.clientY);
        const dx = x - this.joystick.baseX;
        const dy = y - this.joystick.baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const k = dist > this.joystick.radius ? this.joystick.radius / dist : 1;
        this.joystick.knobX = this.joystick.baseX + dx * k;
        this.joystick.knobY = this.joystick.baseY + dy * k;
      }
    }
    this._recomputeAxis();
  }

  _onEnd(e) {
    for (const t of this._changed(e)) {
      if (this.joystick.active && t.identifier === this.joystick.id) {
        this.joystick.active = false;
        this.joystick.id = null;
        this.joystick.knobX = this.joystick.baseX;
        this.joystick.knobY = this.joystick.baseY;
      }
      for (const b of this.buttonsDefs) {
        if (b.id === t.identifier) {
          b.id = null;
          b.down = false;
          this.buttons[b.name] = false;
        }
      }
    }
    this._recomputeAxis();
  }

  _recomputeAxis() {
    const j = this.joystick;
    if (!j.active) {
      this.axisX = 0;
      this.axisY = 0;
      return;
    }
    let ax = (j.knobX - j.baseX) / j.radius;
    let ay = (j.knobY - j.baseY) / j.radius;
    ax = Math.max(-1, Math.min(1, ax));
    ay = Math.max(-1, Math.min(1, ay));
    if (Math.abs(ax) < JOY_DEADZONE) ax = 0;
    if (Math.abs(ay) < JOY_DEADZONE) ay = 0;
    this.axisX = ax;
    this.axisY = ay;
  }

  /**
   * 「上」方向：正上 ±45° 锥形判定。
   * 判的是方向而非力度——只要推出死区，|x| ≤ |y| 即在锥内（边界 45° 也算上）。
   * 用方向锥而非整片上区，可避免「边跑边跳」误触发大跳。
   */
  get up() {
    if (this.axisY > -UP_DEADZONE) return false;
    return Math.abs(this.axisX) <= -this.axisY;
  }

  /**
   * 「下」方向：正下 ±30° 锥形判定（用于下蹲）。
   * 注意：不能命名为 down —— 会与 down(name) 按钮方法重名而覆盖掉。
   */
  get downward() {
    if (this.axisY < DOWN_DEADZONE) return false;
    return Math.abs(this.axisX) <= this.axisY * DOWN_CONE;
  }

  down(name) {
    return !!this.buttons[name];
  }

  pressed(name) {
    return !!this.buttons[name] && !this._prev[name];
  }

  /**
   * 命中一次「UI 点击」：若本帧有触点落在矩形内，消费它并返回 true。
   * 供背包按钮、菜单条目等使用；消费后不会被同帧其它 UI 重复命中。
   */
  tapIn(rect) {
    for (let i = 0; i < this.taps.length; i++) {
      const t = this.taps[i];
      if (t.x >= rect.x && t.x <= rect.x + rect.w
        && t.y >= rect.y && t.y <= rect.y + rect.h) {
        this.taps.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  /** 每帧渲染结束后调用一次 */
  endFrame() {
    for (const b of this.buttonsDefs) this._prev[b.name] = this.buttons[b.name];
    this.taps.length = 0;
  }
}
