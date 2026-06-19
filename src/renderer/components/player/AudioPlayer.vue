<template>
  <audio
    ref="audioEl"
    :src="playUrl || undefined"
    @loadedmetadata="onLoaded"
    @timeupdate="onTimeUpdate"
    @ended="onEnded"
    @error="onError"
    @play="onPlay"
    @pause="onPause"
  ></audio>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { usePlayerStore } from '../../stores/player.store'
import { volumeToAmplitude } from '../../../shared/utils/audio'

const playerStore = usePlayerStore()
const audioEl = ref<HTMLAudioElement | null>(null)
const playUrl = ref('')
// 防止已发送 ended 后重复触发：切换视频 + 浏览器重复 ended 事件 + 并发 error
let switchingToVideo = false
let endedSent = false
let fadeTimer: ReturnType<typeof setInterval> | null = null
let lastTimeUpdate = 0   // 节流 onTimeUpdate，目标 500ms 一次
let lastDuration = 0     // 去重 duration 更新

/** 取消正在进行的音量渐变 */
function cancelFade() {
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null }
}

/** 音量淡入：从 0 渐变到感知线性化的目标音量 */
function fadeIn(el: HTMLAudioElement) {
  cancelFade()
  const target = volumeToAmplitude(playerStore.volume)
  el.volume = 0
  el.muted = false
  const step = target / 15  // ~300ms at 20ms intervals
  let cur = 0
  fadeTimer = setInterval(() => {
    cur += step
    if (cur >= target) {
      el.volume = target
      cancelFade()
    } else {
      el.volume = Math.min(cur, target)
    }
  }, 20)
}

/** 音量淡出：从当前渐变到 0，然后真正暂停 */
function fadeOutAndPause(el: HTMLAudioElement) {
  cancelFade()
  const startVol = el.volume
  if (startVol <= 0.001) { el.pause(); playerStore.playing = false; return }
  const step = startVol / 10  // ~200ms
  let cur = startVol
  fadeTimer = setInterval(() => {
    cur -= step
    if (cur <= 0) {
      el.volume = 0
      el.pause()
      playerStore.playing = false
      cancelFade()
    } else {
      el.volume = Math.max(cur, 0)
    }
  }, 20)
}

// 监听音量变化（感知线性化）
watch(() => playerStore.volume, (vol) => {
  if (audioEl.value) {
    audioEl.value.volume = volumeToAmplitude(vol)
  }
})

onMounted(() => {
  window.electronAPI.onPlayUrl(async (data: any) => {
    if (data.playerType === 'video') {
      // 切换到视频时，停止音频播放
      switchingToVideo = true
      if (audioEl.value) {
        audioEl.value.pause()
        audioEl.value.removeAttribute('src')
      }
      playUrl.value = ''
      return
    }
    // 切换回音频时清除标志，允许下一次 ended
    switchingToVideo = false
    endedSent = false
    const url = data.song?.playUrl || ''
    playerStore.currentSong = data.song || null
    playerStore.playing = data.playing
    playerStore.playerType = data.playerType

    if (url) {
      playUrl.value = url
      // 等 Vue 渲染 <audio> 后根据 playing 决定是否播放
      await nextTick()
      if (data.playing && audioEl.value) {
        audioEl.value.play().catch(() => {})
      }
    }
  })

  window.electronAPI.onPlayerPause(() => {
    if (playerStore.playerType !== 'audio') return
    cancelFade()
    if (audioEl.value) fadeOutAndPause(audioEl.value)
  })

  window.electronAPI.onPlayerResume(async () => {
    // 仅响应音频模式的 resume，视频模式由 VideoPlayer 处理
    if (playerStore.playerType !== 'audio') return
    // 首次启动：playUrl 尚未通过 player:play-url 设置，从 store 中获取
    if (!playUrl.value && playerStore.currentSong?.playUrl) {
      playUrl.value = playerStore.currentSong.playUrl
      await nextTick()
    }
    if (audioEl.value) {
      audioEl.value.play().catch(() => {})
      fadeIn(audioEl.value)
    }
    playerStore.playing = true
  })

  window.electronAPI.onPlayerSeek((time: number) => {
    // 只有当前是音频模式才响应 seek
    if (playerStore.playerType === 'audio' && audioEl.value) {
      audioEl.value.currentTime = time
    }
  })
})

function onLoaded() {
  if (audioEl.value && playerStore.currentSong) {
    playerStore.duration = audioEl.value.duration
    lastDuration = audioEl.value.duration
    // 初始化音量：确保默认值真正应用到播放器（感知线性化）
    audioEl.value.volume = volumeToAmplitude(playerStore.volume)
  }
  lastTimeUpdate = 0
}

function onTimeUpdate() {
  if (!audioEl.value) return
  // 节流至每 500ms 更新一次进度条，减少 CPU 占用
  const now = performance.now()
  if (now - lastTimeUpdate < 500) return
  lastTimeUpdate = now

  playerStore.currentTime = audioEl.value.currentTime
  // 仅在 duration 变化时更新，避免重复触发响应式重算
  const dur = audioEl.value.duration
  if (dur > 0 && dur !== lastDuration) {
    lastDuration = dur
    playerStore.duration = dur
  }
}

function onEnded() {
  // 已发送过 ended 或正在切换到视频，忽略
  if (switchingToVideo || endedSent) {
    console.warn('[AudioPlayer] 忽略重复ended事件')
    return
  }
  endedSent = true
  window.electronAPI.playerEnded()
}

function onError() {
  if (switchingToVideo || endedSent) return
  // playUrl 为空时忽略 error（src="" 或 src 被移除引起的误触发）
  if (!playUrl.value) return
  console.warn('[AudioPlayer] 播放失败，尝试下一首')
  endedSent = true
  window.electronAPI.playerEnded()
}

function onPlay() {
  if (audioEl.value) fadeIn(audioEl.value)
  playerStore.playing = true
}

function onPause() {
  // 忽略元素已销毁的异步 pause 事件（组件销毁/重建时 ref 已为 null）
  if (!audioEl.value) return
  // 忽略元素 src 切换引起的异步 pause（此时 media.paused === false，实际仍在播放）
  if (!audioEl.value.paused) return
  playerStore.playing = false
}
</script>