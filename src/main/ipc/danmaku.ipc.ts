import { BrowserWindow, ipcMain } from 'electron'
import { LiveWS } from '../services/danmaku/live-ws'
import { playlistManager } from '../services/player/playlist-manager'
import { store } from '../services/store'
import { sendDanmaku, getEmoticons, getUserEmoticons, getAllEmoticons } from '../services/live-manager'
import { prefetchNextSongs } from './player.ipc'
import { emoticonCache } from '../services/emoticon-cache'
import { sendViewerJoinToDanmakuWindow, sendStatusToDanmakuWindow } from '../services/danmaku/danmaku-window'

let liveWS: LiveWS | null = null

// ========== 表情包主进程内存缓存 ==========
// 目的：弹幕窗口复用主窗口启动时已获取的表情包数据，避免重复网络请求
interface EmoticonCacheEntry {
  data: any
  timestamp: number
}
const emoticonDataCache = new Map<string, EmoticonCacheEntry>()
const EMOTICON_CACHE_TTL = 5 * 60 * 1000 // 5 分钟过期

function getCached(key: string): any | null {
  const entry = emoticonDataCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > EMOTICON_CACHE_TTL) {
    emoticonDataCache.delete(key)
    return null
  }
  return entry.data
}

function setCache(key: string, data: any) {
  emoticonDataCache.set(key, { data, timestamp: Date.now() })
}

export function registerDanmakuIpc(mainWindow: BrowserWindow) {
  ipcMain.handle('danmaku:connect', async (_, roomId: number) => {
    try {
      // 断开旧连接
      liveWS?.disconnect()
      liveWS = null

      const bilibiliUid = parseInt(store.get('bilibili_uid') || '0', 10)
      const ws = new LiveWS(roomId, bilibiliUid)
      ws.onStatusChange = (status) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('danmaku:status-changed', status)
        }
        // 广播到弹幕独立窗口，使其按钮状态同步
        sendStatusToDanmakuWindow(status)
      }
      ws.onSongRequest = (req) => {
        if (mainWindow.isDestroyed()) return
        playlistManager.insertTop(req.song)
        mainWindow.webContents.send('song:playlist-updated', playlistManager.getQueue())
        mainWindow.webContents.send('log:add', `${req.requesterName} 点歌: ${req.song.title}`)
        // 触发预缓存，确保新增歌曲能被下载到本地
        prefetchNextSongs(mainWindow, 3)
      }
      ws.onViewerJoin = (viewer) => {
        if (mainWindow.isDestroyed()) return
        mainWindow.webContents.send('danmaku:viewer-join', viewer)
        sendViewerJoinToDanmakuWindow(viewer)
      }
      liveWS = ws
      await ws.connect()
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('danmaku:disconnect', async () => {
    liveWS?.disconnect()
    liveWS = null
    return { success: true }
  })

  ipcMain.handle('danmaku:send', async (_, roomId: number, msg: string, emoticonUnique?: string, emoticonId?: number, dmType?: number) => {
    try {
      const result = await sendDanmaku(roomId, msg, emoticonUnique, emoticonId, dmType)
      return result
    } catch (e: any) {
      return { code: -1, message: e.message, data: null }
    }
  })

  ipcMain.handle('danmaku:get-emoticons', async (_, roomId: number) => {
    try {
      const cacheKey = `room_emoticons:${roomId}`
      const cached = getCached(cacheKey)
      if (cached) return cached

      const result = await getEmoticons(roomId)
      if (result?.code === 0) setCache(cacheKey, result)
      return result
    } catch (e: any) {
      return { code: -1, message: e.message, data: null }
    }
  })

  ipcMain.handle('danmaku:get-user-emoticons', async () => {
    try {
      const cacheKey = 'user_emoticons'
      const cached = getCached(cacheKey)
      if (cached) return cached

      const result = await getUserEmoticons()
      if (result?.code === 0) setCache(cacheKey, result)
      return result
    } catch (e: any) {
      return { code: -1, message: e.message, packages: [] }
    }
  })

  ipcMain.handle('danmaku:get-all-emoticons', async () => {
    try {
      const cacheKey = 'all_emoticons'
      const cached = getCached(cacheKey)
      if (cached) return cached

      const result = await getAllEmoticons()
      if (result?.code === 0) setCache(cacheKey, result)
      return result
    } catch (e: any) {
      return { code: -1, message: e.message, packages: [] }
    }
  })

  // 弹幕窗口专用：一次性获取所有表情包（优先使用主进程缓存，避免重复请求）
  ipcMain.handle('danmaku:get-cached-emoticons', async (_, roomId: number) => {
    try {
      const roomCacheKey = `room_emoticons:${roomId}`
      const cachedRoom = getCached(roomCacheKey)
      const cachedUser = getCached('user_emoticons')
      const cachedAll = getCached('all_emoticons')

      if (cachedRoom && cachedUser && cachedAll) {
        return {
          code: 0,
          roomEmoticons: cachedRoom,
          userEmoticons: cachedUser,
          allEmoticons: cachedAll,
          fromCache: true,
        }
      }

      const [roomResult, userResult, allResult] = await Promise.allSettled([
        cachedRoom ? Promise.resolve(cachedRoom) : getEmoticons(roomId),
        cachedUser ? Promise.resolve(cachedUser) : getUserEmoticons(),
        cachedAll ? Promise.resolve(cachedAll) : getAllEmoticons(),
      ])

      const roomData = roomResult.status === 'fulfilled' ? roomResult.value : null
      const userData = userResult.status === 'fulfilled' ? userResult.value : null
      const allData = allResult.status === 'fulfilled' ? allResult.value : null

      if (roomData?.code === 0) setCache(roomCacheKey, roomData)
      if (userData?.code === 0) setCache('user_emoticons', userData)
      if (allData?.code === 0) setCache('all_emoticons', allData)

      return {
        code: 0,
        roomEmoticons: roomData,
        userEmoticons: userData,
        allEmoticons: allData,
        fromCache: false,
      }
    } catch (e: any) {
      return { code: -1, message: e.message }
    }
  })

  // CSS 注入到 blivechat iframe：通过主进程在子 frame 中执行 JavaScript
  ipcMain.handle('danmaku:inject-css', async (_, css: string) => {
    try {
      const mainFrame = mainWindow.webContents.mainFrame
      // 遍历所有子 frame（包括 iframe），找到 blivechat 房间页面
      const allFrames = mainFrame.framesInSubtree
      for (const frame of allFrames) {
        try {
          const url = frame.url
          // 匹配 blivechat 房间页面的 frame
          if (url.includes('blive.chat/room/')) {
            await frame.executeJavaScript(`
              (function() {
                var styleId = 'blc-external-css';
                var style = document.getElementById(styleId);
                if (!style) {
                  style = document.createElement('style');
                  style.id = styleId;
                  document.head.appendChild(style);
                }
                style.textContent = ${JSON.stringify(css)};
              })();
            `)
            return { success: true }
          }
        } catch {
          // 某个 frame 可能尚未就绪，继续尝试下一个
        }
      }
      return { success: false, error: 'blivechat frame not found or not ready' }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // 表情包图片缓存：传入表情包数据，返回 URL 映射
  ipcMain.handle('emoticon:cache-images', async (_, packages: any[]) => {
    try {
      const urlMap = await emoticonCache.cachePackageImageUrls(packages)
      return { success: true, urlMap: Object.fromEntries(urlMap) }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // 清除表情包图片缓存
  ipcMain.handle('emoticon:clear-cache', async () => {
    try {
      emoticonCache.clearAll()
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })
}