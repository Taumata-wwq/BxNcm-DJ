import { store } from '../store'
import type { SongItem, LyricLine } from '../../../shared/types/song'
import { weapiRequest, eapiRequest } from '../../utils/netease-crypto'

// 获取保存的 cookie
function getSavedCookie(): Record<string, string> {
  const cookie = store.get('netease_cookie')
  if (!cookie) return {}
  try {
    return JSON.parse(cookie)
  } catch (e) {
    console.error('[NeteaseApi] 解析Cookie失败:', (e as Error).message)
    return {}
  }
}

export const neteaseApi = {
  async searchFallback(songName: string, artist: string): Promise<SongItem | null> {
    const keyword = `${songName} ${artist}`
    const cookie = getSavedCookie()

    try {
      // 使用 weapi 搜索
      const result = await weapiRequest('/api/search/get/web', {
        s: keyword,
        type: 1, // 1 = 单曲
        offset: 0,
        total: true,
        limit: 5,
      }, cookie)

      const data = result.body
      if (data.code === 200 && data.result?.songs?.length > 0) {
        const song = data.result.songs[0]
        return mapSongItem(song)
      }
    } catch (e) {
      console.error('[NeteaseApi] search 失败:', (e as Error).message)
    }
    return null
  },

  /**
   * 通用搜索 - 仅按关键词搜索（用户手动点歌）
   */
  async searchByKeyword(keyword: string): Promise<SongItem | null> {
    const cookie = getSavedCookie()
    try {
      const result = await weapiRequest('/api/cloudsearch/get/web', {
        s: keyword,
        type: 1,
        offset: 0,
        limit: 1,
      }, cookie)

      const data = result.body
      if (data.code === 200 && data.result?.songs?.length > 0) {
        return mapSongItem(data.result.songs[0])
      }
    } catch (e) {
      console.error('[NeteaseApi] searchByKeyword 失败:', (e as Error).message)
    }
    // 回退普通搜索
    return this.searchFallback(keyword, '')
  },

  /**
   * 懒加载：仅获取歌单的 trackId 列表，返回轻量 stub。
   * 内存占用极小，后续通过 hydrateSongs 按需获取完整信息。
   */
  async getPlaylistTrackStubs(playlistId: string): Promise<{ stubs: SongItem[]; count: number }> {
    const cookie = getSavedCookie()
    try {
      const detail = await weapiRequest('/api/v6/playlist/detail', {
        id: playlistId,
        n: 100000,
        s: 8,
      }, cookie)

      if (detail.body.code === 200 && detail.body.playlist) {
        const trackIds: number[] = (detail.body.playlist.trackIds || []).map((t: any) => t.id)
        const stubs: SongItem[] = trackIds.map(id => createSongStub(id))
        return { stubs, count: trackIds.length }
      }
    } catch (e) {
      console.error('[NeteaseApi] getPlaylistTrackStubs 失败:', (e as Error).message)
    }
    return { stubs: [], count: 0 }
  },

  /**
   * 懒加载：为指定的 stub ID 批量获取完整歌曲信息（最多 50 首/批）
   */
  async hydrateSongs(songIds: string[]): Promise<SongItem[]> {
    if (songIds.length === 0) return []
    const cookie = getSavedCookie()
    const songs: SongItem[] = []

    try {
      // 每次最多请求 50 首，批次间延迟 300ms 避免触发频率限制
      for (let i = 0; i < songIds.length; i += 50) {
        const batch = songIds.slice(i, i + 50)
          .map(id => id.replace(/^ne_/, '')) // 去掉 ne_ 前缀获取纯数字 ID
          .filter(Boolean)
        if (batch.length === 0) continue

        const idsJsonStr = '[' + batch.map(id => '{"id":' + id + '}').join(',') + ']'

        // 每批最多重试 3 次
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const detailResult = await weapiRequest('/api/v3/song/detail', {
              c: idsJsonStr,
            }, cookie)

            if (detailResult.body.code === 200 && detailResult.body.songs) {
              for (const s of detailResult.body.songs) {
                songs.push(mapSongItem(s))
              }
              break  // 成功则跳出重试循环
            } else {
              console.warn(`[NeteaseApi] hydrateSongs 第 ${Math.floor(i / 50) + 1} 批第 ${attempt + 1}/3 次返回异常 code:`, detailResult.body.code)
              if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
            }
          } catch (batchErr) {
            console.error(`[NeteaseApi] hydrateSongs 第 ${Math.floor(i / 50) + 1} 批第 ${attempt + 1}/3 次失败:`, (batchErr as Error).message)
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
          }
        }

        // 批次间延迟，减轻服务器压力
        if (i + 50 < songIds.length) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }
    } catch (e) {
      console.error('[NeteaseApi] hydrateSongs 失败:', (e as Error).message)
    }
    return songs
  },

  /**
   * 获取歌单名称和创建者信息
   */
  async getPlaylistInfo(playlistId: string): Promise<{ name: string; owner: string } | null> {
    const cookie = getSavedCookie()
    try {
      const detail = await weapiRequest('/api/v6/playlist/detail', {
        id: playlistId,
        n: 1,
        s: 0,
      }, cookie)
      if (detail.body.code === 200 && detail.body.playlist) {
        return {
          name: detail.body.playlist.name || '',
          owner: detail.body.playlist.creator?.nickname || ''
        }
      }
    } catch (e) { console.error('[NeteaseApi] 获取歌单信息失败:', (e as Error).message) }
    return null
  },

  /**
   * 按歌曲数字 ID 精确查询单首歌曲信息
   */
  async getSongById(songId: string): Promise<SongItem | null> {
    const cookie = getSavedCookie()
    try {
      const idsJsonStr = '[{"id":' + songId + '}]'
      const result = await weapiRequest('/api/v3/song/detail', {
        c: idsJsonStr,
      }, cookie)
      if (result.body.code === 200 && result.body.songs?.length > 0) {
        return mapSongItem(result.body.songs[0])
      }
    } catch (e) {
      console.error('[NeteaseApi] getSongById 失败:', (e as Error).message)
    }
    return null
  },

  async getPlayUrl(songId: string): Promise<string> {
    const cookie = getSavedCookie()
    // 尝试最高音质：jymaster(超清母带) > hires > lossless > exhigh > standard
    const levels = ['jymaster', 'hires', 'lossless', 'exhigh', 'standard']
    
    for (const level of levels) {
      try {
        const result = await eapiRequest('/api/song/enhance/player/url/v1', {
          ids: `[${songId}]`,
          level: level,
          encodeType: 'flac',
        }, cookie)

        const data = result.body
        if (data.code === 200 && data.data?.[0]?.url) {
          let url = data.data[0].url
          if (url && url.startsWith('http:')) url = url.replace('http:', 'https:')
          return url
        }
      } catch (e) { console.error('[NeteaseApi] 获取播放地址失败(level: ' + level + '):', (e as Error).message) }
    }

    // 回退尝试 eapi 旧接口
    try {
      const result = await eapiRequest('/api/song/enhance/player/url', {
        ids: `[${songId}]`,
        br: 999000,
      }, cookie)
      const data = result.body
      if (data.code === 200 && data.data?.[0]?.url) {
        let url = data.data[0].url
        if (url && url.startsWith('http:')) url = url.replace('http:', 'https:')
        return url
      }
    } catch (e) { console.error('[NeteaseApi] 获取播放地址(旧接口)失败:', (e as Error).message) }

    return ''
  },

  async getLyric(songId: string): Promise<LyricLine[]> {
    const cookie = getSavedCookie()

    try {
      // 使用 weapi 获取歌词（tv=-1 获取翻译）
      const result = await weapiRequest('/api/song/lyric', {
        id: songId,
        tv: -1,
        lv: -1,
        rv: -1,
        kv: -1,
        _nmclfl: 1,
      }, cookie)

      const data = result.body
      if (data.lrc?.lyric) {
        const original = parseLyricList(data.lrc.lyric)
        const translation = data.tlyric?.lyric ? parseLyricList(data.tlyric.lyric) : []
        return mergeLyricWithTranslation(original, translation)
      }
    } catch (e) { console.error('[NeteaseApi] 获取歌词失败:', (e as Error).message) }

    // 回退：尝试新版歌词接口
    try {
      const result2 = await weapiRequest('/api/song/lyric/v1', {
        id: songId,
        cp: false,
        tv: -1,
        lv: -1,
        rv: -1,
        kv: 0,
        yv: 0,
        ytv: 0,
        yrv: 0,
      }, cookie)
      const data2 = result2.body
      if (data2.lrc?.lyric) {
        const original = parseLyricList(data2.lrc.lyric)
        const translation = data2.tlyric?.lyric ? parseLyricList(data2.tlyric.lyric) : []
        return mergeLyricWithTranslation(original, translation)
      }
    } catch (e) { console.error('[NeteaseApi] 获取歌词(v1接口)失败:', (e as Error).message) }

    return []
  }
}

