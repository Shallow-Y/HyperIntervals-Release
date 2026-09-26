# HyperIntervals-Release

面向小米 / Redmi / POCO 设备的**信息查询与维护工具箱**，同时附带一套日常实用小工具。
Android 原生应用，Kotlin + Jetpack Compose 编写，UI 基于 [Miuix](https://github.com/compose-miuix-ui/miuix)（澎湃 OS 风格组件库）。

- **产物形态**：Arm64 APK（`applicationId: com.shallowy.intervals`）
- **运行要求**：Android 8.0（API 26）及以上
- **当前版本**：`26.9.Beta3`（`versionCode 2026092603`）

---

## 功能概览

### 首页 · 当前设备

- 设备卡片：机型、系统版本（优先读取 HyperOS 版本号）、发布时间、**更新终止日期（EOL）**
- 维护状态标签：数据加载中显示「检测中」，不再出现先「维护中」后跳成「已终止」的闪跳
- 公告记录入口：查看历史应用内公告

### 数据 · 设备资料库

- 检索与筛选小米系机型的维护状态、更新终止日期
- 「显示海外型号」开关：开启后按数据源原始型号展示（如 `Xiaomi 14T Pro`）
- 数据来源为公开的设备 EOL / AER 认证数据

### 小工具 · 硬件与日志

- **硬件信息**：一次日志分析汇总机型与系统版本、屏幕与触控 IC、内存与存储、UFS 健康状态、电池健康度
- **电池健康度**：容量概览、循环次数、历史记录
- **抓取日志**：解析 bugreport，输出功耗、内存、LPDDR、关机原因等专项分析页
- **系统属性快照 / 已安装应用快照**：保存与对比系统状态
- **系统更新包查询**、**禁用系统更新**、**快捷功能**、**应用管理**（导出 / 分享安装包，支持 `.apks`）

### 实用工具

- **APK 安装器**：系统安装器 / **Shizuku** 静默安装
- **倒数日 · 生日**：支持农历
- **抖音无水印下载**：粘贴分享链接或整段分享文本，解析下载视频、图文、音乐与封面
- **悬浮时间**：悬浮窗显秒、实时更新通知、后台隐藏

### 娱乐工具

今日人品、手上跳蛋、音效盒

### 设置

- 应用风格拆分：顶栏与底栏可独立设置；底栏提供 经典 / 悬浮（含液态玻璃）样式，平板端悬浮底栏统一使用液态玻璃
- 动态取色（含色系与调色风格选择）
- 应用内更新：**稳定版 / 测试版**双通道、更新日志、帮助与反馈、赞赏支持

---

## 界面与交互

| 能力 | 说明 |
|---|---|
| Miuix / HyperOS 风格 | 全局使用 Miuix 组件与该设计语言 |
| 液态玻璃 | 基于 `io.github.kyant0:backdrop` 的实时模糊底栏与顶栏，含按压态与拖动选择器 |
| 深色模式 | 全页面适配，图标与文字随主题反转 |
| 大屏平行视界 | 基于 Activity Embedding，宽度 ≥600dp 时主页面收缩至左侧（0.34 : 0.66），支持一级页条目持久按压态与右边缘分隔线 |
| 渐变模糊遮罩 | 顶栏滚动时渐进模糊，随侧边栏展开 / 进出平行视界自适应 |
| 公平运行内存 | 适配小米 HyperOS 公平运行内存机制（`itgsa.intent.action.TRIM`） |

---

## 技术栈

| 层 | 选型 |
|---|---|
| 语言 / 构建 | Kotlin 2.4.0、AGP 9.2.1、Gradle Version Catalog、KSP |
| UI | Jetpack Compose（BOM `2026.05.01`）、Material 3、**Miuix 0.9.4** |
| 视觉特效 | `io.github.kyant0:backdrop` 2.0.1、`io.github.kyant0:shapes` 1.2.1、`material-color-utilities` |
| 架构 | Hilt 依赖注入、ViewModel + StateFlow、`data/repository` 仓库层 |
| 存储 | Room 2.8.4（设备 / EOL 数据）、DataStore Preferences（用户偏好） |
| 网络 | Retrofit 2.11 + OkHttp 4.12 + Gson |
| 系统能力 | `androidx.window`（Activity Embedding）、**Shizuku 13.1.5**、AndroidX Startup |
| SDK | `compileSdk 37` / `targetSdk 37` / `minSdk 26`，Java 17，仅 `arm64-v8a` |

---

### 版本号约定

- `versionCode`：`YYYYMMDD` + 当日构建序号，例如 `2026092603`
- `versionName`：`26.9.<构建序号>`，Beta 通道形如 `26.9.Beta3`
- Git tag：`v26.9.<发布日>.<当日构建序号>`，例如 `v26.9.26.3`
- 三者需与 `ui/data/ChangelogData.kt` 首条更新日志的版本与日期保持一致

---

## 发布渠道

应用内更新读取发布仓库的通道元数据，**稳定版与测试版独立**：

| 通道 | 元数据 | 下载源 |
|---|---|---|
| 稳定版 | `stable.json` | [GitHub Releases](https://github.com/Shallow-Y/HyperIntervals-Release/releases) · [Gitee Releases](https://gitee.com/shallow-y/hyper-intervals-release/releases) |
| 测试版 | `beta.json` | 同上（Beta tag） |

---

## 官网

`website/` 为官网工程（Kotlin Multiplatform / **Wasm** + Compose for Web）：

- 构建：`./gradlew -p website wasmJsBrowserDistribution`
- 部署：`.github/workflows/deploy-pages.yml` 每日定时 + 推送触发，产物发布到 `HyperIntervals-Release` 的 `gh-pages` 分支
- 设备数据由 `website/scripts/fetch_device_data.py` 抓取并生成 `devices.json`

---

## 第三方组件

感谢以下开源项目：

- [Miuix](https://github.com/compose-miuix-ui/miuix)（Apache-2.0）—— 澎湃 OS 风格 Compose Multiplatform 组件库
- `io.github.kyant0:shapes`、`io.github.kyant0:backdrop` —— 形状库与实时模糊（液态玻璃效果）
- [material-color-utilities](https://github.com/material-foundation/material-color-utilities) —— 动态取色
- [Shizuku](https://github.com/RikkaApps/Shizuku) —— 免 Root 的系统级调用
- AndroidX、Kotlin、Room、Hilt、Retrofit / OkHttp 等基础设施

---

## 说明

- 本项目与小米、Redmi、POCO 及其关联公司**无隶属或合作关系**；设备型号、维护状态与更新终止日期等信息均来自公开数据源，仅供参考。
- 仓库中的代码为私有代码，**未附开源许可证**；对外提供的仅为构建产物（APK）。
- 使用 Shizuku 或系统更新相关功能需要相应授权，部分能力依赖设备与系统版本。
