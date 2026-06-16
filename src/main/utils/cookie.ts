// 从响应头中提取 cookies（参考 bilitool extract_cookies_from_headers）
import { store } from '../services/store'

export function extractCookies(setCookieHeaders: string[]): Record<string, string> {
  const skipKeys = ['domain', 'path', 'expires', 'max-age', 'httponly', 'secure', 'samesite', 'sameparty', 'partitioned', 'priority']
  const map: Record<string, string> = {}
  for (const header of setCookieHeaders) {
    // 先按分号分割 Set-Cookie 的各部分，取第一部分（key=value）
    const firstPart = header.split(';')[0].trim()
    const eqIdx = firstPart.indexOf('=')
    if (eqIdx <= 0) continue
    const key = firstPart.substring(0, eqIdx).trim()
    const val = firstPart.substring(eqIdx + 1).trim()
    if (val && !skipKeys.includes(key.toLowerCase())) {
      map[key] = val
    }
  }
  return map
}

// 合并 cookie 字符串（参考 bilitool merge_cookie_strings）
export function mergeCookies(base: string, update: Record<string, string>): string {
  const map: Record<string, string> = {}
  if (base) {
    for (const part of base.split(';')) {
      const trimmed = part.trim()
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx > 0) {
        map[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim()
      }
    }
  }
  for (const [k, v] of Object.entries(update)) {
    if (v) map[k] = v
  }
  return Object.entries(map).map(([k, v]) => `${k}=${v}`).join('; ')
}

// 将 cookie 字符串解析为键值对 map
export function parseCookieStrToMap(cookieStr: string): Record<string, string> {
  const map: Record<string, string> = {}
  if (!cookieStr) return map
  for (const part of cookieStr.split(';')) {
    const trimmed = part.trim()
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) {
      map[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim()
    }
  }
  return map
}

/** 提取已保存的 B站 Cookie 字符串（带回退重建） */
export function getBilibiliCookieStr(): string {
  const raw = store.get('bilibili_cookie')
  if (!raw) return ''
  try {
    const cookies = JSON.parse(raw)
    if (cookies.__cookie_str__) return cookies.__cookie_str__
    // 回退：从 key-value 对重建 cookie 字符串
    return Object.entries(cookies)
      .filter(([k]) => k !== '__cookie_str__')
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
  } catch {
    return ''
  }
}