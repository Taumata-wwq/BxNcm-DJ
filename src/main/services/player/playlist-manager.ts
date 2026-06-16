import type { SongItem } from '../../../shared/types/song'
import { store } from '../store'
import { neteaseApi } from '../music/netease-api'
import { bilibiliAuth } from '../music/bilibili-video'

interface IdlePlaylistInfo {
  name: string
  owner: string
  source: 'netease' | 'bilibili'
}

interface RefreshResult {
  info: IdlePlaylistInfo | null
  unchanged: boolean
}

/** 队列最大容量 */
const MAX_QUEUE_SIZE = 50

class PlaylistManager {
  private queue: SongItem[] = []
  private idleList: SongItem[] = []
  private idleQueue: SongItem[] = []    // 队列末尾的 idleQueueSize 首空闲歌曲（仅空闲队列，不含 display）
  private currentIndex = -1
  private isIdle = true
  private requestInsertPos = 0
  private idlePlaylistInfo: IdlePlaylistInfo | null = null
  private hydratingIds = new Set<string>()
  private hydrationPromise: Promise<void> | null = null
  /** Netease 专用：全部 track stub 的池子。idleList 只保留当前水合批次 */
  private stubPool: SongItem[] = []
  /** 已从池子中选取过的 ID（防止同轮重复），全部轮完自动重置 */
  private consumedPoolIds = new Set<string>()
  /** 当前活跃歌单的 ID，耗尽时用于从缓存自动重建 */
  private currentPlaylistId = ''
  onQueueChanged: (() => void) | null = null

  // ==================== 动态属性 ====================

  /** 可配置的空闲队列大小（从 store 读取） */
  private get idleQueueSize(): number { return store.getIdleQueueSize() }
  private get maxQueueSize(): number {
    const raw = store.get('app_maxQueueSize')
    if (raw !== undefined) {
      const v = parseInt(raw, 10)
      if (!isNaN(v) && v > 0) return v
    }
    return MAX_QUEUE_SIZE
  }

  // ==================== 查询方法 ====================

