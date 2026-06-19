# BxNcm DJ

基于 **Vue 3 + Electron + TypeScript** 的桌面端点歌助手，支持**网易云音乐**和 **Bilibili 视频**双源播放，通过 B站直播间弹幕实现观众点歌互动。

***

## 功能特性

### 音乐播放

- 双源支持：网易云音乐（音频）+ Bilibili 收藏夹/合集（视频）
- 自动切换空闲歌单，无点歌时自动轮播（推荐列表）
- 歌词实时显示，支持翻译和滚动词高亮等
- 视频播放（B站源自动切换视频模式，支持硬件解码优化）
- 音量控制、快进快退、播放队列管理
- 音频预缓存，减少播放延迟

### 弹幕点歌与互动

- 自动连接B站直播间，实时接收弹幕
- 支持多种点歌格式：歌名、歌手+歌名、网易云ID、B站 BV 号
- 自由配置冷却时间（用户冷却 / 歌曲冷却）
- 最大队列长度可控制
- 支持发送弹幕表情（B站直播间表情包，支持本地缓存）
- 通过 blivechat 内嵌弹幕显示，支持自定义 CSS 样式
- 关键词屏蔽、用户屏蔽、等级过滤等高级筛选

### OBS 浏览器源捕获

- **歌词叠加层**：实时歌词 + 翻译显示，支持空闲文本轮播
- **队列叠加层**：当前播放队列可视化
- **歌曲信息叠加层**：当前歌曲标题 / 作者 / 点歌人
- 统一样式设置面板，字体、颜色、阴影、背景等完全可自定义
- 内置 HTTP + WebSocket 服务器，OBS 浏览器源直接接入
- 地址可复制，方便分享给其他设备访问

### 直播管理

- 一键开播/ 下播，自动获取RTMP推流地址及推流码
- 支持修改直播间标题和分区
- 弹幕实时粉丝数、在线观看（高能榜）缩略显示。
- 直播数据获取

### 弹幕独立窗口

- 独立透明窗口置顶显示弹幕内容，可自由拖拽、缩放
- 支持固定窗口：固定后上半部分（弹幕区+观众栏）鼠标穿透，下半部分（表情栏+发送框）保持可交互
- 全局快捷键（默认 Alt+B）快速切换固定/解锁状态
- 支持自定义背景色和窗口透明度
- 支持显示/隐藏边框，边框颜色跟随主题色
- 支持发送文本弹幕和表情弹幕，表情包数据与主窗口共享缓存

### 窗口体验

- 无边框自定义标题栏（最小化 / 最大化 / 关闭）
- 窗口置顶 / 可缩放切换
- 窗口位置和大小记忆
- 关闭到系统托盘（可配置，首次提示记忆）
- 托盘右键菜单：快速切换弹幕弹窗、固定/解锁、OBS 样式设置、窗口居中、检查更新
- 明暗主题切换
- 自定义主题色

### 其他功能

- 自动更新检查（基于 GitHub Releases）
- 窗口居中到屏幕正中间

### 键盘快捷键

| 快捷键         | 功能         |
| ----------- | ---------- |
| `Space`     | 播放 / 暂停    |
| `←` / `→`  | 快退 / 快进（长按连续） |
| `↑` / `↓`  | 音量增加 / 减少  |
| `Alt+B`（可配置） | 切换弹幕窗口固定状态 |

***

## 空闲歌单系统

空闲歌单是无人点歌时自动播放的歌曲来源，支持两种源：

- **网易云歌单**：输入歌单 ID（从歌单 URL 中获取，如 `https://music.163.com/playlist?id=8512248857` 中的 `8512248857`）
- **B站视频列表**：支持合集链接、收藏夹链接、分P视频链接

空闲歌单采用**懒加载 + 缓存**策略：
- 启动时优先从本地缓存加载，实现秒开
- 后台异步刷新歌单数据，仅在歌曲列表变化时更新
- 网易云采用池子模式（全部歌曲进池子，播放时随机选取后水合详细信息）
- 歌单播放完毕后自动从缓存重建，实现无限循环播放
- 切换歌单源时零 API 调用，直接从缓存加载

