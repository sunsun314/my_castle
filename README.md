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
  - **上 + A**：**大跳**（摇杆推向正上 ±45° 锥内，速度倍率 `bigJumpMul=2.0`、高度约普通跳 4 倍，需 `abilities.bigJump`）。**空中也能触发，且不受、也不消耗「空中跳次数」**（仅受能力与魔力约束）；`bigJumpMp>0` 时每次扣蓝。
  - 空中再按 A：**二段跳**（需 `abilities.doubleJump`）。
- **摇杆正下（±30° 锥）**：**下蹲**。碰撞体高度减半（**受攻击范围减半**）、脚底位置不变；下蹲时**不能跳跃**，但**可以普通攻击**，且攻击判定盒随身体一起下沉；站在**单向平台**上「下蹲 + 跳」可**向下穿越平台**掉到下层。
- **B 键**：近战攻击。伤害 = 玩家攻击力 `stats.atk`；命中顿帧、每刀对同一敌人只结算一次。**攻击范围 / 盒高 / 生效时长 / 元素属性 / 攻击类型都取自当前武器**（`weapon.*`，见 `player.getAttackProfile()`）。生效时间内**移动与跳跃被锁定（不可打断）**，但可用 **上+B 副武器打断**施法。
- **上 + B**：**副武器魔法弹**（传统恶魔城副武器）。消耗 MP、伤害 = 玩家魔法力 `stats.mag`、有冷却；魔力不足时退化为近战。**属性 / 弹速 / 消耗 / 冷却 / 颜色 / 弹道跟随装备的副武器（魔法书）**，未装备时回落默认**光属性 / 普通直线弹**（见 `player.getMagicProfile()`）。四本法典弹道各异：火焰=爆裂、寒霜=减速、疾风=穿透、雷击=连锁。
- **变 键（变身·魔神，新魔法类型）**：自身形态变化型魔法（非抛射弹），两种交互——
  - **上 + 变**：进入**魔法魔神**形态。普攻被改写为**「普通」攻击类型、无属性**，伤害 = 魔法力 `stats.mag` × `TRANSFORM.attackMul`（随魔法强度上升），攻击范围/时长也换成变身参数；形态期间**持续耗蓝**（`TRANSFORM.drain`/秒），蓝尽或形态结束自动解除并进入冷却。
  - **长按变**（按住超过 `TRANSFORM.holdTime`）：进入**突进魔神**，锁定朝向**持续向前猛冲**（`dashSpeed`），**期间无敌**（免疫接触/尖刺/一切伤害），**撞到的怪物受巨额伤害** = `stats.mag` × `TRANSFORM.dashDamageMul`（同一次突进对每只怪只结算一次），到时自动结束并进入冷却。
  - 数值与手感全部集中在 `config/constants.js` 的 `TRANSFORM`。
- **受伤机制（不同来源扣减规则不同，见 `game/damage.js`）**：
  - 敌人接触：按怪物 `contactDamage` 扣血，经玩家防御百分比减伤（至少 1 点）。**怪物的碰撞攻击统一为「普通」攻击类型、无属性**。
  - 尖刺陷阱：无视防御，固定扣减**最大生命的 10%**（常量 `SPIKE.pct`）。**尖刺攻击也是「普通」类型**。
  - 坠出地图：**不扣血**，仅复位回出生点（保留当前 HP）。
