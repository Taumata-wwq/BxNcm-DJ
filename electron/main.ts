import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { store } from '../src/main/services/store'
import { stopObsServer } from '../src/main/services/obs'
import { destroyDanmakuWindow, registerDanmakuFixShortcutFromStore, unregisterDanmakuFixShortcut } from '../src/main/services/danmaku/danmaku-window'

// 修复 ffmpeg 视频解码兼容性问题（B站某些视频像素格式不受 Chromium GPU 解码支持）
// 仅禁用硬件视频解码，保留 GPU 渲染和合成（否则 video autoplay 会失败）
app.commandLine.appendSwitch('disable-accelerated-video-decode')
app.commandLine.appendSwitch('disable-accelerated-video-encode')

process.env.DIST = join(__dirname, '../dist')
process.env.PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST, '../public')

let mainWindow: BrowserWindow | null = null
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

// 关闭流程状态：防止竞态条件导致数据丢失
let isQuitting = false
let isRelaunching = false
const QUIT_TIMEOUT = 5000  // 渲染进程无响应时的超时保护

function getThemeBgColor(): string {
  const boot = store.loadBootData()
  return boot.theme === 'light' ? '#f0f0f0' : '#1e1e1e'
}

function loadWindowOptions() {
  const boot = store.loadBootData()
  const win: Electron.BrowserWindowConstructorOptions = {
    title: 'BxNcm DJ',
    width: 750,
    height: 500,
    minWidth: 700,
    minHeight: 500,
    frame: false,
    transparent: false,
    show: false,
    backgroundColor: getThemeBgColor(),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  }

  // 恢复窗口位置
  const pos = boot.windowPosition
  if (pos) {
    if (typeof pos.x === 'number') win.x = pos.x
    if (typeof pos.y === 'number') win.y = pos.y
    if (typeof pos.width === 'number' && pos.width >= 700) win.width = pos.width
    if (typeof pos.height === 'number' && pos.height >= 500) win.height = pos.height
  }

  // 恢复置顶和可缩放
  win.alwaysOnTop = boot.alwaysOnTop
  win.resizable = boot.resizable

  return win
}

function createWindow() {
  const options = loadWindowOptions()
  mainWindow = new BrowserWindow(options)

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(process.env.DIST!, 'index.html'))
  }

  // HTML 加载完成即显示窗口（含静态 loading 界面），不再等待 ready-to-show
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.show()
  })

  // 关闭流程：
  //   1. preventDefault 阻止窗口立即关闭
  //   2. 保存窗口位置（主进程侧，同步）
  //   3. 通知渲染进程保存设置（异步 IPC）
  //   4. 等待渲染进程完成保存后发送 app:save-done
  //   5. 收到后 flush 并退出；超时则强制退出
  mainWindow.on('close', (e) => {
    if (isQuitting || isRelaunching) return  // 已进入退出/重启流程，允许直接关闭
    e.preventDefault()
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition()
      const [w, h] = mainWindow.getSize()
      store.set('window_position', JSON.stringify({ x, y, width: w, height: h }))
      mainWindow.webContents.send('app:before-close')
    }
    // 超时保护：渲染进程崩溃或无响应时强制退出
    const quitTimer = setTimeout(() => {
      if (!isQuitting) {
        console.warn('[Main] 渲染进程未在超时前完成保存，强制退出')
        isQuitting = true
        destroyDanmakuWindow()
        store.flush()
        stopObsServer()
        app.exit(0)
      }
    }, QUIT_TIMEOUT)
    // 正常退出时清除超时定时器
    mainWindow?.once('closed', () => clearTimeout(quitTimer))
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  store.init()
  // 注册关闭流程监听器：渲染进程保存完成后通知主进程退出
  ipcMain.on('app:save-done', () => {
    if (!isQuitting) {
      isQuitting = true
      destroyDanmakuWindow()
      store.flush()
      stopObsServer()
      app.quit()
    }
  })

  // 重启应用：app.relaunch() 在 dev/prod 模式下均可用，配合 app.quit() 优雅退出
  // 不直接 exit(0)，避免杀死 dev server 进程树
  ipcMain.handle('app:relaunch', () => {
    store.set('window_position', '')
    store.flush()
    isRelaunching = true
    app.relaunch()
    app.quit()
  })

  createWindow()

  // 注册全局快捷键（固定弹幕窗口，由 danmaku-window.ts 统一管理）
  registerDanmakuFixShortcutFromStore()

  // 异步加载 IPC 模块
  import('../src/main/ipc').then(({ registerIpcHandlers }) => {
    registerIpcHandlers(mainWindow!)
  })
})

app.on('window-all-closed', () => {
  destroyDanmakuWindow()
  store.flush()
  stopObsServer()
  app.quit()
})

app.on('will-quit', () => {
  destroyDanmakuWindow()
  store.flush()
  stopObsServer()
  unregisterDanmakuFixShortcut()
})
