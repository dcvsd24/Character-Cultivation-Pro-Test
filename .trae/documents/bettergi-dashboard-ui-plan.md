# BetterGI 自动养成配置工具 UI 改造计划

> 已阅读并遵守 `genshin-planner/CLAUDE.md` 中的项目规范：Vue 3.5 + TypeScript + Tauri 2 + Tailwind CSS 4 + Pinia + pnpm；前端只消费 `BackendFacade.ts` 稳定接口；优先复用旧版组件与样式。

## 1. Summary

将 `genshin-planner` 前端从素版调试面板改造为符合旧版视觉风格的四分区正式 UI。`Appold.vue` 不是废稿，而是风格参考和可复用资产来源：优先复用/迁移旧版卡片、稀有度背景、材料卡片、角色选择弹窗等，不能直接复用再拆分新组件。
- 当前计划 / 刷取状态（默认首页）
- 添加计划（角色 + 武器养成）
- 背包库 / 背包变更
- 设置 / 数据状态

本轮仅做前端 UI 接入和页面结构，**不修改后端数据源、NanokaProvider、materialCalculator、Project B 主流程、BackendFacade 核心逻辑**。所有数据通过 `BackendFacade.ts` 获取。

## 2. Current State Analysis

已完成：
- `App.vue` 已改为挂载 `DashboardShell.vue`
- `DashboardShell.vue` 已创建，包含四分区 Tabs 外壳
- `SettingsView.vue` 已创建，含登录/数据源/缓存/接口测试/版本检查

缺失/空壳：
- `CurrentPlanView.vue`：空文件
- `AddPlanView.vue`：空文件
- `InventoryLibraryView.vue`：空文件
- 共享视觉组件：`QualityBackground.vue`、`MaterialCard.vue`、`StatusTag.vue`、`materialUtils.ts` 为空或缺失
- 数据层 composables 全部为空：`useBetterGIAuth.ts`、`useCurrentPlan.ts`、`useCharacterSelection.ts`、`useWeaponSelection.ts`、`useInventoryLibrary.ts`、`useInventoryChanges.ts`、`useFarmingStatus.ts`

依赖现状：
- 后端接口契约：`docs/backend-contract.md` 已定义完整类型与调用方式
- 图标组件：`CachedImage.vue` 已存在，支持本地缓存、占位图、失败回退
- 旧版视觉参考：`Appold.vue` 使用 `glass-card`、`text-gradient-*`、稀有度背景 PNG、`vue-draggable-plus` 风格
- UI 组件库：shadcn-vue（Card、Button、Dialog、Tabs、Input、Progress 等已在 `components.d.ts` 注册）

## 3. Proposed Changes

### 3.1 共享视觉层（先完成，供后续视图复用）

文件：`src/components/bettergi/dashboard/QualityBackground.vue`
- 复用 `Appold.vue` 的稀有度背景图片导入逻辑
- Props：`rarity: number`
- 输出：`div` 背景图样式，支持 0/1/2/3/4/5/105 稀有度

文件：`src/components/bettergi/dashboard/materialUtils.ts`
- 导出 `getQualityBackground(rarity)` 返回图片 URL
- 导出 `elementColor(element)` 返回元素色值/类名
- 导出 `routeStatusLabel(status)` 把 `RouteStatus` 映射为中文标签
- 导出 `categoryLabel(category)` 把 `MaterialCategory` 映射为中文分类名
- 导出 `rarityClass(rarity)` 返回稀有度颜色类

文件：`src/components/bettergi/dashboard/MaterialCard.vue`
- Props：`material: PlanMaterial | InventoryLibraryItem`、`showOwned?: boolean`、`showMissing?: boolean`
- 使用 `QualityBackground` 做卡片背景
- 使用 `CachedImage` 显示图标（带占位图）
- 显示：图标、名称、拥有/需求/缺口、来源文本、状态标签