***

## 技术栈

| 层级     | 技术                            |
| ------ | ----------------------------- |
| 框架     | Electron 33                   |
| 前端     | Vue 3 + Pinia + Vue Router    |
| 构建     | Vite 6 + vite-plugin-electron |
| 语言     | TypeScript 5.7                |
| 打包     | electron-builder (NSIS)       |
| 更新     | electron-updater (GitHub Releases) |
| OBS 通信 | WebSocket (ws)                |
| 弹幕     | B站直播 WebSocket 协议 + blivechat |

***

## 开发指南

### 环境要求

- Node.js >= 18
- npm >= 9

### 克隆仓库

```bash
git clone https://github.com/Taumata-wwq/BxNcm-DJ.git
cd BxNcm-DJ
```

### 安装依赖

```bash
npm install
```

### 启动开发模式

```bash
npm run dev
```

Vite 启动开发服务器，Electron 窗口自动打开。

### 生产构建

```bash
npm run build
```

构建产物输出到 `release/` 目录，包含：

- `BxNcm DJ Setup x.x.x.exe` — NSIS 安装包
- `BxNcm DJ-x.x.x-portable.exe` — 便携版

### 类型检查

```bash
npm run typecheck
```

***

## 项目结构

```
BxNcm-DJ/
├── electron/                     # Electron 主进程入口
│   ├── main.ts                   # 主窗口创建、生命周期管理
│   └── preload.ts                # 安全的 IPC 桥接（contextBridge）
├── public/                       # 静态资源
│   └── danmaku-window.html       # 弹幕独立窗口页面
├── src/
│   ├── main/                     # 主进程服务（Node.js 环境）
│   │   ├── ipc/                  # IPC 通信处理
│   │   │   ├── index.ts          # 主入口 + 窗口控制 + 重启
│   │   │   ├── auth.ipc.ts       # 登录认证
│   │   │   ├── danmaku.ipc.ts    # 弹幕连接 + 表情包缓存
│   │   │   ├── live.ipc.ts       # 直播管理
│   │   │   ├── player.ipc.ts     # 播放核心
│   │   │   ├── playlist.ipc.ts   # 队列 + 空闲歌单
│   │   │   └── settings.ipc.ts   # 设置读写 + 数据重置
│   │   ├── services/             # 核心服务
│   │   │   ├── danmaku/
│   │   │   │   ├── danmaku-window.ts  # 弹幕独立窗口服务
│   │   │   │   └── live-ws.ts         # 播放弹幕 WebSocket 客户端
│   │   │   ├── music/
│   │   │   │   ├── bilibili-video.ts  # B站视频获取
│   │   │   │   ├── netease-api.ts     # 网易云 API
│   │   │   │   └── netease-auth.ts    # 网易云认证
│   │   │   ├── obs/
│   │   │   │   ├── index.ts      # OBS 服务入口
│   │   │   │   ├── server.ts     # HTTP + WebSocket 服务器
│   │   │   │   ├── common.ts     # 公共工具
│   │   │   │   └── pages/        # 四个叠加层页面
│   │   │   │       ├── lyric.ts
│   │   │   │       ├── queue.ts
│   │   │   │       ├── songinfo.ts
│   │   │   │       └── style.ts
│   │   │   ├── player/
│   │   │   │   ├── audio-cache.ts       # 音频文件缓存
│   │   │   │   └── playlist-manager.ts  # 播放队列管理
│   │   │   ├── auto-login.ts     # 自动登录
│   │   │   ├── emoticon-cache.ts # 表情包图片缓存
│   │   │   ├── live-manager.ts   # 直播管理
│   │   │   ├── store.ts          # 持久化存储（JSON 文件）
│   │   │   ├── tray.ts           # 系统托盘（自定义 BrowserWindow 菜单）
│   │   │   └── updater.ts        # 自动更新服务
│   │   └── utils/                # 主进程工具函数
│   │       ├── cookie.ts         # Cookie 管理
│   │       ├── fetch.ts          # HTTP 请求封装
│   │       ├── image.ts          # 图片处理
│   │       ├── netease-crypto.ts # 网易云加密
│   │       └── wbi.ts            # B站 WBI 签名
│   ├── renderer/                 # 渲染进程（Vue 3）
│   │   ├── assets/
│   │   │   └── styles/
│   │   │       ├── global.css    # 全局样式 + CSS 变量
│   │   │       └── danmaku.css   # 弹幕默认 CSS 样式
│   │   ├── components/
│   │   │   ├── chat/             # 弹幕相关
│   │   │   │   └── DanmakuIframe.vue     # blivechat iframe 嵌入
│   │   │   ├── left-sidebar/     # 左侧边栏
│   │   │   │   ├── SidebarTabs.vue       # 标签页切换
│   │   │   │   ├── AccountPanel.vue      # 账户信息
│   │   │   │   ├── PlaylistPanel.vue     # 点歌队列 + 搜索
│   │   │   │   ├── DanmakuPanel.vue      # 弹幕互动
│   │   │   │   └── LivePanel.vue         # 直播管理
│   │   │   ├── player/           # 播放器
│   │   │   │   ├── AudioPlayer.vue       # 音频播放
│   │   │   │   ├── VideoPlayer.vue       # 视频播放
│   │   │   │   ├── CoverDisplay.vue      # 封面展示
│   │   │   │   ├── LyricsDisplay.vue     # 歌词显示
│   │   │   │   ├── ProgressBar.vue       # 进度条 + 音量
│   │   │   │   └── SongInfo.vue          # 歌曲信息
│   │   │   ├── settings/         # 设置
│   │   │   │   ├── SettingsModal.vue     # 设置弹窗
│   │   │   │   ├── CloseToTrayDialog.vue # 关闭到托盘对话框
│   │   │   │   ├── UpdateNotificationDialog.vue # 更新通知对话框
│   │   │   │   ├── ColorPicker.vue       # 颜色选择器
│   │   │   │   └── ConfirmDialog.vue     # 确认对话框
│   │   │   └── titlebar/
│   │   │       └── TitleBar.vue          # 自定义标题栏
│   │   ├── stores/               # Pinia 状态管理
│   │   │   ├── settings.store.ts # 设置状态（三阶段加载 + 防抖保存）
│   │   │   ├── auth.store.ts     # 认证状态
│   │   │   ├── danmaku.store.ts  # 弹幕状态
│   │   │   ├── player.store.ts   # 播放器状态
│   │   │   └── playlist.store.ts # 播放列表状态
│   │   ├── views/                # 页面视图
│   │   │   ├── LoginView.vue     # 登录页（双平台扫码）
│   │   │   └── MainView.vue      # 主界面
│   │   ├── router/
│   │   │   └── index.ts          # 路由配置（Memory History）
│   │   ├── App.vue               # 根组件（启动状态机 + 关闭前保存）
│   │   └── main.ts               # Vue 应用入口
│   ├── env.d.ts                  # 全局类型声明（window.electronAPI 等）
│   └── shared/                   # 主进程与渲染进程共享
│       ├── types/
│       │   ├── settings.ts       # 设置类型定义
│       │   ├── danmaku.ts        # 弹幕类型定义
│       │   ├── player.ts         # 播放器类型定义
│       │   └── song.ts           # 歌曲类型定义
│       ├── constants/
│       │   └── defaults.ts       # 默认设置值
│       └── utils/
│           └── audio.ts          # 音频工具函数
├── build/                        # 构建资源（图标）
│   └── icon.ico
├── scripts/
│   └── after-pack.cjs            # 打包后精简脚本
├── electron-builder.yml          # 打包配置
├── vite.config.ts                # Vite 构建配置
├── tsconfig.json                 # TypeScript 配置
├── tsconfig.node.json            # Vite 配置的 TS 配置
├── index.html                    # Vite 入口 HTML
├── .gitignore
├── .npmrc                        # npm registry 镜像配置
└── package.json
```

