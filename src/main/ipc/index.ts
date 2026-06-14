import { BrowserWindow, ipcMain, app, screen } from 'electron'
import { registerDanmakuIpc } from './danmaku.ipc'
import { registerPlayerIpc } from './player.ipc'
import { registerPlaylistIpc } from './playlist.ipc'
import { registerAuthIpc } from './auth.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerLiveIpc } from './live.ipc'
import { broadcastObsData, startObsServer, stopObsServer, getObsServerPort } from '../services/obs'
import { store } from '../services/store'

export function registerIpcHandlers(mainWindow: BrowserWindow) {
  registerDanmakuIpc(mainWindow)
  registerPlayerIpc(mainWindow)
  registerPlaylistIpc(mainWindow)
  registerAuthIpc(mainWindow)
  registerSettingsIpc()
  registerLiveIpc()

  ipcMain.handle('window:minimize', () => mainWindow.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow.close())
  ipcMain.handle('window:set-always-on-top', (_event, flag: boolean) => {
    mainWindow.setAlwaysOnTop(flag)
    return flag
  })
  ipcMain.handle('window:is-always-on-top', () => mainWindow.isAlwaysOnTop())
  ipcMain.handle('window:set-resizable', (_event, flag: boolean) => {
    mainWindow.setResizable(flag)
    if (flag) {
      // 恢复可缩放后，重新设置最小尺寸（setResizable(false) 会清除原生窗口最小尺寸约束）
      mainWindow.setMinimumSize(700, 500)
    }
    return flag
  })
  ipcMain.handle('window:is-resizable', () => mainWindow.isResizable())

  // 重启应用
  ipcMain.handle('app:relaunch', () => {
    if (!app.isPackaged) {
      // 开发模式：仅 reload 当前渲染进程
      mainWindow.reload()
    } else {
      // 打包模式：完整 relaunch
      app.relaunch()
      app.exit(0)
    }
  })

  // 打开 OBS 样式设置窗口（独立窗口，位置/大小持久化）
  ipcMain.handle('window:open-style', (_event, port: number) => {
    const DEFAULT_WIDTH = 1200
    const DEFAULT_HEIGHT = 700
    const MIN_WIDTH = 800
    const MIN_HEIGHT = 500

    // 从存储读取之前的位置/大小
    const saved = store.getStyleWindowBounds()

    let winOptions: Electron.BrowserWindowConstructorOptions = {
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      title: 'OBS 叠加层样式设置',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    }

    if (saved) {
      // 验证保存的位置是否在当前可用的显示器范围内
      const displays = screen.getAllDisplays()
      let visible = false
      for (const d of displays) {
        const bx = d.workArea
        // 窗口至少有 100x100 的可见区域才认为是有效的
        if (saved.x + saved.width > bx.x + 100 &&
            saved.x < bx.x + bx.width - 100 &&
            saved.y + saved.height > bx.y + 100 &&
            saved.y < bx.y + bx.height - 100) {
          visible = true
          break
        }
      }
      if (visible) {
        winOptions.x = saved.x
        winOptions.y = saved.y
        winOptions.width = Math.max(MIN_WIDTH, saved.width)
        winOptions.height = Math.max(MIN_HEIGHT, saved.height)
      }
    }

    const styleWin = new BrowserWindow(winOptions)
    styleWin.loadURL(`http://localhost:${port}/style`)

    // 位置/大小变化时防抖保存
    let saveTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleSave = () => {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        try {
          if (styleWin.isDestroyed()) return
          const [x, y] = styleWin.getPosition()
          const [width, height] = styleWin.getSize()
          store.setStyleWindowBounds({ x, y, width, height })
        } catch { /* ignore */ }
      }, 500)
    }

    styleWin.on('move', scheduleSave)
    styleWin.on('resize', scheduleSave)
    styleWin.on('closed', () => {
      if (saveTimer) clearTimeout(saveTimer)
    })

    return true
  })
  ipcMain.handle('window:open-devtools', () => {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  })

  // OBS 叠加层：渲染进程推送歌词数据到 WebSocket 客户端
  ipcMain.on('obs:broadcast-lyric', (_event, data: { text: string; translation: string }) => {
    broadcastObsData('lyric', {
      text: data.text || '',
      translation: data.translation || ''
    })
  })

  // OBS 叠加层动态启停
  ipcMain.handle('obs-overlay:toggle', async (_event, enabled: boolean) => {
    try {
      if (enabled) {
        const port = await startObsServer()
        return { port }
      } else {
        stopObsServer()
        return { port: 0 }
      }
    } catch (e) {
      console.error('[IPC] obs-overlay:toggle 失败:', (e as Error).message)
      return { port: 0, error: (e as Error).message }
    }
  })

  // 渲染进程加载完成后，由主界面触发 OBS 服务启动（仅当设置中已启用时）
  ipcMain.handle('obs-overlay:start-if-enabled', async () => {
    try {
      const port = await startObsServer()
      return { port }
    } catch (e) {
      console.error('[IPC] obs-overlay:start-if-enabled 失败:', (e as Error).message)
      return { port: 0, error: (e as Error).message }
    }
  })

  // OBS 叠加层：渲染进程推送队列数据到 WebSocket 客户端
  ipcMain.on('obs:broadcast-queue', (_event, data: { songs: Array<{ index: number; title: string; artist: string; requesterName: string }>; currentIndex: number }) => {
    broadcastObsData('queue', {
      songs: data.songs || [],
      currentIndex: data.currentIndex ?? 0
    })
  })

  // OBS 叠加层：渲染进程推送歌曲信息到 WebSocket 客户端
  ipcMain.on('obs:broadcast-songinfo', (_event, data: { title: string; artist: string; requester: string }) => {
    broadcastObsData('songinfo', {
      title: data.title || '',
      artist: data.artist || '',
      requester: data.requester || ''
    })
  })
}