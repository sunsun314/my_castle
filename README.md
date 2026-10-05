# minigame-castle

基于微信小游戏 + Canvas2D 的类恶魔城（Metroidvania）技术骨架。
由官方「飞机大战」示例的技术底座演进而来，当前完成 **M0 引擎骨架 + M1 移动与地形**。

## 运行

1. 打开「微信开发者工具」→ 导入项目 / 新建小游戏。
2. 目录选择本文件夹 `~/WeChatProjects/minigame-castle`。
3. AppID 可用现有测试号或「测试号」。
4. 编译运行。**注意将模拟器切换为「横屏」**（`game.json` 已声明 `landscape`）。

## 操作

- **左半屏任意位置按下**：出现悬浮摇杆，拖动控制左右移动（摇杆「正上 ±45° 锥」用于大跳）。
- **A 键**：跳跃。支持短按小跳 / 长按高跳、土狼时间、跳跃缓冲。
  - **上 + A**：**大跳**（摇杆推向正上 ±45° 锥内，高度约普通跳 2.56 倍，需 `abilities.bigJump`）。
  - 空中再按 A：**二段跳**（需 `abilities.doubleJump`）。
- **B 键**：近战攻击。伤害 = 玩家攻击力 `stats.atk`；命中顿帧、每刀对同一敌人只结算一次。
- **上 + B**：**副武器魔法弹**（传统恶魔城副武器）。消耗 MP（`MAGIC.cost`），伤害 = 玩家魔法力 `stats.mag`，有冷却；魔力不足时退化为近战。
- **受伤机制（不同来源扣减规则不同，见 `game/damage.js`）**：
  - 敌人接触：按怪物 `contactDamage` 扣血，经玩家防御百分比减伤（至少 1 点）。
  - 尖刺陷阱：无视防御，固定扣减**最大生命的 10%**（常量 `SPIKE.pct`）。
  - 坠出地图：**不扣血**，仅复位回出生点（保留当前 HP）。
- **背包（顶部中央按钮）**：打开「背包 / 装备管理」菜单，全屏覆盖当前战斗画面；**菜单打开期间世界冻结、不再结算**，点右上角 × 关闭后恢复。点背包物品→装备，点已装备→卸下。

## 已实现（对照里程碑）

- **M0 引擎骨架**
  - `engine/display.js` 虚拟分辨率 + 缩放（固定虚拟高 270，宽随比例）
  - `engine/loop.js` 固定步长主循环（与刷新率解耦、追帧保护）
  - `engine/renderer.js` `Renderer` 抽象 + `Canvas2D` 实现（未来可换 WebGL）
  - `engine/input.js` 多点触控：悬浮摇杆 + 多按钮，按 identifier 追踪手指；未被按钮消费的触点记为 UI 点击（`tapIn(rect)`）
  - `engine/sceneManager.js` 场景栈、`engine/camera.js` 跟随相机
  - `engine/loader.js` 资源加载器、`engine/pool.js` 对象池、`engine/emitter.js` 事件总线
- **M1 移动与地形**
  - `game/tilemap.js` 字符网格地图、碰撞查询、视口裁剪渲染
  - `game/entities/entity.js` AABB + 分轴瓦片碰撞（含单向平台）
  - `game/entities/player.js` 状态机（idle/run/jump/fall/attack/hurt/dead）+ 手感参数
- **M3 战斗闭环**
  - `game/entities/enemy.js` 巡逻小怪：撞墙/临崖掉头、掉血白闪、击退硬直、死亡演出，自带碰撞伤害 `contactDamage`
  - `game/world.js` 命中结算：玩家攻击盒 × 敌人受击盒（**每刀对每个敌人只结算一次**，按挥砍 id 判定）+ 命中顿帧 + 敌人接触伤害
  - 关卡字符 `E` 标记敌人出生点（`config/level1.js`）
