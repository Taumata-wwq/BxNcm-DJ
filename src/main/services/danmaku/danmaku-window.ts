// ---------- 弹幕独立窗口服务 ----------
// 参考 OBS 叠加层服务架构：主进程管理状态，通过 IPC 广播到渲染进程

import { BrowserWindow, screen, globalShortcut } from 'electron'
import { join } from 'path'
import { store } from '../store'

// ===== 运行时状态（类 OBS state 模式） =====

let danmakuWin: BrowserWindow | null = null
let danmakuCss: string = ''
let danmakuUrl: string = ''
let danmakuBgColor: string = 'rgba(0,0,0,0.3)'
let danmakuOpacity: number = 100
let isFixed: boolean = false
let showBorder: boolean = true
let saveTimer: ReturnType<typeof setTimeout> | null = null
let danmakuConnected: boolean = false
let currentRoomId: number = 0

const DANMAKU_WIN_DEFAULTS = { width: 500, height: 400 }

// ===== 窗口创建 =====

function getWrapperHtmlPath(): string {
  if (process.env.PUBLIC) {
    return join(process.env.PUBLIC, 'danmaku-window.html')
  }
  return join(process.env.DIST!, 'danmaku-window.html')
}

function buildDanmakuWindowOptions(): Electron.BrowserWindowConstructorOptions {
  const saved = store.getDanmakuWindowBounds()
  const preloadPath = join(__dirname, 'preload.js')

  const opts: Electron.BrowserWindowConstructorOptions = {
    width: DANMAKU_WIN_DEFAULTS.width,
    height: DANMAKU_WIN_DEFAULTS.height,
    minWidth: 200,
    minHeight: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: !isFixed,
    skipTaskbar: true,
    hasShadow: false,
    roundedCorners: true,
    backgroundColor: '#00000000',
    opacity: danmakuOpacity / 100,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  }

  if (saved) {
    const displays = screen.getAllDisplays()
    let visible = false
    for (const d of displays) {
      const bx = d.workArea
      if (
        saved.x + saved.width > bx.x + 100 &&
        saved.x < bx.x + bx.width - 100 &&
        saved.y + saved.height > bx.y + 100 &&
        saved.y < bx.y + bx.height - 100
      ) {
        visible = true
        break
      }
    }
    if (visible) {
      opts.x = saved.x
      opts.y = saved.y
      opts.width = Math.max(200, saved.width)
      opts.height = Math.max(300, saved.height)
    }
  }

  return opts
}

function scheduleSaveBounds() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      if (!danmakuWin || danmakuWin.isDestroyed()) return
      const [x, y] = danmakuWin.getPosition()
      const [width, height] = danmakuWin.getSize()
      store.setDanmakuWindowBounds({ x, y, width, height })
    } catch {
      /* ignore */
    }
  }, 500)
}

// ===== 配置广播（参考 OBS broadcastObsData） =====

function sendConfig() {
  if (!danmakuWin || danmakuWin.isDestroyed()) return

  const roomId = getRoomId()
  danmakuWin.webContents.send('danmaku-window:config', {
    url: danmakuUrl,
    roomId,
    bgColor: danmakuBgColor,
    css: danmakuCss,
    borderColor: getBorderColorRgba(),
    showBorder: showBorder,
    isFixed: isFixed,
    connected: danmakuConnected,
  })
}

// ===== CSS 注入到 iframe =====

async function injectCssIntoIframe() {
  if (!danmakuWin || danmakuWin.isDestroyed()) return
  if (!danmakuCss) return

  const cssJson = JSON.stringify(danmakuCss)
  try {
    const mainFrame = danmakuWin.webContents.mainFrame
    const allFrames = mainFrame.framesInSubtree
    for (const frame of allFrames) {
      try {
        if (frame.url.includes('blive.chat/room/')) {
          await frame.executeJavaScript(`
            (function() {
              var styleId = 'blc-external-css';
              var style = document.getElementById(styleId);
              if (!style) {
                style = document.createElement('style');
                style.id = styleId;
                document.head.appendChild(style);
              }
              style.textContent = ${cssJson};
            })();
          `)
        }
      } catch {
        /* frame 可能尚未就绪 */
      }
    }
  } catch {
    /* ignore */
  }
}

// ===== 边框样式 =====

function getAccentColor(): string {
  try {
    const raw = store.get('app_accentColor')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'string' && parsed.startsWith('#')) return parsed
    }
  } catch {
    /* ignore */
  }
  return '#00b5e5'
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.length === 4 ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3] : hex
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function getBorderColorRgba(): string {
  return hexToRgba(getAccentColor(), 0.5)
}

