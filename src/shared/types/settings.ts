export interface AppSettings {
  roomId: number
  userCooldown: number
  songCooldown: number
  maxQueueSize: number
  theme: 'dark' | 'light'
  accentColor: string
  alwaysOnTop: boolean
  resizable: boolean
  danmakuWindow: boolean
  danmakuWindowFixed: boolean
  danmakuWindowShowBorder: boolean
  danmakuWindowFixShortcut: string
  danmakuWindowBgColor: string
  danmakuWindowOpacity: number
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
  // 弹幕显示控制
  showDanmaku: boolean // 是否显示弹幕
  showPaidMessages: boolean // 是否显示付费弹幕
  showGiftName: boolean // 是否显示礼物名称
  mergeSimilarDanmaku: boolean // 是否合并相似弹幕类型
  mergeSimilarGift: boolean // 是否合并相似礼物弹幕
  minPaidMessagePrice: number // 最小付费弹幕价格
  maxDanmakuCount: number // 最大弹幕数量
  // 弹幕屏蔽
  blockGiftDanmaku: boolean // 是否屏蔽礼物弹幕
  blockMirrorMessages: boolean // 是否屏蔽镜像消息（对齐 blivechat-dev）
  blockKeywords: string // 关键词屏蔽列表
  blockUsers: string // 用户屏蔽列表
  blockLevel: number // 等级屏蔽列表
  blockMedalLevel: number // 勋章等级屏蔽列表
  blockNewbie: boolean // 是否屏蔽新用户（对齐 blivechat-dev）
  blockNotMobileVerified: boolean // 是否屏蔽未绑定手机用户（对齐 blivechat-dev）
  // 弹幕样式（StyleGenerator 配置）
  danmakuStyle: DanmakuStyleConfig
  customDanmakuCss: string
  // 弹幕调试
  showDebugMessages: boolean
  // OBS 叠加层
  obsOverlayEnabled: boolean
  obsLyricStyle: ObsLyricStyle
  obsQueueStyle: ObsQueueStyle
  obsSongInfoStyle: ObsSongInfoStyle
  // blivechat
  identityCode: string
  blivechatLang: string
  // 窗口行为
  closeToTray: boolean // 关闭时收起到托盘
  // 自动更新
  autoUpdate: boolean // 是否启用自动更新
}

/** 弹幕样式配置（对齐 blivechat-dev StyleGenerator Legacy DEFAULT_CONFIG） */
export interface DanmakuStyleConfig {
  globalScale: number
  fontScale: number
  showAvatars: boolean
  avatarSize: number
  showUserNames: boolean
  userNameFontSize: number
  userNameWeight: number
  userNameColor: string
  ownerUserNameColor: string
  moderatorUserNameColor: string
  memberUserNameColor: string
  showBadges: boolean
  showColon: boolean
  // 字体族（对齐 blivechat-dev common.js fontsStrToCss）
  userNameFont: string
  messageFont: string
  timeFont: string
  firstLineFont: string
  secondLineFont: string
  scContentFont: string
  messageFontSize: number
  messageWeight: number
  messageColor: string
  messageOnNewLine: boolean
  messageReverseScroll: boolean
  emoticonSize: number
  largeEmoticonSize: number
  showOutlines: boolean
  outlineSize: number
  outlineColor: string
  blurryOutline: boolean
  showTime: boolean
  timeColor: string
  timeFontSize: number
  timeWeight: number
  bgColor: string
  messageBgColor: string
  ownerMessageBgColor: string
  moderatorMessageBgColor: string
  memberMessageBgColor: string
  showScTicker: boolean
  showOtherThings: boolean
  firstLineFontSize: number
  firstLineWeight: number
  firstLineColor: string
  secondLineFontSize: number
  secondLineWeight: number
  secondLineColor: string
  scContentFontSize: number
  scContentWeight: number
  scContentColor: string
  animateIn: boolean
  fadeInTime: number
  animateOut: boolean
  animateOutWaitTime: number
  fadeOutTime: number
  slide: boolean
  reverseSlide: boolean
  useBarsInsteadOfBg: boolean
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