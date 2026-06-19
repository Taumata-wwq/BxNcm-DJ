import { app, Tray, nativeImage, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { store } from './store'
import { isDanmakuWindowOpen, closeDanmakuWindow, openDanmakuWindow, toggleDanmakuWindowFixed, getDanmakuWindowConfig } from './danmaku/danmaku-window'
import { getObsServerPort } from './obs'
import { checkForUpdatesExternal, checkForUpdatesFromTray, downloadUpdateExternal } from './updater'

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let menuWindow: BrowserWindow | null = null
let onQuitCallback: (() => void) | null = null

/** 创建系统托盘 */
export function createTray(window: BrowserWindow, onQuit: () => void) {
  mainWindow = window
  onQuitCallback = onQuit

  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.ico')
    : join(__dirname, '../../build/icon.ico')

  const image = nativeImage.createFromPath(iconPath)
  const resizedImage = image.resize({ width: 16, height: 16 })

  tray = new Tray(resizedImage)
  tray.setToolTip('BxNcm DJ')

  tray.on('click', () => {
    closeMenuWindow()
    if (mainWindow?.isVisible()) {
      mainWindow?.hide()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })

  tray.on('right-click', (_event, bounds) => {
    closeMenuWindow()
    showTrayMenu(bounds)
  })
}

/** 显示自定义托盘菜单（小型 BrowserWindow，匹配项目 UI 风格） */
function showTrayMenu(bounds: Electron.Rectangle) {
  const boot = store.loadBootData()
  const isDark = boot.theme !== 'light'
  const accent = boot.accentColor || '#00b5e5'

  // 主题色
  const bg = isDark ? '#252526' : '#f0f0f0'
  const borderColor = isDark ? '#3e3e42' : '#d4d4d4'
  const textColor = isDark ? '#ccc' : '#333'
  const hoverBg = isDark ? '#37373d' : '#e0e0e0'
  const separatorColor = isDark ? '#3e3e42' : '#d4d4d4'
  const mutedColor = isDark ? '#888' : '#999'

  // 动态状态
  const danmakuOpen = isDanmakuWindowOpen()
  const danmakuConfig = getDanmakuWindowConfig()
  const danmakuFixed = danmakuConfig.isFixed
  const obsPort = getObsServerPort()
  const obsStyleOpen = obsPort > 0

  // 菜单项
  const items = [
    { id: 'show', icon: 'monitor', label: '显示主窗口', cls: 'show' },
    { id: 'separator', label: '' },
    { id: 'danmaku-toggle', icon: 'message',
      label: danmakuOpen ? '关闭弹幕弹窗' : '打开弹幕弹窗', cls: '' },
    ...(danmakuOpen ? [
      { id: 'danmaku-fix', icon: 'pin',
        label: danmakuFixed ? '解锁弹幕窗口' : '固定弹幕窗口', cls: '' },
    ] : []),
    { id: 'obs-style', icon: 'sliders',
      label: obsStyleOpen ? 'OBS 叠加层样式设置' : 'OBS 样式设置 (未启动)', cls: '', disabled: !obsStyleOpen },
    { id: 'separator', label: '' },
    { id: 'check-update', icon: 'download', label: '检查更新', cls: '' },
    { id: 'center', icon: 'maximize', label: '窗口居中', cls: '' },
    { id: 'separator', label: '' },
    { id: 'quit', icon: 'x', label: '退出', cls: 'quit' },
  ]

  // 根据菜单项数量动态计算高度
  const visibleItems = items.filter(i => {
    // 过滤掉 disabled 的 obs-style 项（如果未启动）
    if (i.id === 'obs-style' && !obsStyleOpen) return false
    return true
  })
  const menuWidth = 170
  const menuHeight = visibleItems.length * 36 - 80

  let selectedAction = ''

  menuWindow = new BrowserWindow({
    width: menuWidth,
    height: menuHeight,
    frame: false,
    transparent: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // 定位
  const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
  const { x: waX, y: waY, width: waW } = display.workArea

  let x = Math.round(bounds.x + bounds.width / 2 - menuWidth / 2)
  let y = Math.round(bounds.y - menuHeight - 4)
  if (y < waY) y = Math.round(bounds.y + bounds.height + 4)
  if (x < waX) x = waX
  if (x + menuWidth > waX + waW) x = waX + waW - menuWidth

  menuWindow.setPosition(x, y)

  // 生成菜单项 HTML
  function buildItemHtml(item: typeof items[0]) {
    if (item.id === 'separator') {
      return `<div class="separator"></div>`
    }
    const iconSvg = getIconSvg(item.icon || '')
    const disabledAttr = item.disabled ? ' class="menu-item disabled"' : ` class="menu-item ${item.cls || ''}"`
    return `<div${disabledAttr} id="btn-${item.id}">
      ${iconSvg}
      ${item.label}
    </div>`
  }

  // 生成点击处理 JS
  function buildClickJs(item: typeof items[0]) {
    if (item.id === 'separator' || item.disabled) return ''
    // 检查更新：不关闭菜单，通过 console.log 通知主进程异步处理
    if (item.id === 'check-update') {
      return `document.getElementById('btn-${item.id}').addEventListener('click', function() {
      console.log('tray-menu:${item.id}');
    });`
    }
    return `document.getElementById('btn-${item.id}').addEventListener('click', function() {
      console.log('tray-menu:${item.id}');
      window.close();
    });`
  }

  const itemsHtml = visibleItems.map(buildItemHtml).join('\n')
  const clickJs = visibleItems.map(buildClickJs).filter(Boolean).join('\n')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, 'Microsoft YaHei', sans-serif;
  font-size: 13px;
  background: ${bg};
  border: 1px solid ${borderColor};
  color: ${textColor};
  user-select: none;
  -webkit-user-select: none;
  overflow: hidden;
  padding: 2px 0;
}
.menu-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px;
  cursor: pointer;
  transition: background 0.1s;
  height: 34px;
}
.menu-item:hover { background: ${hoverBg}; }
.menu-item.show { color: ${accent}; }
.menu-item.show:hover { color: ${accent}; filter: brightness(1.2); }
.menu-item.quit:hover { color: #e74c3c; }
.menu-item.disabled { color: ${mutedColor}; cursor: default; }
.menu-item.disabled:hover { background: transparent; }
.menu-item svg { flex-shrink: 0; opacity: 0.7; stroke: currentColor; }
.menu-item:hover svg { opacity: 1; }
.menu-item.disabled:hover svg { opacity: 0.7; }
.separator { height: 1px; background: ${separatorColor}; margin: 2px 8px; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
${itemsHtml}
</body>
</html>`

  menuWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  menuWindow.once('ready-to-show', () => {
    menuWindow?.show()
  })

  menuWindow.on('blur', () => {
    closeMenuWindow()
  })

  menuWindow.webContents.on('dom-ready', () => {
    menuWindow?.webContents.executeJavaScript(clickJs)
  })

  menuWindow.webContents.on('console-message', (_event, _level, message) => {
    if (message.startsWith('tray-menu:')) {
      const action = message.replace('tray-menu:', '')
      if (action === 'check-update') {
        // 不关闭菜单，异步检查更新并动态更新菜单项
        handleTrayCheckUpdate(menuWindow!)
      } else if (action === 'download-update') {
        // 下载更新：关闭菜单，在主窗口显示进度
        selectedAction = 'download-update'
        closeMenuWindow()
      } else {
        selectedAction = action
      }
    }
  })

  menuWindow.on('closed', () => {
    handleMenuAction(selectedAction)
    menuWindow = null
  })
}

/** 托盘菜单内检查更新：不关闭菜单，动态更新菜单项文本 */
async function handleTrayCheckUpdate(menuWin: BrowserWindow) {
  if (menuWin.isDestroyed()) return

  // 立即更新为"检查中..."
  updateMenuItemHtml(menuWin, 'btn-check-update', getIconSvg('loader'), '检查中...', true)

  const result = await checkForUpdatesFromTray()

  if (menuWin.isDestroyed()) return

  if (result.error) {
    updateMenuItemHtml(menuWin, 'btn-check-update', getIconSvg('x'), '检查失败', true)
    return
  }

  if (result.available && result.version) {
    // 有更新：变为"下载更新 v1.x.x"，可点击
    const version = result.version
    const iconSvg = getIconSvg('download')
    const js = `
      (function() {
        var el = document.getElementById('btn-check-update');
        if (!el) return;
        el.innerHTML = \`${iconSvg}\` + '下载更新 v${version}';
        el.classList.remove('disabled');
        el.style.pointerEvents = '';
        el.style.opacity = '';
        el.id = 'btn-download-update';
        el.onclick = function() { console.log('tray-menu:download-update'); window.close(); };
      })();
    `
    menuWin.webContents.executeJavaScript(js).catch(() => {})
  } else {
    // 无更新：显示"已是最新版本"
    updateMenuItemHtml(menuWin, 'btn-check-update', getIconSvg('check'), '已是最新版本', true)
  }
}

/** 通过 executeJavaScript 更新菜单项内容 */
function updateMenuItemHtml(menuWin: BrowserWindow, id: string, iconSvg: string, label: string, disabled: boolean) {
  const data = JSON.stringify({ icon: iconSvg, label, disabled })
  const js = `
    (function() {
      var data = ${data};
      var el = document.getElementById('${id}');
      if (!el) return;
      el.innerHTML = data.icon + data.label;
      if (data.disabled) {
        el.classList.add('disabled');
        el.style.pointerEvents = 'none';
      } else {
        el.classList.remove('disabled');
        el.style.pointerEvents = '';
      }
    })();
  `
  menuWin.webContents.executeJavaScript(js).catch(() => {})
}

/** 执行托盘菜单操作 */
function handleMenuAction(action: string) {
  if (!action) return

  switch (action) {
    case 'show':
      mainWindow?.show()
      mainWindow?.focus()
      break
    case 'quit':
      onQuitCallback?.()
      break
    case 'danmaku-toggle':
      if (isDanmakuWindowOpen()) {
        closeDanmakuWindow()
      } else {
        // 从 store 读取上次的弹幕窗口配置来打开
        const danmakuUrl = store.get('app_danmakuWindowUrl') || ''
        const danmakuCss = store.get('app_danmakuWindowCss') || ''
        const danmakuBg = store.get('app_danmakuWindowBgColor') || 'rgba(0,0,0,0.3)'
        const danmakuOpacity = parseInt(store.get('app_danmakuWindowOpacity') || '100', 10)
        if (danmakuUrl) {
          openDanmakuWindow(danmakuUrl, danmakuCss, danmakuBg, danmakuOpacity)
          // 通知渲染进程弹窗已打开，同步设置中的开关状态
          mainWindow?.webContents.send('danmaku-window:opened')
        }
      }
      break
    case 'danmaku-fix':
      toggleDanmakuWindowFixed()
      break
    case 'obs-style': {
      const port = getObsServerPort()
      if (port > 0) {
        // 在主进程中打开新窗口
        const { BrowserWindow: BW, screen: scr } = require('electron')
        const saved = store.getStyleWindowBounds()
        const display = scr.getPrimaryDisplay()
        const wa = display.workArea
        const sx = saved ? Math.max(wa.x, saved.x) : Math.round(wa.x + (wa.width - 1200) / 2)
        const sy = saved ? Math.max(wa.y, saved.y) : Math.round(wa.y + (wa.height - 700) / 2)
        const styleWin = new BW({
          x: sx, y: sy,
          width: saved ? Math.max(385, saved.width) : 1200,
          height: saved ? Math.max(450, saved.height) : 700,
          minWidth: 385, minHeight: 450,
          title: 'OBS 叠加层样式设置',
          autoHideMenuBar: true,
          webPreferences: { nodeIntegration: false, contextIsolation: true },
        })
        styleWin.loadURL(`http://localhost:${port}/style`)
        // 保存位置
        let saveTimer: ReturnType<typeof setTimeout> | null = null
        const scheduleSave = () => {
          if (saveTimer) clearTimeout(saveTimer)
          saveTimer = setTimeout(() => {
            try {
              if (styleWin.isDestroyed()) return
              const [sx, sy] = styleWin.getPosition()
              const [sw, sh] = styleWin.getSize()
              store.setStyleWindowBounds({ x: sx, y: sy, width: sw, height: sh })
            } catch { /* ignore */ }
          }, 500)
        }
        styleWin.on('move', scheduleSave)
        styleWin.on('resize', scheduleSave)
        styleWin.on('closed', () => { if (saveTimer) clearTimeout(saveTimer) })
      }
      break
    }
    case 'check-update':
      // 托盘菜单内的检查更新已在 handleTrayCheckUpdate 中处理
      // 此分支仅在外部调用时触发
      checkForUpdatesExternal()
      break
    case 'download-update':
      // 下载更新并显示主窗口
      downloadUpdateExternal()
      mainWindow?.show()
      mainWindow?.focus()
      break
    case 'center':
      mainWindow?.center()
      break
    default:
      break
  }
}

/** 关闭菜单窗口 */
function closeMenuWindow() {
  if (menuWindow && !menuWindow.isDestroyed()) {
    menuWindow.close()
    menuWindow = null
  }
}

/** 销毁托盘 */
export function destroyTray() {
  closeMenuWindow()
  if (tray) {
    tray.destroy()
    tray = null
  }
}

/** SVG 图标 */
function getIconSvg(name: string): string {
  const icons: Record<string, string> = {
    monitor: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="16" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    message: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    pin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`,
    sliders: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
    download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>`,
    loader: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`,
    maximize: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,3 21,3 21,9"/><polyline points="9,21 3,21 3,15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
    x: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  }
  return icons[name] || ''
}