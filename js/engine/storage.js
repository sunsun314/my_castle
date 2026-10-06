/**
 * 本地存储薄封装。
 *
 * 统一走微信本地缓存（wx.setStorageSync / getStorageSync / removeStorageSync）：
 * 完全免费，同一用户同小游戏上限 10MB（单 key ≤ 1MB），足够存一份存档 JSON。
 * 这里只做三件事：加统一前缀避免与其它数据冲突、异常兜底（读写失败不崩游戏）、
 * 以及把「空值」规整为 null。将来若接云存档，只需替换本文件实现。
 */

const PREFIX = 'mg2:';

/** 存档主键（实际写入 wx 的 key 为 'mg2:' + SAVE_KEY） */
export const SAVE_KEY = 'save.main';

/** 写入一个可 JSON 序列化的值；返回是否成功 */
export function write(key, value) {
  try {
    wx.setStorageSync(PREFIX + key, value);
    return true;
  } catch (e) {
    console.warn('[storage] 写入失败:', key, e);
    return false;
  }
}

/** 读取一个值；不存在 / 空 / 失败均返回 null */
export function read(key) {
  try {
    const v = wx.getStorageSync(PREFIX + key);
    return v === '' || v == null ? null : v;
  } catch (e) {
    console.warn('[storage] 读取失败:', key, e);
    return null;
  }
}

/** 删除一个 key */
export function erase(key) {
  try {
    wx.removeStorageSync(PREFIX + key);
    return true;
  } catch (e) {
    console.warn('[storage] 删除失败:', key, e);
    return false;
  }
}

/** 存储用量信息 { keys, currentSize, limitSize }（KB）；不可用时返回 null */
export function info() {
  try {
    return wx.getStorageInfoSync();
  } catch (e) {
    return null;
  }
}
