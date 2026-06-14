export interface DanmakuStatus {
  connected: boolean
  roomId: number
}

export interface ParsedSongRequest {
  type: 'netease' | 'bilibili'
  keyword: string
  artist?: string
}

export interface DanmakuMessage {
  type: 'danmaku' | 'gift' | 'combo_gift' | 'interact' | 'guard' | 'super_chat' | 'like' | 'entry_effect'
  uid: number
  uname: string
  text?: string
  avatarUrl?: string
  emoticonUrl?: string
  medal?: { name: string; level: number }
  gift_name?: string
  gift_icon_url?: string
  num?: number
  combo_num?: number
  total_num?: number
  guard_level?: number
  guard_name?: string
  price?: number
  timestamp?: number
  /** 用户特权类型：0=无, 1=舰长, 2=提督, 3=总督 */
  privilege_type?: number
  /** 连续重复次数（渲染层折叠用，1=不重复） */
  repeat?: number
}

/** 在线观众 */
export interface ViewerInfo {
  uid: number
  uname: string
  avatarUrl?: string
  timestamp: number
}

/** 表情包分组 */
export interface EmoticonPackage {
  pkg_id: number
  pkg_name: string
  pkg_type: number
  /** 表情包封面图 URL */
  pkg_url?: string
  /** 表情包最后修改时间（用于缓存变更检测） */
  pkg_mtime?: number
  emoticons: EmoticonItem[]
}

/** 单个表情 */
export interface EmoticonItem {
  emoticon_id: number
  emoticon_unique: string
  emoji: string
  descript: string
  url: string
  width: number
  height: number
  is_dynamic: number
  perm: number
  /** meta.size: 1=小表情, 2=大表情 */
  emote_size?: number
}