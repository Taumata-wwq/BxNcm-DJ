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
  lastIdleSource: 'netease',
  idleQueueSize: 3, // 默认空闲队列大小
  splitterLeft: 215, // 分隔线左侧宽度
  splitterUpper: 115, // 分隔线顶部高度
  showLyricTranslation: true, // 显示歌词翻译
  splitLyricTranslation: true, // 翻译拆分成多行
  lyricDelay: 100, // 歌词延迟（毫秒）
  lyricFontSize: 16, // 歌词大小
  lyricLineSpacing: 10, // 歌词行间距
  idleLyricText: '没动就是在吃雪糕喵！', // 空闲歌词文本
  liveParentAreaIdx: 0, // 直播父区域索引
  liveSubAreaId: 0, // 直播子区域ID
  showDanmakuTime: false, // 是否显示弹幕时间
  showIdleSongs: true, // 是否显示空闲歌曲
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
}