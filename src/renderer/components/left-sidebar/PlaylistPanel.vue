<script setup lang="ts">
import { ref, onMounted, nextTick, watch, computed } from 'vue'
import { usePlaylistStore } from '../../stores/playlist.store'
import { usePlayerStore } from '../../stores/player.store'
import { useSettingsStore } from '../../stores/settings.store'
import type { SongItem } from '@shared/types/song'

const playlistStore = usePlaylistStore()
const playerStore = usePlayerStore()
const settingsStore = useSettingsStore()

const searchText = ref('')
const searching = ref(false)
const idleSource = ref<'netease' | 'bilibili'>(settingsStore.settings.lastIdleSource)
const neteasePlaylistId = ref(settingsStore.settings.neteasePlaylistId)
const bilibiliFavUrl = ref(settingsStore.settings.bilibiliFavUrl)

/** 解析 B站 URL，支持三种格式：
 *  1. 收藏夹: https://space.bilibili.com/UID/favlist?fid=...
 *  2. 合集:    https://space.bilibili.com/UID/lists/SID?type=season
 *  3. 单个视频: https://www.bilibili.com/video/BVxxxx/...
 */
function parseBiliFavUrl(url: string): { type: 'fav' | 'season' | 'video'; uid: string; id: string; mediaId: string } | null {
  // 单个视频: /video/BVxxxx
  const bvMatch = url.match(/\/video\/(BV[\w]{10})/i)
  if (bvMatch) {
    const bvid = bvMatch[1]
    return { type: 'video', uid: '', id: bvid, mediaId: `fav:single_${bvid}` }
  }
  // 合集: /lists/{sid}
  const listMatch = url.match(/space\.bilibili\.com\/(\d+)\/lists\/(\d+)/)
  if (listMatch) {
    const uid = listMatch[1]
    const sid = listMatch[2]
    return { type: 'season', uid, id: sid, mediaId: `season:${uid}:${sid}` }
  }
  // 收藏夹: favlist?fid={fid}
  const fidMatch = url.match(/[?&]fid=(\d+)/)
  if (fidMatch) {
    const spaceMatch = url.match(/space\.bilibili\.com\/(\d+)/)
    const uid = spaceMatch ? spaceMatch[1] : ''
    return { type: 'fav', uid, id: fidMatch[1], mediaId: `fav:${fidMatch[1]}` }
  }
  return null
}
const loadingPlaylist = ref(false)
const idleCount = ref(0)
const idlePlaylistInfo = ref<{ name: string; owner: string; source: string } | null>(null)
const idleQueueStartIndex = ref(0)

// 根据设置决定是否显示空闲歌曲
const visibleQueue = computed(() => {
  if (settingsStore.settings.showIdleSongs) return playlistStore.queue
  const end = idleQueueStartIndex.value > 0 ? idleQueueStartIndex.value : playlistStore.queue.length
  return playlistStore.queue.slice(0, end)
})

// 存储 textEl 引用
const textElMap = new Map<string, HTMLElement>()

function bindTextEl(el: unknown, songId: string) {
  if (el instanceof HTMLElement) textElMap.set(songId, el)
}

/** hover 驱动：鼠标悬停 0.5s 后触发左右循环滚动 */
const marqueeTimers = new Map<string, ReturnType<typeof setTimeout>>()
const activeRolls = new Map<string, boolean>()

function startHover(songId: string) {
  activeRolls.set(songId, true)
  const timer = setTimeout(() => startRoll(songId), 500)
  marqueeTimers.set(songId, timer)
}

function stopHover(songId: string) {
  const t = marqueeTimers.get(songId)
  if (t) clearTimeout(t)
  marqueeTimers.delete(songId)
  activeRolls.delete(songId)
  // 立刻停止并回到原位
  const el = textElMap.get(songId)
  if (el) {
    const inner = el.querySelector<HTMLElement>('.song-inner')
    if (inner) {
      inner.style.transition = 'none'
      inner.style.transform = 'translate3d(0, 0, 0)'
    }
  }
}

