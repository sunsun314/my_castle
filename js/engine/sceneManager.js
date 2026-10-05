/**
 * 场景栈管理器。
 *
 * 采用「栈」而非单场景：方便叠加暂停菜单/对话框等覆盖层。
 *  - update 只驱动栈顶场景；
 *  - render 从栈底到栈顶依次绘制（覆盖层可见）。
 */
export default class SceneManager {
  constructor(app) {
    this.app = app;
    this.scenes = [];
  }

  get top() {
    return this.scenes[this.scenes.length - 1] || null;
  }

  push(scene) {
    this.scenes.push(scene);
    if (scene.enter) scene.enter();
    return scene;
  }

  pop() {
    const scene = this.scenes.pop();
    if (scene && scene.exit) scene.exit();
    return scene;
  }

  replace(scene) {
    while (this.scenes.length) this.pop();
    this.push(scene);
  }

  update(dt) {
    const scene = this.top;
    if (scene && scene.update) scene.update(dt);
  }

  render(renderer) {
    for (const scene of this.scenes) {
      if (scene.render) scene.render(renderer);
    }
  }
}
