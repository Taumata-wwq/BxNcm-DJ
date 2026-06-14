import { fetchWithTimeout } from './fetch'
import * as crypto from 'crypto'
import { getBilibiliCookieStr } from './cookie'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// 缓存 WBI key
let cachedWbiKey: string | null = null
let wbiKeyTimestamp = 0
const WBI_KEY_TTL = 3600_000 // 1小时

function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex')
}

function getMixinKey(orig: string): string {
  // 参考 B站 WBI mixin 规则：将原始 key 按固定位置重排
  const order = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13]
  let result = ''
  for (const o of order) {
    if (o < orig.length) result += orig[o]
  }
  return result
}

async function fetchWbiKey(force: boolean = false): Promise<string | null> {
  const now = Date.now()
  if (!force && cachedWbiKey && (now - wbiKeyTimestamp) < WBI_KEY_TTL) {
    return cachedWbiKey
  }

  try {
    const res = await fetchWithTimeout('https://api.bilibili.com/x/web-interface/nav', {
      headers: { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/' }
    })
    const data = await res.json()
    if (data.data?.wbi_img) {
      const imgUrl: string = data.data.wbi_img.img_url || ''
      const subUrl: string = data.data.wbi_img.sub_url || ''
      // 从 URL 中提取文件名(不含扩展名)
      const imgKey = imgUrl.split('/').pop()?.split('.')[0] || ''
      const subKey = subUrl.split('/').pop()?.split('.')[0] || ''
      const combined = imgKey + subKey
      cachedWbiKey = getMixinKey(combined)
      wbiKeyTimestamp = now
      return cachedWbiKey
    }
  } catch (e) {
    console.error('[WBI] 获取 key 失败:', (e as Error).message)
  }
  return cachedWbiKey
}

export async function signParams(params: Record<string, string | number>, force: boolean = false): Promise<{ wts: number; w_rid: string }> {
  const wbiKey = await fetchWbiKey(force)
  if (!wbiKey) return { wts: 0, w_rid: '' }

  const wts = Math.floor(Date.now() / 1000)
  const allParams: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) {
    allParams[k] = String(v)
  }
  allParams['wts'] = String(wts)

  // 按参数名升序排序并拼接
  const sorted = Object.keys(allParams).sort()
  const queryParts: string[] = []
  for (const k of sorted) {
    queryParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
  }
  const query = queryParts.join('&')

  const w_rid = md5(query + wbiKey)
  return { wts, w_rid }
}

export interface DanmuServerInfo {
  token: string
  hosts: { host: string; wss_port: number; ws_port: number }[]
}

export async function getDanmuServerInfo(roomId: number): Promise<DanmuServerInfo | null> {
  try {
    const { wts, w_rid } = await signParams({ id: roomId, type: 0, web_location: '444.8' })
    if (!w_rid) return null

    const url = `https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo?id=${roomId}&type=0&web_location=444.8&wts=${wts}&w_rid=${w_rid}`
    const cookieStr = getBilibiliCookieStr()
    const headers: Record<string, string> = {
      'User-Agent': UA,
      'Referer': 'https://live.bilibili.com/',
    }
    if (cookieStr) {
      headers['Cookie'] = cookieStr
    }
    const res = await fetchWithTimeout(url, { headers })
    const data = await res.json()
    if (data.code === 0 && data.data) {
      return {
        token: data.data.token || '',
        hosts: (data.data.host_list || []).map((h: any) => ({
          host: h.host,
          wss_port: h.wss_port,
          ws_port: h.ws_port
        }))
      }
    } else {
      console.error(`[DanmuInfo] API 返回异常: code=${data.code}, message=${data.message}`)
    }
  } catch (e) {
    console.error('[DanmuInfo] getDanmuServerInfo 失败:', (e as Error).message)
  }
  return null
}