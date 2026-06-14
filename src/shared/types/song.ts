export interface SongItem {
  id: string
  source: 'netease' | 'bilibili'
  sourceId: string
  cid?: number
  title: string
  artist: string
  album: string
  coverUrl: string
  duration: number
  playUrl: string
  playUrlExpire: number
  requesterName: string
  requesterUid: number
}

export interface LyricLine {
  time: number
  text: string
  translation?: string
}