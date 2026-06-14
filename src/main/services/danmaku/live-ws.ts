import WebSocket from 'ws'
import * as zlib from 'zlib'
import * as crypto from 'crypto'
import { store } from '../store'
import { playlistManager } from '../player/playlist-manager'
import { neteaseApi } from '../music/netease-api'
import { bilibiliAuth } from '../music/bilibili-video'
import { getDanmuServerInfo, type DanmuServerInfo } from '../../utils/wbi'
import { getOnlineRank } from '../live-manager'
import { fetchWithTimeout } from '../../utils/fetch'
import type { DanmakuStatus, ParsedSongRequest, DanmakuMessage } from '../../../shared/types/danmaku'
import type { SongItem } from '../../../shared/types/song'


// 点歌指令正则
const NETEASE_PATTERN = /^点歌\s*[:：]?\s*(.+?)(?:\s+|\s*[-—–]\s*)(.+?)$/      // "点歌 歌名 歌手"
const NETEASE_PATTERN_SIMPLE = /^点歌\s*[:：]?\s*(.{2,}?)$/                    // "点歌 歌名"（仅歌名，至少2字符）
const NETEASE_ID_PATTERN = /^点歌\s*[:：]?\s*(\d{4,})$/                        // "点歌 123456"（歌曲ID）
const BILI_PATTERN = /^点歌\s*[:：]?\s*(BV[\w]{10})/i                          // "点歌 BV..."

interface HostInfo { host: string; wss_port: number; ws_port: number }

export class LiveWS {
  private ws: WebSocket | null = null
  private roomId: number
  private uid: number
  private token = ''
  private hosts: HostInfo[] = []
  private hostIndex = 0
  private heartbeatTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private lastRequestMap = new Map<number, number>() // uid -> timestamp
  private lastSongMap = new Map<string, number>() // songId -> timestamp (keyword hash pre-check)
  private lastExactSongMap = new Map<string, number>() // real song.id -> timestamp (post-search exact check)
  private intentionalClose = false
  private retryCount = 0
  private maxRetries = 20
  private anchorUid = 0
  private initialViewersFetched = false

  onStatusChange: ((status: DanmakuStatus) => void) | null = null
  onSongRequest: ((req: { song: SongItem; requesterName: string; requesterUid: number }) => void) | null = null
  onDanmakuMessage: ((msg: DanmakuMessage) => void) | null = null
  onViewerJoin: ((viewer: { uid: number; uname: string; avatarUrl: string }) => void) | null = null

  constructor(roomId: number, uid: number = 0) {
    this.roomId = roomId
    this.uid = uid
  }

  async init(): Promise<DanmuServerInfo | null> {
    try {
      const info = await getDanmuServerInfo(this.roomId)
      if (info && info.hosts.length > 0) {
        this.token = info.token
        this.hosts = info.hosts
        return info
      } else {
        console.error('[LiveWS] init 失败: 未获取到有效 token 或 hosts')
      }
    } catch (e) {
      console.error('[LiveWS] init 失败:', (e as Error).message)
    }
    return null
  }

  async connect() {
    if (this.ws) {
      try { this.ws.close() } catch {}
      this.ws = null
    }

    if (this.hosts.length === 0) {
      const info = await this.init()
      if (!info) {
        // 回退：30秒后重试
        this.scheduleReconnect()
        return
      }
    }

    const host = this.hosts[this.hostIndex % this.hosts.length]
    const wsUrl = `wss://${host.host}:${host.wss_port}/sub`

    try {
      this.ws = new WebSocket(wsUrl)
      this.ws.on('open', () => this.onOpen())
      this.ws.on('message', (data: Buffer) => this.onMessage(data))
      this.ws.on('close', (code: number) => this.onClose(code))
      this.ws.on('error', (err: Error) => {
        console.error('[LiveWS] 连接错误:', err.message)
      })
    } catch (e) {
      console.error('[LiveWS] 连接失败:', (e as Error).message)
      this.scheduleReconnect()
    }
  }

  private onOpen() {
    this.retryCount = 0
    this.hostIndex = 0
    this.initialViewersFetched = false
    // 发送鉴权包 (参考 Bilibili-Live-API-master)
    const authPayload = JSON.stringify({
      uid: this.uid,
      roomid: this.roomId,
      protover: 3,
      buvid: crypto.randomBytes(16).toString('hex').slice(0, 32),
      support_ack: true,
      queue_uuid: crypto.randomBytes(4).toString('hex'),
      scene: '',
      platform: 'web',
      type: 2,
      key: this.token
    })
    this.ws?.send(this.buildPacket(7, authPayload))
    this.startHeartbeat()
    this.notifyStatus(true)
  }

