<template>
  <div class="progress-bar">
    <!-- 紧凑播放控制按钮 -->
    <div class="play-controls">
      <button class="mini-btn play-btn" @click="togglePlay" :title="playerStore.playing ? '暂停' : '播放'">
        <svg v-if="playerStore.playing" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </button>
      <button class="mini-btn" @click="playerStore.next()" title="下一首">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z"/></svg>
      </button>
    </div>
    <span class="time">{{ playerStore.currentTimeStr }}</span>
    <div
      class="progress-track"
      ref="trackRef"
      @mousedown="startSeek"
    >
      <div class="progress-fill" :style="{ width: playerStore.progress + '%' }"></div>
      <div class="progress-thumb" :style="{ left: playerStore.progress + '%' }"></div>
    </div>
    <span class="time">{{ playerStore.durationStr }}</span>
    <div class="volume-control">
      <button class="vol-icon" @click="toggleMute">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
          <path v-if="playerStore.volume > 0" d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path v-if="playerStore.volume === 0" d="M22 2L2 22" />
        </svg>
      </button>
      <span class="volume-track-wrap">
        <div
          class="volume-track"
          ref="volTrackRef"
          @mousedown="startVolDrag"
        >
          <div class="volume-fill" :style="{ width: playerStore.volume + '%' }"></div>
          <div class="volume-thumb" :style="{ left: playerStore.volume + '%' }"></div>
        </div>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { usePlayerStore } from '../../stores/player.store'

const playerStore = usePlayerStore()
const trackRef = ref<HTMLElement | null>(null)
const volTrackRef = ref<HTMLElement | null>(null)
const lastVolume = ref<number>(0)
let seekDragging = false
let volDragging = false

function getRatio(el: HTMLElement, clientX: number): number {
  const rect = el.getBoundingClientRect()
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
}

function startSeek(e: MouseEvent) {
  if (!trackRef.value) return
  seekDragging = true
  applySeek(e.clientX)
  document.addEventListener('mousemove', onSeekMove)
  document.addEventListener('mouseup', onSeekUp)
}

function onSeekMove(e: MouseEvent) {
  if (!seekDragging) return
  applySeek(e.clientX)
}

function onSeekUp() {
  seekDragging = false
  document.removeEventListener('mousemove', onSeekMove)
  document.removeEventListener('mouseup', onSeekUp)
}

function applySeek(clientX: number) {
  if (!trackRef.value) return
  const ratio = getRatio(trackRef.value, clientX)
  const time = ratio * playerStore.duration
  playerStore.seek(time)
}

function startVolDrag(e: MouseEvent) {
  if (!volTrackRef.value) return
  volDragging = true
  applyVolume(e.clientX)
  document.addEventListener('mousemove', onVolMove)
  document.addEventListener('mouseup', onVolUp)
}

function onVolMove(e: MouseEvent) {
  if (!volDragging) return
  applyVolume(e.clientX)
}

function onVolUp() {
  volDragging = false
  document.removeEventListener('mousemove', onVolMove)
  document.removeEventListener('mouseup', onVolUp)
}

function applyVolume(clientX: number) {
  if (!volTrackRef.value) return
  const ratio = getRatio(volTrackRef.value, clientX)
  playerStore.setVolume(Math.round(ratio * 100))
}

function toggleMute() {
  if (playerStore.volume > 0) {
    lastVolume.value = playerStore.volume
    playerStore.setVolume(0)
  } else {
    playerStore.setVolume(lastVolume.value || 40)
  }
}

function togglePlay() {
  if (playerStore.playing) playerStore.pause()
  else playerStore.resume()
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onSeekMove)
  document.removeEventListener('mouseup', onSeekUp)
  document.removeEventListener('mousemove', onVolMove)
  document.removeEventListener('mouseup', onVolUp)
})
</script>

<style scoped>
.progress-bar {
  display: flex; align-items: center; gap: 8px; padding: 8px 0 6px 0; margin-top: 6px; flex-shrink: 0;
}
.play-controls { display: flex; gap: 2px; flex-shrink: 0; }
.mini-btn {
  width: 24px; height: 24px; border: none; border-radius: 0;
  background: var(--btn-bg); color: var(--btn-text); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.mini-btn:hover { background: var(--btn-hover-bg); }
.mini-btn.play-btn { background: var(--accent); color: var(--btn-primary-text); }
.mini-btn.play-btn:hover { opacity: 0.85; }
.time { font-size: 11px; color: var(--text-muted); width: 36px; text-align: center; font-family: 'Consolas', monospace; flex-shrink: 0; }
.progress-track {
  flex: 1; height: 4px; background: var(--bg-tertiary);
  cursor: pointer; position: relative; border-radius: 2px;
}
.progress-fill { height: 100%; background: var(--accent); border-radius: 2px; }
.progress-thumb {
  width: 10px; height: 10px; border-radius: 50%; background: var(--accent);
  position: absolute; top: -3px; transform: translateX(-50%); opacity: 0; transition: opacity 0.15s;
}
.progress-track:hover .progress-thumb { opacity: 1; }

/* 音量控制 */
.volume-control {
  display: flex; align-items: center; gap: 6px; flex-shrink: 0;
}
.vol-icon {
  width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--text-muted); cursor: pointer;
}
.vol-icon:hover { color: var(--text-primary); }
/* wrapper 承载右侧 15px 留白，track 保持 70px 使百分比计算精确对齐 */
.volume-track-wrap { display: inline-block; padding-right: 15px; }
.volume-track {
  width: 70px; height: 4px; background: var(--bg-tertiary);
  cursor: pointer; position: relative; border-radius: 2px;
}
.volume-fill { height: 100%; background: var(--accent); border-radius: 2px; }
.volume-thumb {
  width: 10px; height: 10px; border-radius: 50%; background: var(--accent);
  position: absolute; top: -3px; transform: translateX(-50%); opacity: 0; transition: opacity 0.15s;
}
.volume-track:hover .volume-thumb { opacity: 1; }
</style>