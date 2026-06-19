<template>
  <div class="video-player">
    <video
      v-if="videoUrl"
      :ref="setVideoRef"
      :key="playerStore.currentSong?.id"
      :src="videoUrl"
      class="video-el"
      preload="metadata"
      @loadedmetadata="onLoaded"
      @timeupdate="onTimeUpdate"
      @ended="onEnded"
      @error="onError"
      @play="onPlay"
      @pause="onPause"
      @canplay="onCanPlay"
    ></video>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { usePlayerStore } from '../../stores/player.store'
import { volumeToAmplitude } from '../../../shared/utils/audio'

const playerStore = usePlayerStore()
const videoEl = ref<HTMLVideoElement | null>(null)
const videoUrl = ref('')
const retrying = ref(false)
let retryTimer: ReturnType<typeof setTimeout> | null = null
let errorCount = 0       // 当前视频的错误次数
let loadAttemptId = 0    // 递增ID，防止 stale callback
let lastEndedTime = 0    // 防止同一首歌重复触发 playerEnded
let lastTimeUpdate = 0   // 节流 onTimeUpdate，目标 ~30fps
let lastDuration = 0     // 去重 duration 更新，避免重复触发响应式

function setVideoRef(el: any) {
  videoEl.value = el instanceof HTMLVideoElement ? el : null
}

// 监听音量变化（感知线性化）
watch(() => playerStore.volume, (vol) => {
  if (videoEl.value) {
    videoEl.value.volume = volumeToAmplitude(vol)
  }
})

onMounted(() => {
  window.electronAPI.onPlayUrl(async (data: any) => {
    if (data.playerType !== 'video') {
      // 切换到音频时，停止视频播放并清理资源
      cleanupVideo()
      videoUrl.value = ''
      return
    }
    const url = data.song?.playUrl || ''
    playerStore.currentSong = data.song || null
    playerStore.playing = data.playing
    playerStore.playerType = data.playerType
    retrying.value = false
    errorCount = 0
    loadAttemptId++  // 新的加载周期

    if (url) {
      videoUrl.value = url
      // 等 Vue 渲染出 <video> 元素后，根据 playing 状态决定是否播放
      await nextTick()
      if (data.playing && videoEl.value) {
        videoEl.value.play().catch(() => {})
      }
    } else {
      videoUrl.value = ''
    }
  })

  window.electronAPI.onPlayerPause(() => {
    videoEl.value?.pause()
    playerStore.playing = false
  })

  window.electronAPI.onPlayerResume(() => {
    videoEl.value?.play().catch(() => {})
    playerStore.playing = true
  })

  window.electronAPI.onPlayerSeek((time: number) => {
    if (playerStore.playerType !== 'audio' && videoEl.value) {
      videoEl.value.currentTime = time
    }
  })
})

onUnmounted(() => {
  cleanupVideo()
})

function cleanupVideo() {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
  if (videoEl.value) {
    videoEl.value.pause()
    videoEl.value.removeAttribute('src')
    videoEl.value.load()
  }
}

function onLoaded() {
  if (videoEl.value && playerStore.currentSong) {
    playerStore.duration = videoEl.value.duration
    lastDuration = videoEl.value.duration
    // 初始化音量：感知线性化
    videoEl.value.volume = volumeToAmplitude(playerStore.volume)
  }
  retrying.value = false
  errorCount = 0
  lastTimeUpdate = 0
}

function onCanPlay() {
  // 视频可播放，清除错误倒计时
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
  retrying.value = false
  errorCount = 0
}

function onTimeUpdate() {
  if (!videoEl.value) return
  // 节流至 ~30fps（33ms），减少 Vue 响应式更新频率
  const now = performance.now()
  if (now - lastTimeUpdate < 33) return
  lastTimeUpdate = now

  playerStore.currentTime = videoEl.value.currentTime
  // 仅在 duration 变化时更新，避免每帧触发 computed 重算
  const dur = videoEl.value.duration
  if (dur > 0 && dur !== lastDuration) {
    lastDuration = dur
    playerStore.duration = dur
  }
}

function onEnded() {
  // 防止同一首歌短时间内重复触发 ended（音频切视频时可能触发）
  const now = Date.now()
  if (now - lastEndedTime < 2000) {
    console.warn('[VideoPlayer] 忽略重复ended事件')
    return
  }
  lastEndedTime = now
  window.electronAPI.playerEnded()
}

function onError() {
  // videoUrl 为空时忽略 error（元素销毁引起的误触发）
  if (!videoUrl.value) return
  errorCount++
  const currentAttempt = loadAttemptId
  console.warn(`[VideoPlayer] 视频错误 #${errorCount} (attempt=${currentAttempt})`)

  if (retryTimer) clearTimeout(retryTimer)

  // 第1-2次错误：等待后重新加载 src（ffmpeg 内部错误通常会自愈）
  if (errorCount <= 2) {
    retrying.value = true
    retryTimer = setTimeout(() => {
      retryTimer = null
      // 检查是否已被新视频替换
      if (currentAttempt !== loadAttemptId) {
        return
      }
      if (videoEl.value && videoEl.value.readyState >= 2) {
        // 视频已经有足够数据，尝试继续播放
        retrying.value = false
        videoEl.value.play().catch(() => {
          console.warn('[VideoPlayer] 恢复播放失败，重试为加载')
          // 重新设置 src 触发重新加载
          if (videoEl.value && videoEl.value.src) {
            const src = videoEl.value.src
            videoEl.value.src = ''
            videoEl.value.load()
            setTimeout(() => { if (videoEl.value) videoEl.value.src = src }, 200)
          }
        })
        return
      }
      // readyState 不够，尝试重载 src
      if (videoEl.value && videoEl.value.src) {
        const src = videoEl.value.src
        videoEl.value.src = ''
        videoEl.value.load()
        setTimeout(() => {
          if (videoEl.value && currentAttempt === loadAttemptId) {
            videoEl.value.src = src
          }
        }, 300)
      }
    }, 3000)  // 等待3秒让ffmpeg自愈
    return
  }

  // 第3+次错误：等待更长时间后最终放弃
  retrying.value = true
  retryTimer = setTimeout(() => {
    retryTimer = null
    if (currentAttempt !== loadAttemptId) return

    if (videoEl.value && videoEl.value.readyState >= 2) {
      retrying.value = false
      videoEl.value.play().catch(() => {
        console.warn('[VideoPlayer] 多次重试后恢复播放仍失败，跳过')
        retrying.value = false
        window.electronAPI.playerEnded()
      })
      return
    }
    retrying.value = false
    console.warn('[VideoPlayer] 多次重试后仍无法加载，切换到下一首')
    window.electronAPI.playerEnded()
  }, 8000)  // 第3次等待8秒
}

function onPlay() {
  playerStore.playing = true
  retrying.value = false
  errorCount = 0
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
}

function onPause() {
  // 忽略元素已销毁的异步 pause 事件（组件销毁/重建时 ref 已为 null）
  if (!videoEl.value) return
  // 忽略元素销毁/重建引起的异步 pause（此时 media.paused === false，实际仍在播放）
  if (!videoEl.value.paused) return
  playerStore.playing = false
}
</script>

<style scoped>
.video-player {
  height: 100%; display: flex; align-items: center; justify-content: center;
  background: #000000;
}
.video-el {
  width: 100%; height: 100%; object-fit: contain;
}
</style>