/**
 * 资源加载器：统一预加载图片，带进度回调。
 * 骨架阶段暂无图片资源，接口先立好，后续贴图直接 addImage 即可。
 */
export default class ResourceLoader {
  constructor() {
    this.images = {};
    this.total = 0;
    this.loaded = 0;
  }

  /**
   * @param {Object} manifest 形如 { player: 'assets/player.png' }
   * @param {(progress:number)=>void} onProgress 0~1
   * @returns {Promise<void[]>}
   */
  load(manifest = {}, onProgress) {
    const keys = Object.keys(manifest);
    this.total = keys.length;
    this.loaded = 0;

    return Promise.all(
      keys.map(
        (key) =>
          new Promise((resolve) => {
            const img = wx.createImage();
            img.onload = () => {
              this.images[key] = img;
              this.loaded += 1;
              if (onProgress) onProgress(this.total ? this.loaded / this.total : 1);
              resolve(img);
            };
            img.onerror = () => {
              console.warn('[loader] 加载失败:', manifest[key]);
              this.loaded += 1;
              if (onProgress) onProgress(this.total ? this.loaded / this.total : 1);
              resolve(null);
            };
            img.src = manifest[key];
          })
      )
    );
  }

  get(key) {
    return this.images[key];
  }
}
