# BxNcm-DJ

基于 **Vue 3 + Electron + TypeScript** 的桌面端点歌助手，支持**网易云音乐**和 **Bilibili 视频**双源播放，通过 B站直播弹幕实现观众点歌互动。

---

## 功能特性

### 音乐播放

- 双源支持：网易云音乐（音频）+ Bilibili 收藏夹/合集（视频）
- 自动切换空闲歌单，无点歌时自动轮播
- 歌词实时显示（支持翻译、滚动词高亮）
- 视频播放（B站源自动切视频模式）
- 音量控制、快进快退、播放队列管理

### 弹幕点歌

- 连接 B站直播间，观众发送弹幕即可点歌
- 支持多种点歌格式（歌名、网易云ID、B站BV号等）
- 可配置冷却时间（用户冷却 / 歌曲冷却）
- 最大队列长度控制
- 弹幕表情支持

### OBS 叠加层

- **歌词叠加层** — 实时歌词 + 翻译显示，支持空闲文本轮播
- **队列叠加层** — 当前播放队列可视化
- **歌曲信息叠加层** — 当前歌曲标题 / 作者 / 点歌人
- 统一样式设置面板，字体、颜色、阴影、背景等完全可自定义
- 内置 HTTP 服务器，OBS 浏览器源直接接入

### 直播管理

- 一键开播 / 下播
- 修改直播间标题和分区
- 获取粉丝数等直播数据

### 窗口体验

- 无边框自定义标题栏
- 窗口置顶 / 可缩放切换
- 位置和大小记忆
- 明暗主题 / 自定义主题色

---

## 技术栈

| 层级     | 技术                          |
| -------- | ----------------------------- |
| 框架     | Electron 33                   |
| 前端     | Vue 3 + Pinia + Vue Router    |
| 构建     | Vite 6 + vite-plugin-electron |
| 语言     | TypeScript 5.7                |
| 打包     | electron-builder (NSIS)       |
| OBS 通信 | WebSocket (ws)                |

---

## 开发指南

### 环境要求

- Node.js >= 18
- npm >= 9

### 克隆仓库

```bash
git clone https://github.com/Taumata-wwq/BxNcm-DJ.git
cd bx-ncm-dj
```

### 安装依赖

```bash
npm install
```

### 启动开发模式

```bash
npm run dev
```

Vite 将启动开发服务器，Electron 窗口会自动打开。

### 生产构建

```bash
npm run build
```

构建产物输出到 `release/` 目录，包含：

- `BxNcm DJ Setup x.x.x.exe` — NSIS 安装包
- `BxNcm DJ-x.x.x-portable.exe` — 便携版

### 项目结构

```
bx-ncm-dj/
├── electron/                 # Electron 主进程入口
│   ├── main.ts               # 主窗口创建、生命周期
│   └── preload.ts            # 安全的 IPC 桥接
├── src/
│   ├── main/                 # 主进程服务（Node.js）
│   │   ├── ipc/              # IPC 通信处理
│   │   ├── services/         # 核心服务
│   │   │   ├── danmaku/      # B站直播弹幕 WebSocket
│   │   │   ├── music/        # 网易云/B站音视频获取
│   │   │   ├── obs/          # OBS 叠加层 HTTP+WebSocket
│   │   │   │   └── pages/    # 四个叠加层页面
│   │   │   ├── player/       # 播放队列管理
│   │   │   ├── auto-login.ts # 自动登录
│   │   │   ├── live-manager.ts # 直播管理
│   │   │   └── store.ts      # 持久化存储
│   │   └── utils/            # 工具函数
│   ├── renderer/             # 渲染进程（Vue 3）
│   │   ├── components/       # UI 组件
│   │   ├── stores/           # Pinia 状态管理
│   │   ├── views/            # 页面视图
│   │   ├── router/           # 路由配置
│   │   └── App.vue           # 根组件
│   └── shared/               # 共享类型和常量
│       ├── types/            # TypeScript 类型定义
│       └── constants/        # 默认配置
├── build/                    # 构建资源（图标）
├── scripts/                  # 打包后处理脚本
├── electron-builder.yml      # 打包配置
├── vite.config.ts            # Vite 构建配置
├── tsconfig.json             # TypeScript 配置
└── package.json
```

---

## OBS 配置方法

1. 在软件设置中启用「OBS 叠加层」
2. 点击「样式设置」打开样式面板
3. 在 OBS 中添加「浏览器」源，填入对应 URL：
   - 歌词：`http://localhost:4680/lyric`
   - 队列：`http://localhost:4680/queue`
   - 歌曲信息：`http://localhost:4680/songinfo`
4. 设置浏览器源宽度与画布一致，背景透明
5. 在样式面板中实时调整外观

---

## 使用说明

### 首次启动

1. 分别扫码登录 B站 和 网易云音乐
2. 设置 B站直播间房间号
3. 配置空闲歌单（网易云歌单 ID + B站收藏夹链接）
4. 按需调整点歌冷却、队列上限等参数

### 弹幕点歌格式

观众在直播间发送以下格式的弹幕即可点歌：

- `点歌 歌名` — 搜索网易云音乐
- `点歌 歌手 歌名` — 精确搜索
- `点歌 id:xxxxxxx` — 网易云歌曲 ID
- `点歌 BVxxxxxx` — B站视频 BV 号

---

## 许可证

MIT License

## 作者

Taumata

>>>>>>> 6aca698 (1.1.0)
>>>>>>>
>>>>>>
>>>>>
>>>>
>>>
>>
