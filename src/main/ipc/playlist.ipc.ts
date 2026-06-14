import { BrowserWindow, ipcMain } from 'electron'
import { playlistManager } from '../services/player/playlist-manager'
import { neteaseApi } from '../services/music/netease-api'
import { bilibiliAuth } from '../services/music/bilibili-video'
import { store } from '../services/store'
import { sendPlayEvent } from './player.ipc'
import type { SongItem } from '../../shared/types/song'

function notifyQueueUpdate(win: BrowserWindow) {
  win.webContents.send('song:playlist-updated', playlistManager.getQueue())
}

/** 发送队列更新 + 当前播放曲信息到渲染进程，同时返回数据供 IPC 响应同步使用。
 *  注意：不发送 player:play-url，避免非启动场景意外加载 URL 中断播放。
 *  使用 getCurrentSong() 而非 queue[0]，确保发送的是实际正在播放的歌曲。 */
function sendQueueAndFirstSong(win: BrowserWindow): { queue: SongItem[], firstSong: SongItem | null } {
  const queue = playlistManager.getQueue()
  win.webContents.send('song:playlist-updated', queue)
  const current = playlistManager.getCurrentSong() || queue[0] || null
  if (current) {
    win.webContents.send('player:state-changed', {
      currentSong: current,
      playerType: current.source === 'bilibili' ? 'video' : 'audio'
    })
  }
  return { queue, firstSong: current }
}

/** 启动专用：预取首曲的播放 URL 和歌词，并始终发送 player:play-url 让渲染进程拿到数据 */
async function preloadFirstSong(win: BrowserWindow): Promise<void> {
  const first = playlistManager.getQueue()[0]
  if (!first) return
  if (first.source === 'netease') {
    try {
      // URL 不存在或已过期则重新获取
      if (!first.playUrl || (first.playUrlExpire && Date.now() > first.playUrlExpire)) {
        const url = await neteaseApi.getPlayUrl(first.sourceId)
        if (url) {
          first.playUrl = url
          first.playUrlExpire = Date.now() + 3600 * 1000
        }
      }
      // 始终发送 player:play-url，确保渲染进程拿到播放地址
      if (first.playUrl) {
        win.webContents.send('player:play-url', {
          song: first, playing: false, playerType: 'audio'
        })
      }
      // 获取歌词
      const lyric = await neteaseApi.getLyric(first.sourceId)
      if (lyric.length > 0) {
        win.webContents.send('player:lyric-update', lyric)
      }
    } catch (e) {
      console.error('[preloadFirstSong] netease 预取失败:', (e as Error).message)
    }
  } else if (first.source === 'bilibili') {
    try {
      // URL 不存在或已过期则重新获取
      if (!first.playUrl || (first.playUrlExpire && Date.now() > first.playUrlExpire)) {
        let cid = first.cid || 0
        if (cid === 0) {
          const info = await bilibiliAuth.getVideoInfo(first.sourceId)
          cid = info?.cid || 0
          if (cid > 0) first.cid = cid
        }
        if (cid > 0) {
          const result = await bilibiliAuth.getVideoPlayUrl(first.sourceId, cid)
          if (result) {
            first.playUrl = result.url
            if (result.duration > 0) first.duration = result.duration
            first.playUrlExpire = Date.now() + 3600 * 1000
          }
        }
      }
      // 始终发送 player:play-url，确保渲染进程拿到播放地址
      if (first.playUrl) {
        win.webContents.send('player:play-url', {
          song: first, playing: false, playerType: 'video'
        })
        win.webContents.send('player:pause')
      }
    } catch (e) {
      console.error('[preloadFirstSong] B站预取失败:', (e as Error).message)
    }
  }
}