function startRoll(songId: string) {
  if (!activeRolls.get(songId)) return
  const el = textElMap.get(songId)
  if (!el) return
  const inner = el.querySelector<HTMLElement>('.song-inner')
  if (!inner) return

  const overflow = inner.scrollWidth - el.clientWidth
  if (overflow < 2) return
  const scrollDur = Math.max(overflow / 70, 2)

  inner.style.transition = 'none'
  inner.style.transform = 'translate3d(0, 0, 0)'
  runScrollLeft(inner, overflow, scrollDur, songId)
}

/** 向左滚到底 → 停 2s → 向右滚回 → 停 2s → 循环 */
function runScrollLeft(inner: HTMLElement, offset: number, dur: number, songId: string) {
  if (!activeRolls.get(songId)) return
  inner.style.transition = `transform ${dur}s linear`
  inner.style.transform = `translate3d(${-offset}px, 0, 0)`

  const onEnd = () => {
    inner.removeEventListener('transitionend', onEnd)
    if (!activeRolls.get(songId)) return
    setTimeout(() => runScrollRight(inner, offset, dur, songId), 2000)
  }
  inner.addEventListener('transitionend', onEnd)
}

function runScrollRight(inner: HTMLElement, offset: number, dur: number, songId: string) {
  if (!activeRolls.get(songId)) return
  inner.style.transition = `transform ${dur}s linear`
  inner.style.transform = 'translate3d(0, 0, 0)'

  const onEnd = () => {
    inner.removeEventListener('transitionend', onEnd)
    if (!activeRolls.get(songId)) return
    setTimeout(() => runScrollLeft(inner, offset, dur, songId), 2000)
  }
  inner.addEventListener('transitionend', onEnd)
}

function detectMarquee() {
  // 双重 rAF + setTimeout 确保布局已完全收敛
  nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          // 分隔线滚动检测
          const divider = document.querySelector('.idle-divider-text') as HTMLElement | null
          if (divider) {
            const divOver = divider.scrollWidth - divider.clientWidth
            if (divOver > 2) {
              divider.style.setProperty('--divider-scroll', `-${divOver}px`)
              divider.classList.add('idle-divider-scroll')
            } else {
              divider.classList.remove('idle-divider-scroll')
            }
          }
        }, 50)
      })
    })
  })
}

// 深监听队列变化（包括水合后标题更新）重新检测溢出
watch(() => playlistStore.queue, () => detectMarquee(), { deep: true })

onMounted(async () => {
  // 获取空闲歌单信息
  try { idlePlaylistInfo.value = await window.electronAPI.getIdlePlaylistInfo() } catch {}
  try { idleQueueStartIndex.value = await window.electronAPI.getIdleQueueStartIndex() } catch {}
  // 首次渲染后检测溢出
  detectMarquee()
})

// 监听设置加载后更新本地 ref（持久化恢复时生效）
watch(() => settingsStore.settings.neteasePlaylistId, (v) => { neteasePlaylistId.value = v })
watch(() => settingsStore.settings.bilibiliFavUrl, (v) => { bilibiliFavUrl.value = v })
watch(() => settingsStore.settings.lastIdleSource, (v) => { idleSource.value = v })
// 队列变化时更新空闲歌曲起始索引和歌单信息
watch(() => playlistStore.queue.length, async () => {
  try { idleQueueStartIndex.value = await window.electronAPI.getIdleQueueStartIndex() } catch {}
  try { idlePlaylistInfo.value = await window.electronAPI.getIdlePlaylistInfo() } catch {}
})

async function manualSearch() {
  const keyword = searchText.value.trim()
  if (!keyword) return
  searching.value = true
  try {
    const song = await window.electronAPI.searchSong(keyword)
    if (song) {
      song.requesterName = '控制台'
      await window.electronAPI.playlistInsertTop(song)
      searchText.value = ''
    }
  } catch {} finally { searching.value = false }
}

