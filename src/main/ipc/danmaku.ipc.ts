import { BrowserWindow, ipcMain } from 'electron'
import { LiveWS } from '../services/danmaku/live-ws'
import { playlistManager } from '../services/player/playlist-manager'
import { store } from '../services/store'
import { sendDanmaku, getEmoticons, getUserEmoticons, getAllEmoticons } from '../services/live-manager'

let liveWS: LiveWS | null = null

export function registerDanmakuIpc(mainWindow: BrowserWindow) {
  ipcMain.handle('danmaku:connect', async (_, roomId: number) => {
    try {
      const bilibiliUid = parseInt(store.get('bilibili_uid') || '0', 10)
      liveWS = new LiveWS(roomId, bilibiliUid)
      liveWS.onStatusChange = (status) => {
        if (mainWindow.isDestroyed()) return
        mainWindow.webContents.send('danmaku:status-changed', status)
      }
      liveWS.onSongRequest = (req) => {
        if (mainWindow.isDestroyed()) return
        playlistManager.insertTop(req.song)
        mainWindow.webContents.send('song:playlist-updated', playlistManager.getQueue())
        mainWindow.webContents.send('log:add', `${req.requesterName} 点歌: ${req.song.title}`)
      }
      liveWS.onDanmakuMessage = (msg) => {
        if (mainWindow.isDestroyed()) return
        mainWindow.webContents.send('danmaku:message', msg)
      }
      liveWS.onViewerJoin = (viewer) => {
        if (mainWindow.isDestroyed()) return
        mainWindow.webContents.send('danmaku:viewer-join', viewer)
      }
      await liveWS.connect()
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
}