  getQueue(): SongItem[] { return [...this.queue] }
  getCurrentIndex(): number { return this.currentIndex }
  getIdlePlaylistInfo(): IdlePlaylistInfo | null { return this.idlePlaylistInfo }
  getCurrentSong(): SongItem | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      return this.queue[this.currentIndex]
    }
    return null
  }
  getIdleList(): SongItem[] { return [...this.idleList] }
  getIdleQueue(): SongItem[] { return [...this.idleQueue] }
  /** Netease 返回池子总数，Bilibili 返回 idleList 长度 */
  getIdlePoolSize(): number {
    return this.stubPool.length > 0 ? this.stubPool.length : this.idleList.length
  }
  getIdleQueueStartIndex(): number {
    return Math.max(0, this.queue.length - this.idleQueue.length)
  }
  isCurrentlyIdle(): boolean { return this.isIdle }

  // ==================== requestInsertPos ====================

  private recalcRequestInsertPos(): void {
    const idleIdSet = new Set(this.idleQueue.map(s => s.id))
    let lastNonIdleIdx = -1
    for (let i = 0; i < this.queue.length; i++) {
      if (!idleIdSet.has(this.queue[i].id)) {
        lastNonIdleIdx = i
      }
    }
    this.requestInsertPos = lastNonIdleIdx + 1
  }

  // ==================== 队列操作 ====================

  /**
   * 点歌插入。始终插入到 requestInsertPos（所有非空闲歌曲之后），按序号依次排列。
   * 返回: wasIdle（用于判断是否需要触发播放）
   */
  insertTop(song: SongItem): boolean {
    if (this.queue.length >= this.maxQueueSize) return false
    // 去重：禁止队列中出现相同歌曲
    if (this.queue.some(s => s.id === song.id)) return false

    const wasIdle = this.isIdle
    // 始终插入到所有非空闲歌曲之后（requestInsertPos 由 recalcRequestInsertPos 维护）
    let insertPos = this.requestInsertPos
    // 防御：绝不在当前播放歌曲之前插入（避免 currentIndex 指向的歌曲被意外挤到后面）
    if (this.currentIndex >= 0 && insertPos <= this.currentIndex) {
      insertPos = this.currentIndex + 1
    }
    this.queue.splice(insertPos, 0, song)
    store.setCacheItem(song.id, song)

    this.recalcRequestInsertPos()
    return wasIdle
  }

  addToQueue(song: SongItem): boolean {
    if (this.queue.length >= this.maxQueueSize) return false
    // 去重：禁止队列中出现相同歌曲
    if (this.queue.some(s => s.id === song.id)) return false
    const realEnd = this.queue.length - this.idleQueue.length
    this.queue.splice(realEnd, 0, song)
    store.setCacheItem(song.id, song)
    this.recalcRequestInsertPos()
    return true
  }

  removeFromQueue(songId: string) {
    const idx = this.queue.findIndex(s => s.id === songId)
    if (idx < 0) return

    const isIdleSong = this.idleQueue.some(s => s.id === songId)
    const isCurrentSong = idx === this.currentIndex

    if (isIdleSong && !isCurrentSong) {
      // 非当前空闲歌曲：直接从 idleQueue 移除，然后随机补一位
      this.idleQueue = this.idleQueue.filter(s => s.id !== songId)
      this.fillIdleQueue()
    }

    // 记录到缓存，使得该歌曲出现在缓存列表中
    const removed = this.queue[idx]
    if (removed) {
      store.setCacheItem(removed.id, removed)
    }

    this.queue.splice(idx, 1)
    if (idx < this.currentIndex) {
      this.currentIndex--
    } else if (idx === this.currentIndex) {
      this.currentIndex = Math.min(this.currentIndex, this.queue.length - 1)
    }
    this.recalcRequestInsertPos()
  }

  clearQueue() {
    this.queue = []
    this.idleQueue = []
    this.currentIndex = -1
    this.requestInsertPos = 0
    this.isIdle = true
    this.fillInitialIdleQueue()
  }

  play(songId: string): SongItem | null {
    const idx = this.queue.findIndex(s => s.id === songId)
    if (idx < 0) return null

    const song = this.queue[idx]
    const wasIdleSong = this.idleQueue.some(s => s.id === songId)
    this.isIdle = false

    if (wasIdleSong) {
      this.idleQueue = this.idleQueue.filter(s => s.id !== songId)
      this.queue.splice(idx, 1)
      const nonIdleEnd = this.queue.length - this.idleQueue.length
      this.queue.splice(nonIdleEnd, 0, song)
      this.currentIndex = nonIdleEnd
      this.fillIdleQueue()
    } else {
      this.currentIndex = idx
    }

    this.recalcRequestInsertPos()
    store.setCacheItem(song.id, song)
    return song
  }

  // ==================== 播放流转 ====================

  peekNext(n: number = 3): SongItem[] {
    if (this.isIdle) return this.idleQueue.slice(0, n)
    const result: SongItem[] = []
    let idx = this.currentIndex
    while (result.length < n && idx + 1 < this.queue.length) {
      idx++
      const song = this.queue[idx]
      if (song && !result.find(s => s.id === song.id)) result.push(song)
    }
    for (const s of this.idleQueue) {
      if (result.length >= n) break
      if (!result.find(r => r.id === s.id)) result.push(s)
    }
    return result
  }

  /**
   * 核心流转。
   *
   * 新设计关键规则：
   * 1. 移除当前歌曲。
   * 2. 补齐 idleQueue（保持 idleQueueSize）。
   * 3. 若队列为空 → 重建空闲。
   * 4. 获取 queue[currentIndex] 作为下一首。
   * 5. 若下一首在 idleQueue 中 → 从 idleQueue 消费 + 填回。
   *
   * display 提升是隐式的：当最后一个非空闲歌曲被移除后，队列首位自然变为下一个空闲歌曲。
   * 非空闲歌曲存在期间，空闲歌曲原地不动（不会被提前提升到 display 位置）。
   */
  next(): SongItem | null {
    this.removeCurrentSong()
    this.fillIdleQueue()

    if (this.currentIndex < 0 && this.queue.length > 0) {
      this.currentIndex = 0
    }

    if (this.queue.length === 0) {
      return this.enterIdleMode()
    }

    const song = this.queue[this.currentIndex]
    if (!song) return this.enterIdleMode()

    const isIdleSong = this.idleQueue.some(s => s.id === song.id)
    if (isIdleSong) {
      this.idleQueue = this.idleQueue.filter(s => s.id !== song.id)
      this.fillIdleQueue()
      this.isIdle = true
    }

    store.addHistory(song, this.isIdle ? 'idle' : 'request', '', 0)
    store.setCacheItem(song.id, song)
    return song
  }

  private removeCurrentSong(): void {
    if (this.currentIndex < 0 || this.currentIndex >= this.queue.length) return
    const song = this.queue[this.currentIndex]
    const wasIdleSong = this.idleQueue.some(s => s.id === song.id)

    if (wasIdleSong) {
      this.idleQueue = this.idleQueue.filter(s => s.id !== song.id)
      this.isIdle = true
    }

    // 播放完毕从 idleList 移除，迫使 ensureIdlePool 从 stubPool 拉新歌
    // 避免只在小批次（6首）内无限循环
    const ilIdx = this.idleList.findIndex(s => s.id === song.id)
    if (ilIdx >= 0) {
      this.idleList.splice(ilIdx, 1)
    }

    this.queue.splice(this.currentIndex, 1)
    if (this.currentIndex >= this.queue.length) {
      this.currentIndex = this.queue.length - 1
    }
    this.recalcRequestInsertPos()
  }

  /** 为空闲模式重建队列（队列完全为空时调用） */
  private enterIdleMode(): SongItem | null {
    this.isIdle = true

    if (this.idleList.length === 0) {
      // 耗尽后自动从缓存重建，实现无限循环（Bilibili 播完 55 首后自动续播）
      const source = this.idlePlaylistInfo?.source
      if (source && this.currentPlaylistId) {
        const cached = store.getPlaylistCache(source, this.currentPlaylistId)
        if (cached && cached.songIds.length > 0) {
          this.setIdleListFromCache(cached.songIds, {
            name: cached.name, owner: '', source
          }, this.currentPlaylistId)
        }
      }

      // 缓存重建后仍无歌曲 → 兜底收藏夹
      if (this.idleList.length === 0) {
        const favorites = store.getFavorites()
        if (favorites.length > 0) {
          this.idleList = [...favorites]
          this.fillInitialIdleQueue()
        } else {
          return null
        }
      }
    }

    if (this.idleQueue.length === 0) {
      this.fillInitialIdleQueue()
      if (this.idleQueue.length === 0) return null
    }

    // 消费 idleQueue 队首
    const song = this.idleQueue[0]
    if (!song) return null
    this.idleQueue.shift()
    this.fillIdleQueue()
    store.addHistory(song, 'idle', '', 0)
    store.setCacheItem(song.id, song)
    this.currentIndex = this.queue.findIndex(s => s.id === song.id)
    return song
  }

  previous(): SongItem | null {
    if (!this.isIdle && this.queue.length > 0) {
      this.currentIndex--
      if (this.currentIndex < 0) this.currentIndex = this.queue.length - 1
      return this.queue[this.currentIndex]
    }
    return null
  }

  // ==================== 空闲歌单填充 ====================

  /**
   * Netease 池子模式：从 stubPool 中随机取歌到 idleList，后台水合。
   * Bilibili 不使用池子（idleList 已含全部歌曲），此方法直接返回。
   * @param minCount 至少需要的歌曲数
   */
  private ensureIdlePool(minCount: number): void {
    if (this.stubPool.length === 0) return  // Bilibili 模式或无池子

    const usedIds = new Set(this.queue.map(s => s.id))
    const available = this.idleList.filter(s => !usedIds.has(s.id))
    if (available.length >= minCount) return

    const needed = minCount - available.length
    const idleIds = new Set(this.idleList.map(s => s.id))

    // 从池子中筛出未消费且未在 idleList 中的 stub
    let poolAvail = this.stubPool.filter(s =>
      !this.consumedPoolIds.has(s.id) && !idleIds.has(s.id)
    )

    // 池子轮完一圈 → 重置消费记录
    if (poolAvail.length === 0) {
      this.consumedPoolIds.clear()
      poolAvail = this.stubPool.filter(s => !idleIds.has(s.id))
    }

    if (poolAvail.length === 0) return

    const picked = randomPick(poolAvail, Math.min(needed, poolAvail.length))
    picked.forEach(s => this.consumedPoolIds.add(s.id))
    this.idleList.push(...picked)

    // 缓存 stub（含空 title）
    for (const s of picked) store.setCacheItem(s.id, s)

    // 后台水合
    this.hydrateIfNeeded(picked)
  }

  /**
   * 按源类型设置歌曲列表：
   * - Netease → 全部 stub 进池子，idleList 清空（按需水合）
   * - Bilibili → 全部歌曲进 idleList（已含完整信息）
   */
  private setAllSongs(source: 'netease' | 'bilibili', allSongs: SongItem[]): void {
    if (source === 'netease') {
      this.stubPool = allSongs
      this.consumedPoolIds.clear()
      this.idleList = []
    } else {
      this.idleList = allSongs
      this.stubPool = []
    }
  }

  /**
   * 首次填充：从 idleList 中随机选取 1 首 display + idleQueueSize 首空闲队列。
   * display 位于 queue[0]（在 queue 中但不在 idleQueue 中）。
   */
  private fillInitialIdleQueue(): void {
    // 池子模式：先从 stubPool 加载首批歌曲
    this.ensureIdlePool(1 + this.idleQueueSize)

    if (this.idleList.length === 0 || this.queue.length > 0) return

    const total = Math.min(1 + this.idleQueueSize, this.idleList.length)
    // 从 idleList 中随机挑选不重复的歌曲
    const picked = randomPick(this.idleList, total)
    for (const s of picked) store.setCacheItem(s.id, s)

    // 第一首：display
    const display = picked[0]
    if (!display) return
    picked.shift()
    this.queue.push(display)
    this.currentIndex = 0

    // 剩余：idleQueue
    this.queue.push(...picked)
    this.idleQueue = [...picked]

    this.recalcRequestInsertPos()
    this.hydrateIfNeeded([display, ...picked])
  }

  /**
   * 从 idleList 中随机选取不在队列中的歌曲补充到 idleQueue。
   * 始终维持 idleQueue.length === idleQueueSize。
   */
  private fillIdleQueue(): void {
    const needed = this.idleQueueSize - this.idleQueue.length
    if (needed <= 0) return

    // 池子模式：确保 idleList 有足够的未使用歌曲
    this.ensureIdlePool(needed)

    if (this.idleList.length === 0) return

    const usedIds = new Set(this.queue.map(s => s.id))
    const available = this.idleList.filter(s => !usedIds.has(s.id))

    const picked = randomPick(available, Math.min(needed, available.length))
    for (const s of picked) store.setCacheItem(s.id, s)

    this.queue.push(...picked)
    this.idleQueue.push(...picked)
    this.hydrateIfNeeded(picked)
  }

  // ==================== 后台水合 ====================

  private hydrateIfNeeded(songs: SongItem[]): void {
    this.hydrationPromise = this._hydrate(songs)
  }

  private async _hydrate(songs: SongItem[]): Promise<void> {
    // 网易云：批量水合
    const neteaseStubs = songs.filter(s =>
      s.source === 'netease' && !s.title && !this.hydratingIds.has(s.id)
    )
    if (neteaseStubs.length > 0) {
      neteaseStubs.forEach(s => this.hydratingIds.add(s.id))
      try {
        const ids = neteaseStubs.map(s => s.sourceId)
        const hydrated = await neteaseApi.hydrateSongs(ids)
        for (const h of hydrated) this.replaceInQueue(h)
        if (hydrated.length > 0 && this.onQueueChanged) this.onQueueChanged()
      } catch (e) {
        console.error('[PlaylistManager] hydrateIfNeeded 网易云失败:', (e as Error).message)
      } finally {
        neteaseStubs.forEach(s => this.hydratingIds.delete(s.id))
      }
    }

    // B站：逐个水合（无批量 API，限制并发 3 个）
    const biliStubs = songs.filter(s =>
      s.source === 'bilibili' && !s.title && !this.hydratingIds.has(s.id)
    )
    if (biliStubs.length > 0) {
      biliStubs.forEach(s => this.hydratingIds.add(s.id))
      const hydrateOne = async (s: SongItem) => {
        try {
          const info = await bilibiliAuth.getVideoInfo(s.sourceId)
          if (info) {
            s.title = info.title || ''
            s.artist = info.artist || ''
            s.coverUrl = info.coverUrl || ''
            s.duration = info.duration || 0
            s.cid = info.cid || 0
            store.setCacheItem(s.id, s)
            this.replaceInQueue(s)
          }
        } catch (e) {
          console.error(`[PlaylistManager] hydrateIfNeeded B站 ${s.sourceId} 失败:`, (e as Error).message)
        } finally {
          this.hydratingIds.delete(s.id)
        }
      }
      // 并发水合每次最多 3 个
      for (let i = 0; i < biliStubs.length; i += 3) {
        const batch = biliStubs.slice(i, i + 3)
        await Promise.all(batch.map(hydrateOne))
      }
      if (this.onQueueChanged) this.onQueueChanged()
    }
  }

  private replaceInQueue(hydrated: SongItem): void {
    const qIdx = this.queue.findIndex(s => s.id === hydrated.id)
    if (qIdx >= 0) this.queue[qIdx] = hydrated
    const iqIdx = this.idleQueue.findIndex(s => s.id === hydrated.id)
    if (iqIdx >= 0) this.idleQueue[iqIdx] = hydrated
    const ilIdx = this.idleList.findIndex(s => s.id === hydrated.id)
    if (ilIdx >= 0) this.idleList[ilIdx] = hydrated
    store.setCacheItem(hydrated.id, hydrated)
  }

  private savePlaylistCache(source: 'netease' | 'bilibili', id: string, name: string, explicitSongIds?: string[]): void {
    // 优先使用传入的显式 ID（cacheOnly 场景），否则 Netease 用池子，Bilibili 用 idleList
    const allSongIds = explicitSongIds
      ? explicitSongIds
      : source === 'netease' && this.stubPool.length > 0
        ? this.stubPool.map(s => s.id)
        : this.idleList.map(s => s.id)
    store.setPlaylistCache({
      id, source, name,
      songIds: allSongIds,
      timestamp: Date.now()
    })
  }

  /** 随机重建 idleQueue（公开方法，供 IPC handler 在 CD 路径调用） */
  shuffleAndRefreshQueue(): void {
    this.refreshIdleQueue()
  }

  /** 等待当前水合任务完成（切源时用于避免前端看到空标题 stub） */
  async waitHydration(): Promise<void> {
    if (this.hydrationPromise) {
      await this.hydrationPromise
      this.hydrationPromise = null
    }
  }

  // ==================== 歌单刷新（新版：每次 API + 比对缓存） ====================

  /**
   * 按单一源刷新空闲歌单。
   *
   * 策略：
   *   1. 调用 API 获取最新 songIds 列表
   *   2. 与 playlistCache 中的缓存 songIds 比对
   *   3. 相同 → 不做任何改变（unchanged=true）
   *   4. 不同 → 更新缓存 → 移除旧空闲歌 → 重新随机 → 重建 idleList/idleQueue
   *
   * @param source  来源 'netease' | 'bilibili'
   * @param id      歌单/收藏夹 ID
   * @param force   是否强制刷新（跳过冷却）
   */
  async refreshSingleSource(source: 'netease' | 'bilibili', id: string, force = false, cacheOnly = false): Promise<RefreshResult> {
    const allSongs: SongItem[] = []
    let songIds: string[] = []
    let playlistName = ''

    try {
      if (source === 'netease' && id) {
        const [result, info] = await Promise.all([
          neteaseApi.getPlaylistTrackStubs(id),
          neteaseApi.getPlaylistInfo(id).catch(() => null)
        ])
        allSongs.push(...result.stubs)
        songIds = result.stubs.map(s => s.id)
        playlistName = info?.name || `网易云歌单 ${id}`
        if (!cacheOnly) this.idlePlaylistInfo = { name: playlistName, owner: info?.owner || '', source: 'netease' }
      } else if (source === 'bilibili' && id) {
        // 判断是合集/单视频 BV URL/收藏夹
        if (id.startsWith('season:')) {
          const parts = id.split(':')
          const uid = parts[1] || ''
          const sid = parts[2] || ''
          const seasonResult = await bilibiliAuth.getSeasonVideos(uid, sid)
          allSongs.push(...seasonResult.songs)
          songIds = seasonResult.songs.map(s => s.id)
          playlistName = seasonResult.favName || `B站合集 ${sid}`
          if (!cacheOnly) this.idlePlaylistInfo = { name: playlistName, owner: '', source: 'bilibili' }
        } else if (id.startsWith('fav:single_')) {
          const bvid = id.slice('fav:single_'.length)
          const videoList = await bilibiliAuth.getVideoAllPages(bvid)
          if (videoList.length > 0) {
            allSongs.push(...videoList)
            songIds = videoList.map(s => s.id)
            playlistName = videoList[0].title || `B站视频 ${bvid}`
            if (!cacheOnly) this.idlePlaylistInfo = { name: playlistName, owner: videoList[0].artist || '', source: 'bilibili' }
          } else {
            playlistName = `B站视频 ${bvid}`
            if (!cacheOnly) this.idlePlaylistInfo = { name: playlistName, owner: '', source: 'bilibili' }
          }
        } else {
          const fid = id.startsWith('fav:') ? id.slice(4) : id
          const { songs, favName } = await bilibiliAuth.getFavVideos(fid)
          allSongs.push(...songs)
          songIds = songs.map(s => s.id)
          playlistName = favName || `B站收藏夹 ${fid}`
          if (!cacheOnly) this.idlePlaylistInfo = { name: playlistName, owner: '', source: 'bilibili' }
        }
      }
    } catch (e) {
      console.error(`[PlaylistManager] 获取${source}歌单失败:`, (e as Error).message)
      return { info: this.idlePlaylistInfo, unchanged: false }
    }

    // API 调用成功后记录刷新时间（CD 防抖），无论数据是否变化都记录
    if (songIds.length > 0) {
      store.setRefreshTime(source, id)
      // 记录当前歌单 ID，耗尽时用于从缓存自动重建
      if (!cacheOnly) this.currentPlaylistId = id
    }

    // 对比缓存
    const cached = store.getPlaylistCache(source, id)
    const cachedSongIds = cached?.songIds ?? []
    const isSame = cachedSongIds.length > 0 &&
      cachedSongIds.length === songIds.length &&
      JSON.stringify(cachedSongIds.sort()) === JSON.stringify([...songIds].sort())

    if (isSame && !force) {
      // 启动场景特殊处理：队列为空但 API 已拉取到数据，需填充队列
      if (!cacheOnly && this.queue.length === 0) {
        this.setAllSongs(source, allSongs)
      }
      if (!cacheOnly) this.refreshIdleQueue()
      this.savePlaylistCache(source, id, playlistName, cacheOnly ? songIds : undefined)
      return { info: this.idlePlaylistInfo, unchanged: true }
    }

    // 缓存全部歌曲数据，避免切源后再切回时出现空标题 stub
    for (const s of allSongs) store.setCacheItem(s.id, s)

    // 重建空闲列表（cacheOnly 模式仅写缓存，不干扰当前队列）
    if (!cacheOnly) {
      this.setAllSongs(source, allSongs)
      this.refreshIdleQueue()
    } else {
      // cacheOnly 时 Netease 也存池子，切源时可直接用
      if (source === 'netease') {
        this.stubPool = allSongs
        this.consumedPoolIds.clear()
      }
    }
    this.savePlaylistCache(source, id, playlistName, cacheOnly ? songIds : undefined)

    return { info: this.idlePlaylistInfo, unchanged: false }
  }

  /**
   * 清除旧空闲歌曲并从 idleList 重新填充队列。
   * refreshSingleSource / setIdleListFromCache 共用。
   */
  private refreshIdleQueue(): void {
    // 移除旧空闲歌曲（保留非空闲的当前播放歌曲和点歌）
    const oldIdleIds = new Set(this.idleQueue.map(s => s.id))
    let removedBeforeCurrent = 0
    const oldQueue = [...this.queue]
    const newQueue: SongItem[] = []

    for (let i = 0; i < oldQueue.length; i++) {
      const s = oldQueue[i]
      // 保留当前播放的歌
      if (this.currentIndex >= 0 && this.currentIndex < oldQueue.length &&
          s.id === oldQueue[this.currentIndex].id) {
        newQueue.push(s)
        continue
      }
      if (oldIdleIds.has(s.id)) {
        if (i < this.currentIndex) removedBeforeCurrent++
        continue
      }
      newQueue.push(s)
    }
    this.queue = newQueue

    if (removedBeforeCurrent > 0 && this.currentIndex >= 0) {
      this.currentIndex = Math.max(0, this.currentIndex - removedBeforeCurrent)
    }
    if (this.queue.length > 0 && this.currentIndex >= this.queue.length) {
      this.currentIndex = this.queue.length - 1
    }

    this.idleQueue = []

    // 若队列完全为空（启动场景），用 fillInitialIdleQueue（含 display）
    if (this.queue.length === 0) {
      this.fillInitialIdleQueue()
    } else {
      this.recalcRequestInsertPos()
      this.fillIdleQueue()
    }
  }

  /**
   * 从缓存设置 idleList（CD 命中时使用，不重新拉取 API）
   * @param songIds  缓存中的 songIds 列表
   * @param info     歌单信息
   */
  setIdleListFromCache(songIds: string[], info: IdlePlaylistInfo, id = ''): boolean {
    // 混合模式：缓存有完整数据（含 title）则用，没有则创建最小占位 stub
    const songMap = new Map<string, SongItem>()
    for (const sid of songIds) {
      const cached = store.getCacheItem(sid)
      if (cached && cached.title) {
        songMap.set(sid, cached)
      } else {
        // 无缓存或空标题：创建占位 stub，后续水合时自动补全 title/artist 等信息
        songMap.set(sid, {
          id: sid,
          source: info.source,
          sourceId: info.source === 'netease' ? sid.replace('ne_', '') : sid.replace('bv_', ''),
          title: '',
          artist: '',
          album: '',
          coverUrl: '',
          duration: 0,
          playUrl: '',
          requesterName: '',
          requesterUid: 0
        } as SongItem)
      }
    }
    const allStubs = songIds.map(sid => songMap.get(sid)!).filter(Boolean)

    // Netease 走池子模式，Bilibili 直接进 idleList
    this.setAllSongs(info.source, allStubs)

    this.idlePlaylistInfo = info
    if (id) this.currentPlaylistId = id
    this.refreshIdleQueue()
    return allStubs.length > 0
  }
  async refreshIdleList(neteasePlaylistId: string, bilibiliFavId: string): Promise<IdlePlaylistInfo | null> {
    // 改为仅刷新单一源
    const source = store.getLastIdleSource()
    const id = source === 'netease' ? neteasePlaylistId : bilibiliFavId
    const result = await this.refreshSingleSource(source, id, true)
    return result.info
  }
}

export const playlistManager = new PlaylistManager()
export type { IdlePlaylistInfo }

// ── 工具函数 ──
/** 从数组中随机不重复地选取 n 个元素（Fisher-Yates 部分洗牌） */
function randomPick<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  const len = copy.length
  const limit = Math.min(n, len)
  for (let i = 0; i < limit; i++) {
    const j = i + Math.floor(Math.random() * (len - i));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, limit)
}