import { BrowserWindow, ipcMain } from 'electron'
import { autoLogin } from '../services/auto-login'
import { bilibiliAuth, getBilibiliCookieStr } from '../services/music/bilibili-video'
import { neteaseAuth } from '../services/music/netease-auth'
import { store } from '../services/store'

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
}