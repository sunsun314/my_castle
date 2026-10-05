/**
 * 显示配置：把屏幕像素映射到「虚拟分辨率」。
 *
 * 设计约定：
 *  - 逻辑世界与 UI 全部使用「虚拟坐标」（单位 = 虚拟像素）。
 *  - 固定虚拟高度 VIEW_HEIGHT = 270，宽度随屏幕比例浮动（横屏时约 480）。
 *  - 渲染时统一按 scale 缩放，因此游戏代码不需要关心真机分辨率。
 */
const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();

const VIRTUAL_HEIGHT = 270;
const screenWidth = windowInfo.screenWidth;
const screenHeight = windowInfo.screenHeight;
const scale = screenHeight / VIRTUAL_HEIGHT;

export const DISPLAY = {
  screenWidth,
  screenHeight,
  pixelRatio: windowInfo.pixelRatio || 1,
  safeArea: windowInfo.safeArea || null,
  virtualHeight: VIRTUAL_HEIGHT,
  scale,
  // 可见虚拟区域（>= 设计宽）
  viewWidth: Math.round(screenWidth / scale),
  viewHeight: VIRTUAL_HEIGHT,
};

// 主画布（wx.createCanvas 的第一次调用返回显示用画布）
export const canvas = wx.createCanvas();
canvas.width = screenWidth;
canvas.height = screenHeight;

// 兼容官方示例的全局约定
GameGlobal.canvas = canvas;