文件：`src/components/bettergi/dashboard/StatusTag.vue`
- Props：`status: RouteStatus | 'unknown'`、`automatable?: boolean`
- 根据状态渲染对应标签：可自动刷、采集材料、秘境材料、Boss、周本、路线待确认、库存足够

### 3.2 数据层 composables

文件：`src/composables/bettergi/useBetterGIAuth.ts`
- 封装米游社扫码登录逻辑（调用 `MHYService` 的 `fetchMHYLoginQRCode`、`generateQRCode`、`fetchMHYLoginResult`）
- 管理二维码 Base64、倒计时、轮询状态
- 登录成功后写入 `useAuthStore`
- 暴露：`isLoggedIn`、`uid`、`qrLoginBase64`、`showQRDialog`、`qrCountdown`、`isPolling`、`openLoginQRCode`、`stopPolling`、`clearAuthData`、`maskedToken`

文件：`src/composables/bettergi/useCharacterSelection.ts`
- 调用 `fetchBackendCharacterList({ mode, auth, includeOwned: true, includeMhyMetadata: true })`
- 提供 `searchQuery`、`elementFilter`、`rarityFilter`、`ownedOnly` 响应式筛选
- 元素筛选：全部/火/水/雷/冰/风/岩/草
- 星级筛选：全部/五星/四星
- 暴露：`characters`、`loading`、`error`、`filters`、搜索方法

文件：`src/composables/bettergi/useWeaponSelection.ts`
- 调用 `fetchBackendWeaponList({ mode })`
- 提供 `searchQuery`、`rarityFilter`、`weaponTypeFilter` 筛选
- 武器类型筛选：全部/单手剑/双手剑/长柄武器/法器/弓
- 暴露：`weapons`、`loading`、`error`、`filters`

文件：`src/composables/bettergi/useCurrentPlan.ts`
- 调用 `fetchCurrentPlan()`
- 维护 `currentPlan`、`loading`、`error`、`refresh()`
- 暴露聚合后的：当前角色计划、武器计划、材料清单、背包库快照、刷取状态、Project B 目标文本

文件：`src/composables/bettergi/useFarmingStatus.ts`
- 调用 `fetchFarmingStatus()`
- 暴露 `farmingStatus`、`loading`、`refresh()`

文件：`src/composables/bettergi/useInventoryLibrary.ts`
- 调用 `fetchInventoryLibrary({ mode })`
- 提供 `searchQuery`、`categoryFilter`、`rarityFilter` 筛选
- 分类至少包括：全部、角色突破材料、天赋材料、怪物材料、地方特产/采集材料、Boss 材料、周本材料、武器突破材料、经验书/摩拉、其他
- 暴露：`items`、`loading`、`error`、`filters`、`refresh()`

文件：`src/composables/bettergi/useInventoryChanges.ts`
- 仅调用 `fetchInventoryChanges()` 自动读取 Project B 默认路径下的 `latest_record.txt`
- **不再支持手动拖入/导入 latest_record.txt**
- 如果读取不到或内容为空，返回空状态供视图展示
- 暴露：`changes`、`loading`、`error`、`refresh()`

### 3.3 视图层

文件：`src/components/bettergi/dashboard/CurrentPlanView.vue`
- 使用 `useCurrentPlan`、`useFarmingStatus`
- 布局：三栏（左中右）+ 底部背包概览
- 左侧当前养成计划卡片：
  - 角色头像（`CachedImage`）
  - 角色名、星级、元素
  - 当前等级 → 目标等级
  - 当前天赋 A/E/Q → 目标天赋 A/E/Q
  - 当前装备武器、武器等级、精炼
  - 计划状态标签
  - 快捷按钮：同步角色、刷新数据、添加计划
- 中间需求清单：
  - 使用 `MaterialCard` 列表
  - 同时展示：怪物材料、Boss 材料、周本材料、天赋书、经验书、摩拉、地方特产/采集材料、武器突破材料
