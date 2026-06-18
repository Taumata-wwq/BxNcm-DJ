import { BrowserWindow, ipcMain } from 'electron'
import { playlistManager } from '../services/player/playlist-manager'
import { neteaseApi } from '../services/music/netease-api'
import { bilibiliAuth } from '../services/music/bilibili-video'
import { audioCache } from '../services/player/audio-cache'
import type { SongItem } from '../../shared/types/song'

// 重入保护：防止 player:ended / player:next 被并发调用导致跳歌
let processingEnded = false
let processingNext = false

/**
 * 为歌曲获取播放 URL（不发送事件）
 */
async function fetchSongUrl(song: SongItem): Promise<boolean> {
  if (song.source === 'netease') {
    const url = await neteaseApi.getPlayUrl(song.sourceId)
    if (url) {
      song.playUrl = url
      song.playUrlExpire = Date.now() + 3600 * 1000
      return true
    }
  } else if (song.source === 'bilibili') {
    let cid = song.cid || 0
    if (cid === 0) {
      try {
        const info = await bilibiliAuth.getVideoInfo(song.sourceId)
        cid = info?.cid || 0
        if (cid > 0) song.cid = cid
      } catch (e) {
        console.error('[PlayerIPC] 获取B站视频信息失败:', (e as Error).message)
      }
    }
    if (cid > 0) {
      const result = await bilibiliAuth.getVideoPlayUrl(song.sourceId, cid)
      if (result) {
        song.playUrl = result.url
        if (result.duration > 0) song.duration = result.duration
        song.playUrlExpire = Date.now() + 3600 * 1000
        return true
      }
    }
  }
  return false
}

/**
 * 预缓存下 N 首歌曲的播放 URL，并下载音频文件到本地缓存
 * 直接遍历队列中非空闲歌曲（有序号部分），从当前播放位置之后取
 */
export async function prefetchNextSongs(win: BrowserWindow, count: number = 3) {
  const queue = playlistManager.getQueue()
  const currentIdx = playlistManager.getCurrentIndex()
  const idleStartIdx = playlistManager.getIdleQueueStartIndex()

  // 从 currentIndex+1 开始，只取非空闲歌曲（有序号部分），最多 count 首
  const toDownload: SongItem[] = []
  for (let i = currentIdx + 1; i < idleStartIdx && toDownload.length < count; i++) {
    const song = queue[i]
    if (song && !audioCache.has(song.id)) {
      toDownload.push(song)
    }
  }
  if (toDownload.length === 0) return

  for (const song of toDownload) {
    if (!song.playUrl || (song.playUrlExpire && Date.now() > song.playUrlExpire)) {
      try {
        await fetchSongUrl(song)
      } catch (e) {
        console.error('[PlayerIPC] 预缓存歌曲URL失败:', (e as Error).message)
        continue
      }
    }
    if (song.playUrl) {
      audioCache.download(song).catch(e => {
        console.error('[PlayerIPC] 预缓存下载失败:', (e as Error).message)
      })
    }
  }
}

/**
 * 发送播放事件（获取实际URL后发送给渲染进程）
 * 对于 B站视频：如果 URL 获取失败，会重试多次（重新请求 CID + URL）
 * 返回 true 表示成功发送播放事件，false 表示 URL 获取失败需要跳过当前歌曲
 */