***

## 架构说明

### 进程模型

项目遵循 Electron 标准的**主进程 / 渲染进程**分离架构：

- **主进程**（`src/main/`）：运行在 Node.js 环境，负责文件系统操作、网络请求、WebSocket 连接、播放器控制等底层功能。通过 `electron/preload.ts` 中的 `contextBridge` 暴露安全的 API 给渲染进程。
- **渲染进程**（`src/renderer/`）：运行在 Chromium 环境，使用 Vue 3 构建 UI。通过 `window.electronAPI` 调用主进程功能，不直接访问 Node.js API。
- **共享层**（`src/shared/`）：TypeScript 类型定义和常量，两端均可引用。

### 数据流

```
用户操作 → Vue 组件 → Pinia Store → IPC (invoke/send) → 主进程服务 → 外部 API
                                                                   ↓
UI 更新 ← Vue 响应式 ← Pinia Store ← IPC (on 事件) ← 主进程服务结果
```

### 设置持久化

采用**三阶段加载**策略，优化启动速度：

1. **Boot**（窗口显示前）：主题、窗口位置、置顶状态
2. **App**（窗口显示后）：软件本体设置（弹幕、播放器、OBS 等）
3. **Style**（预留）：OBS 样式数据

设置变更通过 300ms 防抖自动保存，关闭时即时保存避免数据丢失。

