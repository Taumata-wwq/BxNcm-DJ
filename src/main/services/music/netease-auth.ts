import QRCode from 'qrcode'
import { store } from '../store'
import { apiRequest, weapiRequest } from '../../utils/netease-crypto'

// 本地生成二维码 data URL
async function generateQRDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    })
  } catch (e) {
    console.error('[NeteaseAuth] generateQRDataUrl \u5931\u8d25:', (e as Error).message)
    return ''
  }
}

// 获取用户账号信息（使用 weapi 加密，参考 api-enhanced-main）
async function fetchUserAccount(cookies: Record<string, string>): Promise<{
  nickname: string; avatarUrl: string; userId: number
} | null> {
  try {
    const result = await weapiRequest('/api/nuser/account/get', {}, cookies)
    const data = result.body
    if (data.code === 200 && data.profile) {
      return {
        nickname: data.profile.nickname || '',
        avatarUrl: data.profile.avatarUrl || '',
        userId: data.profile.userId || 0
      }
    }
  } catch (e) {
    console.error('[NeteaseAuth] getUserAccount \u5931\u8d25:', (e as Error).message)
  }
  return null
}

export const neteaseAuth = {
  clearCredentials() {
    store.delete('netease_cookie')
    store.delete('netease_uname')
    store.delete('netease_face')
    store.delete('netease_uid')
  },

  async getQRCode() {
    try {
      // 使用普通 API 获取 unikey（type=3 表示 PC 端）
      const result = await apiRequest('/api/login/qrcode/unikey', { type: 3 }, {})

      // API 直接返回 { code: 200, unikey: '...' }
      if (result.body.code !== 200 || !result.body.unikey) {
        console.error('[NeteaseAuth] getQRCode \u8fd4\u56de:', result.body)
        return null
      }

      const unikey = result.body.unikey
      const qrContent = `https://music.163.com/login?codekey=${unikey}`
      const qrDataUrl = await generateQRDataUrl(qrContent)

      if (!qrDataUrl) return null
      return { unikey, url: qrDataUrl }
    } catch (e) {
      console.error('[NeteaseAuth] getQRCode \u5931\u8d25:', (e as Error).message)
      return null
    }
  },

  async checkQRCode(unikey: string) {
    try {
      // 检查二维码登录状态
      const result = await apiRequest('/api/login/qrcode/client/login', { key: unikey, type: 3 }, {})

      const data = result.body

      // 803 = 登录成功
      if (data.code === 803) {
        // 从响应 cookie 中提取登录凭证
        const cookies = result.cookie
        const cookieStr = Object.entries(cookies)
          .filter(([k]) => k !== '__cookie_str__')
          .map(([k, v]) => `${k}=${v}`)
          .join('; ')

        // 保存 cookie
        const cookieObj = { ...cookies, __cookie_str__: cookieStr }
        store.set('netease_cookie', JSON.stringify(cookieObj))

        // 获取用户信息（使用 weapi 加密请求）
        let uname = '\u7f51\u6613\u4e91\u7528\u6237'
        let face = ''
        let faceDataUrl = ''
        let uid = 0

        try {
          const userInfo = await fetchUserAccount(cookies)
          if (userInfo) {
            uname = userInfo.nickname || '\u7f51\u6613\u4e91\u7528\u6237'
            face = userInfo.avatarUrl || ''
            uid = userInfo.userId || 0
            // 直接使用原始 URL，由 Chromium 原生缓存处理，不提前转为 base64
            faceDataUrl = face
          }
        } catch (e) {
          console.error('[NeteaseAuth] \u83b7\u53d6\u7528\u6237\u4fe1\u606f\u5931\u8d25:', (e as Error).message)
        }

        store.set('netease_uname', uname)
        store.set('netease_face', faceDataUrl || face)
        store.set('netease_uid', String(uid))

        return { success: true, cookies, uname, face: faceDataUrl || face, uid }
      }

      // 800 = 二维码过期, 801 = 等待扫码, 802 = 已扫码待确认
      return { success: false, status: data.code }
    } catch (e) {
      console.error('[NeteaseAuth] checkQRCode \u5931\u8d25:', (e as Error).message)
      return { success: false, status: -1 }
    }
  }
}
