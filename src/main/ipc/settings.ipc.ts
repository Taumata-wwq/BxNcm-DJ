import { ipcMain } from 'electron'
import { store } from '../services/store'
import { DEFAULT_SETTINGS } from '../../shared/constants/defaults'
import { broadcastObsData, getObsServerPort } from '../services/obs'

const APP_PREFIX = 'app_'
const OLD_SETTINGS_KEY = 'app_settings'
const MIGRATION_DONE_KEY = 'app__migration_done'

/**
 * 设置持久化：采用与登录信息一致的逐键保存模式
 * 
 * 登录信息保存模式（已验证可靠，单键单次 saveToDisk）：
 *   store.set('bilibili_cookie', JSON.stringify(cookieMap))
 *   settingsRepo.set('bilibili_uname', result.uname)
 * 
 * 设置保存模式（逐键但批量落盘，减少 I/O）：
 *   settingsRepo.setBatch([['app_theme', '"dark"'], ['app_accentColor', '"#00b5e5"'], ...])
 */

function migrateOldFormat(): boolean {
  // 已迁移过的跳过
  if (store.get(MIGRATION_DONE_KEY)) return false

  const old = store.get(OLD_SETTINGS_KEY)
  if (!old) return false
  try {
    const parsed = JSON.parse(old)
    const entries: [string, string][] = Object.entries(parsed).map(
      ([key, value]) => [`${APP_PREFIX}${key}`, JSON.stringify(value)]
    )
    // 批量写入（一次落盘）+ 删除旧键
    store.setBatch(entries)
    store.delete(OLD_SETTINGS_KEY)
    store.set(MIGRATION_DONE_KEY, '1')
    return true
  } catch (e) {
    console.error('[SettingsIPC] 旧格式迁移失败:', (e as Error).message)
    return false
  }
}

export function registerSettingsIpc() {
  // 启动时迁移旧格式
  const migrated = migrateOldFormat()

  // 无论是否迁移成功，当前所有设置键已在 store 中

  // ====== 三阶段加载 ======

  /** 阶段1：启动数据 — 主题色、窗口信息（最先读取，用于加载窗口） */
  ipcMain.handle('boot:load', () => {
    try {
      return store.loadBootData()
    } catch (e) {
      console.error('[SettingsIPC] 读取启动数据失败:', (e as Error).message)
      return { theme: 'dark', accentColor: '#00b5e5', alwaysOnTop: false, resizable: true, windowPosition: null }
    }
  })

  /** 阶段2：应用数据 — 除 boot/style 外的软件本体设置 */
  ipcMain.handle('app:load', () => {
    try {
      return store.loadAppData()
    } catch (e) {
      console.error('[SettingsIPC] 读取应用数据失败:', (e as Error).message)
      return {}
    }
  })

  /** 阶段3：样式数据 — HTTP style 界面数据（最后读取，预留供启动 style 界面使用） */
  ipcMain.handle('style:load', () => {
    try {
      return store.loadStyleData()
    } catch (e) {
      console.error('[SettingsIPC] 读取样式数据失败:', (e as Error).message)
      return {}
    }
  })

  // ====== 原有设置读写 ======

  ipcMain.handle('settings:get', () => {
    try {
      const kvMap: Record<string, string> = {}
      const all = store.getAll()
      for (const [k, v] of Object.entries(all)) {
        if (k.startsWith(APP_PREFIX)) kvMap[k] = v
      }
      const appKeyCount = Object.keys(kvMap).length

      if (appKeyCount === 0) {
        return DEFAULT_SETTINGS
      }

      // 将逐键值合并为设置对象
      const settings: any = { ...DEFAULT_SETTINGS }
      for (const [fullKey, jsonValue] of Object.entries(kvMap)) {
        const key = fullKey.slice(APP_PREFIX.length) // 去掉 app_ 前缀
        try {
          settings[key] = JSON.parse(jsonValue)
        } catch {
          settings[key] = jsonValue
        }
      }
      return settings
    } catch (e) {
      console.error('[SettingsIPC] 读取设置失败:', (e as Error).message)
      return DEFAULT_SETTINGS
    }
  })

  ipcMain.handle('settings:save', (_event, entries: [string, string][]) => {
    try {
      store.setBatch(entries)
      return { success: true }
    } catch (e) {
      console.error('[SettingsIPC] 保存设置失败:', (e as Error).message)
      return { success: false }
    }
  })

  ipcMain.handle('store:reset-data', () => {
    try {
      store.resetAllData()
      return { success: true }
    } catch (e) {
      console.error('[SettingsIPC] 重置数据失败:', (e as Error).message)
      return { success: false }
    }
  })

  // OBS 叠加层样式
  ipcMain.handle('obs-overlay:get-style', (_event, page: string) => {
    const raw = store.get(`obs_${page}_style`)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })

  ipcMain.handle('obs-overlay:save-style', (_event, page: string, config: Record<string, unknown>) => {
    try {
      store.set(`obs_${page}_style`, JSON.stringify(config))
      // 如果 OBS 服务器在运行，广播样式变更
      try {
        broadcastObsData('style', { page, ...config })
      } catch {}
      return { success: true }
    } catch (e) {
      console.error('[SettingsIPC] 保存叠加层样式失败:', (e as Error).message)
      return { success: false }
    }
  })

  ipcMain.handle('obs-overlay:get-port', () => {
    try {
      return getObsServerPort()
    } catch {
      return 0
    }
  })
}