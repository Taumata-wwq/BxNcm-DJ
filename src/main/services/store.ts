import { app } from 'electron'
import { join, dirname } from 'path'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import type { SongItem } from '../../shared/types/song'

// ---------- 数据模型 ----------

interface PlaylistCacheEntry {
  id: string                    // 歌单/收藏夹ID
  source: 'netease' | 'bilibili'
  name: string                  // 歌单名
  songIds: string[]             // 歌曲ID/BV全列表（用于比对是否变化）
  timestamp: number             // 最后更新时间
}

interface StoreSchema {
  settings: Record<string, string>       // key → value (app_前缀)
  favorites: string[]                    // 已收藏 songId 列表
  history: HistoryEntry[]                // 播放历史
  cache: SongCacheEntry[]                // 歌曲信息缓存
  playlistCache: PlaylistCacheEntry[]    // 歌单/收藏夹缓存（最近各10条）
  lastRefreshTime: Record<string, number> // 歌单刷新冷却: 'netease_id' → timestamp
}

interface BootData {
  theme: 'dark' | 'light'
  accentColor: string
  alwaysOnTop: boolean
  resizable: boolean
  windowPosition: { x: number; y: number; width: number; height: number } | null
}

interface HistoryEntry {
  songId: string; title: string; artist: string
  sourceId?: string; cid?: number; coverUrl?: string; duration?: number
  type: string; source: string; index: number; timestamp: number
}

interface SongCacheEntry {
  songId: string; data: SongItem; timestamp: number
}

const HISTORY_MAX = 200
const CACHE_MAX = 50
const PLAYLIST_CACHE_MAX = 10  // 每组（网易云/B站）各10条
const REFRESH_COOLDOWN = 60_000  // 歌单刷新冷却 60s
const REFRESH_TTL = 600_000    // lastRefreshTime 条目自动清理 TTL
const SAVE_DEBOUNCE = 500

/** 尝试解析 JSON 字符串值，失败返回 null */
function parseJsonStr(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'string' ? parsed : null
  } catch { return null }
}

class AppStore {
  private data: StoreSchema = { settings: {}, favorites: [], history: [], cache: [], playlistCache: [], lastRefreshTime: {} }
  private filePath: string
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private dirty = false

  constructor() {
    // 使用 Electron 标准 userData 目录，更新安装时数据不会丢失
    this.filePath = join(app.getPath('userData'), 'app-data.json')
    // 延迟加载：在 app.whenReady() 之后由外部调用 load()
  }

  /** 在 app.whenReady() 之后调用，确保 getPath 可用 */
  init() {
    this.load()
  }

  // ==================== 文件 I/O ====================

