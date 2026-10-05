import Scene from './scene';
import PlayScene from './play';

/** 加载场景：真实项目里在此预加载图片/音频并显示进度，骨架先做短暂停留。 */
export default class LoadingScene extends Scene {
  enter() {
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    if (this.t >= 0.4) {
      this.app.scenes.replace(new PlayScene(this.app));
    }
  }

  render(r) {
    const cx = r.width / 2;
    const cy = r.height / 2;
    r.drawText('MINIGAME CASTLE', cx, cy - 14, {
      align: 'center',
      baseline: 'middle',
      color: '#e6e6e6',
      font: 'bold 18px sans-serif',
    });
    r.drawText('Loading...', cx, cy + 12, {
      align: 'center',
      baseline: 'middle',
      color: '#8a8f98',
      font: '10px sans-serif',
    });
  }
}
