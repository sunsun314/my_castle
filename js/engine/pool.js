/**
 * 对象池：复用高频创建/销毁的对象（子弹、粒子、敌人等），减少 GC 抖动。
 */
export default class Pool {
  constructor() {
    this._dic = {};
  }

  _pool(name) {
    if (!this._dic[name]) this._dic[name] = [];
    return this._dic[name];
  }

  /** 取出一个实例：池空则 new，否则复用 */
  get(name, className) {
    const pool = this._pool(name);
    return pool.length ? pool.shift() : new className();
  }

  /** 回收实例 */
  recover(name, instance) {
    this._pool(name).push(instance);
  }

  clear() {
    this._dic = {};
  }
}
