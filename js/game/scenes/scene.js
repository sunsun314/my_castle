/** 场景基类：定义生命周期钩子 */
export default class Scene {
  constructor(app) {
    this.app = app;
  }

  enter() {}
  exit() {}
  update() {}
  render() {}
}
