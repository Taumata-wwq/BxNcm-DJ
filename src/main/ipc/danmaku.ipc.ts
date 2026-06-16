import { BrowserWindow, ipcMain } from 'electron'
import { LiveWS } from '../services/danmaku/live-ws'
import { playlistManager } from '../services/player/playlist-manager'
import { store } from '../services/store'
import { sendDanmaku, getEmoticons, getUserEmoticons, getAllEmoticons } from '../services/live-manager'
import { prefetchNextSongs } from './player.ipc'
import { emoticonCache } from '../services/emoticon-cache'

let liveWS: LiveWS | null = null

export function registerDanmakuIpc(mainWindow: BrowserWindow) {
  ipcMain.handle('danmaku:connect', async (_, roomId: number) => {
    try {
      // 断开旧连接
      liveWS?.disconnect()
      liveWS = null

      const bilibiliUid = parseInt(store.get('bilibili_uid') || '0', 10)
      const ws = new LiveWS(roomId, bilibiliUid)
      ws.onStatusChange = (status) => {
        if (mainWindow.isDestroyed()) return
        mainWindow.webContents.send('danmaku:status-changed', status)
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
      const result = await getEmoticons(roomId)
      return result
    } catch (e: any) {
      return { code: -1, message: e.message, data: null }
    }
  })

  ipcMain.handle('danmaku:get-user-emoticons', async () => {
    try {
      const result = await getUserEmoticons()
      return result
    } catch (e: any) {
      return { code: -1, message: e.message, packages: [] }
    }
  })

  ipcMain.handle('danmaku:get-all-emoticons', async () => {
    try {
      const result = await getAllEmoticons()
      return result
    } catch (e: any) {
      return { code: -1, message: e.message, packages: [] }
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