### 弹幕系统

弹幕通过 **blivechat iframe**（`DanmakuIframe.vue`）嵌入 blivechat 页面，支持通过 URL 参数配置和自定义 CSS 注入。

弹幕数据通过主进程的 WebSocket 连接 B站直播间获取，支持自动重连。

***

## 使用说明

### 首次启动

1. 分别扫码登录 B站 和 网易云音乐
2. 配置空闲歌单（网易云歌单 ID + B站收藏夹链接）
3. 按需调整各种设置项

### 弹幕点歌格式

观众在直播间发送以下格式的弹幕即可点歌：

| 格式              | 示例                 | 说明        |
| --------------- | ------------------ | --------- |
| `点歌 歌名`         | `点歌 春日影`           | 搜索网易云音乐   |
| `点歌 歌手 歌名`      | `点歌 春日影 CRYCHIC`   | 精确搜索      |
| `点歌 id:xxxxxxx` | `点歌 id:2154464431` | 网易云歌曲 ID  |
| `点歌 BVxxxxxx`   | `点歌 BV1EGKMebEyJ`  | B站视频 BV 号 |

### blivechat 弹幕显示

在设置中开启「弹幕捕获」后，系统会自动获取身份码并构建 blivechat 地址。

弹幕显示区域的样式可通过设置中的「自定义 CSS」文本框修改。

***

## OBS 配置

1. 在软件设置中启用「OBS 叠加层」
2. 点击「打开」按钮打开样式设置面板。
3. 在 OBS 中添加「浏览器」源，填入对应 URL：
   - 歌词：`http://localhost:4680/lyric`
   - 队列：`http://localhost:4680/queue`
   - 歌曲信息：`http://localhost:4680/songinfo`
4. 将obs浏览器源放到需要的位置即可。
5. 在样式面板中实时调整字体、颜色、阴影等外观，自动同步可在右侧预览或obs直接看到效果。

***

## 打包说明

### 构建命令

```bash
npm run build
```

### 打包配置

打包配置位于 `electron-builder.yml`，主要选项：

- 目标平台：Windows (x64, NSIS 安装包)
- 压缩级别：maximum
- ASAR 打包：启用（ws、qrcode、electron-updater 模块解包）
- 安装选项：自定义安装路径、桌面快捷方式、开始菜单

### 构建产物精简

`scripts/after-pack.cjs` 在打包后自动执行，移除不必要的文件：

- 多余语言包（仅保留中英文）
- PDF 查看器（pdf.dll）
- 崩溃上报程序（crashpad\_handler.exe）

### 版本号

版本号在 `package.json` 中维护，通过 Vite 的 `define` 注入到应用中，在登录页底部显示。

***

## 许可证

MIT License

## 作者

Taumata
