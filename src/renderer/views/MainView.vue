<template>
  <div class="main-layout">
    <TitleBar />
    <div class="main-body">
      <div class="left-sidebar" :style="{ width: leftWidth + 'px' }">
        <SidebarTabs />
        <AccountPanel />
      </div>
      <div
        class="splitter splitter-h"
        @mousedown="startDragSplitter($event, 'h')"
      ></div>
      <div class="right-content">
        <div class="player-upper" :style="{ height: upperHeight + 'px', '--cover-size': Math.round(Math.min(upperHeight * 0.91, 800)) + 'px' }">
          <CoverDisplay />
          <SongInfo />
        </div>
        <div
          class="splitter splitter-v"
          @mousedown="startDragSplitter($event, 'v')"
        ></div>
        <div class="player-lower">
          <LyricsDisplay v-if="playerStore.currentSong && playerStore.playerType === 'audio'" />
          <VideoPlayer v-else-if="playerStore.currentSong && playerStore.playerType === 'video'" />
        </div>
        <ProgressBar />
      </div>
    </div>
    <SettingsModal v-if="authStore.showSettings" @close="authStore.closeSettings" />
    <AudioPlayer />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject, watch } from 'vue'
import { useAuthStore } from '../stores/auth.store'
import { usePlaylistStore } from '../stores/playlist.store'
import { usePlayerStore } from '../stores/player.store'
import { useSettingsStore } from '../stores/settings.store'
import { useDanmakuStore } from '../stores/danmaku.store'
import TitleBar from '../components/titlebar/TitleBar.vue'
import SidebarTabs from '../components/left-sidebar/SidebarTabs.vue'
import AccountPanel from '../components/left-sidebar/AccountPanel.vue'
import CoverDisplay from '../components/player/CoverDisplay.vue'
import SongInfo from '../components/player/SongInfo.vue'
import LyricsDisplay from '../components/player/LyricsDisplay.vue'
import VideoPlayer from '../components/player/VideoPlayer.vue'
import AudioPlayer from '../components/player/AudioPlayer.vue'
import ProgressBar from '../components/player/ProgressBar.vue'
import SettingsModal from '../components/settings/SettingsModal.vue'

const authStore = useAuthStore()
const playlistStore = usePlaylistStore()
const playerStore = usePlayerStore()
const settingsStore = useSettingsStore()
const danmakuStore = useDanmakuStore()

/** 解析 B站 URL → 复合 ID */
function parseBiliFavMediaId(url: string): string {
  // 单个视频: /video/BVxxxx
  const bvMatch = url.match(/\/video\/(BV[\w]{10})/i)
  if (bvMatch) return `fav:single_${bvMatch[1]}`
  // 合集: /lists/{sid}
  const listMatch = url.match(/space\.bilibili\.com\/(\d+)\/lists\/(\d+)/)
  if (listMatch) return `season:${listMatch[1]}:${listMatch[2]}`
  // 收藏夹: favlist?fid={fid}
  const fidMatch = url.match(/[?&]fid=(\d+)/)
  if (fidMatch) return `fav:${fidMatch[1]}`
  return ''
}

// App.vue 提供的就绪回调：等主界面数据全部加载完成后通知移除加载屏
const signalMainReady = inject<() => void>('signalMainReady', () => {})
// App.vue 提供的进度回调：更新加载屏上的文字和进度条
const updateLoadingProgress = inject<(pct: number, task: string) => void>('updateLoadingProgress', () => {})

// ======= 可拖拽分割条 =======
const leftWidth = ref(settingsStore.settings.splitterLeft)
const upperHeight = ref(settingsStore.settings.splitterUpper)

// 同步 store 中的分屏位置到 UI ref（覆盖持久化恢复/重置场景）
watch(() => settingsStore.settings.splitterLeft, (v) => { leftWidth.value = v })
watch(() => settingsStore.settings.splitterUpper, (v) => { upperHeight.value = v })

type DragAxis = 'h' | 'v'