function parseLyricList(lrc: string): LyricLine[] {
  const lines = lrc.split('\n')
  const result: LyricLine[] = []
  const timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/
  for (const line of lines) {
    const match = line.match(timeReg)
    if (match) {
      const min = parseInt(match[1])
      const sec = parseInt(match[2])
      const ms = parseInt(match[3].padEnd(3, '0'))
      const time = min * 60 + sec + ms / 1000
      const text = line.replace(timeReg, '').trim()
      if (text) result.push({ time, text })
    }
  }
  return result
}

/** 将翻译歌词按时间戳匹配到原文歌词 */
function mergeLyricWithTranslation(original: LyricLine[], translation: LyricLine[]): LyricLine[] {
  if (translation.length === 0) return original
  // 翻译和原文时间戳接近（1秒内）则视为同一行
  for (const line of original) {
    const match = translation.find(t => Math.abs(t.time - line.time) < 1.0)
    if (match) line.translation = match.text
  }
  return original
}

/**
 * 创建轻量 SongItem stub，只存储必要信息，不缓存图片
 */
function createSongStub(trackId: number): SongItem {
  return {
    id: `ne_${trackId}`,
    source: 'netease',
    sourceId: String(trackId),
    title: '',
    artist: '',
    album: '',
    coverUrl: '',
    duration: 0,
    playUrl: '',
    playUrlExpire: 0,
    requesterName: '',
    requesterUid: 0
  }
}

function mapSongItem(song: any): SongItem {
  return {
    id: `ne_${song.id}`,
    source: 'netease',
    sourceId: String(song.id),
    title: song.name || '',
    artist: song.artists?.map((a: any) => a.name).join('/') || song.ar?.map((a: any) => a.name).join('/') || '',
    album: song.album?.name || song.al?.name || '',
    coverUrl: song.album?.picUrl || song.al?.picUrl || '',
    duration: Math.floor((song.duration || song.dt || 0) / 1000),
    playUrl: '',
    playUrlExpire: 0,
    requesterName: '',
    requesterUid: 0
  }
}
