import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SongItem } from '@shared/types/song'

export const usePlaylistStore = defineStore('playlist', () => {
  const queue = ref<SongItem[]>([])
  const favorites = ref<SongItem[]>([])

  async function loadQueue() {
    try {
      queue.value = await window.electronAPI.getPlaylist()
    } catch {}
  }

  async function loadFavorites() {
    try {
      favorites.value = await window.electronAPI.getFavorites()
    } catch {}
  }

  function updateQueue(list: SongItem[]) {
    queue.value = list
  }

  async function removeSong(songId: string) {
    await window.electronAPI.playlistRemove(songId)
    // 不再手动过滤：IPC handler 已通过 song:playlist-updated 发送更新后的队列
  }

  async function clearQueue() {
    await window.electronAPI.playlistClear()
    queue.value = []
  }

  async function toggleFavorite(song: SongItem) {
    const idx = favorites.value.findIndex(s => s.id === song.id)
    if (idx >= 0) {
      await window.electronAPI.favoriteRemove(song.id)
      favorites.value.splice(idx, 1)
    } else {
      await window.electronAPI.favoriteAdd(song)
      favorites.value.push(song)
    }
  }

  function isFavorite(songId: string): boolean {
    return favorites.value.some(s => s.id === songId)
  }

  return { queue, favorites, loadQueue, loadFavorites, updateQueue, removeSong, clearQueue, toggleFavorite, isFavorite }
})