function startDragSplitter(e: MouseEvent, axis: DragAxis) {
  e.preventDefault()
  const startX = e.clientX
  const startY = e.clientY
  const startW = leftWidth.value
  const startH = upperHeight.value

  const onMove = (ev: MouseEvent) => {
    if (axis === 'h') {
      const newW = Math.max(160, Math.min(400, startW + (ev.clientX - startX)))
      leftWidth.value = newW
    } else {
      const rightEl = document.querySelector('.right-content') as HTMLElement
      const maxH = rightEl ? rightEl.clientHeight * 0.6 : 500
      const newH = Math.max(100, Math.min(maxH, startH + (ev.clientY - startY)))
      upperHeight.value = newH
    }
  }

  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    // 持久化位置
    settingsStore.settings.splitterLeft = leftWidth.value
    settingsStore.settings.splitterUpper = upperHeight.value
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// ======= 全局键盘快捷键 =======
let keyRepeatTimers: Record<string, ReturnType<typeof setInterval> | null> = {}

function handleKeyDown(e: KeyboardEvent) {
  // 忽略输入框中的按键（包括 contenteditable 元素）
  const target = e.target as HTMLElement
  const tag = target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (target?.isContentEditable || target?.closest('[contenteditable="true"]')) return

  switch (e.code) {
    case 'Space': {
      e.preventDefault()
      if (playerStore.playing) playerStore.pause()
      else playerStore.resume()
      break
    }
    case 'ArrowLeft': {
      e.preventDefault()
      if (keyRepeatTimers['left']) return // 已有长按定时器，不重复触发
      const SEEK_STEP = 0.5
      const SEEK_INTERVAL = 10
      const target = Math.max(0, playerStore.currentTime - SEEK_STEP)
      playerStore.seek(target)
      keyRepeatTimers['left'] = setInterval(() => {
        const t = Math.max(0, playerStore.currentTime - SEEK_STEP)
        playerStore.seek(t)
      }, SEEK_INTERVAL)
      break
    }
    case 'ArrowRight': {
      e.preventDefault()
      if (keyRepeatTimers['right']) return
      const SEEK_STEP = 0.5
      const SEEK_INTERVAL = 10
      const target = Math.min(playerStore.duration, playerStore.currentTime + SEEK_STEP)
      playerStore.seek(target)
      keyRepeatTimers['right'] = setInterval(() => {
        const t = Math.min(playerStore.duration, playerStore.currentTime + SEEK_STEP)
        playerStore.seek(t)
      }, SEEK_INTERVAL)
      break
    }
    case 'ArrowUp': {
      e.preventDefault()
      playerStore.setVolume(Math.min(100, playerStore.volume + 5))
      break
    }
    case 'ArrowDown': {
      e.preventDefault()
      playerStore.setVolume(Math.max(0, playerStore.volume - 5))
      break
    }
  }
}

function handleKeyUp(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  const tag = target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (target?.isContentEditable || target?.closest('[contenteditable="true"]')) return
  if (e.code === 'ArrowLeft' && keyRepeatTimers['left']) {
    clearInterval(keyRepeatTimers['left']!)
    keyRepeatTimers['left'] = null
  }
  if (e.code === 'ArrowRight' && keyRepeatTimers['right']) {
    clearInterval(keyRepeatTimers['right']!)
    keyRepeatTimers['right'] = null
  }
}

// 需要焦点在窗口内才生效（document level）
document.addEventListener('keydown', handleKeyDown)
document.addEventListener('keyup', handleKeyUp)

// OBS 轮询定时器引用（事件驱动模式下已移除）

onMounted(async () => {
  // ====== 关闭前保存：显式保存设置后再通知主进程可退出 ======
  window.electronAPI.onBeforeClose(async () => {
    try { await settingsStore.save() } catch (e) { console.error('[MainView] 关闭前保存失败:', e) }
    window.electronAPI.appSaveDone()
  })

  // 音量变化自动保存到设置
  watch(() => playerStore.volume, (vol) => {
    settingsStore.settings.volume = vol
  })

  // ====== 1. 加载基础数据 ======
  await playlistStore.loadQueue()
  await playlistStore.loadFavorites()
  // boot + app + style 数据已在 App.vue initApp 中通过三阶段加载完成

  // ====== 2. 注册 IPC 监听器 ======
  window.electronAPI.onDanmakuStatusChanged((s: any) => danmakuStore.updateStatus(s))
  window.electronAPI.onDanmakuMessage((msg: any) => danmakuStore.addMessage(msg))
  window.electronAPI.onPlaylistUpdated((list: any[]) => playlistStore.updateQueue(list))
  window.electronAPI.onPlayerStateChanged((state: any) => playerStore.updateState(state))
  window.electronAPI.onPlayerTimeUpdate((t: number, d: number) => playerStore.updateTime(t, d))
  window.electronAPI.onLyricUpdate((lyric: any[]) => playerStore.updateLyrics(lyric))
  window.electronAPI.onAuthStateChanged((state: any) => authStore.authState = state)
  window.electronAPI.onLogAdd((msg: string) => danmakuStore.addLog(msg))

  // ====== 3. 从缓存恢复空闲歌单到队列（快速恢复上次退出时的状态） ======
  const source = settingsStore.settings.lastIdleSource
  const id = source === 'netease'
    ? settingsStore.settings.neteasePlaylistId
    : parseBiliFavMediaId(settingsStore.settings.bilibiliFavUrl)

  const sourceLabel = source === 'netease' ? '网易云歌单' : 'B站视频列表'
  let firstFromIpc: any = null

  updateLoadingProgress(65, `正在加载${sourceLabel}缓存...`)
  if (id) {
    try {
      const r3 = await window.electronAPI.loadIdlePlaylistFromCache(source, id)
      if (r3?.queue?.length) {
        playlistStore.updateQueue(r3.queue)
        firstFromIpc = r3.firstSong || null
      }
    } catch {}
  }

  // ====== 4. 异步刷新空闲歌单（CD期内跳过API调用，非CD期自动更新） ======
  updateLoadingProgress(75, `正在刷新${sourceLabel}...`)
  if (id) {
    try {
      const r4 = await window.electronAPI.refreshIdlePlaylistSingle(source, id, false)
      if (r4?.queue?.length) {
        playlistStore.updateQueue(r4.queue)
        firstFromIpc = r4.firstSong || firstFromIpc
      } else if (r4?.firstSong) {
        firstFromIpc = r4.firstSong
      }
    } catch {}
  }

  // ====== 4.5 预加载另一端的歌单到缓存（不干扰当前队列） ======
  const otherSource = source === 'netease' ? 'bilibili' : 'netease'
  const otherId = otherSource === 'netease'
    ? settingsStore.settings.neteasePlaylistId
    : parseBiliFavMediaId(settingsStore.settings.bilibiliFavUrl)
  if (otherId) {
    const otherLabel = otherSource === 'netease' ? '网易云歌单' : 'B站视频列表'
    updateLoadingProgress(85, `正在预加载${otherLabel}...`)
    await window.electronAPI.cacheOnlyIdlePlaylist(otherSource, otherId).catch(() => {})
  }

  // ====== 5. 设置首曲信息（暂停状态，高亮队列第一项，根据源设 playerType） ======
  // 优先使用 IPC 响应中的同步数据，确保 overlay 淡出前 playerStore 已就绪
  const first = firstFromIpc || (playlistStore.queue.length > 0 ? playlistStore.queue[0] : null)
  if (first) {
    playerStore.updateState({
      playing: false,
      currentSong: first,
      playerType: first.source === 'bilibili' ? 'video' : 'audio'
    })
  }

  // ====== 6. 从设置恢复音量 ======
  playerStore.setVolume(settingsStore.settings.volume)

  // ====== 7. B站直播间自动连接 ======
  if (authStore.authState.bilibili) {
    try {
      const roomInfo = await window.electronAPI.getBilibiliLiveRoom()
      if (roomInfo && roomInfo.roomId > 0) {
        settingsStore.settings.roomId = roomInfo.roomId
        danmakuStore.addLog(`自动读取直播间: ${roomInfo.roomId}`)
        await window.electronAPI.connectDanmaku(roomInfo.roomId)
      }
    } catch (e) { console.error('[MainView] getBilibiliLiveRoom failed:', e) }
  }

  // ====== 8. 启动 OBS 叠加层 HTTP 服务（如果设置中已启用） ======
  updateLoadingProgress(95, '正在启动 OBS 叠加层服务...')
  try {
    const result = await window.electronAPI.startObsIfEnabled()
  } catch {}

  // ====== 9. 通知 App 加载完成，淡出加载屏 ======
  updateLoadingProgress(100, '加载完成')
  signalMainReady()

  // ====== 10. OBS 叠加层实时广播（歌词 / 队列 / 歌曲信息） ======
  // 防抖合并短时间内的多次变化
  let obsTimer: ReturnType<typeof setTimeout> | null = null
  let obsPending = false

  function scheduleObsBroadcast() {
    if (obsTimer) clearTimeout(obsTimer)
    obsTimer = setTimeout(() => {
      obsTimer = null
      doObsBroadcast()
    }, 50)
  }

  function doObsBroadcast() {
    if (obsPending) return
    obsPending = true
    try {
      // 歌词：text 和 translation 分别发送，确保 OBS 页面可分两行渲染
      const lyrics = playerStore.lyrics
      const line = (lyrics.length > 0 && playerStore.currentLyricIndex >= 0 && playerStore.currentLyricIndex < lyrics.length)
        ? lyrics[playerStore.currentLyricIndex]
        : null
      const isVideo = playerStore.currentSong?.source === 'bilibili'
      if (isVideo) {
        // 视频源无歌词，发送空文本让 OBS 叠加层使用自身配置的空闲文本
        window.electronAPI.obsBroadcastLyric('', '')
      } else if (line) {
        const translation = (settingsStore.settings.showLyricTranslation && line.translation) ? line.translation : ''
        window.electronAPI.obsBroadcastLyric(line.text || '', translation)
      } else {
        window.electronAPI.obsBroadcastLyric('', '')
      }

      // 队列
      const songs = playlistStore.queue.map((s, i) => ({
        index: i + 1,
        title: s.title,
        artist: s.artist,
        requesterName: s.requesterName || ''
      }))
      window.electronAPI.obsBroadcastQueue(songs, Math.max(0, playlistStore.queue.findIndex(s => s.id === playerStore.currentSong?.id)))

      // 歌曲信息
      window.electronAPI.obsBroadcastSongInfo(
        playerStore.currentSong?.title || '',
        playerStore.currentSong?.artist || '',
        playerStore.currentSong?.requesterName || ''
      )
    } catch {} finally {
      obsPending = false
    }
  }

  // 监听变化源，统一触发防抖广播（事件驱动，无需轮询）
  watch(() => [playerStore.currentLyricIndex, playerStore.currentSong?.title], scheduleObsBroadcast)
  watch(() => playlistStore.queue, scheduleObsBroadcast, { deep: true })
  watch(() => playerStore.currentSong, scheduleObsBroadcast)
})

onUnmounted(() => {
  // 事件驱动模式：无需清理轮询定时器
})
</script>

<style scoped>
.main-layout { display: flex; flex-direction: column; height: 100vh; background: var(--bg-primary); color: var(--text-primary); }
.main-body { display: flex; flex: 1; overflow: hidden; }
.left-sidebar { display: flex; flex-direction: column; border-right: 1px solid var(--border); background: var(--sidebar-bg); flex-shrink: 0; }
.splitter { flex-shrink: 0; background: var(--border); transition: background 0.15s; }
.splitter:hover { background: var(--accent); }
.splitter-h { width: 2px; cursor: col-resize; }
.splitter-v { height: 2px; cursor: row-resize; }
.right-content { flex: 1; display: flex; flex-direction: column; padding: 12px; overflow: hidden; }
.player-upper { display: flex; gap: 12px; flex-shrink: 0; }
.player-lower { flex: 1; overflow: hidden; border: 1px solid var(--border); background: var(--bg-primary); }
</style>