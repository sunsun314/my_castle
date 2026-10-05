/**
 * 实体基类：所有会移动/有碰撞体的对象（玩家、敌人、道具…）。
 *
 * 提供：
 *  - AABB 边界（left/right/top/bottom）
 *  - 与瓦片地图的分轴碰撞解算（moveX / moveY）
 *  - AABB 重叠检测（供攻击盒×受击盒使用）
 */
export default class Entity {
  constructor(x = 0, y = 0, w = 0, h = 0) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;

    this.vx = 0;
    this.vy = 0;

    this.facing = 1; // 1 右 / -1 左
    this.onGround = false;
    this.active = true;
    this.dead = false;
    this.dropThrough = 0; // >0 时忽略单向平台碰撞（下蹲跳下穿）

    this.hp = 1;
    this.maxHp = 1;
  }

  get left() { return this.x; }
  get right() { return this.x + this.w; }
  get top() { return this.y; }
  get bottom() { return this.y + this.h; }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  /** 水平移动并解算 X 碰撞（先动 X 再修正是分轴碰撞的关键） */
  moveX(dt, map) {
    this.x += this.vx * dt;
    const ts = map.tileSize;
    const r0 = Math.floor(this.y / ts);
    const r1 = Math.floor((this.y + this.h - 1) / ts);

    if (this.vx > 0) {
      const col = Math.floor((this.x + this.w - 1) / ts);
      for (let r = r0; r <= r1; r++) {
        if (map.isSolid(col, r)) {
          this.x = col * ts - this.w;
          this.vx = 0;
          break;
        }
      }
    } else if (this.vx < 0) {
      const col = Math.floor(this.x / ts);
      for (let r = r0; r <= r1; r++) {
        if (map.isSolid(col, r)) {
          this.x = (col + 1) * ts;
          this.vx = 0;
          break;
        }
      }
    }
  }

  /** 垂直移动并解算 Y 碰撞（含单向平台：只在下落且此前位于平台上方时碰撞） */
  moveY(dt, map) {
    const ts = map.tileSize;
    const prevBottom = this.y + this.h;
    this.y += this.vy * dt;

    const c0 = Math.floor(this.x / ts);
    const c1 = Math.floor((this.x + this.w - 1) / ts);
    this.onGround = false;

    if (this.vy > 0) {
      // 用「脚底所在格」探测：脚底恰好贴住地面时也能立即判定，避免 onGround 抖动/微陷
      const row = Math.floor((this.y + this.h) / ts);
      for (let c = c0; c <= c1; c++) {
        const solid = map.isSolid(c, row);
        const platform = map.isPlatform(c, row) && prevBottom <= row * ts + 1 && this.dropThrough <= 0;
        if (solid || platform) {
          this.y = row * ts - this.h;
          this.vy = 0;
          this.onGround = true;
          break;
        }
      }
    } else if (this.vy < 0) {
      const row = Math.floor(this.y / ts);
      for (let c = c0; c <= c1; c++) {
        if (map.isSolid(c, row)) {
          this.y = (row + 1) * ts;
          this.vy = 0;
          break;
        }
      }
    }
  }

  /** 与另一实体做 AABB 重叠检测 */
  overlaps(other) {
    return (
      this.x < other.x + other.w &&
      this.x + this.w > other.x &&
      this.y < other.y + other.h &&
      this.y + this.h > other.y
    );
  }

  update() {}
  render() {}
}