- 右侧刷取状态：
  - 总进度百分比
  - 当前正在执行/已完成/待执行数量
  - 刷取任务列表（材料图标、名称、目标/已完成/剩余、进度条、状态）
- 底部背包概览 / 最近变更：
  - 最近一次 `latest_record` 时间
  - 获取/消耗/总变更/变更种类
  - 最近变化的材料卡片
  - 点击跳到“背包库 / 背包变更”分区（通过 `emit('switch-tab', 'inventory')`）
- 无计划空状态：
  - 暂无养成计划
  - 按钮：添加角色计划、同步米游社角色、读取背包库

文件：`src/components/bettergi/dashboard/AddPlanView.vue`
- 使用 `useCharacterSelection`、`useWeaponSelection`
- 上下两块：A. 角色养成计划；B. 武器养成计划
- 角色养成计划：
  - 角色选择按钮，点击打开角色选择弹窗
  - 弹窗使用旧版风格（玻璃卡片网格、元素筛选、星级筛选、搜索、已拥有标记、头像+星级角标+元素标记）
  - 选中后自动显示角色头像/名称
  - 如果后端返回米游社数据，自动填入：当前等级、当前天赋 A/E/Q、命座、当前装备武器、武器等级、精炼、突破等级
  - 目标设置：当前等级、目标等级、A/E/Q 当前/目标、数据模式 live/beta、计算方式 米游社优先/本地计算
  - 按钮：计算需求、保存配置、保存并回到当前计划
  - 点击“计算需求”后在右侧/下方展示需求清单预览（不 toast）
  - 点击“保存配置”调用 `savePlan`，成功后刷新当前计划并跳转首页
- 武器养成计划：
  - 位于角色养成计划下方
  - 如果当前角色已有装备武器，自动带入
  - 武器卡片左上角显示小圆形角色头像（归属角色）
  - 显示武器图标、名称、当前等级、目标等级、精炼、突破、星级
  - 支持手动更换武器、武器列表选择、搜索、五星/四星筛选、武器类型筛选
  - 预留 `calculateWeaponPlan` / `saveWeaponPlan` 调用
  - 武器材料清单使用 `MaterialCard`

文件：`src/components/bettergi/dashboard/InventoryLibraryView.vue`
- 内部两个子 Tab：背包库 / 背包变更
- 背包库 Tab：
  - 使用 `useInventoryLibrary`
  - 网格/列表展示材料卡片（`MaterialCard`）
  - 搜索、分类筛选、稀有度筛选
  - 确保展示：空羽蛾、松珀香、冬凌草、月落银、霜盏花、便携轴承、琉鳞石、云岩裂叶、枯叶紫英、微光角菌、肉龙掌 等采集材料
  - 确保展示：浮游干核、破旧的刀镡、骗骗花蜜、寻宝鸦印、新兵的徽记、牢固的箭簇、导能绘卷、破损的面具、史莱姆凝液 等怪物材料
- 背包变更 Tab：
  - 使用 `useInventoryChanges`
  - 自动读取 Project B 的 `latest_record.txt`
  - **删除拖入/导入 latest_record.txt 的入口**
  - 没有记录时显示空状态：“暂无背包变更记录，请先运行一次背包扫描。”
  - 显示变化前后、增加/减少、最新记录时间、变化分类
  - 保留排序、稀有度着色

文件：`src/components/bettergi/dashboard/DashboardShell.vue`（完善）
- 保留四分区 Tabs
- 在 CurrentPlanView 上监听 `switch-tab` 事件切换到 inventory
- header 保持玻璃态标题栏、登录状态、同步角色/扫码按钮

文件：`src/components/bettergi/dashboard/SettingsView.vue`（已存在，补充接口测试）
- 已有米游社登录、数据源状态、缓存刷新、版本检查
- 补充后端接口测试按钮：依次测试 `fetchBackendCharacterList`、`fetchInventoryLibrary`、`fetchCurrentPlan`、`fetchFarmingStatus`
- 调试信息、token 脱敏、版本信息、数据源状态全部放在此分区

