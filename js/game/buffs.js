/**
 * 限时增益（Buff）列表。
 *
 * 一个 buff 形如：
 *   { id, name, timeLeft, flat:{...}, mul:{...}, color, ... }
 *
 * 规则：
 *  - 用 timeLeft dt 倒计时（而非绝对时间戳），固定步长下更稳、暂停/切场景不会算错。
 *  - 同 id 再次施加 -> 刷新时长（不叠加）。若将来要叠加，改这里即可。
 *  - 任何增删/过期都会置 dirty，玩家侧据此重算属性。
 */
export default class BuffList {
  constructor() {
    this.list = [];
    this._dirty = false;
  }

  /** 施加一个 buff（def.time 或 def.dur 为持续秒数） */
  add(def) {
    if (!def || !def.id) return;
    const dur = def.time != null ? def.time : (def.dur != null ? def.dur : 1);
    const cur = this.list.find((b) => b.id === def.id);
    if (cur) {
      // 刷新时长，取较大值
      cur.timeLeft = Math.max(cur.timeLeft, dur);
    } else {
      this.list.push(Object.assign({}, def, { timeLeft: dur }));
    }
    this._dirty = true;
  }

  remove(id) {
    const i = this.list.findIndex((b) => b.id === id);
    if (i >= 0) {
      this.list.splice(i, 1);
      this._dirty = true;
    }
  }

  has(id) {
    return this.list.some((b) => b.id === id);
  }

  clear() {
    if (this.list.length) {
      this.list = [];
      this._dirty = true;
    }
  }

  /** 每帧倒计时；返回本帧是否有 buff 过期 */
  update(dt) {
    if (!this.list.length) return false;
    let expired = false;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      b.timeLeft -= dt;
      if (b.timeLeft <= 0) {
        this.list.splice(i, 1);
        expired = true;
      }
    }
    if (expired) this._dirty = true;
    return expired;
  }

  /** 取出并清除 dirty 标记（供玩家侧决定是否重算属性） */
  consumeDirty() {
    const d = this._dirty;
    this._dirty = false;
    return d;
  }
}
