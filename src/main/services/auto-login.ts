import { store } from './store'
import type { AutoLoginResult, AuthState } from '../../shared/types/settings'
import { fetchWithTimeout } from '../utils/fetch'
import { fetchImageAsDataUrl } from '../utils/image'
import { weapiRequest } from '../utils/netease-crypto'
import { getBilibiliCookieStr } from './music/bilibili-video'

export const autoLogin = {
  async check(): Promise<AutoLoginResult> {
    const bilibiliCookie = store.get('bilibili_cookie')
    const neteaseCookie = store.get('netease_cookie')
    const bilibiliUname = store.get('bilibili_uname') || ''
    const bilibiliFace = store.get('bilibili_face') || ''
    const bilibiliUid = parseInt(store.get('bilibili_uid') || '0', 10)
    const neteaseUname = store.get('netease_uname') || ''
    const neteaseFace = store.get('netease_face') || ''
    const neteaseUid = parseInt(store.get('netease_uid') || '0', 10)

    const authState: AuthState = {
      bilibili: !!bilibiliCookie,
      bilibiliUname,
      bilibiliFace,
      bilibiliUid,
      netease: !!neteaseCookie,
      neteaseUname,
      neteaseFace,
      neteaseUid
    }

    // 验证 B站 Cookie 是否有效
    if (bilibiliCookie) {
      try {
        const cookieStr = getBilibiliCookieStr()
        const res = await fetchWithTimeout('https://api.bilibili.com/x/web-interface/nav', {
          headers: { Cookie: cookieStr }
        })
        const data = await res.json()
        if (data.code === 0 && data.data?.isLogin) {
          authState.bilibili = true
          authState.bilibiliUname = data.data.uname
          authState.bilibiliUid = data.data.mid || 0
          // 将头像URL转为data URL，避免渲染进程跨域问题
          let faceDataUrl = data.data.face || ''
          if (faceDataUrl && !faceDataUrl.startsWith('data:')) {
            faceDataUrl = await fetchImageAsDataUrl(faceDataUrl) || faceDataUrl
          }
          authState.bilibiliFace = faceDataUrl
          store.set('bilibili_uname', data.data.uname)
          store.set('bilibili_face', faceDataUrl)
          store.set('bilibili_uid', String(data.data.mid || 0))
        } else {
          authState.bilibili = false
          store.delete('bilibili_cookie')
          store.delete('bilibili_uname')
          store.delete('bilibili_face')
          store.delete('bilibili_uid')
        }
      } catch (e) {
        console.error('[AutoLogin] B站 Cookie 验证失败:', (e as Error).message)
        authState.bilibili = false
      }
    }

    // 验证网易云 Cookie 是否有效（使用 weapi 加密请求）
    if (neteaseCookie) {
      try {
        const cookies = JSON.parse(neteaseCookie)
        const result = await weapiRequest('/api/nuser/account/get', {}, cookies)
        const data = result.body
        if (data.code === 200 && data.profile) {
          authState.netease = true
          authState.neteaseUname = data.profile.nickname || ''
          let faceDataUrl = data.profile.avatarUrl || ''
          if (faceDataUrl && !faceDataUrl.startsWith('data:')) {
            faceDataUrl = await fetchImageAsDataUrl(faceDataUrl, 'https://music.163.com/') || faceDataUrl
          }
          authState.neteaseFace = faceDataUrl
          authState.neteaseUid = data.profile.userId || 0
          store.set('netease_uname', data.profile.nickname || '')
          store.set('netease_face', faceDataUrl)
          store.set('netease_uid', String(data.profile.userId || 0))
        } else {
          authState.netease = false
          store.delete('netease_cookie')
          store.delete('netease_uname')
          store.delete('netease_face')
          store.delete('netease_uid')
        }
      } catch (e) {
        console.error('[AutoLogin] 网易云 Cookie 验证失败:', (e as Error).message)
        authState.netease = false
      }
    }

    return {
      hasCredentials: authState.bilibili && authState.netease,
      authState
    }
  }
}
