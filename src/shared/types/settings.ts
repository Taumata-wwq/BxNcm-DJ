export interface AppSettings {
  roomId: number
  userCooldown: number
  songCooldown: number
  maxQueueSize: number
  theme: 'dark' | 'light'
  accentColor: string
  alwaysOnTop: boolean
  resizable: boolean
  volume: number
  neteasePlaylistId: string
  bilibiliFavUrl: string
  lastIdleSource: 'netease' | 'bilibili'
  idleQueueSize: number
  splitterLeft: number
  splitterUpper: number
  showLyricTranslation: boolean
  splitLyricTranslation: boolean
  lyricDelay: number
  lyricFontSize: number
  lyricLineSpacing: number
  idleLyricText: string
  liveParentAreaIdx: number
  liveSubAreaId: number
  showDanmakuTime: boolean
  showIdleSongs: boolean
  // OBS 叠加层
  obsOverlayEnabled: boolean
  obsLyricStyle: ObsLyricStyle
  obsQueueStyle: ObsQueueStyle
  obsSongInfoStyle: ObsSongInfoStyle
}

export interface AuthState {
  bilibili: boolean
  bilibiliUname: string
  bilibiliFace: string
  bilibiliUid: number
  netease: boolean
  neteaseUname: string
  neteaseFace: string
  neteaseUid: number
}

export interface AutoLoginResult {
  hasCredentials: boolean
  authState: AuthState
}

export interface ObsLyricStyle {
  // 歌词文本
  fontSize: number
  fontFamily: string
  fontWeight: string
  fontStyle: string
  textDecoration: string
  fontColor: string
  idleText: string
  idleTextRefreshInterval: number
  // 翻译
  showTranslation: boolean
  translationFontSize: number
  translationFontFamily: string
  translationFontWeight: string
  translationFontStyle: string
  translationTextDecoration: string
  translationColor: string
  splitTranslation: boolean
  // 布局
  textAlign: 'left' | 'center' | 'right'
  lineSpacing: number
  // 背景效果
  bgColor: string
  bgOpacity: number
  shadowColor: string
  shadowSize: number
  shadowOffsetX: number
  shadowOffsetY: number
}

export interface ObsQueueStyle {
  // 文字样式
  fontSize: number
  fontFamily: string
  fontWeight: string
  fontStyle: string
  textDecoration: string
  fontColor: string
  highlightColor: string
  showIndex: boolean
  indexColor: string
  // 点歌人
  showRequester: boolean
  requesterColor: string
  // 布局
  wordWrap: boolean
  textAlign: 'left' | 'center' | 'right'
  verticalAlign: 'top' | 'bottom'
  lineSpacing: number
  maxLines: number
  // 背景效果
  bgColor: string
  bgOpacity: number
  shadowColor: string
  shadowSize: number
  shadowOffsetX: number
  shadowOffsetY: number
}

export interface ObsSongInfoStyle {
  // 标题
  titleFontSize: number
  titleFontFamily: string
  titleFontWeight: string
  titleFontStyle: string
  titleTextDecoration: string
  titleColor: string
  // 作者
  splitArtist: boolean
  artistFontSize: number
  artistFontFamily: string
  artistFontWeight: string
  artistFontStyle: string
  artistTextDecoration: string
  artistColor: string
  // 点歌人
  showRequester: boolean
  requesterFontSize: number
  requesterFontFamily: string
  requesterFontWeight: string
  requesterFontStyle: string
  requesterTextDecoration: string
  requesterColor: string
  // 布局
  textAlign: 'left' | 'center' | 'right'
  lineSpacing: number
  // 背景效果
  bgColor: string
  bgOpacity: number
  shadowColor: string
  shadowSize: number
  shadowOffsetX: number
  shadowOffsetY: number
}