/// <reference types="vite/client" />

declare const __APP_VERSION__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}


interface ElectronAPI {
  checkAutoLogin: () => Promise<{ hasCredentials: boolean; authState: import('@shared/types/settings').AuthState }>
  // 弹幕
  connectDanmaku: (roomId: number) => Promise<any>
  disconnectDanmaku: () => Promise<any>
  sendDanmaku: (roomId: number, msg: string, emoticonUnique?: string, emoticonId?: number, dmType?: number) => Promise<any>
  getEmoticons: (roomId: number) => Promise<{ code: number; message: string; data: any }>
  getUserEmoticons: () => Promise<{ code: number; message: string; packages: any[] }>
  getAllEmoticons: () => Promise<{ code: number; message: string; packages: any[] }>
  onDanmakuStatusChanged: (cb: (status: import('@shared/types/danmaku').DanmakuStatus) => void) => void
  onDanmakuViewerJoin: (cb: (viewer: import('@shared/types/danmaku').ViewerInfo) => void) => void
  playerPlay: (songId: string) => Promise<void>
  playerPause: () => Promise<void>
  playerResume: () => Promise<void>
  playerSeek: (time: number) => Promise<void>
  playerNext: () => Promise<void>
  playerPrev: () => Promise<void>
  playerSetVolume: (vol: number) => Promise<void>
  onPlayerStateChanged: (cb: (state: any) => void) => void
  onPlayUrl: (cb: (data: any) => void) => void
  onPlayerPause: (cb: () => void) => void
  onPlayerResume: (cb: () => void) => void
  onPlayerSeek: (cb: (time: number) => void) => void
  onPlayerTimeUpdate: (cb: (t: number, d: number) => void) => void
  playerEnded: () => void
  onLyricUpdate: (cb: (lyric: any[]) => void) => void
  getPlaylist: () => Promise<any[]>
  playlistRemove: (songId: string) => Promise<void>
  playlistClear: () => Promise<void>
  playlistAddSong: (song: any) => Promise<void>
  playlistInsertTop: (song: any) => Promise<void>
  onPlaylistUpdated: (cb: (list: any[]) => void) => void
  favoriteAdd: (song: any) => Promise<void>
  favoriteRemove: (songId: string) => Promise<void>
  getFavorites: () => Promise<any[]>
  getIdlePlaylistInfo: () => Promise<{ name: string; owner: string; source: string } | null>
  getIdleQueueStartIndex: () => Promise<number>
  refreshIdlePlaylistSingle: (source: 'netease' | 'bilibili', id: string, force: boolean) => Promise<{ success: boolean; count?: number; info?: { name: string; owner: string; source: string } | null; unchanged: boolean; cached?: boolean; queue?: any[]; firstSong?: any }>
  getIdlePlaylistCacheInfo: (source: 'netease' | 'bilibili', id: string) => Promise<{ name: string; songCount: number; cached: boolean }>
  loadIdlePlaylistFromCache: (source: 'netease' | 'bilibili', id: string) => Promise<{ success: boolean; reason?: string; queue?: any[]; firstSong?: any; count?: number }>
  cacheOnlyIdlePlaylist: (source: 'netease' | 'bilibili', id: string) => Promise<{ success: boolean }>
  getSettings: () => Promise<any>
  saveSettings: (settings: any) => Promise<{ success: boolean }>
  // 三阶段加载
  loadBootData: () => Promise<{ theme: 'dark' | 'light'; accentColor: string; alwaysOnTop: boolean; resizable: boolean; windowPosition: { x: number; y: number; width: number; height: number } | null }>
  loadAppData: () => Promise<Record<string, string>>
  loadStyleData: () => Promise<Record<string, unknown>>
  getIdleQueueSize: () => Promise<number>
  setIdleQueueSize: (size: number) => Promise<{ success: boolean }>
  getLastIdleSource: () => Promise<'netease' | 'bilibili'>
  setLastIdleSource: (source: 'netease' | 'bilibili') => Promise<{ success: boolean }>
  resetAllData: () => Promise<{ success: boolean }>
  getBilibiliQRCode: () => Promise<{ qrcodeKey: string; url: string } | null>
  checkBilibiliQRCode: (oauthKey: string) => Promise<{ success: boolean; status: number; uname?: string; face?: string; faceDataUrl?: string; uid?: number } | null>
  getBilibiliLiveRoom: () => Promise<{ roomId: number; liveStatus: number } | null>
  getNeteaseQRCode: () => Promise<{ unikey: string; url: string } | null>
  checkNeteaseQRCode: (unikey: string) => Promise<{ success: boolean; status: number; uname?: string; face?: string; uid?: number } | null>
  logoutBilibili: () => Promise<void>
  logoutNetease: () => Promise<void>
  onAuthStateChanged: (cb: (state: any) => void) => void
  searchSong: (keyword: string) => Promise<any>
  getRecentCache: () => Promise<any[]>
  clearCache: () => Promise<{ success: boolean }>
  minimizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  setAlwaysOnTop: (flag: boolean) => Promise<boolean>
  isAlwaysOnTop: () => Promise<boolean>
  setResizable: (flag: boolean) => Promise<boolean>
  isResizable: () => Promise<boolean>
  onLogAdd: (cb: (msg: string) => void) => void
  onBeforeClose: (cb: () => void) => void
  appSaveDone: () => void
  appRelaunch: () => Promise<void>
  openDevTools: () => Promise<void>
  openStyleWindow: (port: number) => Promise<boolean>
  liveGetRoomInfo: (uid: number) => Promise<any>
  liveGetRoomInfoByRoom: (roomId: number) => Promise<any>
  liveGetFollowerCount: (vmid: number) => Promise<{ code: number; follower: number }>
  liveUpdateTitle: (roomId: number, title: string) => Promise<any>
  liveUpdateArea: (roomId: number, areaId: number) => Promise<any>
  liveGetAreaList: () => Promise<any>
  liveStart: (roomId: number, areaId: number) => Promise<any>
  liveStop: (roomId: number) => Promise<any>
  getLiveArea: () => Promise<{ parentAreaIdx: number; subAreaId: number } | null>
  setLiveArea: (parentAreaIdx: number, subAreaId: number) => Promise<{ success: boolean }>
  // blivechat 身份码
  fetchIdentityCode: () => Promise<{ success: boolean; code?: string; message?: string }>
  // blivechat CSS 注入（通过主进程在子 frame 中执行 JavaScript）
  injectCssToBlivechatFrame: (css: string) => Promise<{ success: boolean; error?: string }>
  // 表情包图片缓存
  cacheEmoticonImages: (packages: any[]) => Promise<{ success: boolean; urlMap: Record<string, string> }>
  clearEmoticonCache: () => Promise<{ success: boolean }>
  // OBS 叠加层 - 广播数据
  obsBroadcastLyric: (text: string, translation: string) => void
  obsBroadcastQueue: (songs: Array<{ index: number; title: string; artist: string; requesterName: string }>, currentIndex: number) => void
  obsBroadcastSongInfo: (title: string, artist: string, requester: string) => void
  // OBS 叠加层
  getObsPort: () => Promise<number>
  toggleObsOverlay: (enabled: boolean) => Promise<{ port: number; error?: string }>
  startObsIfEnabled: () => Promise<{ port: number; error?: string }>
  getAudioCacheList: () => Promise<any[]>
  clearAudioCache: () => Promise<void>
  prefetchQueueOnStartup: () => Promise<void>
}
interface Window {
  electronAPI: ElectronAPI
}