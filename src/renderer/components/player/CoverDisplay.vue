<template>
  <div class="cover-display">
    <img v-if="playerStore.currentSong?.coverUrl" :src="playerStore.currentSong.coverUrl" class="cover-img" />
    <div v-else class="cover-placeholder">
      <span class="placeholder-icon">🎵</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePlayerStore } from '../../stores/player.store'
const playerStore = usePlayerStore()
</script>

<style scoped>
.cover-display {
  width: var(--cover-size, 800px); height: var(--cover-size, 800px);
  flex-shrink: 0; overflow: hidden; border: 1px solid var(--border);
  min-width: 60px; min-height: 60px;
}
.cover-img { width: 100%; height: 100%; object-fit: cover; }
.cover-placeholder {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  background: var(--bg-secondary);
}
.placeholder-icon { font-size: 40px; opacity: 0.2; }
</style>