/**
 * 极简事件总线（订阅/发布），供场景与实体使用。
 */
export default class Emitter {
  constructor() {
    this._handlers = {};
  }

  on(name, fn) {
    if (!this._handlers[name]) this._handlers[name] = [];
    this._handlers[name].push(fn);
    return this;
  }

  off(name, fn) {
    const list = this._handlers[name];
    if (!list) return this;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
    return this;
  }

  emit(name, ...args) {
    const list = this._handlers[name];
    if (!list) return;
    // 复制一份，允许回调中增删监听
    for (const fn of list.slice()) fn(...args);
  }
}