- **战斗飘字（伤害数字）**：命中时弹出——**白色 = 玩家对怪物造成的伤害**，**红色 = 己方（玩家）受到的伤害**；**抛物线跳动 + 逐步淡出**。参数在 `config/constants.js` 的 `DAMAGE_TEXT`。
- **背包 / 魔法（顶部中央两个平行按钮）**：打开「菜单」覆盖层（全屏覆盖战斗画面，**打开期间世界冻结、不再结算**，点**右下角 ×**（在「变」按钮上方）关闭后恢复；菜单打开期间**跳跃/攻击/变身按钮与摇杆全部被屏蔽**，触点全部交给菜单）。菜单顶部是**按装备栏分类**的页签：**武器 / 防具 / 戒指 / 副武器 / 道具**（由 `ITEM_SLOTS` 驱动，新增槽位自动多一页）。每页左列是该栏的**已装备槽**（点一下卸下）与**对比预览**，右列是背包中**属于该栏的物品**。物品采用**两段式操作**：点一次**选中并显示属性对比**（逐项 `当前→替换后`，绿升红降，`player.previewStats()` 纯计算不改状态），再点同一件才**装备 / 使用**；「道具」页收无槽位物品（药水等）并显示生效中的增益。屏幕最底部预留一条 Banner 广告位（暂未插入广告）。

## 已实现（对照里程碑）

- **M0 引擎骨架**
  - `engine/display.js` 虚拟分辨率 + 缩放（固定虚拟高 270，宽随比例）
  - `engine/loop.js` 固定步长主循环（与刷新率解耦、追帧保护）
  - `engine/renderer.js` `Renderer` 抽象 + `Canvas2D` 实现（未来可换 WebGL；`drawText` 支持 `alpha` 淡出）
  - `engine/input.js` 多点触控：悬浮摇杆 + 多按钮，按 identifier 追踪手指；未被按钮消费的触点记为 UI 点击（`tapIn(rect)`）
  - `engine/sceneManager.js` 场景栈、`engine/camera.js` 跟随相机
  - `engine/loader.js` 资源加载器、`engine/pool.js` 对象池、`engine/emitter.js` 事件总线
- **M1 移动与地形**
  - `game/tilemap.js` 字符网格地图、碰撞查询、视口裁剪渲染
  - `game/entities/entity.js` AABB + 分轴瓦片碰撞（含单向平台）
  - `game/entities/player.js` 状态机（idle/run/jump/fall/attack/crouch/hurt/dead）+ 手感参数；下蹲：高度减半（受击盒减半）、脚底不动、站起查头顶空间、下蹲不能跳但可攻击、下蹲跳下穿单向平台
