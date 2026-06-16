import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { SongItem, LyricLine } from '@shared/types/song'
import type { PlayerState } from '@shared/types/player'
import { useSettingsStore } from './settings.store'

export const usePlayerStore = defineStore('player', () => {
  const playing = ref(false)
  const currentSong = ref<SongItem | null>(null)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(40)
  const playerType = ref<'audio' | 'video'>('audio')
  const lyrics = ref<LyricLine[]>([])
  const currentLyricIndex = ref(0)

  const settingsStore = useSettingsStore()

  const progress = computed(() => duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0)
  const currentTimeStr = computed(() => formatTime(currentTime.value))
  const durationStr = computed(() => formatTime(duration.value))

  function updateState(state: Partial<PlayerState>) {
    if (state.playing !== undefined) playing.value = state.playing
    if (state.currentSong !== undefined) currentSong.value = state.currentSong
    if (state.playerType !== undefined) {
      playerType.value = state.playerType
      // 切换到视频源时清除旧歌词，避免 OBS 空闲文本被残留歌词覆盖
      if (state.playerType === 'video') {
        lyrics.value = []
        currentLyricIndex.value = 0
      }
    }
  }

  function updateTime(time: number, dur: number) {
    currentTime.value = time
    if (dur > 0) duration.value = dur
  }

  // 歌词索引随播放时间自动更新（二分查找 O(log n)，代入延迟偏移量）
  watch(currentTime, (time) => {
    if (lyrics.value.length === 0) return
    const delay = (settingsStore.settings.lyricDelay || 0) / 1000  // ms → s
    const adjustedTime = time + delay
    const idx = binarySearchLyric(lyrics.value, adjustedTime)
    if (idx !== currentLyricIndex.value) {
      currentLyricIndex.value = idx
    }
  })

  function updateLyrics(lyric: LyricLine[]) {
    lyrics.value = lyric
  }

  async function play(songId: string) {
    await window.electronAPI.playerPlay(songId)
  }

  async function pause() {
    try {
      await window.electronAPI.playerPause()
      playing.value = false
    } catch (e) {
      console.error('[PlayerStore] pause 失败:', e)
    }
  }

  async function resume() {
    try {
      await window.electronAPI.playerResume()
      playing.value = true
    } catch (e) {
      console.error('[PlayerStore] resume 失败:', e)
    }
  }

  async function next() {
    await window.electronAPI.playerNext()
  }

  async function prev() {
    await window.electronAPI.playerPrev()
  }

  async function seek(time: number) {
    await window.electronAPI.playerSeek(time)
    currentTime.value = time
  }

  function setVolume(vol: number) {
    volume.value = Math.max(0, Math.min(100, vol))
  }

  return { playing, currentSong, currentTime, duration, volume, playerType, lyrics, currentLyricIndex, progress, currentTimeStr, durationStr, updateState, updateTime, updateLyrics, play, pause, resume, next, prev, seek, setVolume }
})

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** 二分查找当前时间对应的歌词行索引 */
function binarySearchLyric(lyrics: LyricLine[], time: number): number {
  let lo = 0
  let hi = lyrics.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (lyrics[mid].time <= time) {
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return Math.max(0, hi)
}