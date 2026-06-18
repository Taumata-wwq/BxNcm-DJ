import { store } from '../store'
import type { SongItem } from '../../../shared/types/song'
import { extractCookies, mergeCookies, parseCookieStrToMap, getBilibiliCookieStr } from '../../utils/cookie'
import { fetchImageAsDataUrl, delay } from '../../utils/image'
import { fetchWithTimeout } from '../../utils/fetch'
import { signParams } from '../../utils/wbi'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const REFERER = 'https://www.bilibili.com/'

export const bilibiliAuth = {
  async getQRCode() {
    try {
      const res = await fetchWithTimeout('https://passport.bilibili.com/x/passport-login/web/qrcode/generate', {
        headers: { 'User-Agent': UA, 'Referer': REFERER }
      })
      const data = await res.json()
      if (data.code === 0 && data.data) {
        const qrcodeKey = data.data.qrcode_key
        const qrUrl = data.data.url
        const qrDataUrl = await fetchImageAsDataUrl(qrUrl)
        return { qrcodeKey, url: qrDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}` }
      }
    } catch (e) {
      console.error('[BiliAuth] getQRCode 失败:', (e as Error).message)
    }
    return null
  },

  async checkQRCode(qrcodeKey: string) {
    try {
      let cookieStr = ''
      const savedCookie = store.get('bilibili_cookie')
      if (savedCookie) {
        try { cookieStr = JSON.parse(savedCookie).__cookie_str__ || '' } catch {}
      }

      const res = await fetchWithTimeout(
        `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${qrcodeKey}&source=web`,
        {
          headers: {
            'User-Agent': UA, 'Referer': REFERER,
            ...(cookieStr ? { Cookie: cookieStr } : {})
          }
        }
      )

      const rawHeaders = (res as any).headers
      const setCookieHeaders: string[] = typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : (rawHeaders['set-cookie'] ? (Array.isArray(rawHeaders['set-cookie']) ? rawHeaders['set-cookie'] : [rawHeaders['set-cookie']]) : [])
      const newCookies = extractCookies(setCookieHeaders)
      const mergedCookieStr = mergeCookies(cookieStr, newCookies)

      const data = await res.json()
      if (data.code !== 0 || !data.data) {
        return { success: false, status: -1 }
      }

      const scanCode = data.data.code

      if (scanCode === 0) {
        const cookieMap = parseCookieStrToMap(mergedCookieStr)
        const navData = await fetchNavInfo(mergedCookieStr)
        if (navData) {
          cookieMap.__cookie_str__ = mergedCookieStr
          store.set('bilibili_cookie', JSON.stringify(cookieMap))
          store.set('bilibili_uname', navData.uname)
          store.set('bilibili_face', navData.face)
          store.set('bilibili_uid', String(navData.mid))
          return {
            success: true,
            cookies: cookieMap,
            uname: navData.uname,
            face: navData.face,
            faceDataUrl: navData.faceDataUrl,
            uid: navData.mid
          }
        }
        return { success: false, status: -1 }
      }

      if (Object.keys(newCookies).length > 0) {
        const cookieMap = parseCookieStrToMap(mergedCookieStr)
        cookieMap.__cookie_str__ = mergedCookieStr
        store.set('bilibili_cookie', JSON.stringify(cookieMap))
      }

      return { success: false, status: scanCode }
    } catch (e) {
      console.error('[BiliAuth] checkQRCode 失败:', (e as Error).message)
      return { success: false, status: -1 }
    }
  },

  async getLiveRoomInfo(cookieStr: string): Promise<{ roomId: number; liveStatus: number } | null> {
    try {
      const res = await fetchWithTimeout('https://api.live.bilibili.com/xlive/web-ucenter/user/live_info', {
        headers: {
          'User-Agent': UA, 'Referer': 'https://link.bilibili.com/',
          ...(cookieStr ? { Cookie: cookieStr } : {})
        }
      })
      const data = await res.json()
      if (data.code === 0 && data.data) {
        return {
          roomId: data.data.room_id || data.data.roomid || 0,
          liveStatus: data.data.live_status || 0
        }
      }
    } catch (e) {
      console.error('[BiliAuth] getLiveRoomInfo 失败:', (e as Error).message)
    }
    return null
  },

  async getVideoInfo(bvid: string): Promise<SongItem | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const cookieStr = getBilibiliCookieStr()
        const res = await fetchWithTimeout(
          `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
          {
            headers: {
              'User-Agent': UA, 'Referer': REFERER,
              ...(cookieStr ? { Cookie: cookieStr } : {})
            }
          }
        )
        const data = await res.json()
        if (data.code === 0 && data.data) {
          return await mapVideoToSong(data.data)
        }
      } catch (e) {
        console.error(`[BiliAuth] getVideoInfo 第${attempt + 1}/3 次失败:`, (e as Error).message)
      }
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
    }
    return null
  },

  /** 获取B站合集（seasons_archives）内的所有视频
   * API: https://api.bilibili.com/x/polymer/web-space/seasons_archives_list
   * Ref: https://socialsisteryi.github.io/bilibili-API-collect/docs/video/collection.html
   */
  async getSeasonVideos(mid: string, seasonId: string, maxPages: number = 5): Promise<{ songs: SongItem[]; favName: string }> {
    const midNum = parseInt(mid)
    const sidNum = parseInt(seasonId)
    if (isNaN(midNum) || isNaN(sidNum) || sidNum <= 0) {
      console.error(`[BiliAuth] 无效的合集参数: mid=${mid}, season_id=${seasonId}`)
      return { songs: [], favName: '' }
    }

    const cookieStr = getBilibiliCookieStr()
    if (!cookieStr) {
      console.error('[BiliAuth] 合集获取失败: 未登录B站')
      return { songs: [], favName: '' }
    }

    const songs: SongItem[] = []
    let favName = ''
    let page = 1
    const pageSize = 30

    const headers: Record<string, string> = {
      'User-Agent': UA,
      'Referer': 'https://www.bilibili.com/',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Cookie': cookieStr,
    }

    try {
      while (page <= maxPages) {
        const params: Record<string, string | number | boolean> = {
          mid: midNum,
          season_id: sidNum,
          page_num: page,
          page_size: pageSize,
          sort_reverse: false,
        }
        const sorted = Object.keys(params).sort()
        const queryParts = sorted.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`)
        const url = `https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?${queryParts.join('&')}`

        const res = await fetchWithTimeout(url, { headers })
        const data = await res.json()

        if (data.code !== 0) {
          console.error(`[BiliAuth] 合集列表 page=${page} code=${data.code} msg=${data.message || ''}`)
          break
        }

        // 第一页获取元数据
        if (page === 1 && data.data?.meta) {
          favName = data.data.meta.name || ''
        }

        const archives = (data.data?.archives || []) as any[]
        if (archives.length === 0) break

        for (const arc of archives) {
          const song = await mapVideoToSong({
            bvid: arc.bvid,
            pic: arc.pic || '',
            title: arc.title || '',
            duration: arc.duration || 0,
            owner: { name: arc.owner?.name || '' },
            cid: 0,  // 合集API不返回cid，播放时再获取
          })
          songs.push(song)
        }

        // 检查是否还有下一页
        const total = data.data?.page?.total || 0
        if (page * pageSize >= total) break

        page++
      }
    } catch (e) {
      console.error('[BiliAuth] 合集获取异常:', (e as Error).message)
    }

    return { songs, favName }
  },

  /** 获取视频所有分页，每页作为独立 SongItem */
  async getVideoAllPages(bvid: string): Promise<SongItem[]> {
    try {
      const cookieStr = getBilibiliCookieStr()
      const res = await fetchWithTimeout(
        `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
        {
          headers: {
            'User-Agent': UA, 'Referer': REFERER,
            ...(cookieStr ? { Cookie: cookieStr } : {})
          }
        }
      )
      const data = await res.json()
      if (data.code !== 0 || !data.data) return []

      const d = data.data
      const pages: any[] = d.pages || []
      if (pages.length <= 1) {
        // 单页视频，走原有映射逻辑
        const song = await mapVideoToSong(d)
        return song.title ? [song] : []
      }

      // 多页视频，每页创建一个 SongItem
      const songs: SongItem[] = []
      for (const page of pages) {
        const pageNum = page.page || 1
        const partTitle = page.part || ''
        const fullTitle = partTitle ? `${d.title} - ${partTitle}` : `${d.title} #${pageNum}`
        const song = await mapVideoToSong({
          bvid: d.bvid,
          pic: d.pic || '',
          title: fullTitle,
          duration: page.duration || d.duration || 0,
          owner: { name: d.owner?.name || '' },
          cid: page.cid || 0,
        })
        // 用独立 id 区分不同分页
        song.id = `bv_${d.bvid}_p${pageNum}`
        songs.push(song)
      }
      return songs.filter(s => s.title)
    } catch (e) {
      console.error('[BiliAuth] getVideoAllPages 失败:', (e as Error).message)
      return []
    }
  },

  /**
   * 获取B站视频播放URL（最高 1080p30帧）
   */
  async getVideoPlayUrl(bvid: string, cid: number): Promise<{ url: string; duration: number } | null> {
    const cookieStr = getBilibiliCookieStr()

    // fnval=1 → MP4(H.264) durl 流 → HTML5 <video> 可直接播放
    // fnval=0 → 默认流（通常是 FLV！HTML5 无法播放 FLV！）
    // qn: 80=1080P, 64=720P, 32=480P, 16=360P
    const tryUrls = [
      { url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=80&fnval=1&fnver=0&platform=html5&fourk=1`, desc: '1080P MP4' },
      { url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=64&fnval=1&fnver=0&platform=html5&fourk=1`, desc: '720P MP4' },
      { url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=32&fnval=1&fnver=0&platform=html5&fourk=1`, desc: '480P MP4' },
      { url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=16&fnval=1&fnver=0&platform=html5&fourk=1`, desc: '360P MP4' },
    ]

    for (const { url: apiUrl, desc } of tryUrls) {
      try {
        const res = await fetchWithTimeout(apiUrl, {
          headers: {
            'User-Agent': UA,
            'Referer': 'https://www.bilibili.com/',
            ...(cookieStr ? { Cookie: cookieStr } : {})
          }
        })
        const data = await res.json()
        if (data.code !== 0) continue

        const d = data.data
        if (!d) continue

        let url = ''
        let duration = 0

        // fnval=1 → durl 格式，包含可直接播放的 MP4 URL
        if (d.durl?.length > 0) {
          url = d.durl[0].url || d.durl[0].backup_url?.[0] || ''
          if (url && url.startsWith('http:')) url = url.replace('http:', 'https:')
        }

        duration = d.timelength ? Math.floor(d.timelength / 1000) : 0

        if (url) {
          return { url, duration }
        }
      } catch (e) {
        console.error(`[BiliAuth] getVideoPlayUrl ${desc} 失败:`, (e as Error).message)
      }
    }
    console.error('[BiliAuth] 所有播放URL尝试均失败，请检查是否已登录B站')
    return null
  },

  /**
   * 获取B站收藏夹内的所有视频
   * 参考 bilitool 项目的 fav.rs 实现
   */
  async getFavVideos(favId: string, maxPages: number = 5): Promise<{ songs: SongItem[]; favName: string }> {
    const mediaIdNum = parseInt(favId)
    if (isNaN(mediaIdNum) || mediaIdNum <= 0) {
      console.error(`[BiliAuth] 无效的收藏夹ID: "${favId}"`)
      return { songs: [], favName: '' }
    }

    // 提取 cookie 字符串（带回退重建逻辑）
    const cookieStr = getBilibiliCookieStr()
    if (!cookieStr) {
      console.error('[BiliAuth] 收藏夹获取失败: 未登录B站')
      return { songs: [], favName: '' }
    }

    const songs: SongItem[] = []
    let favName = ''
    let page = 1
    const pageSize = 20

    const headers: Record<string, string> = {
      'User-Agent': UA,
      'Referer': 'https://www.bilibili.com/',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Cookie': cookieStr,
    }

    // 发起 API 请求（包含 -352 WBI 签名失败重试 + -412 风控重试）
    async function favRequest(path: string, params: Record<string, string | number>, isRetry = false): Promise<any> {
      // WBI 签名（-352 重试时强制刷新 key）
      const sign = await signParams(params, isRetry)
      const sorted = Object.keys(params).sort()
      const queryParts = sorted.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`)
      let url = `https://api.bilibili.com${path}?${queryParts.join('&')}`
      if (sign.w_rid) {
        url += `&wts=${sign.wts}&w_rid=${sign.w_rid}`
      }

      const res = await fetchWithTimeout(url, { headers })
      const data = await res.json()

      // -352: WBI签名过期/失败 → 强制刷新 key 后重试一次
      if (data.code === -352 && !isRetry) {
        console.warn('[BiliAuth] WBI签名失败(-352)，强制刷新key后重试')
        return favRequest(path, params, true)
      }

      // -412: 风控 → 轮询重试（参考 bilitool client.rs）
      if (data.code === -412 || data.code === 412) {
        console.warn('[BiliAuth] 触发风控(-412)，开始轮询重试...')
        for (let i = 1; i <= 10; i++) {
          await delay(1000)
          const retrySign = await signParams(params, true)
          let retryUrl = `https://api.bilibili.com${path}?${queryParts.join('&')}`
          if (retrySign.w_rid) {
            retryUrl += `&wts=${retrySign.wts}&w_rid=${retrySign.w_rid}`
          }
          const retryRes = await fetchWithTimeout(retryUrl, { headers })
          const retryData = await retryRes.json()
          if (retryData.code !== -412 && retryData.code !== 412) {
            return retryData
          }
        }
        console.error('[BiliAuth] 风控重试10次仍未解除')
      }

      return data
    }

    try {
      // 1. 获取收藏夹名称
      const infoParams: Record<string, string | number> = {
        media_id: mediaIdNum,
        platform: 'web'
      }
      try {
        const infoData = await favRequest('/x/v3/fav/folder/info', infoParams)
        if (infoData.code === -101) {
          console.error('[BiliAuth] 收藏夹需要登录 (code=-101)，请重新登录B站')
          return { songs, favName }
        }
        if (infoData.code === -404 || infoData.code === 11001) {
          console.error(`[BiliAuth] 收藏夹不存在 (favId=${favId}, code=${infoData.code})`)
          return { songs, favName }
        }
        if (infoData.code !== 0) {
          console.error(`[BiliAuth] 收藏夹信息获取失败 (favId=${favId}, code=${infoData.code}, msg=${infoData.message || ''})`)
        }
        if (infoData.code === 0 && infoData.data) {
          favName = infoData.data.title || ''
        }
      } catch (e) {
        console.warn('[BiliAuth] 收藏夹名称获取异常，继续获取列表:', (e as Error).message)
      }

      // 2. 遍历获取所有视频
      let hasMore = true
      while (hasMore && page <= maxPages) {
        try {
          const listParams: Record<string, string | number> = {
            media_id: mediaIdNum,
            pn: page,
            ps: pageSize,
            platform: 'web',
          }
          let data = await favRequest('/x/v3/fav/resource/list', listParams)

          if (data.code === -101) {
            console.error('[BiliAuth] 收藏夹列表需要登录 (code=-101)')
            break
          }
          if (data.code === -352) {
            console.error('[BiliAuth] 收藏夹列表 WBI 签名持续失败 (code=-352)')
            break
          }
          if (data.code !== 0) {
            console.error(`[BiliAuth] 收藏夹列表 page=${page} 返回 code=${data.code} msg=${data.message || ''}`)
            break
          }

          let medias = (data.data.medias || []) as any[]
          const info = data.data.info || {}

          // 如果 medias 为空但 info.media_count > 0，尝试不同参数
          if (medias.length === 0 && info.media_count > 0) {
            // 尝试不带 platform 参数重试
            const retryParams: Record<string, string | number> = {
              media_id: mediaIdNum,
              pn: page,
              ps: pageSize,
            }
            const retryData = await favRequest('/x/v3/fav/resource/list', retryParams)
            if (retryData.code === 0) {
              const retryMedias = (retryData.data.medias || retryData.data.list || []) as any[]
              if (retryMedias.length > 0) {
                data = retryData
                medias = retryMedias
              }
            }
          }

          if (medias.length > 0) {
            let added = 0
          const rawSongs: any[] = []
          for (const m of medias) {
            // 兼容 type 为数字或字符串（参考 bilitool as_u64 转换）
            if (m.type != null && Number(m.type) !== 2) continue
            if (!m.bvid) continue
            const title = (m.title || '') as string
            // 自动跳过已失效视频
            if (title.includes('已失效')) {
              continue
            }
            const upper = m.upper || m.owner || {}
            rawSongs.push({
              bvid: m.bvid,
              aid: m.aid || m.id,
              title,
              owner: { name: upper.name || '' },
              pic: m.cover || '',
              duration: m.duration || 0,
              cid: m.cid || 0,
              pages: m.pages || [],
            })
            added++
          }
          // 并行转换封面为 data URL（参考 bilitool proxy_image）
          if (rawSongs.length > 0) {
            const mapped = await Promise.all(rawSongs.map(s => mapVideoToSong(s)))
            // 过滤已失效视频（无标题即视为已删除/私有化）
            const valid = mapped.filter(s => s.title && s.title.trim() !== '')
            songs.push(...valid)
            if (valid.length < mapped.length) {
              console.warn(`[BiliAuth] 收藏夹 page ${page} 中过滤了 ${mapped.length - valid.length} 个失效视频`)
            }
          }
          }
          hasMore = data.data.has_more || false
          page++
        } catch (e) {
          console.error(`[BiliAuth] fav page ${page} 请求异常:`, (e as Error).message)
          hasMore = false
        }
        if (hasMore) await delay(500)
      }
    } catch (e) {
      console.error('[BiliAuth] getFavVideos 失败:', (e as Error).message)
    }
    return { songs, favName }
  }
}