  private onClose(code: number) {
    this.stopHeartbeat()
    if (this.intentionalClose) {
      this.notifyStatus(false)
      return
    }
    // 尝试下一个 host (fallback)
    this.hostIndex++
    if (this.hostIndex < this.hosts.length) {
      // 尝试 fallback host
      setTimeout(() => this.connect(), 500)
      return
    }
    // 所有 host 都失败，指数退避重连
    if (this.retryCount < this.maxRetries) {
      this.retryCount++
      this.hostIndex = 0
      const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000)
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null
        this.connect().catch((e) => { console.error('[LiveWS] 重连失败:', (e as Error).message) })
      }, delay)
    }
  }

  private scheduleReconnect() {
    const delay = 5000
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect().catch((e) => { console.error('[LiveWS] 重连失败:', (e as Error).message) })
    }, delay)
  }

  private notifyStatus(connected: boolean) {
    if (this.onStatusChange) {
      this.onStatusChange({ connected, roomId: this.roomId })
    }
  }

  disconnect() {
    this.intentionalClose = true
    this.stopHeartbeat()
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    this.ws?.close()
    this.ws = null
    this.retryCount = 0
    this.hostIndex = 0
    this.notifyStatus(false)
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(this.buildPacket(2, ''))
      }
      // 定期清理过期冷却记录（超过10分钟的条目）
      const now = Date.now()
      for (const [key, ts] of this.lastRequestMap) {
        if (now - ts > 600_000) this.lastRequestMap.delete(key)
      }
      for (const [key, ts] of this.lastSongMap) {
        if (now - ts > 600_000) this.lastSongMap.delete(key)
      }
      for (const [key, ts] of this.lastExactSongMap) {
        if (now - ts > 600_000) this.lastExactSongMap.delete(key)
      }
    }, 30000)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null }
  }

  private msgCount = 0

  private onMessage(buffer: Buffer) {
    try {
      this.msgCount++
      const packets = this.parsePackets(buffer)
      for (const packet of packets) {
        if (packet.op === 8) {
          // 鉴权成功
          this.retryCount = 0
          // 连接成功后拉取在线观众榜
          this.fetchInitialViewers()
        } else if (packet.op === 3) {
          // 心跳响应 (人气值)
        } else if (packet.op === 5) {
          this.handleMessages(packet.body)
        }
      }
    } catch (e) {
      console.error('[LiveWS] 消息处理失败:', (e as Error).message, (e as Error).stack)
    }
  }

  private parsePackets(buffer: Buffer): { op: number; body: any[] }[] {
    const results: { op: number; body: any[] }[] = []
    let offset = 0
    while (offset < buffer.length) {
      if (offset + 16 > buffer.length) break
      const packetLen = buffer.readUInt32BE(offset)
      const headerLen = buffer.readUInt16BE(offset + 4)
      const ver = buffer.readUInt16BE(offset + 6)
      const op = buffer.readUInt32BE(offset + 8)
      const data = buffer.subarray(offset + headerLen, offset + packetLen)

      if (op === 5) {
        try {
          if (ver === 0) {
            results.push({ op, body: parseBody(data.toString('utf-8')) })
          } else if (ver === 2) {
            const decompressed = zlib.inflateSync(data)
            results.push(...this.parsePackets(decompressed))
          } else if (ver === 3) {
            const decompressed = zlib.brotliDecompressSync(data)
            results.push(...this.parsePackets(decompressed))
          }
        } catch (e) {
          console.error(`[LiveWS] 数据包解压失败 ver=${ver} op=${op}:`, (e as Error).message)
        }
      } else if (op === 3) {
        // 心跳响应 (人气值)
      } else if (op === 8) {
        // 认证回包
        results.push({ op, body: [] })
      }

      offset += packetLen
    }
    return results
  }

  // ======== 点歌处理 + 弹幕/礼物消息转发 ========
  private cmdLogCounts = new Map<string, number>()
  private handleMessages(bodies: any[]) {
    for (const body of bodies) {
      if (!body || !body.cmd) continue

      const cmd = body.cmd as string
      const cnt = (this.cmdLogCounts.get(cmd) || 0) + 1
      this.cmdLogCounts.set(cmd, cnt)

      // 普通弹幕
      if (cmd.startsWith('DANMU_MSG')) {
        this.handleDanmakuMsg(body)
        continue
      }

      // 弹幕聚合（相同内容合并展示）
      if (cmd.startsWith('DANMU_AGGREGATION')) {
        const data = body.data
        if (data && this.onDanmakuMessage) {
          this.onDanmakuMessage({
            type: 'danmaku',
            uid: data.uid || 0,
            uname: data.uname || '',
            text: data.msg || data.text || '',
            num: data.aggregation_num || 1,
          })
        }
        continue
      }

      // 弹幕互动（连击等）
      if (cmd.startsWith('DM_INTERACTION')) {
        const data = body.data
        if (data && this.onDanmakuMessage) {
          this.onDanmakuMessage({
            type: 'danmaku',
            uid: data.uid || 0,
            uname: data.uname || '',
            text: data.msg || '',
          })
        }
        continue
      }

      // 礼物
      if (cmd.startsWith('SEND_GIFT')) {
        const data = body.data
        if (data && this.onDanmakuMessage) {
          // 提取勋章
          const medalInfo = data.medal_info
          const medal = medalInfo?.medal_name
            ? { name: String(medalInfo.medal_name), level: Number(medalInfo.medal_level || 0) }
            : undefined

          this.onDanmakuMessage({
            type: 'gift',
            uid: data.uid || 0,
            uname: data.uname || '',
            avatarUrl: data.face || '',
            gift_name: data.giftName || '',
            gift_icon_url: data.gift_info?.img_basic || '',
            num: data.num || 0,
            medal,
            privilege_type: data.guard_level || 0,
          })
        }
        continue
      }

      // 连击礼物
      if (cmd.startsWith('COMBO_SEND')) {
        const data = body.data
        if (data && this.onDanmakuMessage) {
          const medalInfo = data.medal_info
          const medal = medalInfo?.medal_name
            ? { name: String(medalInfo.medal_name), level: Number(medalInfo.medal_level || 0) }
            : undefined

          this.onDanmakuMessage({
            type: 'combo_gift',
            uid: data.uid || 0,
            uname: data.uname || '',
            avatarUrl: data.face || '',
            gift_name: data.gift_name || '',
            gift_icon_url: data.gift_info?.img_basic || '',
            combo_num: data.combo_num || 0,
            total_num: data.total_num || 0,
            medal,
            privilege_type: data.guard_level || 0,
          })
        }
        continue
      }

      // 进入/关注/分享直播间（exact match，避免匹配到 INTERACT_WORD_V2）
      if (cmd === 'INTERACT_WORD') {
        const data = body.data
        if (data && this.onDanmakuMessage) {
          const msgType = data.msg_type || 0
          let desc = ''
          if (msgType === 1) desc = '进入了直播间'
          else if (msgType === 2) desc = '关注了直播间'
          else if (msgType === 3) desc = '分享了直播间'
          else if (msgType === 4) desc = '使用了高能激励'
          else desc = '互动了'

          // 提取头像（参考 blivechat-dev: uinfo.base.face）
          const avatarUrl = data.uinfo?.base?.face || ''

          // 提取勋章
          const fansMedal = data.fans_medal
          const medal = fansMedal && fansMedal.medal_name
            ? { name: String(fansMedal.medal_name), level: Number(fansMedal.medal_level || 0) }
            : undefined

          // 特权类型
          const privilegeType = data.privilege_type || 0

          this.onDanmakuMessage({
            type: 'interact',
            uid: data.uid || 0,
            uname: data.uname || '',
            text: `${data.uname || ''} ${desc}`,
            avatarUrl: avatarUrl || undefined,
            medal,
            privilege_type: privilegeType,
            timestamp: data.timestamp ? data.timestamp * 1000 : undefined,
          })

          // 通知观众加入
          if (this.onViewerJoin && data.uname) {
            this.onViewerJoin({
              uid: data.uid || 0,
              uname: data.uname,
              avatarUrl: avatarUrl || '',
            })
          }
        }
        continue
      }

      // 观众进入/关注/分享 V2（更详细的观众信息）
      if (cmd.startsWith('INTERACT_WORD_V2')) {
        const data = body.data
        if (data && this.onViewerJoin && data.uname) {
          this.onViewerJoin({
            uid: data.uid || 0,
            uname: data.uname,
            avatarUrl: data.uinfo?.base?.face || data.face || '',
          })
        }
        continue
      }

      // 在线观众排行 V3（高能榜）
      // 实测字段: data.list / data.rank_list / data.item (数组)
      if (cmd === 'ONLINE_RANK_V3') {
        const data = body.data
        if (data && this.onViewerJoin) {
          const list = data.list || data.rank_list || data.item || data.items || []
          if (Array.isArray(list)) {
            for (const item of list) {
              const viewerUname = item.uname || item.name || ''
              const viewerUid = item.uid || 0
              if (viewerUname && viewerUid > 0) {
                this.onViewerJoin({
                  uid: viewerUid,
                  uname: viewerUname,
                  avatarUrl: item.face || item.uinfo?.base?.face || '',
                })
              }
            }
          }
        }
        continue
      }

      // 欢迎VIP进入
      if (cmd === 'WELCOME') {
        const data = body.data
        if (data && data.uname && this.onDanmakuMessage) {
          this.onDanmakuMessage({
            type: 'interact',
            uid: data.uid || 0,
            uname: data.uname,
            text: `${data.uname} 进入了直播间`,
            avatarUrl: data.face || undefined,
          })
        }
        continue
      }

      // 欢迎房管
      if (cmd === 'WELCOME_GUARD') {
        const data = body.data
        if (data && data.username && this.onDanmakuMessage) {
          this.onDanmakuMessage({
            type: 'interact',
            uid: data.uid || 0,
            uname: data.username,
            text: `${data.username} 进入了直播间`,
            avatarUrl: data.face || undefined,
          })
        }
        continue
      }

      // 进场特效
      if (cmd.startsWith('ENTRY_EFFECT')) {
        const data = body.data
        if (data && data.copy_writing && this.onDanmakuMessage) {
          const text = (data.copy_writing as string).replace(/<%|%>/g, '')
          this.onDanmakuMessage({
            type: 'entry_effect',
            uid: data.uid || 0,
            uname: '',
            text,
            avatarUrl: data.face || undefined,
          })
        }
        continue
      }

      // 上舰 (USER_TOAST_MSG_V2 - 参考 blivechat-dev 的 userToastV2Callback)
      if (cmd === 'USER_TOAST_MSG_V2') {
        const data = body.data
        // 官方的评论栏不会显示 source==2 的消息
        if (data && data.option?.source !== 2 && this.onDanmakuMessage) {
          const senderUinfo = data.sender_uinfo || {}
          const guardInfo = data.guard_info || {}
          const payInfo = data.pay_info || {}
          const username = senderUinfo.base?.name || ''
          const uid = senderUinfo.uid || 0
          const guardLevel = guardInfo.guard_level || 0
          const guardName = guardLevel === 1 ? '总督' : guardLevel === 2 ? '提督' : guardLevel === 3 ? '舰长' : '大航海'
          const num = payInfo.num || 1
          const unit = payInfo.unit || '月'

          this.onDanmakuMessage({
            type: 'guard',
            uid,
            uname: username,
            guard_level: guardLevel,
            guard_name: guardName,
            num,
            text: `${username} 开通了${guardName} x${num}${unit}`,
            // USER_TOAST_MSG_V2 没有直接提供 face URL，后续可异步获取
          })
        }
        continue
      }

      // 上舰 (GUARD_BUY - 兼容旧格式)
      if (cmd === 'GUARD_BUY') {
        const data = body.data
        if (data && this.onDanmakuMessage) {
          const guardLevel = data.guard_level || 0
          const guardName = guardLevel === 1 ? '总督' : guardLevel === 2 ? '提督' : guardLevel === 3 ? '舰长' : '大航海'
          this.onDanmakuMessage({
            type: 'guard',
            uid: data.uid || 0,
            uname: data.username || '',
            guard_level: guardLevel,
            guard_name: guardName,
            num: data.num || 1,
            text: `${data.username || ''} 开通了${guardName} x${data.num || 1}`,
          })
        }
        continue
      }

      // SC 醒目留言
      if (cmd.startsWith('SUPER_CHAT_MESSAGE')) {
        const data = body.data
        if (data && this.onDanmakuMessage) {
          const medalInfo = data.medal_info
          const medal = medalInfo?.medal_name
            ? { name: String(medalInfo.medal_name), level: Number(medalInfo.medal_level || 0) }
            : undefined

          this.onDanmakuMessage({
            type: 'super_chat',
            uid: data.uid || 0,
            uname: data.user_info?.uname || '',
            avatarUrl: data.user_info?.face || '',
            text: data.message || '',
            price: data.price || 0,
            medal,
            privilege_type: data.user_info?.guard_level || 0,
          })
        }
        continue
      }

      // 点赞
      if (cmd === 'LIKE_INFO_V3_CLICK') {
        const data = body.data
        if (data && this.onDanmakuMessage) {
          this.onDanmakuMessage({
            type: 'like',
            uid: data.uid || 0,
            uname: data.uname || '',
            text: `${data.uname || ''} 点赞了`,
            avatarUrl: data.uinfo?.base?.face || undefined,
            medal: data.fans_medal?.medal_name
              ? { name: String(data.fans_medal.medal_name), level: Number(data.fans_medal.medal_level || 0) }
              : undefined,
            privilege_type: data.guard_level || 0,
          })
        }
        continue
      }
    }
  }

  private handleDanmakuMsg(body: any) {
    const info = body.info
    if (!info || !info[1]) return

    const text = String(info[1]).trim()
    const user: any[] = info[2] || []
    const uname = String(user[1] || '')
    const uid = Number(user[0] || 0)

    // 提取头像URL（info[0][15] 是 modeInfo，其中 user.base.face 是头像）
    const modeInfo = info[0][15]
    const avatarUrl = modeInfo?.user?.base?.face || ''

    // 提取表情URL（info[0][13] 是 emoticon 对象，url 字段是表情图片地址）
    const emoticonUrl = info[0][13]?.url || null

    // 特权类型 (info[7])：0=无, 1=舰长, 2=提督, 3=总督
    const privilegeType = Number(info[7] || 0)

    // 转发弹幕消息到前端
    const medalInfo = info[3]
    if (this.onDanmakuMessage) {
      this.onDanmakuMessage({
        type: 'danmaku',
        uid,
        uname,
        text,
        avatarUrl,
        emoticonUrl: emoticonUrl || undefined,
        medal: medalInfo && medalInfo.length > 0
          ? { name: String(medalInfo[1] || ''), level: Number(medalInfo[0] || 0) }
          : undefined,
        privilege_type: privilegeType,
      })
    }

    if (uname === 'BxNcm DJ') return // 忽略自己的消息

    const parsed = this.parseCommand(text)
    if (!parsed) return

      // 检查点歌冷却
      // 读取设置（逐键格式，与登录信息保存模式一致）
      const getSettingNum = (key: string, fallback: number): number => {
        const raw = store.get(`app_${key}`)
        if (raw !== undefined) {
          const v = parseInt(raw, 10)
          if (!isNaN(v)) return v
        }
        return fallback
      }
      const cooldown = getSettingNum('songCooldown', 600)
      const userCooldownS = getSettingNum('userCooldown', 30)

      // 1) 用户冷却检查
      const lastUserTime = this.lastRequestMap.get(uid) || 0
      if (Date.now() - lastUserTime < userCooldownS * 1000) return

      // 立即设置用户冷却（修复竞态窗口：防止搜索期间的重复点歌绕过冷却）
      this.lastRequestMap.set(uid, Date.now())

      // 2) 歌曲冷却预检（使用 keyword+artist 哈希作为近似 key，避免无意义的搜索 API 调用）
      const songKey = `${parsed.type}:${parsed.keyword}:${parsed.artist || ''}`
      const lastSongPrecheck = this.lastSongMap.get(songKey) || 0
      if (Date.now() - lastSongPrecheck < cooldown * 1000) {
        // 预检失败 → 撤回用户冷却（不消耗用户点歌机会）
        this.lastRequestMap.delete(uid)
        return
      }

      this.processSongRequest(parsed, uname, uid).then(song => {
        if (!song) {
          // 搜索失败 → 撤回用户冷却
          this.lastRequestMap.delete(uid)
          return
        }
        // 3) 精确歌曲冷却检查（使用搜索结果中的真实 song.id）
        const lastExactTime = this.lastExactSongMap.get(song.id) || 0
        if (Date.now() - lastExactTime < cooldown * 1000) {
          // 精确冷却未过 → 撤回用户冷却
          this.lastRequestMap.delete(uid)
          return
        }

          // 通过所有检查 → 记录冷却并投递
        this.lastSongMap.set(songKey, Date.now())
        this.lastExactSongMap.set(song.id, Date.now())

        // 点歌人信息写入
        song.requesterName = uname
        song.requesterUid = uid

        if (this.onSongRequest) {
          this.onSongRequest({ song, requesterName: uname, requesterUid: uid })
        }
      })
  }

  parseCommand(text: string): ParsedSongRequest | null {
    // B站: "点歌 BVxxxxxxx"
    const mBili = text.match(BILI_PATTERN)
    if (mBili) {
      return { type: 'bilibili', keyword: mBili[1] }
    }

    // 网易云歌曲ID: "点歌 1234567"
    const mId = text.match(NETEASE_ID_PATTERN)
    if (mId) {
      return { type: 'netease', keyword: mId[1] }
    }

    // 网易云完整格式: "点歌 歌名 歌手" 或 "点歌：歌名 - 歌手"
    const mNet = text.match(NETEASE_PATTERN)
    if (mNet) {
      return { type: 'netease', keyword: mNet[1].trim(), artist: mNet[2].trim() }
    }

    // 网易云仅歌名: "点歌 歌名"
    const mSimple = text.match(NETEASE_PATTERN_SIMPLE)
    if (mSimple) {
      return { type: 'netease', keyword: mSimple[1].trim() }
    }

    return null
  }

  async processSongRequest(
    parsed: ParsedSongRequest,
    uname: string,
    uid: number
  ): Promise<SongItem | null> {
    if (parsed.type === 'netease') {
      // 与控制台搜索逻辑保持一致：使用 cloudsearch
      const keyword = parsed.artist
        ? `${parsed.keyword} ${parsed.artist}`
        : parsed.keyword
      return neteaseApi.searchByKeyword(keyword)
    } else if (parsed.type === 'bilibili') {
      return bilibiliAuth.getVideoInfo(parsed.keyword)
    }
    return null
  }

  // ======== 工具方法 ========

  private buildPacket(op: number, body: string): Buffer {
    const bodyBuf = Buffer.from(body, 'utf-8')
    const packetLen = 16 + bodyBuf.length
    const header = Buffer.alloc(16)
    header.writeUInt32BE(packetLen, 0)
    header.writeUInt16BE(16, 4)
    header.writeUInt16BE(1, 6)
    header.writeUInt32BE(op, 8)
    header.writeUInt32BE(1, 12)
    return Buffer.concat([header, bodyBuf])
  }

  /** 从 HTTP API 拉取当前在线观众榜（高能榜），并在认证成功后调用一次 */
  private async fetchInitialViewers() {
    if (this.initialViewersFetched) return
    this.initialViewersFetched = true

    try {
      // 获取主播 UID
      if (this.anchorUid === 0) {
        const roomResp = await fetchWithTimeout(
          `https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${this.roomId}`,
          { timeoutMs: 8000 }
        )
        const roomData = await roomResp.json()
        if (roomData?.code === 0 && roomData?.data?.uid) {
          this.anchorUid = roomData.data.uid
        } else {
          console.warn('[LiveWS] 无法获取主播UID，跳过观众拉取')
          return
        }
      }

      // 拉取在线观众榜
      const result = await getOnlineRank(this.anchorUid, this.roomId, 1, 50)
      if (result.code === 0 && result.items.length > 0) {
        for (const item of result.items) {
          if (this.onViewerJoin) {
            this.onViewerJoin({
              uid: item.uid,
              uname: item.uname,
              avatarUrl: item.face || '',
            })
          }
        }
      }
    } catch (e) {
      console.error('[LiveWS] 拉取初始观众失败:', (e as Error).message)
    }
  }
}
function parseBody(data: string): any[] {
  const results: any[] = []
  // 先尝试作为整体解析（匹配 Rust 参考实现）
  try {
    const obj = JSON.parse(data)
    if (typeof obj === 'object' && obj !== null) results.push(obj)
  } catch {
    // 如果整体解析失败，回退到按 \x00 分隔（兼容旧版协议）
    const parts = data.split('\x00')
    for (const part of parts) {
      try {
        const obj = JSON.parse(part)
        if (typeof obj === 'object' && obj !== null) results.push(obj)
      } catch (_) { /* 忽略空片段 */ }
    }
  }
  return results
}