### 3.4 入口与全局

文件：`src/App.vue`（修复并完善）
- 确认 `DashboardShell` 正确挂载
- 确认 `QrLoginDialog` 属性绑定正确（不再带 `.value`）
- 集成 `useBetterGIAuth`

文件：`src/style.css`（如需要）
- 添加/确认全局 `.glass-card`、`.text-gradient-primary`、`.text-gradient-accent`、`.glass-button`、`.glass-input` 类可用

## 4. Implementation Phases

### Phase 1（优先完成）
1. `DashboardShell` 四分区结构稳定
2. 恢复 `Appold.vue` 旧版视觉风格：稀有度背景、材料卡片、角色选择弹窗风格
3. 完成“当前计划 / 刷取状态”首页
4. 完成“添加计划”中的角色选择与角色养成
5. 完成“背包库 / 背包变更”基础展示（背包库展示采集/怪物材料，背包变更自动读取 latest_record）
6. 完成“设置 / 数据状态”归位（登录、调试、版本、数据源状态）

### Phase 2（后续完善）
1. 武器养成完整计算与保存（`calculateWeaponPlan` / `saveWeaponPlan`）
2. 背包变更高级排序与筛选
3. 需求清单更多筛选与分组
4. 动画、图标、细节优化

## 5. Assumptions & Decisions

- 后端接口已按 `docs/backend-contract.md` 实现完成，前端只调用 `BackendFacade.ts` 暴露的方法
- 角色选择弹窗复用旧版 AvatarSelectDialog 风格，但扩展元素/星级筛选，不删除旧组件
- 图片统一使用 `CachedImage.vue`，确保缺失/失败/加载中都显示占位图
- 武器养成第一版先做 UI 结构和预留接口，计算可调用后端 `calculateWeaponPlan`
- 不新增路由，所有内容在 DashboardShell 的 Tabs 内切换
- 不删除 `Appold.vue` 及任何旧组件
- 调试信息、token、版本、数据源状态全部集中在 SettingsView

## 6. Verification Steps

1. 确认已阅读并遵守 `CLAUDE.md` 项目规范
2. 启动 `pnpm dev`，确认应用正常渲染 DashboardShell，无白屏/报错
3. 确认顶部只有四个主 Tab：当前计划/刷取状态、添加计划、背包库/背包变更、设置/数据状态
4. 确认“当前计划/刷取状态”为默认首页，包含左侧计划卡片、中间需求清单、右侧刷取状态、底部背包概览
5. 无计划时显示空状态，按钮可跳转/触发对应操作
6. “添加计划”页角色选择弹窗支持搜索、元素筛选、星级筛选、已拥有标记
7. 选择角色后右侧/下方显示头像、名称，并在有米游社数据时自动填入等级/天赋/命座/武器
8. 点击“计算需求”后显示材料清单预览，不只弹 toast
9. 点击“保存配置”调用 `savePlan`，成功后当前计划刷新并可在首页看到
10. 武器养成入口在角色养成下方，武器卡片显示归属角色小圆头像
11. “背包库/背包变更”分区内有两个子 Tab，背包库包含采集材料和怪物材料
12. 背包变更自动读取 latest_record.txt，**没有拖入/导入入口**；无记录时显示空状态
13. 调试信息/登录/token/版本/数据源状态全部在第四个分区，不在首页
14. 所有角色头像、武器图标、材料图标均使用 `CachedImage`，加载失败/缺失/URL 为空都显示占位图
15. 运行 `pnpm type-check` 无明显类型错误；如环境允许，运行 `pnpm lint` 检查代码风格
16. 确认未修改 `BackendFacade.ts`、`NanokaProvider.ts`、`materialCalculator.ts`、Project B 主流程文件