- **属性与能力系统（成长骨架）**
  - `game/stats.js` 属性计算管线：`base(等级) → 装备 flat → buff mul → 取整`；**只缓存派生结果，来源变化才重算**
  - `game/damage.js` 伤害机制表：接触（防御减伤）/ 尖刺（最大生命百分比）/ 坠落（不扣血），新增机制只在此扩展
  - `config/items.js` 装备/道具表：`flat`（加法）与 `mul`（乘法）修正、buff 时限
  - `game/buffs.js` 限时增益：dt 倒计时、同 id 刷新、过期自动重算
  - `entities/player.js` 持有 `level / exp / stats / abilities / equipment / buffs`：
    - 攻击力参与战斗结算（不再是硬编码 1）；防御按百分比曲线减伤
    - 经验升级 → 属性成长；`abilities` 门控双跳 / 大跳
  - HUD 以「数值 + 条」显示 HP / MP（如 `HP 90/100`），以及等级 / 经验 / buff 图标
  - **背包 / 装备管理菜单**（`scenes/inventory.js`）：顶部中央「背包」按钮打开，全屏覆盖战斗层；打开期间世界冻结不结算，关闭后恢复
  - `entities/player.js` 持有 `inventory`：槽位 `equip/unequip` 自动与背包互换（换下自动回背包），限时药水 `useItem` 直接消耗并施加 buff
  - `config/items.js` `ITEM_SLOTS`（weapon / armor / ring）+ `ITEMS` 纯数据表；初始赠送若干物品便于体验
- **副武器：上+B 魔法弹（传统恶魔城副武器）**
  - `game/entities/projectile.js` 魔法弹：水平飞行、命中敌人造成 `mag` 伤害、撞墙/超时自动回收
  - `game/world.js` 新增 `projectiles` 管理与「弹丸 × 敌人」结算；`spawnMagic()` 发射
  - 施法消耗 MP 并有冷却；魔力不足时退化为近战（保证永远能出手）
  - `MAGIC` 常量（速度 / 存活 / 耗蓝 / 冷却 / 颜色）集中在 `config/constants.js`

## 目录结构

```
minigame-castle/
├── game.js / game.json          入口与运行配置（横屏）
├── js/
│   ├── main.js                  App 组装
│   ├── engine/                  与具体玩法无关的引擎层
│   │   ├── display.js           虚拟分辨率与画布
│   │   ├── renderer.js          渲染抽象 + Canvas2D 实现
│   │   ├── loop.js              固定步长主循环
│   │   ├── input.js             多点触控输入
│   │   ├── camera.js            跟随相机
│   │   ├── sceneManager.js      场景栈
│   │   ├── loader.js            资源加载
│   │   ├── pool.js              对象池
│   │   └── emitter.js           事件总线
│   ├── game/                    玩法层
│   │   ├── world.js             世界（地图+实体+相机）
│   │   ├── tilemap.js           瓦片地图
│   │   ├── entities/            entity.js / player.js / enemy.js / projectile.js
│   │   └── scenes/              scene.js / loading.js / play.js / inventory.js
│   └── config/                  constants.js / items.js / level1.js
└── README.md
```

## 后续路线（见主方案）

- **M2**：真机触屏手感调参（当前参数集中在 `config/constants.js`）
- **M4**：Tiled 关卡管线、房间切换与转场
- **M5**：道具拾取/掉落接入装备系统、存档点、粒子 / 屏震、更多副武器（飞刀/圣水/回旋镖）
- **M6**：能力门控（用道具解锁双跳/大跳）、地图、Boss、难度曲线、性能优化

## 调试：快速试验属性系统

在开发者工具 Console 里可直接操作当前玩家，验证装备 / buff / 升级：

```js
const p = GameGlobal.app.scenes.top.world.player;
p.equip({ id:'iron_sword', slot:'weapon', flat:{ atk:2 } });        // 加装备：攻击力 +2
p.addBuff({ id:'atkup', time:10, flat:{ atk:3 }, color:'#ffd166' }); // 限时增益
p.gainExp(8);                                                        // 升级，属性成长
p.stats;   // 查看当前最终属性 { maxHp, maxMp, atk, def, mag }
```

> 属性来源（基础值/装备/buff）与派生结果分离：任何时候改动来源后都会自动重算 `p.stats`。

## 说明

- 当前用**纯色块**渲染（零资源依赖，导入即可跑）。接入美术时把 `tilemap.render` / `player.render`
  换成 `renderer.drawSprite(...)`，并给 `Renderer` 补图集切帧即可。
- 所有手感/物理数值集中在 `js/config/constants.js`，装备/道具在 `js/config/items.js`，便于调参。
换成 `renderer.drawSprite(...)`，并给 `Renderer` 补图集切帧即可。
- 所有手感/物理数值集中在 `js/config/constants.js`，装备/道具在 `js/config/items.js`，便于调参。
` / `player.render`
  换成 `renderer.drawSprite(...)`，并给 `Renderer` 补图集切帧即可。
- 所有手感/物理数值集中在 `js/config/constants.js`，装备/道具在 `js/config/items.js`，便于调参。