async function applyIdlePlaylist() {
  settingsStore.settings.neteasePlaylistId = neteasePlaylistId.value
  settingsStore.settings.bilibiliFavUrl = bilibiliFavUrl.value
  loadingPlaylist.value = true
  try {
    const source = idleSource.value
    const parsed = source === 'bilibili' ? parseBiliFavUrl(bilibiliFavUrl.value) : null
    const id = source === 'netease' ? neteasePlaylistId.value : (parsed?.mediaId || '')
    if (!id) return
    // 手动操作：强制绕过 CD，直接 API 拉取
    const result = await window.electronAPI.refreshIdlePlaylistSingle(source, id, true)
    if (result.count !== undefined) idleCount.value = result.count
    if (result.info) idlePlaylistInfo.value = result.info
    // 持久化 lastIdleSource
    await window.electronAPI.setLastIdleSource(source)
    settingsStore.settings.lastIdleSource = source
  } catch {} finally { loadingPlaylist.value = false }
}

function onIdleInputBlur() {
  if (idleSource.value === 'netease' && neteasePlaylistId.value !== settingsStore.settings.neteasePlaylistId) {
    applyIdlePlaylist()
  } else if (idleSource.value === 'bilibili' && bilibiliFavUrl.value !== settingsStore.settings.bilibiliFavUrl) {
    applyIdlePlaylist()
  }
}

function onIdleInputEnter() {
  applyIdlePlaylist()
}

async function switchIdleSource(source: 'netease' | 'bilibili') {
  idleSource.value = source
  settingsStore.settings.lastIdleSource = source
  await window.electronAPI.setLastIdleSource(source)

  const parsed = source === 'bilibili' ? parseBiliFavUrl(bilibiliFavUrl.value) : null
  const id = source === 'netease' ? neteasePlaylistId.value : (parsed?.mediaId || '')

  // 后台预加载另一端：下次切回来时缓存已就绪，零等待
  const otherSource: 'netease' | 'bilibili' = source === 'netease' ? 'bilibili' : 'netease'
  const otherParsed = otherSource === 'bilibili' ? parseBiliFavUrl(bilibiliFavUrl.value) : null
  const otherId = otherSource === 'netease' ? neteasePlaylistId.value : (otherParsed?.mediaId || '')
  if (otherId) {
    window.electronAPI.cacheOnlyIdlePlaylist(otherSource, otherId).catch(() => {})
  }

  if (id) {
    try {
      const result = await window.electronAPI.loadIdlePlaylistFromCache(source, id)
      if (result?.success) {
        if (result.queue) playlistStore.updateQueue(result.queue)
        try { idlePlaylistInfo.value = await window.electronAPI.getIdlePlaylistInfo() } catch {}
        idleCount.value = result.count ?? 0
        return
      }
    } catch {}
    // 缓存未命中：切换源表头的歌单信息但不调用 API（用户需手动设置后刷新）
    idleCount.value = 0
    idlePlaylistInfo.value = null
  } else {
    idleCount.value = 0
    idlePlaylistInfo.value = null
  }
}

async function removeSong(song: SongItem) {
  playlistStore.removeSong(song.id)
}
</script>