function injectBorderCss() {
  if (!danmakuWin || danmakuWin.isDestroyed()) return

  const borderColor = getBorderColorRgba()

  // 固定态：header 和观众栏设置 pointer-events:none 防止光标变化和文本选择。
  // iframe 区域不在此设置 pointer-events:none，因为其上方有透明遮罩层
  // （.dm-iframe-overlay）负责捕获鼠标事件，确保父文档始终收到 mousemove。
  const pointerEventsRule = isFixed
    ? '.dm-header,.dm-header *,.dm-viewer-list,.dm-viewer-list *{pointer-events:none!important}'
    : ''

  const js = `
    (function() {
      var el = document.getElementById('blc-chrome-css');
      if (!el) {
        el = document.createElement('style');
        el.id = 'blc-chrome-css';
        document.head.appendChild(el);
      }
      if (${showBorder}) {
        el.textContent = 'html{box-sizing:border-box;border:2px solid ${borderColor}!important;height:100%;border-radius:8px;overflow:hidden}.dm-header{-webkit-app-region:drag!important}${pointerEventsRule}';
      } else {
        el.textContent = 'html{border:none!important;border-radius:0!important}.dm-header{-webkit-app-region:drag!important}${pointerEventsRule}';
      }
    })();
  `
  danmakuWin.webContents.executeJavaScript(js).catch(() => {})
}

// ===== 辅助 =====

function getRoomId(): number {
  return currentRoomId
}

function sendToMainWindow(channel: string, ...args: unknown[]) {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (win !== danmakuWin && !win.isDestroyed()) {
      win.webContents.send(channel, ...args)
      return
    }
  }
}

// ===== 公共 API =====

export function openDanmakuWindow(url: string, css: string, bgColor?: string, opacity?: number): boolean {
  danmakuUrl = url
  danmakuCss = css
  if (bgColor !== undefined) danmakuBgColor = bgColor
  if (opacity !== undefined) danmakuOpacity = Math.max(5, Math.min(100, opacity))

  if (danmakuWin && !danmakuWin.isDestroyed()) {
    danmakuWin.setOpacity(danmakuOpacity / 100)
    danmakuWin.webContents.once('did-finish-load', () => {
      sendConfig()
      injectBorderCss()
      injectCssIntoIframe()
    })
    if (danmakuWin.webContents.isLoading() === false) {
      sendConfig()
      injectBorderCss()
      injectCssIntoIframe()
    }
    return true
  }

  const opts = buildDanmakuWindowOptions()
  danmakuWin = new BrowserWindow(opts)
  danmakuWin.setOpacity(danmakuOpacity / 100)
  danmakuWin.setAlwaysOnTop(true, 'screen-saver')

  // 如果创建时已处于固定态，同步设置鼠标穿透
  if (isFixed) {
    danmakuWin.setIgnoreMouseEvents(true, { forward: true })
  }

  const wrapperPath = getWrapperHtmlPath()
  danmakuWin.loadFile(wrapperPath)

  danmakuWin.webContents.on('did-finish-load', () => {
    sendConfig()
    injectBorderCss()
    setTimeout(() => injectCssIntoIframe(), 2000)
  })

  danmakuWin.webContents.on('did-frame-finish-load', () => {
    injectCssIntoIframe()
  })

  danmakuWin.on('move', () => scheduleSaveBounds())
  danmakuWin.on('resize', () => scheduleSaveBounds())

  danmakuWin.on('closed', () => {
    if (saveTimer) clearTimeout(saveTimer)
    danmakuWin = null
  })

  return true
}

export function closeDanmakuWindow(): boolean {
  if (danmakuWin && !danmakuWin.isDestroyed()) {
    danmakuWin.close()
    danmakuWin = null
  }
  return true
}

export function setDanmakuWindowFixed(fixed: boolean): boolean {
  isFixed = fixed
  if (!danmakuWin || danmakuWin.isDestroyed()) {
    sendToMainWindow('danmaku-window:fixed-changed', fixed)
    return false
  }

  danmakuWin.setResizable(!fixed)
  try {
    danmakuWin.setMovable(!fixed)
  } catch {
    /* ignore */
  }

  // 固定时：使用 setIgnoreMouseEvents(true, { forward: true }) 实现窗口级鼠标穿透，
  // 仅 -webkit-app-region: no-drag 元素接收事件，其余全部穿透，无需渲染层动态切换。
  if (fixed) {
    danmakuWin.setIgnoreMouseEvents(true, { forward: true })
  } else {
    danmakuWin.setIgnoreMouseEvents(false)
  }

  injectBorderCss()
  sendConfig()
  sendToMainWindow('danmaku-window:fixed-changed', fixed)
  return true
}

/** 从渲染层控制鼠标穿透：固定时启用（仅 no-drag 元素可交互），解锁时禁用 */
export function setMousePassthrough(passthrough: boolean): void {
  if (!isFixed && passthrough) return
  if (!danmakuWin || danmakuWin.isDestroyed()) return

  if (passthrough) {
    danmakuWin.setIgnoreMouseEvents(true, { forward: true })
  } else {
    danmakuWin.setIgnoreMouseEvents(false)
  }
}

