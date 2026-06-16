import type { AppSettings } from '../../shared/types/settings'

export const DEFAULT_SETTINGS: AppSettings = {
  roomId: 114514, // 房间ID 
  userCooldown: 3, // 用户冷却时间（秒）
  maxQueueSize: 25, // 最大队列
  songCooldown: 799, // 点歌冷却时间（秒）
  theme: 'dark', // 明暗主题
  accentColor: '#00b5e5', // 主题色
  alwaysOnTop: false, // 是否总在顶部
  resizable: true,// 是否可调整大小
  volume: 40, // 默认音量
  neteasePlaylistId: '8512248857', // 默认wyy歌单
  bilibiliFavUrl: 'https://space.bilibili.com/62898492/lists/4641985?type=season', // 默认合集
  lastIdleSource: 'netease', // 上次空闲来源
  idleQueueSize: 3, // 默认空闲队列大小
  splitterLeft: 215, // 分隔线左侧宽度
  splitterUpper: 115, // 分隔线顶部高度
  // 歌词
  showLyricTranslation: true, // 显示歌词翻译
  splitLyricTranslation: true, // 翻译拆分成多行
  lyricDelay: 100, // 歌词延迟（毫秒）
  lyricFontSize: 16, // 歌词大小
  lyricLineSpacing: 10, // 歌词行间距
  idleLyricText: '没动就是在吃雪糕喵！', // 空闲歌词文本
  liveParentAreaIdx: 0, // 直播父区域索引
  liveSubAreaId: 0, // 直播子区域ID
  // 弹幕
  showDanmakuTime: false, // 是否显示弹幕时间
  showIdleSongs: true, // 是否显示空闲歌曲
  showDanmaku: true, // 显示弹幕
  showPaidMessages: true, // 显示付费消息
  showGiftName: true, // 显示礼物名
  mergeSimilarDanmaku: true, // 合并相似弹幕
  mergeSimilarGift: true, // 合并礼物
  minPaidMessagePrice: 0.1, // 最低显示付费消息价格（元）（对齐 blivechat-dev minGiftPrice: 0.1）
  maxDanmakuCount: 200, // 最多显示消息数
  // 弹幕屏蔽
  blockGiftDanmaku: false, // 是否屏蔽礼物弹幕
  blockMirrorMessages: false, // 是否屏蔽镜像消息（对齐 blivechat-dev）
  blockKeywords: '', // 屏蔽关键词
  blockUsers: '', // 屏蔽用户
  blockLevel: 0, // 屏蔽等级
  blockMedalLevel: 0, // 屏蔽勋章等级
  blockNewbie: false, // 是否屏蔽新用户（对齐 blivechat-dev）
  blockNotMobileVerified: false, // 是否屏蔽未绑定手机用户（对齐 blivechat-dev）
  // 弹幕样式
  danmakuStyle: {
    globalScale: 0.7, // 全局缩放比例
    fontScale: 1, // 字体缩放比例
    showAvatars: true, // 是否显示头像
    avatarSize: 24, // 头像大小
    showUserNames: true, // 是否显示用户名
    userNameFontSize: 20, // 用户名字体大小
    userNameWeight: 700, // 用户名字体粗细
    userNameColor: '#cccccc', // 用户名字体颜色
    ownerUserNameColor: '#ffd600', // 主播用户名字体颜色
    moderatorUserNameColor: '#5e84f1', // 管理员用户名字体颜色
    memberUserNameColor: '#0f9d58', // 普通用户名字体颜色
    showBadges: true, // 是否显示勋章
    showColon: true, // 是否显示冒号
    // 字体族（对齐 blivechat-dev common.js fontsStrToCss，空字符串表示使用默认字体）
    userNameFont: '', // 用户名字体
    messageFont: '', // 消息字体
    timeFont: '', // 时间字体
    firstLineFont: '', // 付费消息第一行字体
    secondLineFont: '', // 付费消息第二行字体
    scContentFont: '', // SC内容字体
    messageFontSize: 20, // 消息字体大小
    messageWeight: 700, // 消息字体粗细
    messageColor: '#ffffff',
    messageOnNewLine: false, // 是否在新行显示
    messageReverseScroll: false, // 是否反向滚动
    emoticonSize: 24, // 表情大小
    largeEmoticonSize: 40, // 大表情大小
    showOutlines: true, // 是否显示轮廓
    outlineSize: 2, // 轮廓大小
    outlineColor: '#000000',
    blurryOutline: false, // 是否显示模糊轮廓
    showTime: false, // 是否显示时间
    timeColor: '#999999', // 时间颜色（对齐 blivechat-dev）
    timeFontSize: 20, // 时间字体大小
    timeWeight: 400, // 时间字体粗细
    bgColor: 'rgba(0, 0, 0, 0)', // 背景颜色
    messageBgColor: 'rgba(204, 204, 204, 0)', // 消息背景颜色
    ownerMessageBgColor: 'rgba(255, 214, 0, 0)', // 主播消息背景颜色
    moderatorMessageBgColor: 'rgba(94, 132, 241, 0)', // 管理员消息背景颜色
    memberMessageBgColor: 'rgba(15, 157, 88, 0)', // 普通用户消息背景颜色
    showScTicker: false, // 是否显示滚动条
    showOtherThings: true, // 是否显示其他内容
    firstLineFontSize: 22, // 第一行字体大小
    firstLineWeight: 700, // 第一行字体粗细
    firstLineColor: '#ffffff',
    secondLineFontSize: 20, // 第二行字体大小
    secondLineWeight: 700, // 第二行字体粗细
    secondLineColor: '#ffffff',
    scContentFontSize: 20, // 滚动条字体大小
    scContentWeight: 700, // 滚动条字体粗细
    scContentColor: '#ffffff',
    animateIn: false, // 是否显示入场动画
    fadeInTime: 200, // 入场动画时间（毫秒）
    animateOut: false, // 是否显示出场动画
    animateOutWaitTime: 30, // 出场动画等待时间（毫秒）
    fadeOutTime: 200, // 出场动画时间（毫秒）
    slide: false, // 是否显示滑动动画
    reverseSlide: false, // 是否反向滑动
    useBarsInsteadOfBg: false, // 用装饰条而非背景色（对齐 bilibili-tool）
  } as import('../../shared/types/settings').DanmakuStyleConfig,
  customDanmakuCss: '', // 自定义弹幕样式（可在 https://blive.chat/stylegen 的经典样式生成 CSS 复制过来）
   showDebugMessages: false, // 是否显示调试消息
  obsOverlayEnabled: true, // 是否启用obs覆盖层
  obsLyricStyle: {
    // 歌词文本
    fontSize: 32,
    fontFamily: '',
    fontWeight: 'bold',
    fontStyle: 'normal',
    textDecoration: 'none',
    fontColor: '#ffffff',
    idleText: '没动就是在吃雪糕喵！',
    idleTextRefreshInterval: 5,
    // 翻译
    showTranslation: true,
    translationFontSize: 24,
    translationFontFamily: '',
    translationFontWeight: 'normal',
    translationFontStyle: 'normal',
    translationTextDecoration: 'none',
    translationColor: '#ffffff',
    splitTranslation: true,
    // 布局
    textAlign: 'center' as const,
    lineSpacing: 4,
    // 背景效果
    bgColor: '#000000',
    bgOpacity: 0,
    shadowColor: '#000000',
    shadowSize: 3,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  },
  obsQueueStyle: {
    // 文字样式
    fontSize: 20,
    fontFamily: '',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    fontColor: '#ffffff',
    highlightColor: '#00b5e5',
    showIndex: true,
    indexColor: '#ffffff',
    // 点歌人
    showRequester: true,
    requesterColor: '#00b5e5',
    // 布局
    wordWrap: false,
    textAlign: 'left' as const,
    verticalAlign: 'top' as const,
    lineSpacing: 4,
    maxLines: 10,
    // 背景效果
    bgColor: '#000000',
    bgOpacity: 0,
    shadowColor: '#000000',
    shadowSize: 3,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  },
  obsSongInfoStyle: {
    // 标题
    titleFontSize: 32,
    titleFontFamily: '',
    titleFontWeight: 'bold',
    titleFontStyle: 'normal',
    titleTextDecoration: 'none',
    titleColor: '#ffffff',
    // 作者
    splitArtist: true,
    artistFontSize: 32,
    artistFontFamily: '',
    artistFontWeight: 'normal',
    artistFontStyle: 'normal',
    artistTextDecoration: 'none',
    artistColor: '#ffffff',
    // 点歌人
    showRequester: false,
    requesterFontSize: 24,
    requesterFontFamily: '',
    requesterFontWeight: 'normal',
    requesterFontStyle: 'normal',
    requesterTextDecoration: 'none',
    requesterColor: '#00b5e5',
    // 布局
    textAlign: 'center' as const,
    lineSpacing: 4,
    // 背景效果
    bgColor: '#000000',
    bgOpacity: 0,
    shadowColor: '#000000',
    shadowSize: 3,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  },
  // blivechat
  identityCode: '',
  blivechatLang: 'zh',
}