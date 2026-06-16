import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, unlinkSync, statSync, writeFileSync, readFileSync } from 'fs'
import { createWriteStream } from 'fs'
import { get as httpsGet } from 'https'
import { get as httpGet } from 'http'
import type { IncomingMessage } from 'http'
import type { SongItem } from '../../../shared/types/song'

const MAX_CACHE_SIZE = 20
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

interface CacheEntry {
  songId: string
  title: string
  artist: string
  filePath: string
  coverPath: string
  size: number
  timestamp: number
}

class AudioCacheManager {
  private cacheDir: string
  private indexFile: string
  private index = new Map<string, CacheEntry>()

  constructor() {
    const dataDir = app.isPackaged ? dirname(app.getPath('exe')) : app.getPath('userData')
    this.cacheDir = join(dataDir, 'audio-cache')
    this.indexFile = join(this.cacheDir, 'index.json')
    this.init()
  }

  private init() {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true })
    }
    this.loadIndex()
  }

  private loadIndex() {
    try {
      if (existsSync(this.indexFile)) {
        const raw = readFileSync(this.indexFile, 'utf-8')
        const entries: CacheEntry[] = JSON.parse(raw)
        for (const e of entries) {
          if (existsSync(e.filePath)) {
            this.index.set(e.songId, e)
          }
        }
      }
    } catch (e) {
      console.error('[AudioCache] 加载索引失败:', (e as Error).message)
    }
  }

  private saveIndex() {
    try {
      const entries = Array.from(this.index.values())
      writeFileSync(this.indexFile, JSON.stringify(entries, null, 2), 'utf-8')
    } catch (e) {
      console.error('[AudioCache] 保存索引失败:', (e as Error).message)
    }
  }

  /** 将路径转为 file:// URL */
  private toFileUrl(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/')
    return `file:///${normalized}`
  }

  /** 检查是否已有本地缓存 */
  has(songId: string): boolean {
    const entry = this.index.get(songId)
    if (!entry) return false
    if (!existsSync(entry.filePath)) {
      this.index.delete(songId)
      return false
    }
    return true
  }

  /** 获取本地缓存音频文件的 file:// URL，同时更新 LRU 时间戳 */
  getFileUrl(songId: string): string | null {
    const entry = this.index.get(songId)
    if (!entry || !existsSync(entry.filePath)) return null
    entry.timestamp = Date.now()
    return this.toFileUrl(entry.filePath)
  }

  /** 获取本地缓存封面的 file:// URL */
  getCoverUrl(songId: string): string | null {
    const entry = this.index.get(songId)
    if (!entry || !entry.coverPath || !existsSync(entry.coverPath)) return null
    return this.toFileUrl(entry.coverPath)
  }

  /** 下载歌曲音频 + 封面到本地缓存 */
  async download(song: SongItem): Promise<string | null> {
    const songId = song.id
    const url = song.playUrl
    if (!url) return null

    // 已缓存且文件存在
    if (this.has(songId)) {
      return this.getFileUrl(songId)
    }

    // LRU 淘汰：超限时删除最旧文件（不进回收站）
    while (this.index.size >= MAX_CACHE_SIZE) {
      this.evictOldest()
    }

    const ext = this.detectExt(song, url)
    const filePath = join(this.cacheDir, `${songId}${ext}`)

    try {
      await this.downloadFile(url, filePath)

      const stat = statSync(filePath)
      if (stat.size === 0) {
        try { unlinkSync(filePath) } catch {}
        return null
      }

      // 下载封面
      let coverPath = ''
      if (song.coverUrl) {
        try {
          coverPath = await this.downloadCover(songId, song.coverUrl)
        } catch (e) {
          console.warn(`[AudioCache] 封面下载失败 ${song.title}:`, (e as Error).message)
        }
      }

      const entry: CacheEntry = {
        songId,
        title: song.title || '',
        artist: song.artist || '',
        filePath,
        coverPath,
        size: stat.size,
        timestamp: Date.now()
      }
      this.index.set(songId, entry)
      this.saveIndex()
      console.log(`[AudioCache] 缓存完成: ${song.title} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`)
      return this.getFileUrl(songId)
    } catch (e) {
      console.error(`[AudioCache] 下载失败 ${song.title}:`, (e as Error).message)
      try { if (existsSync(filePath)) unlinkSync(filePath) } catch {}
      return null
    }
  }

  /** 下载封面图片到本地 */
  private async downloadCover(songId: string, coverUrl: string): Promise<string> {
    const coverPath = join(this.cacheDir, `${songId}_cover.jpg`)

    // data URL（B站封面已转为 base64）
    if (coverUrl.startsWith('data:image/')) {
      const base64 = coverUrl.split(',')[1]
      if (base64) {
        writeFileSync(coverPath, Buffer.from(base64, 'base64'))
        return coverPath
      }
      return ''
    }

    // 远程 URL
    await this.downloadFile(coverUrl, coverPath)
    const stat = statSync(coverPath)
    if (stat.size === 0) {
      try { unlinkSync(coverPath) } catch {}
      return ''
    }
    return coverPath
  }

  /** 推断文件扩展名 */
  private detectExt(song: SongItem, url: string): string {
    if (song.source === 'bilibili') return '.mp4'
    const m = url.match(/\.(mp3|flac|aac|wav|ogg|m4a)($|\?)/i)
    if (m) return '.' + m[1].toLowerCase()
    return '.mp3'
  }

  /** 流式下载文件，处理重定向 */
  private downloadFile(url: string, dest: string, redirects = 0): Promise<void> {
    return new Promise((resolve, reject) => {
      const MAX_REDIRECTS = 5
      const proto = url.startsWith('https:') ? httpsGet : httpGet

      const req = proto(url, {
        headers: { 'User-Agent': UA }
      }, (res: IncomingMessage) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirects >= MAX_REDIRECTS) {
            reject(new Error('重定向次数过多'))
            return
          }
          res.resume()
          this.downloadFile(res.headers.location, dest, redirects + 1)
            .then(resolve).catch(reject)
          return
        }

        if (res.statusCode !== 200) {
          res.resume()
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }

        const file = createWriteStream(dest)
        let settled = false
        res.pipe(file)
        file.on('finish', () => { file.close(); if (!settled) { settled = true; resolve() } })
        file.on('error', (err) => { file.close(); try { unlinkSync(dest) } catch {}; if (!settled) { settled = true; reject(err) } })
        res.on('error', (err) => { file.close(); try { unlinkSync(dest) } catch {}; if (!settled) { settled = true; reject(err) } })
      })

      req.on('error', reject)
      req.setTimeout(120_000, () => {
        req.destroy()
        reject(new Error('下载超时'))
      })
    })
  }

  /** 预缓存多首歌曲（顺序下载，不阻塞） */
  async prefetch(songs: SongItem[]): Promise<void> {
    for (const song of songs) {
      if (this.has(song.id)) continue
      if (!song.playUrl) continue
      try {
        console.log(`[AudioCache] 预缓存: ${song.title}`)
        await this.download(song)
      } catch (e) {
        console.error(`[AudioCache] 预缓存失败: ${song.title}`, (e as Error).message)
      }
    }
  }

  /** 驱逐最旧的缓存条目（不进回收站，同时清理封面） */
  private evictOldest() {
    let oldest: CacheEntry | null = null
    for (const entry of this.index.values()) {
      if (!oldest || entry.timestamp < oldest.timestamp) {
        oldest = entry
      }
    }
    if (oldest) {
      try { unlinkSync(oldest.filePath) } catch {}
      if (oldest.coverPath) {
        try { unlinkSync(oldest.coverPath) } catch {}
      }
      this.index.delete(oldest.songId)
      console.log(`[AudioCache] 淘汰: ${oldest.title}`)
    }
  }

  /** 获取缓存文件列表（按时间倒序） */
  getCacheList(): Array<{ songId: string; title: string; artist: string; size: number; timestamp: number }> {
    return Array.from(this.index.values())
      .filter(e => existsSync(e.filePath))
      .map(e => ({
        songId: e.songId,
        title: e.title,
        artist: e.artist,
        size: e.size,
        timestamp: e.timestamp
      }))
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /** 清空所有缓存文件（不进回收站，含封面） */
  clearAll() {
    for (const entry of this.index.values()) {
      try { unlinkSync(entry.filePath) } catch {}
      if (entry.coverPath) {
        try { unlinkSync(entry.coverPath) } catch {}
      }
    }
    this.index.clear()
    this.saveIndex()
    console.log('[AudioCache] 已清空所有缓存')
  }

  /** 获取缓存目录路径 */
  getCacheDir(): string {
    return this.cacheDir
  }

  /** 获取缓存文件数 */
  get count(): number {
    return this.index.size
  }
}

export const audioCache = new AudioCacheManager()