export function registerPlaylistIpc(mainWindow: BrowserWindow) {
  // 水合完成后自动通知渲染进程刷新队列，并更新当前歌曲信息（标题等）
  // 注意：不发送 playing 字段，避免覆盖媒体元素的实际播放状态
  playlistManager.onQueueChanged = () => {
    notifyQueueUpdate(mainWindow)
    const current = playlistManager.getCurrentSong() || playlistManager.getQueue()[0]
    if (current) {
      mainWindow.webContents.send('player:state-changed', {
        currentSong: current,
        playerType: current.source === 'bilibili' ? 'video' : 'audio'
      })
    }
  }

  ipcMain.handle('playlist:get', () => playlistManager.getQueue())

  ipcMain.handle('playlist:remove', async (_, songId: string) => {
    const current = playlistManager.getCurrentSong()
    if (current && current.id === songId) {
      // 删除当前歌曲 → 跳到下一首
      const nextSong = playlistManager.next()
      if (nextSong) {
        await sendPlayEvent(mainWindow, nextSong)
        mainWindow.webContents.send('song:playlist-updated', playlistManager.getQueue())
      } else {
        mainWindow.webContents.send('player:state-changed', {
          playing: false, currentSong: null
        })
        mainWindow.webContents.send('song:playlist-updated', playlistManager.getQueue())
      }
    } else {
      playlistManager.removeFromQueue(songId)
      sendQueueAndFirstSong(mainWindow)
    }
  })

  ipcMain.handle('playlist:clear', () => {
    playlistManager.clearQueue()
    mainWindow.webContents.send('player:state-changed', {
      playing: false, currentSong: null
    })
    notifyQueueUpdate(mainWindow)
  })

  ipcMain.handle('playlist:add-song', (_, song: any) => {
    const ok = playlistManager.addToQueue(song)
    if (ok) notifyQueueUpdate(mainWindow)
    return { success: ok }
  })

  ipcMain.handle('playlist:insert-top', (_, song: any) => {
    playlistManager.insertTop(song)
    notifyQueueUpdate(mainWindow)
    mainWindow.webContents.send('log:add', `${song.requesterName || '控制台'} 点歌: ${song.title}`)
    return { success: true }
  })

  // 收藏
  ipcMain.handle('favorite:add', (_, song: any) => {
    store.addFavorite(song.id)
    store.setCacheItem(song.id, song)
    return { success: true }
  })

  ipcMain.handle('favorite:remove', (_, songId: string) => {
    store.removeFavorite(songId)
  })

  ipcMain.handle('favorite:get', () => {
    return store.getFavorites()
  })

  // 空闲歌单
  ipcMain.handle('idle-playlist:info', () => playlistManager.getIdlePlaylistInfo())
  ipcMain.handle('idle-playlist:queue-start', () => playlistManager.getIdleQueueStartIndex())

  /** 按单一源刷新空闲歌单（启动/切换歌单ID时触发，源切换不触发） */
  ipcMain.handle('idle-playlist:refresh-single', async (_, source: 'netease' | 'bilibili', id: string, force: boolean) => {
    const isCooling = !force && store.isRefreshCooling(source, id)
    if (isCooling) {
      // 如果当前队列为空（缓存加载失败），则执行本地随机填充
      const currentQueue = playlistManager.getQueue()
      if (currentQueue.length === 0) {
        playlistManager.shuffleAndRefreshQueue()
      }
      // 启动阶段：预取首曲播放 URL 和歌词
      await preloadFirstSong(mainWindow)
      const idleInfo = playlistManager.getIdlePlaylistInfo()
      const queue = playlistManager.getQueue()
      const current = playlistManager.getCurrentSong() || queue[0] || null
      return {
        success: true,
        unchanged: true,
        cached: true,
        count: playlistManager.getIdlePoolSize(),
        info: idleInfo,
        queue,
        firstSong: current
      }
    }

    const result = await playlistManager.refreshSingleSource(source, id, force)
    // 启动阶段：预取首曲播放 URL 和歌词
    await preloadFirstSong(mainWindow)
    const { queue, firstSong } = sendQueueAndFirstSong(mainWindow)

    const idleInfo = playlistManager.getIdlePlaylistInfo()
    return {
      success: true,
      unchanged: result.unchanged,
      count: playlistManager.getIdlePoolSize(),
      info: idleInfo,
      queue,
      firstSong
    }
  })

  /** 根据缓存加载空闲歌单到队列（切源专用，零API调用）。
   *  返回 success: false 表示缓存无效或 idleList 为空，调用方应回退到 API 刷新。 */
  ipcMain.handle('idle-playlist:load-from-cache', async (_, source: 'netease' | 'bilibili', id: string) => {
    const cached = store.getPlaylistCache(source, id)
    if (!cached || cached.songIds.length === 0) return { success: false, reason: 'no_cache' }
    const ok = playlistManager.setIdleListFromCache(cached.songIds, {
      name: cached.name,
      owner: '',
      source
    }, id)
    if (!ok) return { success: false, reason: 'empty_idle_list' }
    // 等待 stub 水合完成，避免前端短暂显示 "-" 标题
    await playlistManager.waitHydration()
    const { queue, firstSong } = sendQueueAndFirstSong(mainWindow)
    return { success: true, queue, firstSong, count: playlistManager.getIdlePoolSize() }
  })

  /** 获取歌单缓存信息（用于前置UI展示） */
  ipcMain.handle('idle-playlist:cache-info', (_, source: 'netease' | 'bilibili', id: string) => {
    const entry = store.getPlaylistCache(source, id)
    return entry ? { name: entry.name, songCount: entry.songIds.length, cached: true } : { cached: false }
  })

  /** 仅缓存歌单数据，不更新队列（启动时预加载另一个源） */
  ipcMain.handle('idle-playlist:cache-only', async (_, source: 'netease' | 'bilibili', id: string) => {
    if (!id || store.isRefreshCooling(source, id)) return { success: false }
    try {
      await playlistManager.refreshSingleSource(source, id, false, true)
      return { success: true }
    } catch (e) {
      console.error('[idle-playlist:cache-only] 失败:', (e as Error).message)
      return { success: false }
    }
  })

  // 搜索
  ipcMain.handle('search:song', async (_, keyword: string) => {
    // 判断是BV号还是歌名
    const bvMatch = keyword.match(/^BV[\w]{10}$/i)
    if (bvMatch) {
      return bilibiliAuth.getVideoInfo(bvMatch[0])
    }
    // 判断是否是纯数字（歌曲ID）
    const idMatch = keyword.match(/^(\d{4,})$/)
    if (idMatch) {
      return neteaseApi.searchByKeyword(keyword)
    }
    // 否则按歌名搜索
    return neteaseApi.searchByKeyword(keyword)
  })

  // 搜索缓存
  ipcMain.handle('cache:get-recent', () => {
    return store.getHistory()
  })

  ipcMain.handle('cache:clear', () => {
    store.clearCache()
    return { success: true }
  })

  // idleQueueSize 设置
  ipcMain.handle('settings:get-idle-queue-size', () => store.getIdleQueueSize())
  ipcMain.handle('settings:set-idle-queue-size', (_, size: number) => {
    store.setIdleQueueSize(size)
    return { success: true }
  })

  // lastIdleSource 设置
  ipcMain.handle('settings:get-last-idle-source', () => store.getLastIdleSource())
  ipcMain.handle('settings:set-last-idle-source', (_, source: string) => {
    store.setLastIdleSource(source as 'netease' | 'bilibili')
    return { success: true }
  })

  // 直播分区持久化
  ipcMain.handle('settings:get-live-area', () => store.getLiveArea())
  ipcMain.handle('settings:set-live-area', (_, parentAreaIdx: number, subAreaId: number) => {
    store.setLiveArea(parentAreaIdx, subAreaId)
    return { success: true }
  })
}