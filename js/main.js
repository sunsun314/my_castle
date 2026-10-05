import { DISPLAY, canvas } from './engine/display';
import CanvasRenderer from './engine/renderer';
import Input from './engine/input';
import GameLoop from './engine/loop';
import SceneManager from './engine/sceneManager';
import LoadingScene from './game/scenes/loading';

/**
 * 应用根节点：组装引擎各子系统（渲染 / 输入 / 场景 / 主循环）。
 * 依赖方向向下：App -> SceneManager -> Scene -> World -> Entity，
 * 引擎组件不反向依赖游戏逻辑，方便替换渲染后端。
 */
class App {
  constructor() {
    this.display = DISPLAY;
    this.canvas = canvas;
    this.renderer = new CanvasRenderer(canvas);
    this.input = new Input();
    this.scenes = new SceneManager(this);

    this.scenes.push(new LoadingScene(this));

    this.loop = new GameLoop({
      update: (dt) => this.scenes.update(dt),
      render: () => {
        this.renderer.beginFrame();
        this.scenes.render(this.renderer);
        // 每帧末刷新输入的边沿状态
        this.input.endFrame();
      },
    });
    this.loop.start();
  }
}

GameGlobal.app = new App();
