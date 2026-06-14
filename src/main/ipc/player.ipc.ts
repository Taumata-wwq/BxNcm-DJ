import { BrowserWindow, ipcMain } from 'electron'
import { playlistManager } from '../services/player/playlist-manager'
import { neteaseApi } from '../services/music/netease-api'
import { bilibiliAuth } from '../services/music/bilibili-video'
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
 * 预缓存下 N 首歌曲的播放 URL
 */
async function prefetchNextSongs(win: BrowserWindow, count: number = 3) {
  const nextSongs = playlistManager.peekNext(count)
  for (const song of nextSongs) {
    if (!song.playUrl || (song.playUrlExpire && Date.now() > song.playUrlExpire)) {
      try {
        await fetchSongUrl(song)
      } catch (e) {
        console.error('[PlayerIPC] 预缓存歌曲URL失败:', (e as Error).message)
        // 预缓存失败不影响当前播放
      }
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

  if (song.source === 'netease') {
    hasUrl = await fetchSongUrl(song)
    // 获取歌词
    try {
      const lyric = await neteaseApi.getLyric(song.sourceId)
      if (lyric.length > 0) {
        win.webContents.send('player:lyric-update', lyric)
      }
    } catch (e) {
      console.error('[PlayerIPC] 获取歌词失败:', (e as Error).message)
    }
  } else if (song.source === 'bilibili') {
    // B站视频：更激进的重试策略（最多 3 次，延迟递增）
    let retries = 0
    const maxRetries = 2  // 共 3 次尝试（含首次）
    while (!hasUrl && retries <= maxRetries) {
      if (retries > 0) {
        const delay = 1500 * retries  // 1.5s, 3s
        console.warn(`[PlayerIPC] B站视频 ${song.title} 第${retries + 1}次尝试获取URL，${delay}ms后重试...`)
        await new Promise(r => setTimeout(r, delay))
        // 重试前清空可能变质的缓存 CID
        song.cid = 0
      }
      hasUrl = await fetchSongUrl(song)
      retries++
    }
    if (!hasUrl) {
      console.error(`[PlayerIPC] B站视频 "${song.title}" 经${retries}次尝试后URL依然获取失败，将跳过`)
    }
  }

  // URL 获取失败：不发送播放事件，避免 VideoPlayer 加载空 URL 后触发 error→跳过
  if (!hasUrl) {
    console.error(`[PlayerIPC] ${song.source === 'bilibili' ? 'B站视频' : '网易云音乐'} "${song.title}" URL获取失败，跳过`)
    return false
  }

  // 先发送 state-changed 触发 Vue 挂载对应播放器组件（audio→video 切换时 VideoPlayer 尚未挂载）
  win.webContents.send('player:state-changed', {
    currentSong: song,
    playerType: song.source === 'bilibili' ? 'video' : 'audio'
  })
  // 再发送 play-url，此时正确的播放器组件已准备好接收
  win.webContents.send('player:play-url', {
    song,
    playing: true,
    playerType: song.source === 'bilibili' ? 'video' : 'audio'
  })

  // 日志：播放信息
  const srcTag = song.source === 'bilibili' ? '[B站]' : '[网易云]'
  const requester = song.requesterName ? ` ${song.requesterName} 点播` : ''
  win.webContents.send('log:add', `${srcTag} 正在播放: ${song.title} - ${song.artist}${requester}`)

  // 预缓存后续歌曲
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
}