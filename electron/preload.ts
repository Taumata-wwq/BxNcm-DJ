import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // 自动登录
  checkAutoLogin: () => ipcRenderer.invoke('auto-login:check'),

  // 弹幕
  connectDanmaku: (roomId: number) =>
    ipcRenderer.invoke('danmaku:connect', roomId),
  disconnectDanmaku: () => ipcRenderer.invoke('danmaku:disconnect'),
  sendDanmaku: (roomId: number, msg: string, emoticonUnique?: string, emoticonId?: number, dmType?: number) =>
    ipcRenderer.invoke('danmaku:send', roomId, msg, emoticonUnique, emoticonId, dmType),
  getEmoticons: (roomId: number) => ipcRenderer.invoke('danmaku:get-emoticons', roomId),
  getUserEmoticons: () => ipcRenderer.invoke('danmaku:get-user-emoticons'),
  getAllEmoticons: () => ipcRenderer.invoke('danmaku:get-all-emoticons'),
  onDanmakuStatusChanged: (cb: (status: unknown) => void) => {
    ipcRenderer.on('danmaku:status-changed', (_, s) => cb(s))
  },
  onDanmakuViewerJoin: (cb: (viewer: unknown) => void) => {
    ipcRenderer.on('danmaku:viewer-join', (_, v) => cb(v))
  },
  onDanmakuViewerListSync: (cb: (viewers: unknown) => void) => {
    ipcRenderer.on('danmaku:viewer-list-sync', (_, v) => cb(v))
  },

  // 播放器
  playerPlay: (songId: string) => ipcRenderer.invoke('player:play', songId),
  playerPause: () => ipcRenderer.invoke('player:pause'),
  playerResume: () => ipcRenderer.invoke('player:resume'),
  playerSeek: (time: number) => ipcRenderer.invoke('player:seek', time),
  playerNext: () => ipcRenderer.invoke('player:next'),
  playerPrev: () => ipcRenderer.invoke('player:prev'),
  onPlayerStateChanged: (cb: (state: unknown) => void) => {
    ipcRenderer.on('player:state-changed', (_, s) => cb(s))
  },
  onPlayUrl: (cb: (data: unknown) => void) => {
    ipcRenderer.on('player:play-url', (_, d) => cb(d))
  },
  onPlayerPause: (cb: () => void) => {
    ipcRenderer.on('player:pause', () => cb())
  },
  onPlayerResume: (cb: () => void) => {
    ipcRenderer.on('player:resume', () => cb())
  },
  onPlayerSeek: (cb: (time: number) => void) => {
    ipcRenderer.on('player:seek', (_, t: number) => cb(t))
  },
  playerEnded: () => {
    ipcRenderer.send('player:ended')
  },
  onLyricUpdate: (cb: (lyric: unknown[]) => void) => {
    ipcRenderer.on('player:lyric-update', (_, l) => cb(l))
  },
  
  // 播放列表
  getPlaylist: () => ipcRenderer.invoke('playlist:get'),
  playlistRemove: (songId: string) => ipcRenderer.invoke('playlist:remove', songId),
  playlistClear: () => ipcRenderer.invoke('playlist:clear'),
  playlistAddSong: (song: unknown) => ipcRenderer.invoke('playlist:add-song', song),
  playlistInsertTop: (song: unknown) => ipcRenderer.invoke('playlist:insert-top', song),
  onPlaylistUpdated: (cb: (list: unknown[]) => void) => {
    ipcRenderer.on('song:playlist-updated', (_, l) => cb(l))
  },

  // 空闲歌单
  getIdlePlaylistInfo: () => ipcRenderer.invoke('idle-playlist:info'),
  getIdleQueueStartIndex: () => ipcRenderer.invoke('idle-playlist:queue-start'),
  refreshIdlePlaylist: (neteaseId: string, bilibiliId: string) =>
    ipcRenderer.invoke('idle-playlist:refresh', neteaseId, bilibiliId),
  refreshIdlePlaylistSingle: (source: 'netease' | 'bilibili', id: string, force: boolean) =>
    ipcRenderer.invoke('idle-playlist:refresh-single', source, id, force),
  getIdlePlaylistCacheInfo: (source: 'netease' | 'bilibili', id: string) =>
    ipcRenderer.invoke('idle-playlist:cache-info', source, id),
  loadIdlePlaylistFromCache: (source: 'netease' | 'bilibili', id: string) =>
    ipcRenderer.invoke('idle-playlist:load-from-cache', source, id),
  cacheOnlyIdlePlaylist: (source: 'netease' | 'bilibili', id: string) =>
    ipcRenderer.invoke('idle-playlist:cache-only', source, id),

  // 设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),
  // 启动加载
  loadBootData: () => ipcRenderer.invoke('boot:load'),
  loadAppData: () => ipcRenderer.invoke('app:load'),
  getIdleQueueSize: () => ipcRenderer.invoke('settings:get-idle-queue-size'),
  setIdleQueueSize: (size: number) => ipcRenderer.invoke('settings:set-idle-queue-size', size),
  getLastIdleSource: () => ipcRenderer.invoke('settings:get-last-idle-source'),
  setLastIdleSource: (source: 'netease' | 'bilibili') => ipcRenderer.invoke('settings:set-last-idle-source', source),
  resetAllData: () => ipcRenderer.invoke('store:reset-data'),

  // 认证
  getBilibiliQRCode: () => ipcRenderer.invoke('auth:bilibili-qrcode'),
  checkBilibiliQRCode: (oauthKey: string) => ipcRenderer.invoke('auth:bilibili-check', oauthKey),
  getBilibiliLiveRoom: () => ipcRenderer.invoke('auth:bilibili-room'),
  getNeteaseQRCode: () => ipcRenderer.invoke('auth:netease-qrcode'),
  checkNeteaseQRCode: (unikey: string) => ipcRenderer.invoke('auth:netease-check', unikey),
  logoutBilibili: () => ipcRenderer.invoke('auth:logout-bilibili'),
  logoutNetease: () => ipcRenderer.invoke('auth:logout-netease'),
  onAuthStateChanged: (cb: (state: unknown) => void) => {
    ipcRenderer.on('auth:state-changed', (_, s) => cb(s))
  },

  // 搜索
  searchSong: (keyword: string) => ipcRenderer.invoke('search:song', keyword),

  // 音频文件缓存
  getAudioCacheList: () => ipcRenderer.invoke('audio-cache:list'),
  clearAudioCache: () => ipcRenderer.invoke('audio-cache:clear'),
  prefetchQueueOnStartup: () => ipcRenderer.invoke('audio-cache:prefetch-queue'),

  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),

  // 应用
  appRelaunch: () => ipcRenderer.invoke('app:relaunch'),
  setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('window:set-always-on-top', flag),
  isAlwaysOnTop: () => ipcRenderer.invoke('window:is-always-on-top'),
  setResizable: (flag: boolean) => ipcRenderer.invoke('window:set-resizable', flag),
  isResizable: () => ipcRenderer.invoke('window:is-resizable'),

  // 日志
  onLogAdd: (cb: (msg: string) => void) => {
    ipcRenderer.on('log:add', (_, msg: string) => cb(msg))
  },

  // 关闭前保存
  onBeforeClose: (cb: () => void) => {
    ipcRenderer.on('app:before-close', () => cb())
  },
  appSaveDone: () => {
    ipcRenderer.send('app:save-done')
  },
  // 关闭到托盘对话框
  onShowCloseToTrayDialog: (cb: () => void) => {
    ipcRenderer.on('dialog:show-close-to-tray', () => cb())
  },
  sendCloseToTrayResult: (result: { action: string; remember: boolean }) => {
    ipcRenderer.send('dialog:close-to-tray-result', result)
  },
  setLoginPhase: (inLogin: boolean) => {
    ipcRenderer.send('app:set-login-phase', inLogin)
  },

  // 打开开发者工具
  openDevTools: () => ipcRenderer.invoke('window:open-devtools'),
  // 打开 OBS 样式设置窗口
  openStyleWindow: (port: number) => ipcRenderer.invoke('window:open-style', port),

  // 自动更新
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdateStatus: (cb: (status: unknown) => void) => {
    ipcRenderer.on('updater:status', (_, s) => cb(s))
  },

  // 直播管理
  liveGetRoomInfo: (uid: number) => ipcRenderer.invoke('live:get-room-info', uid),
  liveGetRoomInfoByRoom: (roomId: number) => ipcRenderer.invoke('live:get-room-info-by-room', roomId),
  liveGetFollowerCount: (vmid: number) => ipcRenderer.invoke('live:get-follower-count', vmid),
  liveUpdateTitle: (roomId: number, title: string) => ipcRenderer.invoke('live:update-title', roomId, title),
  liveUpdateArea: (roomId: number, areaId: number) => ipcRenderer.invoke('live:update-area', roomId, areaId),
  liveGetAreaList: () => ipcRenderer.invoke('live:get-area-list'),
  liveStart: (roomId: number, areaId: number) => ipcRenderer.invoke('live:start', roomId, areaId),
  liveStop: (roomId: number) => ipcRenderer.invoke('live:stop', roomId),

  // blivechat 身份码
  fetchIdentityCode: () => ipcRenderer.invoke('auth:fetch-identity-code'),
  // blivechat CSS 注入（通过主进程在子 frame 中执行 JavaScript）
  injectCssToBlivechatFrame: (css: string) => ipcRenderer.invoke('danmaku:inject-css', css),
  // 表情包图片缓存
  cacheEmoticonImages: (packages: any[]) => ipcRenderer.invoke('emoticon:cache-images', packages),

  // OBS 叠加层 - 广播数据到 WebSocket 客户端
  obsBroadcastLyric: (text: string, translation: string) => ipcRenderer.send('obs:broadcast-lyric', { text, translation }),
  obsBroadcastQueue: (songs: Array<{ index: number; title: string; artist: string; requesterName: string }>, currentIndex: number) =>
    ipcRenderer.send('obs:broadcast-queue', { songs, currentIndex }),
  obsBroadcastSongInfo: (title: string, artist: string, requester: string) =>
    ipcRenderer.send('obs:broadcast-songinfo', { title, artist, requester }),

  // OBS 叠加层
  getObsPort: () => ipcRenderer.invoke('obs-overlay:get-port'),
  toggleObsOverlay: (enabled: boolean) => ipcRenderer.invoke('obs-overlay:toggle', enabled),
  startObsIfEnabled: () => ipcRenderer.invoke('obs-overlay:start-if-enabled'),

  // 弹幕窗口
  openDanmakuWindow: (url: string, css: string, bgColor?: string, opacity?: number) => ipcRenderer.invoke('danmaku-window:open', url, css, bgColor, opacity),
  closeDanmakuWindow: () => ipcRenderer.invoke('danmaku-window:close'),
  setDanmakuWindowFixed: (fixed: boolean) => ipcRenderer.invoke('danmaku-window:set-fixed', fixed),
  toggleDanmakuWindowFixed: () => ipcRenderer.invoke('danmaku-window:toggle-fixed'),
  setDanmakuWindowShowBorder: (show: boolean) => ipcRenderer.invoke('danmaku-window:set-show-border', show),
  registerDanmakuFixShortcut: (shortcut: string) => ipcRenderer.invoke('danmaku-window:register-fix-shortcut', shortcut),
  setDanmakuWindowBgColor: (color: string) => ipcRenderer.invoke('danmaku-window:set-bg-color', color),
  setDanmakuWindowOpacity: (opacity: number) => ipcRenderer.invoke('danmaku-window:set-opacity', opacity),
  updateDanmakuWindowCss: (css: string) => ipcRenderer.invoke('danmaku-window:update-css', css),
  updateDanmakuWindowUrl: (url: string) => ipcRenderer.invoke('danmaku-window:update-url', url),
  isDanmakuWindowOpen: () => ipcRenderer.invoke('danmaku-window:is-open'),
  getDanmakuWindowConfig: () => ipcRenderer.invoke('danmaku-window:get-config'),
  onDanmakuWindowConfig: (cb: (config: unknown) => void) => {
    ipcRenderer.on('danmaku-window:config', (_, cfg) => cb(cfg))
  },
  onDanmakuWindowFixedChanged: (cb: (fixed: boolean) => void) => {
    ipcRenderer.on('danmaku-window:fixed-changed', (_, fixed) => cb(fixed))
  },
  onDanmakuWindowClosed: (cb: () => void) => {
    ipcRenderer.on('danmaku-window:closed', () => cb())
  },
  onDanmakuWindowOpened: (cb: () => void) => {
    ipcRenderer.on('danmaku-window:opened', () => cb())
  },
  setMousePassthrough: (passthrough: boolean) => ipcRenderer.invoke('danmaku-window:set-mouse-passthrough', passthrough),
})