export function toggleDanmakuWindowFixed(): boolean {
  return setDanmakuWindowFixed(!isFixed)
}

export function setDanmakuWindowShowBorder(show: boolean): boolean {
  showBorder = show
  if (!danmakuWin || danmakuWin.isDestroyed()) return false
  injectBorderCss()
  return true
}

export function setDanmakuWindowBgColor(bgColor: string): boolean {
  danmakuBgColor = bgColor
  if (!danmakuWin || danmakuWin.isDestroyed()) return false
  sendConfig()
  return true
}

export function setDanmakuWindowOpacity(opacity: number): boolean {
  danmakuOpacity = Math.max(5, Math.min(100, opacity))
  if (!danmakuWin || danmakuWin.isDestroyed()) return false
  danmakuWin.setOpacity(danmakuOpacity / 100)
  return true
}

export function updateDanmakuWindowCss(css: string): boolean {
  danmakuCss = css
  if (!danmakuWin || danmakuWin.isDestroyed()) return false
  injectCssIntoIframe()
  return true
}

export function updateDanmakuWindowUrl(url: string): boolean {
  danmakuUrl = url
  if (!danmakuWin || danmakuWin.isDestroyed()) return false
  sendConfig()
  setTimeout(() => injectCssIntoIframe(), 2000)
  return true
}

export function destroyDanmakuWindow() {
  if (danmakuWin && !danmakuWin.isDestroyed()) {
    danmakuWin.close()
  }
  danmakuWin = null
}

export function isDanmakuWindowOpen(): boolean {
  return danmakuWin !== null && !danmakuWin.isDestroyed()
}

/** 获取当前弹幕窗口配置（pull 模式，确保渲染进程一定能拿到配置） */
export function getDanmakuWindowConfig() {
  return {
    url: danmakuUrl,
    roomId: getRoomId(),
    bgColor: danmakuBgColor,
    css: danmakuCss,
    borderColor: getBorderColorRgba(),
    showBorder: showBorder,
    isFixed: isFixed,
    connected: danmakuConnected,
  }
}

/** 广播观众数据到弹幕窗口（参考 OBS broadcastObsData 模式） */
export function sendViewerJoinToDanmakuWindow(viewer: { uid: number; uname: string; avatarUrl: string }): void {
  if (danmakuWin && !danmakuWin.isDestroyed()) {
    danmakuWin.webContents.send('danmaku:viewer-join', viewer)
  }
}

/** 广播连接状态到弹幕窗口 */
export function sendStatusToDanmakuWindow(status: { connected: boolean; roomId: number }): void {
  danmakuConnected = status.connected
  if (status.roomId > 0) currentRoomId = status.roomId
  if (danmakuWin && !danmakuWin.isDestroyed()) {
    danmakuWin.webContents.send('danmaku:status-changed', status)
  }
}

// ===== 全局快捷键：固定/解锁弹幕窗口（统一管理，避免 main.ts 和 ipc/index.ts 双重注册） =====

let currentFixShortcut: string | null = null

/** 从 store 读取快捷键并注册（启动时调用） */
export function registerDanmakuFixShortcutFromStore(): void {
  try {
    const raw = store.get('app_danmakuWindowFixShortcut')
    let shortcut = 'Alt+B'
    if (raw) {
      try { const parsed = JSON.parse(raw); if (typeof parsed === 'string') shortcut = parsed } catch { /* ignore */ }
    }
    registerDanmakuFixShortcut(shortcut)
  } catch (e) {
    console.warn('[DanmakuWindow] 全局快捷键加载异常:', e)
  }
}

/** 注册/更新全局快捷键：先注销旧快捷键，再注册新的 */
export function registerDanmakuFixShortcut(shortcut: string): void {
  if (currentFixShortcut) {
    globalShortcut.unregister(currentFixShortcut)
  }
  if (!shortcut) {
    currentFixShortcut = null
    return
  }

  try {
    const ret = globalShortcut.register(shortcut, () => {
      toggleDanmakuWindowFixed()
    })
    if (ret) {
      currentFixShortcut = shortcut
    } else {
      console.warn(`[DanmakuWindow] 全局快捷键注册失败: ${shortcut}`)
    }
  } catch (e) {
    console.warn(`[DanmakuWindow] 全局快捷键异常: ${shortcut}`, e)
  }
}

/** 注销当前快捷键（退出时调用） */
export function unregisterDanmakuFixShortcut(): void {
  if (currentFixShortcut) {
    globalShortcut.unregister(currentFixShortcut)
    currentFixShortcut = null
  }
}