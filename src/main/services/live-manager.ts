import * as crypto from 'crypto'
import { store } from './store'
import { fetchWithTimeout } from '../utils/fetch'
import { parseCookieStrToMap } from '../utils/cookie'
import { getBilibiliCookieStr } from './music/bilibili-video'

const APP_KEY = 'aae92bc66f3edfab'
const APP_SEC = 'af125a0d5279fd576c1b4418a3e8276d'

// ==================== 内部工具函数 ====================

/** 获取 cookie 字符串和 csrf_token */
function getAuth(): { cookieStr: string; csrf: string } {
  const cookieStr = getBilibiliCookieStr()
  const cookieMap = parseCookieStrToMap(cookieStr)
  const csrf = cookieMap['bili_jct'] || ''
  return { cookieStr, csrf }
}

/** 签名算法：参数按 key 排序，URL 编码后拼接，末尾加 APP_SEC，MD5 */
function appSign(params: Record<string, string>): Record<string, string> {
  params['appkey'] = APP_KEY
  const sortedKeys = Object.keys(params).sort()
  const encoded = sortedKeys.map(k =>
    `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`
  )
  const queryStr = encoded.join('&')
  const signStr = queryStr + APP_SEC
  const sign = crypto.createHash('md5').update(signStr).digest('hex')
  params['sign'] = sign
  return params
}

/** 获取 B站服务器时间戳 */
async function getTimestamp(): Promise<string> {
  const resp = await fetchWithTimeout('https://api.bilibili.com/x/report/click/now')
  const data = await resp.json()
  return String(data?.data?.now || 0)
}

/** 获取直播版本信息（build + curr_version） */
async function getVersionInfo(ts: string): Promise<{ build: string; version: string }> {
  const signed = appSign({ system_version: '2', ts })
  const query = new URLSearchParams(signed).toString()
  const resp = await fetchWithTimeout(
    `https://api.live.bilibili.com/xlive/app-blink/v1/liveVersionInfo/getHomePageLiveVersion?${query}`
  )
  const data = await resp.json()
  return {
    build: String(data?.data?.build || 0),
    version: data?.data?.curr_version || ''
  }
}

/** 统一请求头 */
function liveHeaders(cookieStr: string): HeadersInit {
  return {
    Cookie: cookieStr,
    Referer: 'https://link.bilibili.com/'
  }
}

// ==================== 对外 API ====================

/** 通过 UID 获取直播间信息（房间号 → 详情） */
export async function getRoomInfoByUid(uid: number): Promise<{ code: number; message: string; data: any }> {
  try {
    const { cookieStr } = getAuth()

    // 第一步: 通过 UID 获取房间号
    const roomIdResp = await fetchWithTimeout(
      `https://api.live.bilibili.com/room/v2/Room/room_id_by_uid?uid=${uid}`,
      { headers: liveHeaders(cookieStr) }
    )
    const roomIdData = await roomIdResp.json()
    const roomId = roomIdData?.data?.room_id || 0

    if (roomId === 0) {
      return { code: -1, message: '该用户未开通直播间', data: null }
    }

    // 第二步: 获取房间详情
    const roomInfoResp = await fetchWithTimeout(
      `https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${roomId}`,
      { headers: liveHeaders(cookieStr) }
    )
    const roomInfoData = await roomInfoResp.json()

    return {
      code: roomInfoData.code,
      message: roomInfoData.message || 'ok',
      data: roomInfoData.data || null
    }
  } catch (e) {
    return { code: -1, message: `获取直播间信息失败: ${(e as Error).message}`, data: null }
  }
}

