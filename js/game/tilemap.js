import { TILE, TILE_COLORS } from '../config/constants';

/**
 * 字符网格瓦片地图。
 *
 * 负责：把字符数据解析成网格、提供碰撞查询（isSolid/isPlatform/isHazard）、
 * 以及带视口裁剪的渲染。地形碰撞的「分轴解算」放在实体侧（Entity.moveX/moveY）。
 */
export default class Tilemap {
  constructor(rows) {
    this.rows = rows;
    this.tileSize = TILE;
    this.height = rows.length;
    this.width = rows[0].length;
    this.pixelWidth = this.width * this.tileSize;
    this.pixelHeight = this.height * this.tileSize;

    // 出生点（默认左上安全位置）
    this.spawn = { col: 2, row: Math.max(0, this.height - 3) };
    this.enemySpawns = [];
    for (let r = 0; r < this.height; r++) {
      const line = rows[r];
      for (let c = 0; c < this.width; c++) {
        if (line[c] === 'P') this.spawn = { col: c, row: r };
        else if (line[c] === 'E') this.enemySpawns.push({ col: c, row: r });
      }
    }
  }

  /** 越界视为空气（因此掉出地图底部 = 坠落） */
  charAt(col, row) {
    if (row < 0 || row >= this.height || col < 0 || col >= this.width) return '.';
    return this.rows[row][col];
  }

  isSolid(col, row) {
    return this.charAt(col, row) === '#';
  }

  isPlatform(col, row) {
    return this.charAt(col, row) === '=';
  }

  isHazard(col, row) {
    return this.charAt(col, row) === '^';
  }

  /** 只绘制相机可见范围内的瓦片 */
  render(renderer, camera) {
    const ts = this.tileSize;
    const c0 = Math.max(0, Math.floor(camera.x / ts));
    const c1 = Math.min(this.width - 1, Math.floor((camera.x + renderer.width) / ts));
    const r0 = Math.max(0, Math.floor(camera.y / ts));
    const r1 = Math.min(this.height - 1, Math.floor((camera.y + renderer.height) / ts));

    for (let row = r0; row <= r1; row++) {
      const line = this.rows[row];
      for (let col = c0; col <= c1; col++) {
        const color = TILE_COLORS[line[col]];
        if (!color) continue;
        renderer.drawRect(col * ts, row * ts, ts, ts, color);
        // 给地面顶部加一条高光，增强立体感
        if (line[col] === '#' && !this.isSolid(col, row - 1)) {
          renderer.drawRect(col * ts, row * ts, ts, 2, '#6c7396');
        }
      }
    }
  }
}
