import { BrowserWindow, ipcMain } from 'electron'
import { autoLogin } from '../services/auto-login'
import { bilibiliAuth, getBilibiliCookieStr } from '../services/music/bilibili-video'
import { neteaseAuth } from '../services/music/netease-auth'
import { store } from '../services/store'
import { fetchWithTimeout } from '../utils/fetch'

function getBilibiliState() {
  return {
    bilibili: !!store.get('bilibili_cookie'),
    bilibiliUname: store.get('bilibili_uname') || '',
    bilibiliFace: store.get('bilibili_face') || '',
    bilibiliUid: parseInt(store.get('bilibili_uid') || '0', 10)
  }
}

function getNeteaseState() {
  return {
    netease: !!store.get('netease_cookie'),
    neteaseUname: store.get('netease_uname') || '',
    neteaseFace: store.get('netease_face') || '',
    neteaseUid: parseInt(store.get('netease_uid') || '0', 10)
  }
}

/** 从 cookie 字符串中提取 bili_jct 的值 */
function extractBiliJct(cookieStr: string): string {
  if (!cookieStr) return ''
  for (const part of cookieStr.split(';')) {
    const trimmed = part.trim()
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx <= 0) continue
    const key = trimmed.substring(0, eqIdx).trim()
    if (key === 'bili_jct') {
      return trimmed.substring(eqIdx + 1).trim()
    }
  }
  return ''
}

export function registerAuthIpc(mainWindow: BrowserWindow) {
  ipcMain.handle('auto-login:check', async () => {
    return autoLogin.check()
  })

  // B站 二维码
  ipcMain.handle('auth:bilibili-qrcode', async () => {
    return bilibiliAuth.getQRCode()
  })

  ipcMain.handle('auth:bilibili-check', async (_, oauthKey: string) => {
    const result = await bilibiliAuth.checkQRCode(oauthKey)
    if (result.success) {
      // faceDataUrl 是主进程代理下载的 base64 头像，可直接用于渲染
      store.set('bilibili_uname', result.uname || '')
      store.set('bilibili_face', result.faceDataUrl || result.face || '')
      store.set('bilibili_uid', String(result.uid || 0))
      mainWindow.webContents.send('auth:state-changed', {
        ...getBilibiliState(), bilibili: true,
        ...getNeteaseState()
      })
    }
    return result
  })

  // B站 直播间信息
  ipcMain.handle('auth:bilibili-room', async () => {
    const cookieStr = getBilibiliCookieStr()
    if (!cookieStr) return null
    try {
      return bilibiliAuth.getLiveRoomInfo(cookieStr)
    } catch (e) {
      console.error('[AuthIPC] B站直播间信息获取失败:', (e as Error).message)
      return null
    }
  })

  // 网易云 二维码
  ipcMain.handle('auth:netease-qrcode', async () => {
    return neteaseAuth.getQRCode()
  })

  ipcMain.handle('auth:netease-check', async (_, unikey: string) => {
    const result = await neteaseAuth.checkQRCode(unikey)
    if (result.success) {
      mainWindow.webContents.send('auth:state-changed', {
        ...getBilibiliState(),
        ...getNeteaseState(), netease: true
      })
    }
    return result
  })

  // 退出登录
  ipcMain.handle('auth:logout-bilibili', () => {
    store.delete('bilibili_cookie')
    store.delete('bilibili_uname')
    store.delete('bilibili_face')
    store.delete('bilibili_uid')
    mainWindow.webContents.send('auth:state-changed', {
      bilibili: false, bilibiliUname: '', bilibiliFace: '', bilibiliUid: 0,
      ...getNeteaseState()
    })
  })

  ipcMain.handle('auth:logout-netease', () => {
    neteaseAuth.clearCredentials()
    mainWindow.webContents.send('auth:state-changed', {
      ...getBilibiliState(),
      netease: false, neteaseUname: '', neteaseFace: '', neteaseUid: 0
    })
  })

  // 获取 blivechat 身份码（直播间推广码）
  // 参考: https://programmerall.com/article/19972716529/
  // POST body 需要: action=1&csrf_token={bili_jct}&csrf={bili_jct}
  ipcMain.handle('auth:fetch-identity-code', async () => {
    const cookieStr = getBilibiliCookieStr()
    if (!cookieStr) {
      return { success: false, message: '未登录B站' }
    }
    // 从 cookie 中提取 bili_jct 作为 CSRF token
    const csrfToken = extractBiliJct(cookieStr)
    if (!csrfToken) {
      return { success: false, message: 'Cookie 中缺少 bili_jct，请重新登录B站' }
    }
    try {
      const body = `action=1&csrf_token=${encodeURIComponent(csrfToken)}&csrf=${encodeURIComponent(csrfToken)}`

      // 最多重试 3 次
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetchWithTimeout('https://api.live.bilibili.com/xlive/open-platform/v1/common/operationOnBroadcastCode', {
            method: 'POST',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
              'Content-Type': 'application/x-www-form-urlencoded',
              'Cookie': cookieStr,
              'Origin': 'https://link.bilibili.com',
              'Referer': 'https://link.bilibili.com/p/center/index',
            },
            body
          })
          const data = await res.json()
          if (data.code === 0 && data.data?.code) {
            return { success: true, code: data.data.code }
          } else {
            console.warn(`[AuthIPC] 获取身份码第 ${attempt + 1}/3 次返回异常:`, data.message)
            if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
          }
        } catch (fetchErr) {
          console.error(`[AuthIPC] 获取身份码第 ${attempt + 1}/3 次失败:`, (fetchErr as Error).message)
          if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
        }
      }
      return { success: false, message: '获取失败（已重试3次）' }
    } catch (e) {
      return { success: false, message: (e as Error).message }
    }
  })
}