export async function sendPlayEvent(win: BrowserWindow, song: SongItem): Promise<boolean> {
  let hasUrl = false

  // 先检查本地缓存：命中则直接用本地文件（音频 + 封面）
  const localUrl = audioCache.getFileUrl(song.id)
  if (localUrl) {
    song.playUrl = localUrl
    hasUrl = true
    // 封面也使用本地缓存
    const localCover = audioCache.getCoverUrl(song.id)
    if (localCover) {
      song.coverUrl = localCover
    }
  }

  if (!hasUrl && song.source === 'netease') {
    hasUrl = await fetchSongUrl(song)
  } else if (!hasUrl && song.source === 'bilibili') {
    // B站视频：更激进的重试策略（最多 3 次，延迟递增）
    let retries = 0
    const maxRetries = 2  // 共 3 次尝试（含首次）
    while (!hasUrl && retries <= maxRetries) {
      if (retries > 0) {
        const delay = 1500 * retries  // 1.5s, 3s
        console.warn(`[PlayerIPC] B站视频 ${song.title} 第${retries + 1}次尝试获取URL，${delay}ms后重试...`)
        await new Promise(r => setTimeout(r, delay))
        song.cid = 0
      }
      hasUrl = await fetchSongUrl(song)
      retries++
    }
    if (!hasUrl) {
      console.error(`[PlayerIPC] B站视频 "${song.title}" 经${retries}次尝试后URL依然获取失败，将跳过`)
    }
  }

  // URL 获取失败：不发送播放事件
  if (!hasUrl) {
    console.error(`[PlayerIPC] ${song.source === 'bilibili' ? 'B站视频' : '网易云音乐'} "${song.title}" URL获取失败，跳过`)
    return false
  }

  // 获取歌词（netease，即使缓存命中也需要）
  if (song.source === 'netease') {
    try {
      const lyric = await neteaseApi.getLyric(song.sourceId)
      if (lyric.length > 0) {
        win.webContents.send('player:lyric-update', lyric)
      }
    } catch (e) {
      console.error('[PlayerIPC] 获取歌词失败:', (e as Error).message)
    }
  }

  // 先发送 state-changed 触发 Vue 挂载对应播放器组件
  win.webContents.send('player:state-changed', {
    currentSong: song,
    playerType: song.source === 'bilibili' ? 'video' : 'audio'
  })
  // 再发送 play-url
  win.webContents.send('player:play-url', {
    song,
    playing: true,
    playerType: song.source === 'bilibili' ? 'video' : 'audio'
  })

  // 日志：播放信息
  const srcTag = song.source === 'bilibili' ? '[B站]' : '[网易云]'
  const requester = song.requesterName ? ` ${song.requesterName} 点播` : ''
  const cacheTag = song.playUrl?.startsWith('file://') ? ' [本地缓存]' : ''
  win.webContents.send('log:add', `${srcTag} 正在播放: ${song.title} - ${song.artist}${requester}${cacheTag}`)

  // 后台下载当前播放歌曲到本地缓存（未缓存 + 有URL 即可）
  if (!localUrl && song.playUrl) {
    audioCache.download(song).catch(e => {
      console.error('[PlayerIPC] 当前歌曲缓存失败:', (e as Error).message)
    })
  }

  // 预缓存后续歌曲 URL + 下载音频
  prefetchNextSongs(win, 3)

  return true
}

