<template>
  <div class="song-info">
    <template v-if="playerStore.currentSong">
      <div class="song-title">{{ playerStore.currentSong.title }}</div>
      <div class="song-artist">{{ playerStore.currentSong.artist }}</div>
      <div class="song-meta">
        <span class="song-id">
          {{ playerStore.currentSong.source === 'bilibili' ? 'BV' : 'ID' }}: {{ playerStore.currentSong.sourceId }}
        </span>
        <span class="source-tag" :class="playerStore.currentSong.source">
          {{ playerStore.currentSong.source === 'bilibili' ? 'B站视频' : '网易云' }}
        </span>
      </div>
      <div class="song-requester">点歌人: {{ playerStore.currentSong.requesterName || '空闲播放' }}</div>
    </template>
    <template v-else>
      <div class="no-song">等待播放...</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { usePlayerStore } from '../../stores/player.store'

const playerStore = usePlayerStore()
</script>

<style scoped>
.song-info { flex: 1; display: flex; flex-direction: column; justify-content: center; min-width: 0; }
.song-title {
  font-size: 16px; font-weight: 600; color: var(--text-primary); line-height: 1.3;
  display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; user-select: text; margin-bottom: 2px;
}
.song-artist { font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; user-select: text; }
.song-meta { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
.song-id { font-size: 11px; color: var(--text-muted); user-select: text; }
.source-tag { padding: 1px 6px; font-size: 11px; border: 1px solid var(--border); flex-shrink: 0; }
.source-tag.netease { color: #569cd6; }
.source-tag.bilibili { color: #ce9178; }
.song-requester { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }
.no-song { font-size: 15px; color: var(--text-muted); }
</style>