- **M3 战斗闭环**
  - **多类型怪物**（`config/enemies.js` 的 `ENEMY_TYPES` 数据表 + `game/entities/enemy.js` 按 `behavior` 分派行为）：
    - `patrol` 巡逻兵：地面巡逻，撞墙/临崖掉头（基类默认行为，保持原手感），无主动攻击
    - `flyer` 游魂：**飞行**，无重力、垂直正弦起伏、撞墙掉头，生成时抬升悬浮；无主动攻击（漂浮接触型威胁）
    - `charger` 冲锋兽：地面冲锋 —— 玩家进入视野 -> **前摇蓄力**（停下蓄势、可被躲开）-> 高速冲锋 -> **后摇硬直**
    - `shooter` 巫妖：地面远程 —— 玩家进入射程 -> **前摇蓄光并持续瞄准** -> 发射能量弹（`attack.emit='bolt'`）-> **后摇僵直**
    - `jumper` 跳跳蛛：地面扑击 —— 玩家进入射程 -> **蹲伏前摇** -> 起跳扑向前方 -> **落地后摇**
    - `ceiling` 吊诡（**贴天花板**）：生成时自动向上吸附到实心/单向平台底部；玩家经过**正下方** -> **抖动前摇** -> 坠落砸击 -> **爬回天花板**
    - `diver` 恶鸦（**飞行俯冲**）：空中漂浮 -> 玩家进入范围 -> **悬停前摇并持续锁定方向** -> 朝玩家俯冲 -> **拉升后摇**
    - `flamer` 炎魔（**离体·吐火**）：进入射程 -> 前摇聚气 -> **原地喷出持续伤害火焰区**（`emit='flame'`，按住期间每 `interval` 秒生成一段）-> 后摇
    - `blader` 风刃使（**离体·风刃**）：进入射程 -> 前摇结印 -> **掷出正弦飞行、可穿透的双发风刃**（`emit='windblade'`）-> 后摇
    - `boss` 魔王·阿撒兹（**多阶段 BOSS**）：重型（受击不位移/不硬直）；血量跌破阈值 -> **短暂无敌咆哮**（阶段切换）-> 换用该阶段的**招式表 / 弱点 / 配色 / 速度**继续战斗。招式循环出招，每招仍是四段状态机，`kind` 决定生效效果：`lunge` 冲撞 / `emit` 外放离体攻击（三连火球、连喷吐火）/ `slam` 起跳砸地放冲击波。阶段定义见 `ENEMY_TYPES.boss.phases`
    - 未指定的数值回落到 `constants.ENEMY`；新增一种怪只需在 `ENEMY_TYPES` 加一条并在关卡 `LEVEL1_ENEMY_TYPES` 里引用
  - **主动攻击机制（与怪物强绑定）**：所有会攻击的怪共用一个四段状态机 `idle → windup(前摇) → active(生效) → recovery(后摇)`，但**每段的实际效果由该类型的行为分支独占实现**，参数（range/vRange/windup/active/recovery/cooldown + 机制专属 dashSpeed/hopSpeed*/dropSpeed/diveSpeed）全部写在该类型的 `attack` 块里。**触发方式统一为「玩家进入攻击范围即发动」**（`enemy._inRange`）；**前摇/后摇都刻意加长**：前摇给玩家反应窗口规避、后摇是安全输出窗口
  - **多阶段 BOSS**（`behavior:'boss'`）：类型带 `phases`（**≥2 段**，`at` = 进入该阶段的血量比例）。血量跌破阈值触发 `_beginPhaseTransition` —— **全程无敌**（`hurt()` 直接返回 false、攻击无效）、原地咆哮，结束后 `_applyPhase` 切换**招式表 / 弱点 / 配色 / 速度**。**招式与阶段强绑定**：每阶段自带 `moves` 循环出招，每招复用四段状态机，`_startMove`/`_tickMove` 按 `move.kind` 生效（`lunge`/`emit`/`slam`）；`heavy` 标志令 BOSS 受击不位移、不硬直，避免被连击锁死
  - **离体攻击框架**（`config/enemyAttacks.js` 注册表 + `game/entities/enemyAttack.js`）：把「怪物外放出去的独立实体」做成数据驱动形态——`shape`（rect/circle/blade/flame，预留 sprite）、`motion`（**straight** 直线 / **arc** 抛物线 / **sine** 正弦波动 / **static** 原地持续伤害区）、`pierce` 穿透数、`tick` 持续伤害节拍、`count/spread/offset` 多发与枪口偏移，另可覆盖 `damage/speed/color`。怪物通过 `attack.emit` 引用形态（**机制与怪物强绑定**，形态可复用/替换）；发射统一走 `world.spawnEnemyAttack()`（`spawnEnemyBolt()` 为兼容别名），命中仍走既有伤害管线。**新增一种离体攻击 = 在注册表加一条**（接素材时补 `sprite`，或给 render 加一个 shape 分支），逻辑零改动
  - `game/world.js` 命中结算：玩家攻击盒 × 敌人受击盒（**每刀对每个敌人只结算一次**，按挥砍 id 判定）+ 弱点倍率 + 命中顿帧 + 敌人接触伤害 + **离体攻击 × 玩家**（`enemyBolts`：弹体去重/穿透、持续伤害区按 tick 节拍，经防御减伤）
  - 关卡字符 `E` 标记敌人出生点（`config/level1.js`），类型由 `LEVEL1_ENEMY_TYPES` 按出生顺序一一对应；**弱点表 `LEVEL1_ENEMY_WEAKNESSES` 必须与类型表同序等长**
  - **战斗飘字（伤害数字）**：命中瞬间弹出并**抛物线跳动 + 逐步淡出**（`game/entities/damageText.js`）——**白色 = 对怪物的伤害**、**红色 = 己方受到的伤害**（含接触与尖刺）；数值取实际结算后的伤害，`world.spawnDamageText()` / `spawnPlayerDamage()` 生成