<template>
  <div class="playlist-panel">
    <!-- 手动点歌框 -->
    <div class="search-bar">
      <input
        v-model="searchText"
        class="search-input"
        placeholder="歌名 / BV号 / 歌曲ID"
        @keyup.enter="manualSearch"
      />
      <button class="search-btn" @click="manualSearch" :disabled="searching">
        {{ searching ? '搜索中' : '点歌' }}
      </button>
    </div>

    <!-- 播放队列 -->
    <div class="panel-header">
      <span>队列 [{{ playlistStore.queue.length }}]</span>
      <button class="btn-sm" @click="playlistStore.clearQueue()">清空</button>
    </div>
    <div class="song-list">
      <template v-for="(song, index) in visibleQueue" :key="song.id">
        <!-- 空闲歌单分隔线（仅在显示空闲歌曲时出现） -->
        <div
          v-if="index === idleQueueStartIndex && idleQueueStartIndex > 0 && idlePlaylistInfo && settingsStore.settings.showIdleSongs"
          class="idle-divider"
        >
          <span class="idle-divider-text">{{ idlePlaylistInfo.name }}<span v-if="idlePlaylistInfo.owner"> - {{ idlePlaylistInfo.owner }}</span></span>
        </div>
        <div
          class="song-item"
          :class="{ active: playerStore.currentSong?.id === song.id }"
          @mouseenter="startHover(song.id)"
          @mouseleave="stopHover(song.id)"
        >
        <span class="song-index" v-if="settingsStore.settings.showIdleSongs ? index < idleQueueStartIndex : true">{{ index + 1 }}</span>
        <span class="song-index idle-idx" v-else>-</span>
        <div class="song-info">
          <div class="song-line">
            <div
                class="song-text"
                :ref="(el: any) => bindTextEl(el, song.id)"
              >
              <span class="song-inner">
                <span class="song-title">{{ song.title }}</span>
                <span class="song-dash"> - </span>
                <span class="song-artist">{{ song.artist }}</span>
              </span>
            </div>
            <span class="song-source" v-if="song.source === 'bilibili'">[B站]</span>
            <span class="song-requester" v-if="song.requesterName">| {{ song.requesterName }}</span>
          </div>
        </div>
        <button class="del-btn" @click="removeSong(song)" title="移除">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      </template>
      <div v-if="playlistStore.queue.length === 0" class="empty-hint">等待点歌...</div>
    </div>

    <!-- 空闲歌单 -->
    <div class="idle-section">
      <div class="panel-header">
        <span>空闲歌单</span>
        <div class="source-toggle">
          <button
            class="toggle-btn"
            :class="{ active: idleSource === 'netease' }"
            @click="switchIdleSource('netease')"
          >网易云</button>
          <button
            class="toggle-btn"
            :class="{ active: idleSource === 'bilibili' }"
            @click="switchIdleSource('bilibili')"
          >B站</button>
        </div>
      </div>
      <div class="idle-inputs">
        <div class="idle-row" v-if="idleSource === 'netease'">
          <label class="idle-label">歌单ID</label>
          <input
            v-model="neteasePlaylistId"
            class="idle-input"
            placeholder="歌单分享链接中的数字"
            @keyup.enter="onIdleInputEnter"
            @blur="onIdleInputBlur"
          />
          <span class="idle-status" v-if="idleCount > 0">+{{ idleCount }}</span>
          <span class="idle-loading" v-if="loadingPlaylist">...</span>
        </div>
        <div class="idle-row" v-else>
          <label class="idle-label">地址</label>
          <input
            v-model="bilibiliFavUrl"
            class="idle-input"
            placeholder="公开收藏夹/合集/分P视频"
            @keyup.enter="onIdleInputEnter"
            @blur="onIdleInputBlur"
          />
          <span class="idle-status" v-if="idleCount > 0">+{{ idleCount }}</span>
          <span class="idle-loading" v-if="loadingPlaylist">...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.playlist-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.panel-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 5px 10px; font-size: 12px; font-weight: 600; color: var(--text-primary);
  border-bottom: 1px solid var(--border); background: var(--bg-tertiary);
}
/* 点歌框 */
.search-bar { display: flex; gap: 4px; padding: 6px 8px; border-bottom: 1px solid var(--border); }
.search-input {
  flex: 1; min-width: 0; padding: 4px 8px; font-size: 12px;
  background: var(--input-bg); border: 1px solid var(--input-border);
  color: var(--text-primary); outline: none;
}
.search-input:focus { border-color: var(--accent); }
.search-input::placeholder { color: var(--text-muted); }
.search-btn {
  padding: 4px 10px; font-size: 12px; border: none; border-radius: 0;
  background: var(--accent); color: var(--btn-primary-text); cursor: pointer; white-space: nowrap;
}
.search-btn:hover { opacity: 0.85; }
.search-btn:disabled { opacity: 0.5; cursor: default; }

