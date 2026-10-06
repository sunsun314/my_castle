import { LEVEL1_ENEMY_TYPES, LEVEL1_ENEMY_WEAKNESSES } from './level1';

/**
 * 房间系统（独立地图 + 左右门切换）。
 *
 * 设计约定：
 *  - 每个房间是一张**独立的地图**（字符网格），四周（上/下/左/右）全部封墙，
 *    只在左墙、右墙的**贴地位置**各留一个 2 格高的门洞。
 *  - 房间用 left / right 指向相邻房间 id，构成一条「左右连通」的线性链
 *    （A 废墟入口 ↔ B 崩坏回廊 ↔ S 篝火营地[存档点] ↔ C 魔王殿）：
 *    从左门出去 = 退回上一间，从右门出去 = 进入下一间。
 *  - 带 savePoint 字段的房间会放置一座存档石碑（靠近后按「上」保存，见 game/save.js）。
 *  - 玩家的 HP / 装备 / 等级跨房间保留；切房时重建地图与怪，玩家从对侧门内侧进入。
 *
 * 房间内容（敌人、平台、装饰）之后可直接改这里；网格既可用 makeRoom 生成，
 * 也可换成手写的字符数组。
 */

export const ROOM_W = 40;
export const ROOM_H = 18;

/** 贴地门洞所在的两行（地面在 ROOM_H-2 行，玩家站立占 h-4 / h-3 行） */
export const DOOR_ROWS = [ROOM_H - 4, ROOM_H - 3];

/**
 * 生成一间标准房间：天花板 / 地面 / 左右墙全实心，按 doors 在贴地位置开门洞。
 * @param {{w?:number,h?:number,doors?:{left?:boolean,right?:boolean},platforms?:Array<{col:number,row:number,len:number}>}} opts
 * @returns {string[]} 字符网格（'.' 空气 '#' 实心 '=' 单向平台，见 tilemap.js）
 */
export function makeRoom({ w = ROOM_W, h = ROOM_H, doors = {}, platforms = [] } = {}) {
  const grid = [];
  for (let r = 0; r < h; r++) {
    const row = new Array(w).fill('.');
    if (r === 0 || r >= h - 2) for (let c = 0; c < w; c++) row[c] = '#'; // 天花板 + 地面
    for (const pf of platforms) {
      if (pf.row === r) for (let c = pf.col; c < pf.col + pf.len && c < w; c++) row[c] = '=';
    }
    grid.push(row);
  }
  for (let r = 0; r < h; r++) { grid[r][0] = '#'; grid[r][w - 1] = '#'; } // 左右墙
  for (const dr of [h - 4, h - 3]) { // 贴地门洞
    if (doors.left) grid[dr][0] = '.';
    if (doors.right) grid[dr][w - 1] = '.';
  }
  return grid.map((row) => row.join(''));
}

/**
 * 取「全关卡怪物表」的一段，分配到房间内的列上。
 * 全关卡表（类型 + 弱点）仍以 config/level1.js 为唯一来源，这里只做切片，
 * 保证 LEVEL1_ENEMY_TYPES / LEVEL1_ENEMY_WEAKNESSES 顺序一致、内容不丢失。
 */
function sliceEnemies(from, to, cols) {
  const out = [];
  for (let i = from; i < to; i++) {
    out.push({
      col: cols[i - from],
      row: ROOM_H - 3,
      type: LEVEL1_ENEMY_TYPES[i],
      weaknesses: LEVEL1_ENEMY_WEAKNESSES[i] || [],
    });
  }
  return out;
}

export const ROOMS = [
  {
    id: 'A',
    name: '废墟入口',
    left: null,
    right: 'B',
    spawn: { col: 3, row: ROOM_H - 3 },
    grid: makeRoom({ doors: { right: true }, platforms: [{ col: 8, row: 12, len: 4 }, { col: 16, row: 10, len: 4 }] }),
    enemies: sliceEnemies(0, 3, [22, 28, 34]), // patrol / charger / blader
  },
  {
    id: 'B',
    name: '崩坏回廊',
    left: 'A',
    right: 'S',
    spawn: { col: 2, row: ROOM_H - 3 },
    grid: makeRoom({ doors: { left: true, right: true }, platforms: [{ col: 6, row: 11, len: 5 }, { col: 20, row: 13, len: 4 }] }),
    enemies: sliceEnemies(3, 7, [10, 18, 26, 34]), // jumper / ceiling / shooter / flyer
  },
  {
    id: 'S',
    name: '篝火营地',
    left: 'B',
    right: 'C',
    spawn: { col: 2, row: ROOM_H - 3 },
    // 存档点：玩家靠近石碑后按「上」即保存角色状态（见 entities/savePoint.js）
    savePoint: { col: 6, row: ROOM_H - 3 },
    grid: makeRoom({ doors: { left: true, right: true }, platforms: [{ col: 12, row: 12, len: 5 }, { col: 26, row: 12, len: 5 }] }),
    enemies: [], // 安全屋：无怪
  },
  {
    id: 'C',
    name: '魔王殿',
    left: 'S',
    right: null,
    spawn: { col: 2, row: ROOM_H - 3 },
    grid: makeRoom({ doors: { left: true }, platforms: [{ col: 12, row: 12, len: 6 }] }),
    enemies: sliceEnemies(7, 10, [10, 24, 34]), // flamer / diver / boss
  },
];

export const DEFAULT_ROOM = ROOMS[0].id;

export function getRoom(id) {
  return ROOMS.find((r) => r.id === id) || null;
}
