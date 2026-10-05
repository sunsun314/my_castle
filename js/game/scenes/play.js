import Scene from './scene';
import World from '../world';
import InventoryScene from './inventory';
import { COLORS } from '../../config/constants';

/** 游戏进行场景：编排世界（相机空间）与 UI（屏幕空间） */
export default class PlayScene extends Scene {
  enter() {
    this.world = new World(this.app);
  }

  update(dt) {
    // 顶部中央「背包」按钮：打开装备管理（覆盖层场景会冻结世界、不再结算）
    if (this.app.input.tapIn(this._backpackRect(this.app.renderer))) {
      this.app.scenes.push(new InventoryScene(this.app, this.world.player));
      return;
    }
    this.world.update(dt);
  }

  /** 顶部中央「背包」按钮的命中矩形（update / render 共用，保证点哪画哪） */
  _backpackRect(r) {
    const w = 44;
    const h = 16;
    return { x: (r.width - w) / 2, y: 5, w, h };
  }

  render(r) {
    const cam = this.world.camera;

    // ---- 世界层（相机空间）----
    r.pushCamera(cam);
    // 天空底色（略大于视口，避免相机取整后露边）
    r.drawRect(cam.x - 8, cam.y - 8, r.width + 16, r.height + 16, COLORS.sky);
    this.world.render(r);
    r.popCamera();

    // ---- UI 层（屏幕空间，不随相机移动）----
    this._renderHUD(r);
    this._renderControls(r);
  }

  _renderHUD(r) {
    const p = this.world.player;
    const mono = '9px monospace';

    // 生命值：条 + 数值
    const maxHp = p.stats.maxHp;
    const hp = Math.max(0, Math.ceil(p.hp));
    const barW = 88;
    r.drawRect(8, 8, barW, 8, '#3a1d24');
    r.drawRect(8, 8, barW * Math.max(0, p.hp / maxHp), 8, '#e5484d');
    r.drawText('HP ' + hp + '/' + maxHp, 8 + barW + 4, 8, { color: '#ffb3b8', font: mono });

    // 魔法值：条 + 数值
    const maxMp = p.stats.maxMp;
    const mp = Math.max(0, Math.ceil(p.mp));
    r.drawRect(8, 19, barW, 8, '#20232f');
    if (maxMp > 0) r.drawRect(8, 19, barW * (p.mp / maxMp), 8, '#4aa3ff');
    r.drawText('MP ' + mp + '/' + maxMp, 8 + barW + 4, 19, { color: '#a9c7ff', font: mono });

    // 等级 / 经验
    r.drawText('Lv' + p.level, 8, 31, { color: '#8a8f98', font: mono });
    r.drawText('EXP ' + p.exp + '/' + p.expToNext(), 32, 31, { color: '#8a8f98', font: mono });

    // 剩余敌人 / 状态
    r.drawText('敌人 ' + this.world.aliveEnemies, 8, 43, { color: '#e5484d', font: mono });
    r.drawText(p.state, 56, 43, { color: '#8a8f98', font: mono });

    // 限时 buff 图标（按剩余时间由左到右）
    let bx = 8;
    for (const b of p.buffs.list) {
      r.drawRect(bx, 55, 16, 8, b.color || '#ffd166', 0.9);
      r.drawText(b.timeLeft.toFixed(0), bx + 8, 59, {
        align: 'center',
        baseline: 'middle',
        color: '#0b1020',
        font: '7px monospace',
      });
      bx += 20;
    }

    // FPS（调试用）
    r.drawText('FPS ' + this.app.loop.fps, r.width - 8, 8, {
      align: 'right',
      color: '#8a8f98',
      font: mono,
    });

    // 顶部中央：背包按钮（点击打开装备管理菜单）
    const br = this._backpackRect(r);
    r.drawRect(br.x, br.y, br.w, br.h, '#2a3350');
    r.drawRect(br.x, br.y, br.w, br.h, '#4aa3ff', 0.1);
    r.drawText('背包', br.x + br.w / 2, br.y + br.h / 2, {
      align: 'center',
      baseline: 'middle',
      color: '#cfe0ff',
      font: '9px sans-serif',
    });
  }

  _renderControls(r) {
    const input = this.app.input;
    const j = input.joystick;

    // 悬浮摇杆
    if (j.active) {
      r.drawCircle(j.baseX, j.baseY, j.radius, {
        stroke: '#ffffff',
        alpha: 0.25,
        lineWidth: 1.5,
      });
      r.drawCircle(j.knobX, j.knobY, j.radius * 0.45, {
        fill: '#ffffff',
        alpha: 0.4,
      });
    } else {
      // 未激活时左下角给个提示
      r.drawCircle(40, r.height - 40, j.radius, {
        stroke: '#ffffff',
        alpha: 0.12,
        lineWidth: 1.5,
      });
    }

    // A / B 按钮
    for (const b of input.buttonsDefs) {
      const isJump = b.name === 'jump';
      r.drawCircle(b.x, b.y, b.r, {
        fill: isJump ? '#4aa3ff' : '#ff7043',
        alpha: b.down ? 0.55 : 0.2,
      });
      r.drawCircle(b.x, b.y, b.r, {
        stroke: '#ffffff',
        alpha: 0.35,
        lineWidth: 1,
      });
      r.drawText(b.label, b.x, b.y, {
        align: 'center',
        baseline: 'middle',
        color: '#ffffff',
        font: 'bold 13px sans-serif',
      });
    }
  }
}