/** 修改直播间标题 */
export async function updateRoomTitle(roomId: number, title: string): Promise<{ code: number; message: string; data: any }> {
  try {
    const { cookieStr, csrf } = getAuth()
    if (!csrf) {
      return { code: -1, message: '未获取到 csrf token，请确认已登录B站', data: null }
    }

    const body = new URLSearchParams({
      room_id: String(roomId),
      platform: 'pc_link',
      title,
      csrf_token: csrf,
      csrf
    })

    const resp = await fetchWithTimeout('https://api.live.bilibili.com/room/v1/Room/update', {
      method: 'POST',
      headers: {
        ...liveHeaders(cookieStr),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    })
    const data = await resp.json()

    return {
      code: data.code,
      message: data.message || 'ok',
      data: data.data || null
    }
  } catch (e) {
    return { code: -1, message: `修改标题失败: ${(e as Error).message}`, data: null }
  }
}

/** 修改直播分区 */
export async function updateRoomArea(roomId: number, areaId: number): Promise<{ code: number; message: string; data: any }> {
  try {
    const { cookieStr, csrf } = getAuth()
    if (!csrf) {
      return { code: -1, message: '未获取到 csrf token，请确认已登录B站', data: null }
    }

    const body = new URLSearchParams({
      room_id: String(roomId),
      platform: 'pc_link',
      area_id: String(areaId),
      csrf_token: csrf,
      csrf
    })

    const resp = await fetchWithTimeout('https://api.live.bilibili.com/room/v1/Room/update', {
      method: 'POST',
      headers: {
        ...liveHeaders(cookieStr),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    })
    const data = await resp.json()

    return {
      code: data.code,
      message: data.message || 'ok',
      data: data.data || null
    }
  } catch (e) {
    return { code: -1, message: `修改分区失败: ${(e as Error).message}`, data: null }
  }
}

/** 获取直播分区列表 */
export async function getAreaList(): Promise<{ code: number; message: string; data: any }> {
  try {
    const { cookieStr } = getAuth()

    const resp = await fetchWithTimeout(
      'https://api.live.bilibili.com/room/v1/Area/getList?show_pinyin=1',
      { headers: liveHeaders(cookieStr) }
    )
    const data = await resp.json()

    return {
      code: data.code,
      message: data.message || 'ok',
      data: data.data || null
    }
  } catch (e) {
    return { code: -1, message: `获取分区列表失败: ${(e as Error).message}`, data: null }
  }
}

/** 开播并获取推流码 */
export async function startLive(roomId: number, areaId: number): Promise<{ code: number; message: string; data: any }> {
  try {
    const { cookieStr, csrf } = getAuth()
    if (!csrf) {
      return { code: -1, message: '未获取到 csrf token，请确认已登录B站', data: null }
    }

    // 1. 获取时间戳
    const ts = await getTimestamp()

    // 2. 获取版本信息
    const { build, version } = await getVersionInfo(ts)

    // 3. 构建签名参数并发起开播请求
    const signedParams = appSign({
      room_id: String(roomId),
      platform: 'pc_link',
      area_v2: String(areaId),
      backup_stream: '0',
      csrf_token: csrf,
      csrf,
      build,
      version,
      ts
    })

    const query = new URLSearchParams(signedParams).toString()
    const resp = await fetchWithTimeout(
      `https://api.live.bilibili.com/room/v1/Room/startLive?${query}`,
      {
        method: 'POST',
        headers: liveHeaders(cookieStr)
      }
    )
    const data = await resp.json()

    return {
      code: data.code,
      message: data.message || 'ok',
      data: data.data || null
    }
  } catch (e) {
    return { code: -1, message: `开播失败: ${(e as Error).message}`, data: null }
  }
}

/** 关播 */
export async function stopLive(roomId: number): Promise<{ code: number; message: string; data: any }> {
  try {
    const { cookieStr, csrf } = getAuth()
    if (!csrf) {
      return { code: -1, message: '未获取到 csrf token，请确认已登录B站', data: null }
    }

    // 1. 获取时间戳
    const ts = await getTimestamp()

    // 2. 获取版本信息
    const { build, version } = await getVersionInfo(ts)

    // 3. 构建签名参数并发起关播请求
    const signedParams = appSign({
      room_id: String(roomId),
      platform: 'pc_link',
      csrf_token: csrf,
      csrf,
      build,
      version,
      ts
    })

    const query = new URLSearchParams(signedParams).toString()
    const resp = await fetchWithTimeout(
      `https://api.live.bilibili.com/room/v1/Room/stopLive?${query}`,
      {
        method: 'POST',
        headers: liveHeaders(cookieStr)
      }
    )
    const data = await resp.json()

    return {
      code: data.code,
      message: data.message || 'ok',
      data: data.data || null
    }
  } catch (e) {
    return { code: -1, message: `关播失败: ${(e as Error).message}`, data: null }
  }
}

/** 发送弹幕（支持表情参数）
 * @param dmType 显式指定 dm_type，用于 upower_ 格式表情（不需要 emoticon_unique）
 */
export async function sendDanmaku(
  roomId: number,
  msg: string,
  emoticonUnique?: string,
  emoticonId?: number,
  dmType?: number,
): Promise<{ code: number; message: string; data: any }> {
  try {
    const { cookieStr, csrf } = getAuth()
    if (!csrf) {
      return { code: -1, message: '未获取到 csrf token，请确认已登录B站', data: null }
    }

    const params: Record<string, string> = {
      bubble: '0',
      msg,
      color: '16777215',
      mode: '1',
      pool: '0',
      fontsize: '25',
      rnd: String(Math.floor(Date.now() / 1000)),
      roomid: String(roomId),
      csrf_token: csrf,
      csrf,
    }

    // dm_type 设置
    if (dmType !== undefined) {
      params.dm_type = String(dmType)
    } else if (emoticonUnique) {
      // 向后兼容：有 emoticon_unique 时自动设置 dm_type=1（official_XXX 格式）
      params.dm_type = '1'
    }

    if (emoticonUnique) {
      params.emoticon_unique = emoticonUnique
    }
    if (emoticonId) {
      params.emoticon_id = String(emoticonId)
    }

    const body = new URLSearchParams(params)

    const resp = await fetchWithTimeout('https://api.live.bilibili.com/msg/send', {
      method: 'POST',
      headers: {
        ...liveHeaders(cookieStr),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    })
    const data = await resp.json()

    return {
      code: data.code,
      message: data.message || 'ok',
      data: data.data || null
    }
  } catch (e) {
    console.error(`[LiveManager] 发送弹幕异常: ${(e as Error).message}`)
    return { code: -1, message: `发送弹幕失败: ${(e as Error).message}`, data: null }
  }
}

/** 获取直播间可用表情包（同时请求 pc 和 android 平台，合并去重） */
export async function getEmoticons(roomId: number): Promise<{ code: number; message: string; data: any }> {
  try {
    const { cookieStr } = getAuth()

    // 同时请求 pc 和 android 平台，android 平台通常返回更多表情包（如粉丝勋章表情等）
    const [pcResp, androidResp] = await Promise.all([
      fetchWithTimeout(
        `https://api.live.bilibili.com/xlive/web-ucenter/v2/emoticon/GetEmoticons?platform=pc&room_id=${roomId}`,
        { headers: liveHeaders(cookieStr) }
      ),
      fetchWithTimeout(
        `https://api.live.bilibili.com/xlive/web-ucenter/v2/emoticon/GetEmoticons?platform=android&room_id=${roomId}`,
        { headers: liveHeaders(cookieStr) }
      ),
    ])

    const [pcData, androidData] = await Promise.all([pcResp.json(), androidResp.json()])

    // 合并两个平台的表情包（按 pkg_id 去重）
    const mergedPackages: any[] = []
    const seenPkgIds = new Set<number>()

    const addPackages = (data: any, platform: string) => {
      if (data?.code === 0 && data?.data?.data) {
        const packages = data.data.data as any[]
        for (const pkg of packages) {
          if (!seenPkgIds.has(pkg.pkg_id)) {
            seenPkgIds.add(pkg.pkg_id)
            mergedPackages.push(pkg)
          }
        }
      } else {
        console.warn(`[LiveManager] 获取表情包失败 (platform=${platform}): code=${data?.code}, message=${data?.message}`)
      }
    }

    addPackages(pcData, 'pc')
    addPackages(androidData, 'android')

    return {
      code: 0,
      message: 'ok',
      data: { data: mergedPackages, fans_brand: pcData?.data?.fans_brand, purchase_url: pcData?.data?.purchase_url }
    }
  } catch (e) {
    console.error(`[LiveManager] 获取表情包异常: ${(e as Error).message}`)
    return { code: -1, message: `获取表情包失败: ${(e as Error).message}`, data: null }
  }
}

/** 获取用户个人拥有的评论表情包（可跨直播间使用） */
export async function getUserEmoticons(): Promise<{ code: number; message: string; packages: any[] }> {
  try {
    const { cookieStr } = getAuth()

    const resp = await fetchWithTimeout(
      'https://api.bilibili.com/x/emote/user/panel/web?business=reply',
      { headers: liveHeaders(cookieStr) }
    )
    const data = await resp.json()

    if (data.code !== 0) {
      console.warn(`[LiveManager] 获取用户表情包失败: code=${data.code}, message=${data.message}`)
      return { code: data.code, message: data.message, packages: [] }
    }

    const packages = data.data?.packages as any[] | undefined

    return { code: 0, message: 'ok', packages: packages || [] }
  } catch (e) {
    console.error(`[LiveManager] 获取用户表情包异常: ${(e as Error).message}`)
    return { code: -1, message: `获取用户表情包失败: ${(e as Error).message}`, packages: [] }
  }
}

/** 获取所有可用表情包（包括用户未拥有的，用于兜底表情解析） */
export async function getAllEmoticons(): Promise<{ code: number; message: string; packages: any[] }> {
  try {
    const { cookieStr } = getAuth()

    const resp = await fetchWithTimeout(
      'https://api.bilibili.com/x/emote/setting/panel?business=reply',
      { headers: liveHeaders(cookieStr) }
    )
    const data = await resp.json()

    if (data.code !== 0) {
      console.warn(`[LiveManager] 获取全量表情包失败: code=${data.code}, message=${data.message}`)
      return { code: data.code, message: data.message, packages: [] }
    }

    // 合并 user_panel_packages 和 all_packages
    // 注意：all_packages 优先（包含完整表情列表），user_panel_packages 补充
    const userPackages = data.data?.user_panel_packages as any[] | undefined
    const allPackages = data.data?.all_packages as any[] | undefined
    const merged: any[] = []

    const seenIds = new Set<number>()
    const addPkg = (pkg: any) => {
      if (pkg && !seenIds.has(pkg.id)) {
        seenIds.add(pkg.id)
        merged.push(pkg)
      }
    }
    // all_packages 优先：包含完整表情列表（如小黄脸的全部 [dog] 等）
    if (allPackages) {
      for (const pkg of allPackages) addPkg(pkg)
    }
    // user_panel_packages 补充：仅添加 all_packages 中不存在的包
    if (userPackages) {
      for (const pkg of userPackages) addPkg(pkg)
    }

    return { code: 0, message: 'ok', packages: merged }
  } catch (e) {
    console.error(`[LiveManager] 获取全量表情包异常: ${(e as Error).message}`)
    return { code: -1, message: `获取全量表情包失败: ${(e as Error).message}`, packages: [] }
  }
}

/** 获取用户粉丝数（公开接口，无需 Cookie）
 *  API: GET https://api.bilibili.com/x/relation/stat?vmid=<uid>
 */
export async function getFollowerCount(vmid: number): Promise<{ code: number; follower: number }> {
  try {
    const resp = await fetchWithTimeout(
      `https://api.bilibili.com/x/relation/stat?vmid=${vmid}`,
      { timeoutMs: 5000 }
    )
    const data = await resp.json()
    if (data?.code === 0 && data?.data?.follower != null) {
      return { code: 0, follower: data.data.follower }
    }
    console.warn(`[LiveManager] 获取粉丝数失败: code=${data?.code}, message=${data?.message}`)
    return { code: data?.code || -1, follower: -1 }
  } catch (e) {
    console.error(`[LiveManager] 获取粉丝数异常: ${(e as Error).message}`)
    return { code: -1, follower: -1 }
  }
}

/** 通过房间号获取直播间信息（公开接口）
 *  API: GET https://api.live.bilibili.com/room/v1/Room/get_info?room_id=<roomId>
 */
export async function getRoomInfoByRoomId(roomId: number): Promise<{ uid: number; roomId: number } | null> {
  try {
    const resp = await fetchWithTimeout(
      `https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${roomId}`,
      { timeoutMs: 5000 }
    )
    const data = await resp.json()
    if (data?.code === 0 && data?.data?.uid) {
      return { uid: data.data.uid, roomId: data.data.room_id || roomId }
    }
    return null
  } catch (e) {
    console.error(`[LiveManager] 获取房间信息失败: ${(e as Error).message}`)
    return null
  }
}

/** 获取直播间在线观众榜（高能榜）
 *  公开接口，无需 Cookie
 *  参考: https://api.live.bilibili.com/xlive/general-interface/v1/rank/queryContributionRank
 */
export async function getOnlineRank(
  ruid: number,
  roomId: number,
  page: number = 1,
  pageSize: number = 50,
): Promise<{ code: number; message: string; items: Array<{ uid: number; uname: string; face: string }> }> {
  try {
    const params = new URLSearchParams({
      ruid: String(ruid),
      room_id: String(roomId),
      page: String(page),
      page_size: String(pageSize),
      type: 'online_rank',
    })

    const resp = await fetchWithTimeout(
      `https://api.live.bilibili.com/xlive/general-interface/v1/rank/queryContributionRank?${params.toString()}`,
      { timeoutMs: 8000 }
    )
    const data = await resp.json()

    if (data.code !== 0) {
      console.warn(`[LiveManager] 获取在线观众榜失败: code=${data.code}, message=${data.message}`)
      return { code: data.code, message: data.message || '获取在线观众榜失败', items: [] }
    }

    const items = (data.data?.item || data.data?.list || []) as any[]
    const viewers = items.map((item: any) => ({
      uid: item.uid || 0,
      uname: item.uname || item.name || '',
      face: item.face || item.uinfo?.base?.face || '',
    })).filter((v: { uid: number; uname: string }) => v.uid > 0 && v.uname)

    return { code: 0, message: 'ok', items: viewers }
  } catch (e) {
    console.error(`[LiveManager] 获取在线观众榜异常: ${(e as Error).message}`)
    return { code: -1, message: `获取在线观众榜失败: ${(e as Error).message}`, items: [] }
  }
}