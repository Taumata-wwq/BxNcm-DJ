export type PlayerType = 'audio' | 'video'

export interface PlayerState {
  playing: boolean
  currentSong: import('./song').SongItem | null
  currentTime: number
  duration: number
  volume: number
  playerType: PlayerType
}