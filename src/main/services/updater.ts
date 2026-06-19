import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { store } from './store'

let mainWindow: BrowserWindow | null = null

/** 从托盘等外部调用检查更新 */
export async function checkForUpdatesExternal() {
  if (!app.isPackaged) {
    console.log('[Updater] 开发模式，跳过更新检查')
    return
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (e) {
    console.warn('[Updater] 检查更新失败:', (e as Error)?.message)
  }
}

/** 从托盘菜单检查更新，返回结构化结果 */
export async function checkForUpdatesFromTray(): Promise<{ available: boolean; version?: string; error?: string }> {
  if (!app.isPackaged) {
    return { available: false }
  }
  try {
    const result = await autoUpdater.checkForUpdates()
    if (result && result.updateInfo) {
      const currentVersion = app.getVersion()
      const remoteVersion = result.updateInfo.version
      if (remoteVersion > currentVersion) {
        return { available: true, version: remoteVersion }
      }
    }
    return { available: false }
  } catch (e) {
    return { available: false, error: (e as Error)?.message }
  }
}

/** 从托盘菜单触发下载更新 */
export async function downloadUpdateExternal() {
  if (!app.isPackaged) return
  try {
    await autoUpdater.downloadUpdate()
  } catch (e) {
    console.warn('[Updater] 下载更新失败:', (e as Error)?.message)
  }
}

/** 初始化自动更新模块 */
export function initUpdater(window: BrowserWindow) {
  mainWindow = window

  // 不自动下载，由用户确认后下载
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // ====== IPC handlers（始终注册，开发模式也需响应） ======

  // IPC：手动检查更新
  ipcMain.handle('updater:check', async () => {
    if (!app.isPackaged) {
      return { status: 'not-available', message: '开发模式不支持更新检查' }
    }
    try {
      const result = await autoUpdater.checkForUpdates()
      // electron-updater 在无更新时返回 null；有更新时返回 UpdateCheckResult
      // 但某些版本即使版本号相同也会返回 result，需要手动比较版本号
      if (result && result.updateInfo) {
        const currentVersion = app.getVersion()
        const remoteVersion = result.updateInfo.version
        if (remoteVersion > currentVersion) {
          return { status: 'available', version: remoteVersion }
        }
      }
      return { status: 'not-available' }
    } catch (e) {
      return { status: 'error', error: (e as Error).message }
    }
  })

  // IPC：下载更新
  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // IPC：安装更新并重启
  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall()
    return true
  })

  // 事件通知到渲染进程（始终注册）
  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('updater:status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater:status', { status: 'available', version: info.version, releaseNotes: info.releaseNotes })
  })

  autoUpdater.on('update-not-available', (info) => {
    mainWindow?.webContents.send('updater:status', { status: 'not-available', version: info?.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('updater:status', {
      status: 'downloading',
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater:status', { status: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('updater:status', { status: 'error', error: err?.message })
  })

  // 仅在打包后执行自动更新检查
  if (!app.isPackaged) {
    console.log('[Updater] 开发模式，跳过自动更新检查')
    return
  }

  const boot = store.loadBootData()
  if (boot.autoUpdate) {
    // 启用自动更新：检查更新但不自动下载，由用户确认后下载
    // 延迟 3 秒检查，避免启动时网络拥堵
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.warn('[Updater] 启动检查失败:', err?.message)
      })
    }, 3000)
  }
}