export { getBilibiliCookieStr }

async function fetchNavInfo(cookieStr: string) {
  try {
    const res = await fetchWithTimeout('https://api.bilibili.com/x/web-interface/nav', {
      headers: {
        'User-Agent': UA, 'Referer': REFERER,
        Cookie: cookieStr
      }
    })
    const data = await res.json()
    if (data.code === 0 && data.data?.isLogin) {
      const face = data.data.face || ''
      let faceDataUrl = ''
      if (face) {
        faceDataUrl = await fetchImageAsDataUrl(face) || ''
      }
      return {
        isLogin: true,
        mid: data.data.mid || 0,
        uname: data.data.uname || '',
        face,
        faceDataUrl
      }
    }
  } catch (e) {
    console.error('[BiliAuth] fetchNavInfo 失败:', (e as Error).message)
  }
  return null
}

/**
 * 参考 bilitool proxy_image：将封面 URL 转为 base64 data URL，
 * 避免 Electron 渲染进程加载外部图片时的 CORS/referer/混合内容问题
 */
async function mapVideoToSong(data: any): Promise<SongItem> {
  let cover = data.pic || ''
  if (!cover) cover = ''
  // 处理各种封面 URL 格式
  if (cover.startsWith('//')) cover = 'https:' + cover
  if (cover.startsWith('http:')) cover = cover.replace('http:', 'https:')

  // 参考 bilitool proxy_image：将封面图片转为 data URL
  let coverDataUrl = ''
  if (cover) {
    try {
      coverDataUrl = await fetchImageAsDataUrl(cover)
    } catch (e) {
      console.warn('[BiliAuth] 封面转换失败，使用原始URL:', (e as Error).message)
      coverDataUrl = cover
    }
  }

  return {
    id: `bv_${data.bvid}`,
    source: 'bilibili',
    sourceId: data.bvid,
    cid: data.cid || (data.pages?.length > 0 ? data.pages[0].cid : 0),
    title: data.title || '',
    artist: data.owner?.name || '',
    album: '',
    coverUrl: coverDataUrl || cover,
    duration: data.duration || 0,
    playUrl: '',
    playUrlExpire: 0,
    requesterName: '',
    requesterUid: 0
  }
}