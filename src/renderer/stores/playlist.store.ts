import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SongItem } from '@shared/types/song'

export const usePlaylistStore = defineStore('playlist', () => {
  const queue = ref<SongItem[]>([])

  async function loadQueue() {
    try {
      queue.value = await window.electronAPI.getPlaylist()
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

  return { queue, loadQueue, updateQueue, removeSong, clearQueue }
})