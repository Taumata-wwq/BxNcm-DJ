import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { store } from '../src/main/services/store'
import { stopObsServer } from '../src/main/services/obs'
import { destroyDanmakuWindow, registerDanmakuFixShortcutFromStore, unregisterDanmakuFixShortcut } from '../src/main/services/danmaku/danmaku-window'
import { createTray, destroyTray } from '../src/main/services/tray'
import { initUpdater } from '../src/main/services/updater'

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
let skipCloseToTray = false  // 跳过收起到托盘逻辑（用于托盘"退出"菜单）
let isInLoginPhase = false  // 用户处于登录界面时，强制退出而非收起到托盘
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
      webSecurity: false,
      backgroundThrottling: false  // 窗口被遮挡时继续渲染，避免视频黑屏
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
  //   1. 检查是否收起到托盘（closeToTray 设置）
  //   2. 若收起到托盘：隐藏窗口，不退出
  //   3. 若退出：preventDefault → 保存窗口位置 → 通知渲染进程保存 → 等待 → flush 并退出
  mainWindow.on('close', (e) => {
    if (isQuitting || isRelaunching) return  // 已进入退出/重启流程，允许直接关闭

    // 检查是否收起到托盘
    if (!skipCloseToTray) {
      const boot = store.loadBootData()
      if (boot.closeToTray && !isInLoginPhase) {
        e.preventDefault()
        if (boot.closeToTrayPrompt) {
          // 发送 IPC 到渲染进程显示自定义对话框
          mainWindow?.webContents.send('dialog:show-close-to-tray')
        } else {
          // 直接隐藏到托盘
          mainWindow?.hide()
        }
        return
      }
    }

    // 跳过收起到托盘的标志已使用，重置
    skipCloseToTray = false

    // 正常退出流程
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

/** 处理渲染进程返回的关闭到托盘对话框结果 */
ipcMain.on('dialog:close-to-tray-result', (_, result: { action: string; remember: boolean }) => {
  if (result.remember) {
    store.set('app_closeToTrayPrompt', JSON.stringify(false))
  }
  if (result.action === 'tray') {
    mainWindow?.hide()
  } else {
    skipCloseToTray = true
    mainWindow?.close()
  }
})

/** 渲染进程通知登录阶段状态：登录界面时无视 closeToTray 强制退出 */
ipcMain.on('app:set-login-phase', (_event, inLogin: boolean) => {
  isInLoginPhase = inLogin
})

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

  // 创建系统托盘（传入退出回调，跳过收起到托盘逻辑）
  if (mainWindow) {
    createTray(mainWindow, () => {
      skipCloseToTray = true
      mainWindow?.close()
    })
  }

  // 初始化自动更新
  if (mainWindow) {
    initUpdater(mainWindow)
  }

  // 注册全局快捷键（固定弹幕窗口，由 danmaku-window.ts 统一管理）
  registerDanmakuFixShortcutFromStore()

  // 异步加载 IPC 模块
  import('../src/main/ipc').then(({ registerIpcHandlers }) => {
    registerIpcHandlers(mainWindow!)
  })
})

app.on('window-all-closed', () => {
  destroyDanmakuWindow()
  destroyTray()
  store.flush()
  stopObsServer()
  app.quit()
})

app.on('will-quit', () => {
  destroyDanmakuWindow()
  destroyTray()
  store.flush()
  stopObsServer()
  unregisterDanmakuFixShortcut()
})
