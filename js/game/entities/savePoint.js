/**
 * 存档点：房间里的一座石碑。
 *
 * 交互：玩家靠近后**按「上」**（方向锥朝上、且没有同时按住动作按钮，避免与
 * 「上+A 大跳 / 上+B 魔法」组合冲突）即调用 world.saveGame() 把角色状态写入本地缓存。
 * 它只是视觉 + 交互实体，不参与碰撞，也不阻挡移动。
 */
export default class SavePoint {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 14;
    this.h = 24;
    this.t = 0;      // 呼吸动画计时
    this.flash = 0;  // 存档成功提示剩余时间
    this.active = true;
  }

  get cx() { return this.x + this.w / 2; }

  get cy() { return this.y + this.h / 2; }

  /** 玩家是否在交互范围内（水平 22px、竖直 34px，站地面即可够到） */
  inRange(e) {
    if (!e) return false;
    const ex = e.cx != null ? e.cx : e.x;
    const ey = e.cy != null ? e.cy : e.y;
    return Math.abs(ex - this.cx) <= 22 && Math.abs(ey - this.cy) <= 34;
  }

  update(dt, world) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;

    const input = world.input;
    const p = world.player;
    if (!p || p.hp <= 0) return;

    // 「上」的边沿触发；同时按住任何动作按钮则视为组合键，不存档
    const pressing = input.down('jump') || input.down('attack') || input.down('transform');
    if (this.inRange(p) && input.upPressed && !pressing) {
      if (world.saveGame()) this.flash = 1.6;
    }
  }

  render(renderer, world) {
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3);
    const near = world ? this.inRange(world.player) : false;

    // 光晕（靠近时更亮）
    renderer.drawCircle(this.cx, this.cy - 2, 18 + pulse * 4, {
      fill: '#ffd166', alpha: (near ? 0.22 : 0.12) + 0.06 * pulse,
    });
    // 底座 + 水晶碑体
    renderer.drawRect(this.x - 2, this.y + this.h - 5, this.w + 4, 5, '#5a4326');
    renderer.drawRect(this.x + 3, this.y + 3, this.w - 6, this.h - 8, '#c99a3b');
    renderer.drawRect(this.x + 5, this.y + 6, this.w - 10, this.h - 14, '#ffe08a');
    renderer.drawRect(this.x + 6, this.y + 7, 2, this.h - 16, '#fff6cf', 0.9);
    // 靠近时地面提示圈
    if (near) {
      renderer.drawCircle(this.cx, this.y + this.h, 16, {
        stroke: '#ffd166', alpha: 0.5, lineWidth: 1,
      });
    }
    // 存档成功提示
    if (this.flash > 0) {
      renderer.drawText('已存档', this.cx, this.y - 8, {
        align: 'center', baseline: 'bottom', color: '#ffe08a', font: '9px sans-serif',
      });
    }
  }
}
