import { fetchWithTimeout } from './fetch'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// 通过主进程代理下载图片，转为 base64 data URL（参考 bilitool proxy_image）
// 支持 B站和网易云的头像下载
export async function fetchImageAsDataUrl(url: string, referer?: string): Promise<string> {
  // 根据 URL 自动选择 referer
  const defaultReferer = url.includes('music.163.com') || url.includes('netease')
    ? 'https://music.163.com/'
    : 'https://www.bilibili.com/'

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': UA,
          'Referer': referer || defaultReferer
        }
      })
      const contentType = res.headers.get('content-type') || 'image/jpeg'
      // 网易云头像可能返回无 content-type 或 text/plain，放宽检查
      const isImage = contentType.includes('image') || contentType.includes('octet-stream') || url.includes('music.163.com')
      if (!isImage) {
        if (attempt < 2) { await delay(500); continue }
        return ''
      }
      const buffer = await res.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      // 根据实际内容推断 MIME 类型
      const mime = contentType.includes('image') ? contentType : detectImageMime(buffer)
      return `data:${mime};base64,${base64}`
    } catch {
      if (attempt < 2) { await delay(500); continue }
    }
  }
  return ''
}

// 根据文件头检测图片 MIME 类型
function detectImageMime(buffer: ArrayBuffer): string {
  const arr = new Uint8Array(buffer)
  if (arr[0] === 0xFF && arr[1] === 0xD8) return 'image/jpeg'
  if (arr[0] === 0x89 && arr[1] === 0x50) return 'image/png'
  if (arr[0] === 0x47 && arr[1] === 0x49) return 'image/gif'
  if (arr[0] === 0x52 && arr[1] === 0x49) return 'image/webp'
  return 'image/jpeg'
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}