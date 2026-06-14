/**
 * 网易云音乐 API 加密请求工具
 * 参考: api-enhanced-main 项目
 */
import crypto from 'crypto'
import { fetchWithTimeout } from './fetch'

// 加密常量 — 以下均为网易云音乐 API 公开参数，非应用密钥
const iv = '0102030405060708'
const presetKey = '0CoJUm6Qyw8W8jud'
const eapiKey = 'e82ckenh8dichen8'
const base62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const publicKey = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----`

// API 域名
const API_DOMAIN = 'https://interface.music.163.com'
const DOMAIN = 'https://music.163.com'

// User-Agent
const UA = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/3.0.18.203152'

// 生成加密安全随机字符串（使用 crypto.randomBytes 替代 Math.random）
function randomString(length: number): string {
  const bytes = crypto.randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += base62.charAt(bytes[i] % base62.length)
  }
  return result
}

// AES 加密
function aesEncrypt(text: string, key: string, ivStr: string): string {
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(key), Buffer.from(ivStr))
  return Buffer.concat([cipher.update(Buffer.from(text)), cipher.final()]).toString('base64')
}

// RSA 加密
function rsaEncrypt(text: string): string {
  const buffer = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_NO_PADDING
    },
    Buffer.from(text.padStart(128, '\0'))
  )
  return buffer.toString('hex')
}

// weapi 加密 (用于 Web 端 API)
function weapiEncrypt(object: Record<string, any>): { params: string; encSecKey: string } {
  const text = JSON.stringify(object)
  const secretKey = randomString(16)
  return {
    params: aesEncrypt(aesEncrypt(text, presetKey, iv), secretKey, iv),
    encSecKey: rsaEncrypt(secretKey.split('').reverse().join(''))
  }
}

// eapi 加密 (用于客户端 API)
function eapiEncrypt(url: string, object: Record<string, any>): string {
  const text = JSON.stringify(object)
  const message = `nobody${url}use${text}md5forencrypt`
  const digest = crypto.createHash('md5').update(message).digest('hex')
  const data = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`
  const cipher = crypto.createCipheriv('aes-128-ecb', Buffer.from(eapiKey), null)
  return Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()]).toString('hex').toUpperCase()
}

// eapi 解密
function eapiDecrypt(encrypted: string): any {
  const decipher = crypto.createDecipheriv('aes-128-ecb', Buffer.from(eapiKey), null)
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted, 'hex')), decipher.final()])
  return JSON.parse(decrypted.toString('utf-8'))
}

// 生成请求 ID
function generateRequestId(): string {
  return `${Date.now()}_${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`
}

// 生成设备 ID
function generateDeviceId(): string {
  return randomString(32)
}

// 创建 Header Cookie
function createHeaderCookie(header: Record<string, string | number>): string {
  return Object.entries(header)
    .filter(([k]) => k !== '__cookie_str__') // 过滤内部存储字段
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('; ')
}

// 全局设备 ID
const deviceId = generateDeviceId()

/**
 * 发送 eapi 请求 (网易云音乐客户端加密 API)
 */
