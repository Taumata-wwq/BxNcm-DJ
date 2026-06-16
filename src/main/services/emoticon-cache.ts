import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, createWriteStream, readdirSync, rmSync, statSync } from 'fs'
import { createHash } from 'crypto'
import { get as httpsGet } from 'https'
import { get as httpGet } from 'http'
import type { IncomingMessage } from 'http'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const MAX_CONCURRENT = 5  // 最大并发下载数

class EmoticonCache {
  private cacheDir: string

  constructor() {
    const dataDir = app.isPackaged ? dirname(app.getPath('exe')) : app.getPath('userData')
    this.cacheDir = join(dataDir, 'emoticon-cache')
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true })
    }
  }

  /** 获取图片的本地缓存路径（不存在则下载） */
  async getCachedPath(imageUrl: string): Promise<string> {
    const hash = createHash('md5').update(imageUrl).digest('hex')
    const ext = this.getExtension(imageUrl)
    const localPath = join(this.cacheDir, `${hash}${ext}`)

    if (existsSync(localPath)) {
      return localPath
    }

    await this.download(imageUrl, localPath)
    return localPath
  }

  /** 将图片 URL 转为 file:// 本地路径（不存在则下载） */
  async getCachedUrl(imageUrl: string): Promise<string> {
    const localPath = await this.getCachedPath(imageUrl)
    return `file:///${localPath.replace(/\\/g, '/')}`
  }

  /** 批量缓存表情包中的所有图片 URL，返回 URL 映射 */
  async cachePackageImageUrls(packages: any[]): Promise<Map<string, string>> {
    const urlMap = new Map<string, string>()
    const allUrls = new Set<string>()

    // 收集所有图片 URL
    for (const pkg of packages) {
      if (pkg.pkg_url && !pkg.pkg_url.startsWith('file://')) {
        allUrls.add(pkg.pkg_url)
      }
      if (pkg.emoticons) {
        for (const emo of pkg.emoticons) {
          if (emo.url && !emo.url.startsWith('file://')) {
            allUrls.add(emo.url)
          }
        }
      }
    }

    // 分批并发下载（控制并发数）
    const urlArray = Array.from(allUrls)
    for (let i = 0; i < urlArray.length; i += MAX_CONCURRENT) {
      const batch = urlArray.slice(i, i + MAX_CONCURRENT)
      await Promise.allSettled(
        batch.map(async (url) => {
          try {
            const localUrl = await this.getCachedUrl(url)
            urlMap.set(url, localUrl)
          } catch (e) {
            console.warn(`[EmoticonCache] 下载失败: ${url}`, (e as Error).message)
          }
        })
      )
    }

    return urlMap
  }

  /** 清除所有缓存的图片 */
  clearAll(): void {
    if (existsSync(this.cacheDir)) {
      const files = readdirSync(this.cacheDir)
      for (const file of files) {
        try {
          rmSync(join(this.cacheDir, file), { force: true })
        } catch { /* 忽略删除失败 */ }
      }
    }
  }

  /** 获取缓存目录大小（字节） */
  getSize(): number {
    if (!existsSync(this.cacheDir)) return 0
    let total = 0
    const files = readdirSync(this.cacheDir)
    for (const file of files) {
      try {
        total += statSync(join(this.cacheDir, file)).size
      } catch { /* 忽略 */ }
    }
    return total
  }

  private getExtension(imageUrl: string): string {
    const match = imageUrl.match(/\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i)
    return match ? `.${match[1].toLowerCase()}` : '.png'
  }

  private download(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? httpsGet : httpGet
      const req = protocol(
        url,
        {
          headers: {
            'User-Agent': UA,
            'Referer': 'https://live.bilibili.com/',
          },
          timeout: 15000,
        },
        (res: IncomingMessage) => {
          // 跟随重定向
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            this.download(res.headers.location, dest).then(resolve).catch(reject)
            return
          }
          if (res.statusCode !== 200) {
            reject(new Error(`下载失败 HTTP ${res.statusCode}: ${url}`))
            return
          }
          const file = createWriteStream(dest)
          res.pipe(file)
          file.on('finish', () => {
            file.close()
            resolve()
          })
          file.on('error', (err) => {
            file.close()
            reject(err)
          })
        }
      )
      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error(`下载超时: ${url}`))
      })
    })
  }
}

export const emoticonCache = new EmoticonCache()