export function registerPlayerIpc(mainWindow: BrowserWindow) {
  ipcMain.handle('player:play', async (_, songId: string) => {
    const song = playlistManager.play(songId)
    if (song) {
      const ok = await sendPlayEvent(mainWindow, song)
      if (!ok) {
        // 手动点播但URL获取失败，尝试跳过到下一首
        const nextSong = playlistManager.next()
        if (nextSong) {
          await sendPlayEvent(mainWindow, nextSong)
          mainWindow.webContents.send('song:playlist-updated', playlistManager.getQueue())
        }
      }
      return { success: true }
    }
    return { success: false }
  })

  ipcMain.handle('player:pause', () => {
    mainWindow.webContents.send('player:pause')
  })

  ipcMain.handle('player:resume', () => {
    mainWindow.webContents.send('player:resume')
  })

  ipcMain.handle('player:seek', (_, time: number) => {
    mainWindow.webContents.send('player:seek', time)
  })

  ipcMain.handle('player:next', async () => {
    if (processingNext) {
      console.warn('[PlayerIPC] player:next 正在处理中，忽略重复调用')
      return
    }
    processingNext = true
    try {
      const prevSong = playlistManager.getCurrentSong()
      let song = playlistManager.next()
      if (song) {
        let ok = await sendPlayEvent(mainWindow, song)
        // B站视频：若首次失败，额外重试同一首歌再给一次机会
        if (!ok && song.source === 'bilibili') {
          ok = await sendPlayEvent(mainWindow, song)
        }
        let skipCount = 0
        while (!ok && skipCount < playlistManager.getQueue().length) {
          song = playlistManager.next()
          if (!song) break
          ok = await sendPlayEvent(mainWindow, song)
          if (!ok && song.source === 'bilibili') {
            ok = await sendPlayEvent(mainWindow, song)
          }
          skipCount++
        }
        if (ok && prevSong) {
          mainWindow.webContents.send('log:add', `"${prevSong.title}" 播放完毕，切换到: ${song!.title} - ${song!.artist}`)
        }
        mainWindow.webContents.send('song:playlist-updated', playlistManager.getQueue())
      } else {
        mainWindow.webContents.send('player:state-changed', {
          playing: false, currentSong: null
        })
      }
    } finally {
      processingNext = false
    }
  })

  ipcMain.handle('player:prev', async () => {
    const song = playlistManager.previous()
    if (song) {
      await sendPlayEvent(mainWindow, song)
    }
  })

  // 渲染进程通知播放完成
  ipcMain.on('player:ended', async () => {
    if (processingEnded) {
      console.warn('[PlayerIPC] player:ended 正在处理中，忽略重复事件')
      return
    }
    processingEnded = true
    try {
      const prevSong = playlistManager.getCurrentSong()
      let song = playlistManager.next()
      if (song) {
        let ok = await sendPlayEvent(mainWindow, song)
        // B站视频：若首次失败，额外重试同一首歌再给一次机会（不直接 skip）
        if (!ok && song.source === 'bilibili') {
          console.warn(`[PlayerIPC] B站视频 "${song.title}" sendPlayEvent 失败，额外重试同一首...`)
          ok = await sendPlayEvent(mainWindow, song)
        }
        let skipCount = 0
        while (!ok && skipCount < playlistManager.getQueue().length) {
          song = playlistManager.next()
          if (!song) break
          ok = await sendPlayEvent(mainWindow, song)
          if (!ok && song.source === 'bilibili') {
            ok = await sendPlayEvent(mainWindow, song)
          }
          skipCount++
        }
        if (ok && prevSong) {
          mainWindow.webContents.send('log:add', `"${prevSong.title}" 播放完毕，切换到: ${song!.title} - ${song!.artist}`)
        }
        mainWindow.webContents.send('song:playlist-updated', playlistManager.getQueue())
      } else {
        mainWindow.webContents.send('player:state-changed', {
          playing: false, currentSong: null
        })
      }
    } finally {
      processingEnded = false
    }
  })

  // ==================== 音频文件缓存 ====================

  /** 获取音频缓存文件列表 */
  ipcMain.handle('audio-cache:list', () => {
    return audioCache.getCacheList()
  })

  /** 清空音频缓存（不进回收站） */
  ipcMain.handle('audio-cache:clear', () => {
    audioCache.clearAll()
    return { success: true }
  })

  /** 启动时批量预缓存队列中所有非空闲歌曲（有序号部分） */
  ipcMain.handle('audio-cache:prefetch-queue', async () => {
    const queue = playlistManager.getQueue()
    const idleStartIdx = playlistManager.getIdleQueueStartIndex()
    const toDownload = queue.slice(0, idleStartIdx).filter(s => !audioCache.has(s.id))
    if (toDownload.length === 0) return { success: true, count: 0 }

    console.log(`[PlayerIPC] 启动预缓存: 共 ${toDownload.length} 首`)
    for (const song of toDownload) {
      if (!song.playUrl || (song.playUrlExpire && Date.now() > song.playUrlExpire)) {
        try {
          await fetchSongUrl(song)
        } catch (e) {
          console.error(`[PlayerIPC] 启动预缓存 URL 获取失败: ${song.title}`, (e as Error).message)
          continue
        }
      }
      if (song.playUrl) {
        audioCache.download(song).catch(e => {
          console.error(`[PlayerIPC] 启动预缓存下载失败: ${song.title}`, (e as Error).message)
        })
      }
    }
    return { success: true, count: toDownload.length }
  })
}