export async function eapiRequest(
  uri: string,
  data: Record<string, any>,
  cookie: Record<string, string> = {}
): Promise<{ body: any; cookie: Record<string, string> }> {
  const csrfToken = cookie['__csrf'] || ''
  const now = Date.now()

  // 构建 header
  const header: Record<string, string | number> = {
    osver: 'Microsoft-Windows-10-Professional-build-19045-64bit',
    deviceId: deviceId,
    os: 'pc',
    appver: '3.1.17.204416',
    versioncode: '140',
    mobilename: '',
    buildver: Math.floor(now / 1000).toString(),
    resolution: '1920x1080',
    __csrf: csrfToken,
    channel: 'netease',
    requestId: generateRequestId(),
  }

  if (cookie.MUSIC_U) header.MUSIC_U = cookie.MUSIC_U
  if (cookie.MUSIC_A) header.MUSIC_A = cookie.MUSIC_A

  // 合并数据
  const fullData = {
    ...data,
    header: header
  }

  // 加密
  const encrypted = eapiEncrypt(uri, fullData)
  const url = `${API_DOMAIN}/eapi/${uri.substring(5)}`

  // 发送请求
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Cookie': createHeaderCookie(header),
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': DOMAIN,
    },
    body: `params=${encrypted}`,
  })

  // 解析响应
  const responseText = await res.text()
  let body: any
  try {
    body = eapiDecrypt(responseText)
  } catch {
    body = JSON.parse(responseText)
  }

  // 提取 cookie
  const setCookie = res.headers.get('set-cookie') || ''
  const newCookies: Record<string, string> = {}
  const skipKeys = ['domain', 'path', 'expires', 'max-age', 'httponly', 'secure', 'samesite']
  if (setCookie) {
    setCookie.split(';').forEach(part => {
      const [key, value] = part.trim().split('=')
      if (key && value && !skipKeys.includes(key.toLowerCase())) {
        newCookies[key] = value
      }
    })
  }

  return { body, cookie: { ...cookie, ...newCookies } }
}

/**
 * 发送 weapi 请求 (Web 端加密 API)
 */
export async function weapiRequest(
  uri: string,
  data: Record<string, any>,
  cookie: Record<string, string> = {}
): Promise<{ body: any; cookie: Record<string, string> }> {
  const csrfToken = cookie['__csrf'] || ''

  // 合并数据
  const fullData = {
    ...data,
    csrf_token: csrfToken
  }

  // 加密
  const encrypted = weapiEncrypt(fullData)
  const url = `${DOMAIN}/weapi/${uri.substring(5)}`

  // 发送请求
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Cookie': createHeaderCookie(cookie),
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': DOMAIN,
    },
    body: `params=${encodeURIComponent(encrypted.params)}&encSecKey=${encodeURIComponent(encrypted.encSecKey)}`,
  })

  // 解析响应
  const responseText = await res.text()
  let body: any
  try {
    body = JSON.parse(responseText)
  } catch (parseErr) {
    // 截取前 200 字符便于排查
    const preview = responseText.substring(0, 200)
    console.error(`[weapiRequest] JSON 解析失败 (${uri}):`, (parseErr as Error).message)
    console.error(`[weapiRequest] 原始响应预览:`, preview)
    throw parseErr
  }

  // 提取 cookie
  const setCookie = res.headers.get('set-cookie') || ''
  const newCookies: Record<string, string> = {}
  const skipKeys = ['domain', 'path', 'expires', 'max-age', 'httponly', 'secure', 'samesite']
  if (setCookie) {
    setCookie.split(';').forEach(part => {
      const [key, value] = part.trim().split('=')
      if (key && value && !skipKeys.includes(key.toLowerCase())) {
        newCookies[key] = value
      }
    })
  }

  return { body, cookie: { ...cookie, ...newCookies } }
}

/**
 * 发送普通 API 请求 (无加密)
 */
export async function apiRequest(
  uri: string,
  data: Record<string, any>,
  cookie: Record<string, string> = {}
): Promise<{ body: any; cookie: Record<string, string> }> {
  const url = `${API_DOMAIN}${uri}`
  const params = new URLSearchParams(data).toString()

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Cookie': createHeaderCookie(cookie),
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': DOMAIN,
    },
    body: params,
  })

  const body = await res.json()

  // 提取 cookie（使用 getSetCookie 获取所有 Set-Cookie header）
  const newCookies: Record<string, string> = {}
  try {
    const setCookies: string[] = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : []
    for (const setCookie of setCookies) {
      // Set-Cookie 格式: name=value; Path=/; Domain=...
      const match = setCookie.match(/^([^=]+)=([^;]*)/)
      if (match) {
        const key = match[1]
        // 跳过元数据和 domain/path 等属性
        if (!['domain', 'path', 'expires', 'max-age', 'httponly', 'secure'].includes(key.toLowerCase())) {
          newCookies[key] = match[2]
        }
      }
    }
  } catch {}

  return { body, cookie: { ...cookie, ...newCookies } }
}