- **属性与能力系统（成长骨架）**
  - `game/stats.js` 属性计算管线：`base(等级) → 装备 flat → buff mul → 取整`；**只缓存派生结果，来源变化才重算**
  - `game/damage.js` 伤害机制表：接触（防御减伤）/ 尖刺（最大生命百分比）/ 坠落（不扣血），新增机制只在此扩展
  - `config/items.js` 装备/道具表：`flat`（加法）与 `mul`（乘法）修正、buff 时限
  - `game/buffs.js` 限时增益：dt 倒计时、同 id 刷新、过期自动重算
  - `entities/player.js` 持有 `level / exp / stats / abilities / equipment / buffs`：
    - 攻击力参与战斗结算（不再是硬编码 1）；防御按百分比曲线减伤
    - 经验升级 → 属性成长；`abilities` 门控双跳 / 大跳
  - HUD 以「数值 + 条」显示 HP / MP（如 `HP 90/100`），以及等级 / 经验 / buff 图标
  - **菜单（背包 / 装备）**（`scenes/inventory.js`）：顶部中央「背包」「魔法」两个按钮打开菜单（分别落到武器页 / 副武器页），全屏覆盖战斗层；打开期间世界冻结不结算，关闭后恢复。内部按**装备栏分类页签**（武器 / 防具 / 戒指 / 副武器 / 道具，由 `ITEM_SLOTS` 驱动）组织物品，「道具」页收无槽位物品——做到「道具按装备栏归类、点哪画哪」。物品支持**选中→对比预览→确认装备**：`player.previewStats(item)` 返回换上 / 使用后的最终属性（复用 `computeStats`，不 mutate），界面逐项显示 `当前→预测` 与增减色，避免误换装。关闭按钮位于右下角、**「变」按钮正上方**（避开其 r×1.5 判定圈），菜单打开期间调用 `input.setGameInputEnabled(false)` **屏蔽跳跃/攻击/变身按钮与摇杆**、触点全部作为 UI 点击交给菜单；屏幕最底部预留 Banner 广告位（`BANNER_H = 48`，`_bannerRect()`，后续接入 `wx.createBannerAd`）
  - `entities/player.js` 持有 `inventory`：槽位 `weapon/armor/ring/subweapon`，`equip/unequip` 自动与背包互换（换下自动回背包），限时药水 `useItem` 直接消耗并施加 buff
  - `config/items.js` `ITEM_SLOTS`（weapon / armor / ring / subweapon）+ `ITEMS` 纯数据表；初始赠送若干物品便于体验
  - **武器决定攻击范围与生效时间**：`ITEMS` 中武器可带 `attack: { reach, height, duration }`，`player.getAttackProfile()` 读取当前武器并用于攻击盒与生效时长；未装备武器时回落空手默认值
  - **近战生效时间可被副武器打断、不可被跳跃/移动打断**：生效时间内忽略移动输入、锁定跳跃；仅「上+B」副武器可取消近战判定并施法