/* 歌曲列表 */
.song-list { flex: 1; overflow-y: auto; padding: 0 6px; }
.song-item {
  display: flex; align-items: center; padding: 6px 6px; gap: 6px;
  cursor: pointer; border-bottom: 1px solid var(--border); font-size: 12px;
}
.song-item:hover { background: var(--bg-tertiary); }
.song-item.active { background: var(--accent); }
.song-item.active .song-text { color: var(--btn-primary-text); }
.song-item.active .song-source, .song-item.active .song-requester { color: rgba(255,255,255,0.75); }
.song-index { color: var(--text-muted); width: 14px; text-align: center; font-size: 11px; flex-shrink: 0; }
.song-index.idle-idx { color: var(--text-muted); opacity: 0.35; }
.song-info { flex: 1; min-width: 0; overflow: hidden; }
.song-line {
  display: flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden;
}
.song-text {
  overflow: hidden; min-width: 0;
  /* 留给 hover 的 JS 驱动滚动使用，不要任何 animation */
}
.song-inner {
  display: inline-block; white-space: nowrap; will-change: transform;
}
.song-title { color: var(--text-primary); }
.song-dash { color: var(--text-muted); margin: 0 2px; }
.song-artist { color: var(--text-secondary); }
.song-source { font-size: 10px; color: #ce9178; flex-shrink: 0; }
.song-requester { font-size: 10px; color: #569cd6; flex-shrink: 0; }
.empty-hint { padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px; }

/* 删除按钮 - 仅在hover时显示，非hover时折叠不占空间 */
.del-btn {
  width: 0; height: 20px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--text-muted); cursor: pointer;
  border-radius: 0; flex-shrink: 0; opacity: 0; overflow: hidden; padding: 0;
  transition: width 0.12s, opacity 0.12s, background 0.12s, color 0.12s;
}
.song-item:hover .del-btn { width: 22px; opacity: 1; }
.del-btn:hover { background: #e74c3c; color: #fff; }

/* 空闲歌单分隔线 */
.idle-divider {
  padding: 3px 14px; font-size: 10px; color: var(--text-muted);
  background: var(--bg-tertiary); border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  overflow: hidden;
}
.idle-divider-text {
  display: inline-block; white-space: nowrap; opacity: 0.7;
}
.idle-divider-text.idle-divider-scroll {
  animation: divider-marquee 8s linear infinite;
}
@keyframes divider-marquee {
  0%   { transform: translateX(0); }
  10%  { transform: translateX(0); }
  50%  { transform: translateX(var(--divider-scroll, -40px)); }
  60%  { transform: translateX(var(--divider-scroll, -40px)); }
  100% { transform: translateX(0); }
}

/* 空闲歌单 */
.idle-section { border-top: 1px solid var(--border); flex-shrink: 0; }
.idle-info {
  padding: 2px 10px; font-size: 10px; color: var(--text-muted); overflow: hidden;
  white-space: nowrap; text-overflow: ellipsis; border-bottom: 1px solid var(--border);
}
.idle-info-name { color: var(--text-secondary); }
.idle-info-owner { color: var(--text-muted); }
.idle-inputs { padding: 6px 10px; }
.idle-row { display: flex; align-items: center; gap: 6px; }
.idle-label { font-size: 11px; color: var(--text-secondary); white-space: nowrap; }
.idle-input {
  flex: 1; min-width: 0; height: 24px; padding: 0 6px; font-size: 11px;
  background: var(--input-bg); border: 1px solid var(--input-border);
  color: var(--text-primary); outline: none; box-sizing: border-box;
  border-radius: 0; box-shadow: none; appearance: none; -webkit-appearance: none;
}
.idle-input:focus { border-color: var(--accent); }
.idle-status { font-size: 10px; color: var(--accent); flex-shrink: 0; }
.idle-loading { font-size: 10px; color: var(--text-muted); flex-shrink: 0; }

/* 源切换按钮 */
.source-toggle { display: flex; gap: 0; }
.toggle-btn {
  padding: 2px 2px; font-size: 10px; border: 1px solid var(--border);
  background: var(--bg-primary); color: var(--text-muted); cursor: pointer;
  border-radius: 0; width: 43px; text-align: center;
}
.toggle-btn:last-child { margin-left: -1px; }
.toggle-btn.active { background: var(--accent); color: var(--btn-primary-text); border-color: var(--accent); }
.toggle-btn:hover:not(.active) { background: var(--bg-tertiary); }

.btn-sm {
  padding: 3px 8px; border: none; border-radius: 0;
  background: var(--btn-bg); color: var(--btn-text); font-size: 11px; cursor: pointer;
}
.btn-sm:hover { background: var(--btn-hover-bg); }
</style>