  private load() {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8')
        const parsed = JSON.parse(raw)
        this.data.settings = parsed.settings ?? {}
        this.data.favorites = parsed.favorites ?? []
        this.data.history = parsed.history ?? []
        this.data.cache = parsed.cache ?? []
        this.data.playlistCache = parsed.playlistCache ?? []
        this.data.lastRefreshTime = parsed.lastRefreshTime ?? {}
        this.cleanupRefreshTime()
      }
    } catch (e) {
      console.error('[Store] 加载失败，使用空数据:', (e as Error).message)
      this.data = { settings: {}, favorites: [], history: [], cache: [], playlistCache: [], lastRefreshTime: {} }
    }
  }

  private saveNow() {
    try {
      const dir = dirname(this.filePath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
      this.dirty = false
    } catch (e) {
      console.error('[Store] 保存失败:', (e as Error).message)
    }
  }

  /** 延迟保存（合并短时间内的多次写入） */
  saveSoon() {
    if (!this.dirty) return
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.saveNow(), SAVE_DEBOUNCE)
  }

  /** 立即保存（退出前调用） */
  flush() {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null }
    if (this.dirty) this.saveNow()
  }

  markDirty() {
    this.dirty = true
    this.saveSoon()
  }

  // ==================== 通用键值操作 ====================

  get(key: string): string | undefined {
    return this.data.settings[key]
  }

  set(key: string, value: string): void {
    this.data.settings[key] = value
    this.markDirty()
  }

  delete(key: string): void {
    delete this.data.settings[key]
    this.markDirty()
  }

  getAll(): Record<string, string> {
    return { ...this.data.settings }
  }

  setBatch(entries: Array<[string, string]>): void {
    for (const [k, v] of entries) this.data.settings[k] = v
    this.markDirty()
  }

  // ==================== 收藏操作 ====================

  getFavorites(): SongItem[] {
    return this.data.favorites
      .map(id => this.data.cache.find(e => e.songId === id))
      .filter((e): e is SongCacheEntry => !!e)
      .map(e => e.data)
  }

  addFavorite(songId: string): void {
    if (!this.data.favorites.includes(songId)) {
      this.data.favorites.push(songId)
      this.markDirty()
    }
  }

  removeFavorite(songId: string): void {
    this.data.favorites = this.data.favorites.filter(id => id !== songId)
    this.markDirty()
  }

  // ==================== 历史记录 ====================

  getHistory(limit = 20): HistoryEntry[] {
    return this.data.history.slice(-limit).reverse()
  }

  addHistory(song: SongItem, type: string, source: string, index: number): void {
    // 跳过无效标题
    if (!song.title) return
    // 去重：移除同一 songId 的旧条目
    this.data.history = this.data.history.filter(e => e.songId !== song.id)
    // 添加到末尾（最后方 = 最近播放）
    this.data.history.push({
      songId: song.id, title: song.title, artist: song.artist,
      sourceId: song.sourceId, cid: song.cid, coverUrl: song.coverUrl, duration: song.duration,
      type, source, index, timestamp: Date.now()
    })
    // 超出上限时移除最旧的（最前面的）
    if (this.data.history.length > HISTORY_MAX) {
      this.data.history = this.data.history.slice(-HISTORY_MAX)
    }
    this.markDirty()
  }

  // ==================== 缓存操作 ====================

  getCacheItem(songId: string): SongItem | null {
    const entry = this.data.cache.find(e => e.songId === songId)
    return entry ? entry.data : null
  }

  setCacheItem(songId: string, song: SongItem): void {
    const idx = this.data.cache.findIndex(e => e.songId === songId)
    if (idx >= 0) this.data.cache.splice(idx, 1)
    this.data.cache.push({ songId, data: song, timestamp: Date.now() })
    if (this.data.cache.length > CACHE_MAX) this.data.cache.splice(0, this.data.cache.length - CACHE_MAX)
    this.markDirty()
  }

  setCacheBatch(songs: SongItem[]): void {
    for (const s of songs) {
      const idx = this.data.cache.findIndex(e => e.songId === s.id)
      if (idx >= 0) this.data.cache.splice(idx, 1)
      this.data.cache.push({ songId: s.id, data: s, timestamp: Date.now() })
    }
    if (this.data.cache.length > CACHE_MAX) this.data.cache.splice(0, this.data.cache.length - CACHE_MAX)
    this.markDirty()
  }

  getCacheForSongs(songIds: string[]): SongItem[] {
    const idSet = new Set(songIds)
    return this.data.cache.filter(e => idSet.has(e.songId)).map(e => e.data)
  }

  /** 清空所有本地缓存：歌曲缓存 + 播放历史 + 歌单缓存 + 刷新冷却 */
  clearCache(): void {
    this.data.cache = []
    this.data.history = []
    this.data.playlistCache = []
    this.data.lastRefreshTime = {}
    this.markDirty()
    this.flush()
  }

  // ==================== 歌单缓存（需求4） ====================

  /** 获取指定 source+id 的缓存歌单条目 */
  getPlaylistCache(source: 'netease' | 'bilibili', id: string): PlaylistCacheEntry | null {
    return this.data.playlistCache.find(e => e.source === source && e.id === id) ?? null
  }

  /** 写入/更新歌单缓存，自动 LRU 淘汰（每组最多 10 条） */
  setPlaylistCache(entry: PlaylistCacheEntry): void {
    const idx = this.data.playlistCache.findIndex(
      e => e.source === entry.source && e.id === entry.id
    )
    if (idx >= 0) this.data.playlistCache.splice(idx, 1)
    this.data.playlistCache.push({ ...entry, timestamp: Date.now() })

    // LRU 淘汰：该 source 超过 10 条时删除最旧的
    const sameSource = this.data.playlistCache.filter(e => e.source === entry.source)
    if (sameSource.length > PLAYLIST_CACHE_MAX) {
      sameSource.sort((a, b) => a.timestamp - b.timestamp)
      const toRemove = sameSource.slice(0, sameSource.length - PLAYLIST_CACHE_MAX)
      for (const e of toRemove) {
        const i = this.data.playlistCache.indexOf(e)
        if (i >= 0) this.data.playlistCache.splice(i, 1)
      }
    }
    this.markDirty()
  }

  /** 检查歌单刷新是否在冷却中（60s 内已刷新过则返回 true） */
  isRefreshCooling(source: 'netease' | 'bilibili', id: string): boolean {
    const key = `${source}_${id}`
    const last = this.data.lastRefreshTime[key]
    if (!last) return false
    return Date.now() - last < REFRESH_COOLDOWN
  }

  /** 记录歌单刷新时间 */
  setRefreshTime(source: 'netease' | 'bilibili', id: string): void {
    this.data.lastRefreshTime[`${source}_${id}`] = Date.now()
    this.markDirty()
  }

  /** 清除过期的刷新冷却记录 */
  private cleanupRefreshTime(): void {
    const now = Date.now()
    for (const key of Object.keys(this.data.lastRefreshTime)) {
      if (now - this.data.lastRefreshTime[key] > REFRESH_TTL) {
        delete this.data.lastRefreshTime[key]
      }
    }
  }

  /** 获取上次使用的空闲来源 */
  getLastIdleSource(): 'netease' | 'bilibili' {
    const v = this.data.settings['lastIdleSource']
    if (v === 'bilibili') return 'bilibili'
    return 'netease'
  }

  /** 设置上次使用的空闲来源 */
  setLastIdleSource(source: 'netease' | 'bilibili'): void {
    this.data.settings['lastIdleSource'] = source
    this.markDirty()
  }

  /** 设置 idleQueueSize */
  setIdleQueueSize(size: number): void {
    this.data.settings['idleQueueSize'] = String(Math.max(2, Math.min(5, size)))
    this.markDirty()
  }

  /** 获取 idleQueueSize */
  getIdleQueueSize(): number {
    const v = parseInt(this.data.settings['idleQueueSize'] || '3', 10)
    return Math.max(2, Math.min(5, isNaN(v) ? 3 : v))
  }

  /** 获取上次保存的直播分区选择 */
  getLiveArea(): { parentAreaIdx: number; subAreaId: number } | null {
    const p = this.data.settings['liveParentAreaIdx']
    const s = this.data.settings['liveSubAreaId']
    if (p !== undefined && s !== undefined) {
      const parentAreaIdx = parseInt(p, 10)
      const subAreaId = parseInt(s, 10)
      if (!isNaN(parentAreaIdx) && !isNaN(subAreaId)) {
        return { parentAreaIdx, subAreaId }
      }
    }
    return null
  }

  /** 保存直播分区选择（立即落盘，不依赖防抖） */
  setLiveArea(parentAreaIdx: number, subAreaId: number): void {
    this.data.settings['liveParentAreaIdx'] = String(parentAreaIdx)
    this.data.settings['liveSubAreaId'] = String(subAreaId)
    this.dirty = true
    this.saveNow()
  }

  // ==================== 分区读取（三阶段加载） ====================

  /** 第1部分：启动数据 — 主题色、窗口信息（加载界面启用时最先读取） */
  loadBootData(): BootData {
    const rawTheme = this.data.settings['app_theme']
    const rawAccent = this.data.settings['app_accentColor']
    const rawOnTop = this.data.settings['app_alwaysOnTop']
    const rawResizable = this.data.settings['app_resizable']
    const rawPos = this.data.settings['window_position']
    let windowPosition: BootData['windowPosition'] = null
    if (rawPos) {
      try { windowPosition = JSON.parse(rawPos) } catch { /* ignore */ }
    }
    return {
      theme: (rawTheme === '"light"' || rawTheme === 'light') ? 'light' : 'dark',
      accentColor: parseJsonStr(rawAccent) || '#00b5e5',
      alwaysOnTop: rawOnTop === 'true' || rawOnTop === '"true"',
      resizable: rawResizable !== 'false' && rawResizable !== '"false"',
      windowPosition,
    }
  }

  /** 第2部分：应用数据 — 除 boot/style 外的软件本体设置 */
  loadAppData(): Record<string, string> {
    const bootKeys = new Set(['app_theme', 'app_accentColor', 'app_alwaysOnTop', 'app_resizable', 'window_position'])
    const result: Record<string, string> = {}
    for (const [k, v] of Object.entries(this.data.settings)) {
      if (!bootKeys.has(k) && !k.startsWith('obs_')) {
        result[k] = v
      }
    }
    return result
  }

  /** 获取 style 设置窗口的保存位置/大小 */
  getStyleWindowBounds(): { x: number; y: number; width: number; height: number } | null {
    const raw = this.data.settings['style_window_bounds']
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number' &&
          typeof parsed.width === 'number' && typeof parsed.height === 'number') {
        return parsed
      }
    } catch { /* ignore */ }
    return null
  }

  /** 保存 style 设置窗口的位置/大小 */
  setStyleWindowBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.data.settings['style_window_bounds'] = JSON.stringify(bounds)
    this.markDirty()
  }

  /** 获取弹幕窗口的保存位置/大小 */
  getDanmakuWindowBounds(): { x: number; y: number; width: number; height: number } | null {
    const raw = this.data.settings['danmaku_window_bounds']
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number' &&
          typeof parsed.width === 'number' && typeof parsed.height === 'number') {
        return parsed
      }
    } catch { /* ignore */ }
    return null
  }

  /** 保存弹幕窗口的位置/大小 */
  setDanmakuWindowBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.data.settings['danmaku_window_bounds'] = JSON.stringify(bounds)
    this.markDirty()
  }

  // ==================== 数据重置 ====================

  /** 重置所有数据为默认值，仅保留登录状态（cookie + 用户信息） */
  resetAllData(): void {
    // 保存登录相关键
    const loginKeys = [
      'bilibili_cookie', 'bilibili_uname', 'bilibili_face', 'bilibili_uid',
      'netease_cookie', 'netease_uname', 'netease_face', 'netease_uid'
    ]
    const preserved: Record<string, string> = {}
    for (const key of loginKeys) {
      const val = this.data.settings[key]
      if (val !== undefined) preserved[key] = val
    }

    // 清空所有数据
    this.data.settings = {}
    this.data.favorites = []
    this.data.history = []
    this.data.cache = []
    this.data.playlistCache = []
    this.data.lastRefreshTime = {}

    // 恢复登录相关键
    for (const [key, val] of Object.entries(preserved)) {
      this.data.settings[key] = val
    }

    this.markDirty()
    this.flush()
  }
}

// 单例
export const store = new AppStore()