- **元素与攻击类型（战斗属性系统，`game/elements.js`）**
  - **元素**：光 / 暗 / 火 / 水 / 风 / 电 / 土
  - **攻击类型**：斩击 / 重击 / 普通
  - 武器携带 `element` + `attackType`：匕首/铁剑/长枪 = 斩击、巨剑 = 重击；元素武器如烈焰剑 = 火/斩击、寒霜枪 = 水/斩击、疾风匕 = 风/斩击、雷锤 = 电/重击、岩锤 = 土/重击、圣光剑 = 光/斩击、暗影镰 = 暗/重击
  - **怪物弱点**：每只怪物至多两个弱点，每个是「元素弱点」或「攻击类型弱点」，由关卡配置 `config/level1.js` 的 `LEVEL1_ENEMY_WEAKNESSES` 给出
  - **命中结算**：命中 1 个弱点 → **150%**，命中 2 个 → **300%**（`applyWeakness()` 在 `world._resolveCombat` 中应用，近战与魔法弹都吃弱点）
  - 约定：**所有怪物的碰撞攻击与尖刺陷阱都归为「普通」攻击类型**（`ENEMY.attackType` / `SPIKE.attackType = 'normal'`）
- **副武器：上+B 魔法弹（传统恶魔城副武器）**
  - `game/entities/projectile.js` 魔法弹：水平飞行、命中敌人造成 `mag` 伤害、撞墙/超时自动回收；携带 `element` 与 `attackType`。数值、外观与**弹道**由 `player.getMagicProfile()` 给出——装备副武器（魔法书，槽位 `subweapon`）时随其元素 / 弹速 / 消耗 / 冷却 / 颜色，未装备时回落 `MAGIC` 默认（光 / 普通）
  - **差异化弹道**（`items.magic.behavior`，结算在 `world._resolveCombat` / `magicBurst` / `magicChain`）：`bolt` 直线单体（默认）/ `pierce` 穿透（疾风，可穿 3 个、次数用尽才消失）/ `burst` 爆裂（火焰，命中或撞墙时对半径内敌人溅射 60%）/ `slow` 减速（寒霜，命中后敌人变冰蓝并降速）/ `chain` 连锁（雷击，命中后电弧跳向附近敌人，每跳 60%）。弹丸用 `hitSet` 去重；配套特效：爆裂环（`ring`）、连锁电弧（`arc`），由 `world.magicFx` 驱动
  - `game/world.js` 新增 `projectiles` 管理与「弹丸 × 敌人」结算；`spawnMagic()` 发射
  - 施法消耗 MP 并有冷却；魔力不足时退化为近战（保证永远能出手）
  - `MAGIC` 常量（速度 / 存活 / 耗蓝 / 冷却 / 颜色 / 元素 / 类型）集中在 `config/constants.js`
- **变身·魔神（第三动作按钮，新魔法类型）**
  - 第 3 个动作按钮 `transform`（`engine/input.js`，label「变」，排在 A/B 之后以保持命中优先级）；「上」判定复用摇杆正上锥，长按用按住时长 `_transformHold` 判定
  - `player` 状态机：`demonMode`（`null` / `'mage'` / `'dash'`）+ `demonCd` 冷却 + `demonDashTimer`；`_updateTransform` 分派「上+变 → `_startMage`」「长按 → `_startDash`」，`_endDemon` / `_clearDemon`（复活/坠落复位）收尾
  - **魔法魔神**：`getAttackProfile()` 在该形态下返回变身参数（`attackType:'normal'`、无属性）；新增 `getAttackDamage()`（mag × 倍率）供 `world._resolveCombat` 近战结算使用；`update` 每帧按 `drain` 扣蓝、蓝尽自动解除
  - **突进魔神**：`demonInvuln` 为真 → `isInvincible()` 命中 `_applyDamage` 与尖刺判定，全程免伤；`update` 中锁定朝向按 `dashSpeed` 前冲、重力归零、禁跳禁攻；`getDashDamage()` 供 `world._resolveCombat` 的「突进 × 怪物」结算（`enemy.lastHitDash` 去重）
  - `TRANSFORM` 常量（启动/耗蓝、普攻倍率与范围、长按阈值、突进速度/时长/伤害倍率、冷却、配色）集中在 `config/constants.js`

## 目录结构

```
minigame-castle/
├── game.js / game.json          入口与运行配置（横屏）
├── js/
│   ├── main.js                  App 组装
│   ├── engine/                  与具体玩法无关的引擎层
│   │   ├── display.js           虚拟分辨率与画布
│   │   ├── renderer.js          渲染抽象 + Canvas2D 实现（drawText 支持 alpha）
│   │   ├── loop.js              固定步长主循环
│   │   ├── input.js             多点触控输入
│   │   ├── camera.js            跟随相机
│   │   ├── sceneManager.js      场景栈
│   │   ├── loader.js            资源加载
│   │   ├── pool.js              对象池
│   │   └── emitter.js           事件总线
│   ├── game/                    玩法层
│   │   ├── world.js             世界（地图+实体+相机+战斗结算+飘字）
│   │   ├── tilemap.js           瓦片地图
│   │   ├── stats.js             属性计算管线
│   │   ├── damage.js            伤害机制表
│   │   ├── elements.js          元素 / 攻击类型 / 弱点结算
│   │   ├── buffs.js             限时增益
│   │   ├── entities/            entity.js / player.js / enemy.js / enemyAttack.js / enemyBolt.js / projectile.js / damageText.js
│   │   └── scenes/              scene.js / loading.js / play.js / inventory.js
│   └── config/                  constants.js / items.js / enemies.js / enemyAttacks.js / level1.js
└── README.md
```

## 后续路线（见主方案）

- **M2**：真机触屏手感调参（当前参数集中在 `config/constants.js`）
- **M4**：Tiled 关卡管线、房间切换与转场
- **M5**：道具拾取/掉落接入装备系统、存档点、粒子 / 屏震、更多副武器类型（除魔法书外再加飞刀/圣水/回旋镖）
- **M6**：能力门控（用道具解锁双跳/大跳）、地图、Boss、难度曲线、性能优化

## 调试：快速试验属性系统

在开发者工具 Console 里可直接操作当前玩家，验证装备 / buff / 升级 / 弱点 / 飘字：

```js
const p = GameGlobal.app.scenes.top.world.player;
p.equip({ id:'iron_sword', slot:'weapon', attackType:'slash', element:null, flat:{ atk:2 }, attack:{ reach:24, height:18, duration:0.18 } });
p.addBuff({ id:'atkup', time:10, flat:{ atk:3 }, color:'#ffd166' }); // 限时增益
p.gainExp(8);                                                        // 升级，属性成长
p.getAttackProfile(); // { reach, height, duration, element, attackType }
p.stats;              // { maxHp, maxMp, atk, def, mag }

// 手动弹一个伤害飘字（白色对怪 / 红色己方）
const w = GameGlobal.app.scenes.top.world;
w.spawnDamageText(p.cx, p.y, 12);            // 白
w.spawnPlayerDamage(p.cx, p.y, 5);           // 红
```

> 属性来源（基础值/装备/buff）与派生结果分离：任何时候改动来源后都会自动重算 `p.stats`。
> 弱点结算：`game/elements.js` 的 `applyWeakness(基础伤害, {element, attackType}, 怪物.weaknesses)`。
> 伤害飘字参数：`config/constants.js` 的 `DAMAGE_TEXT`（存活时长 / 上抛速度 / 重力 / 漂移 / 颜色）。

## 说明

- 当前用**纯色块**渲染（零资源依赖，导入即可跑）。接入美术时把 `tilemap.render` / `player.render` 换成 `renderer.drawSprite(...)`，并给 `Renderer` 补图集切帧即可。
- 所有手感/物理数值集中在 `js/config/constants.js`，装备/道具在 `js/config/items.js`，**怪物类型/数值/行为参数在 `js/config/enemies.js`**，**离体攻击形态在 `js/config/enemyAttacks.js`**，元素/攻击类型/弱点倍率在 `js/game/elements.js`，敌人弱点与类型配置在 `js/config/level1.js`，伤害飘字在 `DAMAGE_TEXT`，下蹲高度在 `PLAYER.crouchH`，便于调参。
