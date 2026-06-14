<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>设置</h2>
        <button class="close-btn" @click="$emit('close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="modal-layout">
        <!-- 左侧导航栏 -->
        <nav class="settings-nav">
          <button
            v-for="item in navItems"
            :key="item.id"
            class="nav-item"
            :class="{ active: activeNav === item.id }"
            @click="scrollToSection(item.id)"
          >{{ item.label }}</button>
        </nav>
        <!-- 右侧内容区 -->
        <div ref="settingsBodyRef" class="modal-body" @scroll="onBodyScroll">
        <!-- 帐号 -->
        <div id="section-account" class="section">
          <h3>帐号</h3>
          <div class="setting-row">
            <span>B站: {{ authStore.authState.bilibili ? authStore.authState.bilibiliUname : '未登录' }}</span>
            <button class="btn" @click="logoutBilibili" v-if="authStore.authState.bilibili">退出登录</button>
          </div>
          <div class="setting-row">
            <span>网易云: {{ authStore.authState.netease ? authStore.authState.neteaseUname : '未登录' }}</span>
            <button class="btn" @click="logoutNetease" v-if="authStore.authState.netease">退出登录</button>
          </div>
        </div>

        <!-- 外观 -->
        <div id="section-appearance" class="section">
          <h3>外观</h3>
          <div class="setting-row">
            <span>主题</span>
            <button class="btn" @click="settingsStore.toggleTheme()">
              {{ settingsStore.settings.theme === 'dark' ? '暗色' : '亮色' }}
            </button>
          </div>
          <div class="setting-row">
            <span>主题颜色</span>
            <div class="accent-picker-row">
              <ColorPicker :model-value="settingsStore.settings.accentColor" @update:model-value="settingsStore.setAccentColor($event)" />
              <button class="reset-btn" @click="resetAccent()">恢复默认</button>
            </div>
          </div>
        </div>

        <!-- 窗口 -->
        <div id="section-window" class="section">
          <h3>窗口</h3>
          <div class="setting-row">
            <span>窗口置顶</span>
            <label class="toggle-label">
              <input type="checkbox" :checked="alwaysOnTop" @change="toggleAlwaysOnTop" />
              <span class="toggle-text">{{ alwaysOnTop ? '已开启' : '已关闭' }}</span>
            </label>
          </div>
          <div class="setting-row">
            <span>固定大小</span>
            <label class="toggle-label">
              <input type="checkbox" :checked="!isResizable" @change="toggleResizable" />
              <span class="toggle-text">{{ isResizable ? '可调整' : '已固定' }}</span>
            </label>
          </div>
        </div>

        <!-- 弹幕 -->
        <div id="section-danmaku" class="section">
          <h3>弹幕</h3>
          <div class="setting-row">
            <span>显示弹幕时间</span>
            <label class="toggle-label">
              <input type="checkbox" :checked="settingsStore.settings.showDanmakuTime" @change="toggleDanmakuTime" />
              <span class="toggle-text">{{ settingsStore.settings.showDanmakuTime ? '显示' : '隐藏' }}</span>
            </label>
          </div>
        </div>

        <!-- 点歌规则 -->
        <div id="section-song-request" class="section">
          <h3>点歌规则</h3>
          <div class="setting-row">
            <span>同用户间隔(秒)</span>
            <input v-model.number="settingsStore.settings.userCooldown" type="number" class="input" />
          </div>
          <div class="setting-row">
            <span>队列上限</span>
            <input v-model.number="settingsStore.settings.maxQueueSize" type="number" class="input" />
          </div>
          <div class="setting-row">
            <span>同歌曲间隔(秒)</span>
            <input v-model.number="settingsStore.settings.songCooldown" type="number" class="input" />
          </div>
        </div>

        <!-- 缓存 -->
        <div id="section-cache" class="section">
          <h3>本地缓存</h3>
          <div class="cache-list" v-if="cacheSongs.length > 0">
            <div v-for="(entry, i) in cacheSongs" :key="entry.songId || entry.id" class="cache-item">
              <button class="add-btn" @click="playCached(entry)" title="添加到队列">+</button>
              <span class="cache-idx">{{ i + 1 }}</span>
              <span class="cache-title">{{ entry.title }}</span>
              <span class="cache-artist">{{ entry.artist }}</span>
            </div>
          </div>
          <div v-else class="cache-empty">暂无缓存</div>
          <button v-if="cacheSongs.length > 0" class="btn clear-cache-btn" @click="clearAllCache">清空缓存</button>
          <p class="section-desc" style="margin-top: 6px;">点击加号再次添加到队列</p>
        </div>

        <!-- 歌词 -->
        <div id="section-lyric" class="section">
          <h3>歌词</h3>
          <div class="setting-row">
            <span>显示翻译</span>
            <label class="toggle-label">
              <input type="checkbox" :checked="settingsStore.settings.showLyricTranslation" @change="toggleTranslation" />
              <span class="toggle-text">{{ settingsStore.settings.showLyricTranslation ? '已开启' : '已关闭' }}</span>
            </label>
          </div>
          <div class="setting-row">
            <span>翻译分行</span>
            <label class="toggle-label">
              <input type="checkbox" :checked="settingsStore.settings.splitLyricTranslation" @change="toggleSplitTranslation" />
              <span class="toggle-text">{{ settingsStore.settings.splitLyricTranslation ? '分两行' : '合并为一行' }}</span>
            </label>
          </div>
          <div class="setting-row">
            <span>歌词延迟</span>
            <div class="range-row">
              <span class="range-value">{{ settingsStore.settings.lyricDelay }}ms</span>
              <input
                type="range"
                min="0"
                max="1000"
                step="10"
                v-model.number="settingsStore.settings.lyricDelay"
                class="range-slider"
              />
            </div>
          </div>
          <div class="setting-row">
            <span>字体大小</span>
            <div class="range-row">
              <span class="range-value">{{ settingsStore.settings.lyricFontSize }}px</span>
              <input
                type="range"
                min="10"
                max="30"
                v-model.number="settingsStore.settings.lyricFontSize"
                class="range-slider"
              />
            </div>
          </div>
          <div class="setting-row">
            <span>段落间距</span>
            <div class="range-row">
              <span class="range-value">{{ settingsStore.settings.lyricLineSpacing }}px</span>
              <input
                type="range"
                min="0"
                max="50"
                v-model.number="settingsStore.settings.lyricLineSpacing"
                class="range-slider"
              />
            </div>
          </div>
        </div>

        <!-- 空闲歌单设置 -->
        <div id="section-idle" class="section">
          <h3>空闲歌单</h3>
          <div class="setting-row">
            <span>显示空闲歌曲</span>
            <label class="toggle-label">
              <input type="checkbox" :checked="settingsStore.settings.showIdleSongs" @change="settingsStore.settings.showIdleSongs = !settingsStore.settings.showIdleSongs" />
              <span class="toggle-text">{{ settingsStore.settings.showIdleSongs ? '显示' : '隐藏' }}</span>
            </label>
          </div>
          <div class="setting-row">
            <span>待选数量</span>
            <div class="range-row">
              <span class="range-value">{{ idleQueueSize }} 首</span>
              <input
                type="range"
                min="2"
                max="5"
                v-model.number="idleQueueSize"
                @change="saveIdleQueueSize"
                class="range-slider"
              />
            </div>
          </div>
        </div>

        <!-- OBS 叠加层 -->
        <div id="section-obs-overlay" class="section">
          <h3>OBS 叠加层</h3>
          <div class="setting-row">
            <span>启用 HTTP 服务（实时推送到 OBS 浏览器源）</span>
            <label class="toggle-label">
              <input type="checkbox" v-model="settingsStore.settings.obsOverlayEnabled" @change="onObsOverlayToggled($event)" />
              <span class="toggle-text">{{ settingsStore.settings.obsOverlayEnabled ? '已开启' : '已关闭' }}</span>
            </label>
          </div>
          <template v-if="settingsStore.settings.obsOverlayEnabled">
            <div class="setting-row">
              <span>样式设置地址</span>
              <div class="path-row">
                <input :value="obsPort > 0 ? `http://localhost:${obsPort}/style` : ''" readonly class="input input-path" style="max-width: 249px" placeholder="http://localhost:4680/style" />
                <button class="btn" @click="copyObsUrl('style')">复制</button>
                <button class="btn" @click="openStyleWindow">打开</button>
              </div>
            </div>
            <div class="setting-row">
              <span>歌词叠加层</span>
              <div class="path-row">
                <input :value="obsPort > 0 ? `http://localhost:${obsPort}/lyric` : ''" readonly class="input input-path" placeholder="http://localhost:4680/lyric" />
                <button class="btn" @click="copyObsUrl('lyric')">复制</button>
              </div>
            </div>
            <div class="setting-row">
              <span>队列叠加层</span>
              <div class="path-row">
                <input :value="obsPort > 0 ? `http://localhost:${obsPort}/queue` : ''" readonly class="input input-path" placeholder="http://localhost:4680/queue" />
                <button class="btn" @click="copyObsUrl('queue')">复制</button>
              </div>
            </div>
            <div class="setting-row">
              <span>歌信息叠加层</span>
              <div class="path-row">
                <input :value="obsPort > 0 ? `http://localhost:${obsPort}/songinfo` : ''" readonly class="input input-path" placeholder="http://localhost:4680/songinfo" />
                <button class="btn" @click="copyObsUrl('songinfo')">复制</button>
              </div>
            </div>
            <p class="section-desc">
              在浏览器中打开「样式设置地址」可调整各叠加层的字体、颜色等样式。<br/>
              将歌词/队列/歌曲地址粘贴到 OBS「浏览器」源即可实时捕获。
            </p>
          </template>
        </div>

        <!-- 日志 -->
        <div id="section-log" class="section">
          <h3>日志</h3>
          <div ref="logContainerRef" class="log-container">
            <div v-for="(log, i) in danmakuStore.logs" :key="i" class="log-line">{{ log }}</div>
            <div v-if="danmakuStore.logs.length === 0" class="log-empty">暂无日志</div>
          </div>
        </div>

        <!-- 关于 -->
        <div id="section-about" class="section">
          <h3>关于</h3>
          <div class="about-header">
            <span class="about-text">BxNcm DJ v1.1.0 by Taumata<br/>技术栈: Vue3 + Electron + TypeScript</span>
            <div class="about-actions">
              <button class="btn dev-btn" @click="openDevTools">Dev</button>
              <button class="btn reset-data-btn" @click="resetAllData">重置数据</button>
            </div>
          </div>
        </div>
      </div><!-- end modal-body -->
      </div><!-- end modal-layout -->
    </div>
  </div>

  <!-- 重置数据确认弹窗 -->
  <ConfirmDialog
    v-if="showResetConfirm"
    title="重置数据"
    message="此操作将清除所有本地数据（数据库、缓存、操作记录、设置项），仅保留登录状态。确认后程序将自动重启。"
    @confirm="handleResetConfirm"
    @cancel="showResetConfirm = false"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth.store'
import { useSettingsStore } from '../../stores/settings.store'
import { useDanmakuStore } from '../../stores/danmaku.store'
import ColorPicker from './ColorPicker.vue'
import ConfirmDialog from './ConfirmDialog.vue'

const emit = defineEmits(['close'])
const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const danmakuStore = useDanmakuStore()

const cacheSongs = ref<any[]>([])
const alwaysOnTop = ref(false)
const isResizable = ref(true)
const idleQueueSize = ref(3)
const obsPort = ref(0)
const logContainerRef = ref<HTMLElement | null>(null)
const settingsBodyRef = ref<HTMLElement | null>(null)
const activeNav = ref('account')
let navLocked = false
let navLockTimer: ReturnType<typeof setTimeout> | null = null

// 设置导航项
const navItems = [
  { id: 'account', label: '帐号' },
  { id: 'appearance', label: '外观' },
  { id: 'window', label: '窗口' },
  { id: 'danmaku', label: '弹幕' },
  { id: 'song-request', label: '点歌规则' },
  { id: 'cache', label: '本地缓存' },
  { id: 'lyric', label: '歌词' },
  { id: 'idle', label: '空闲歌单' },
  { id: 'obs-overlay', label: 'OBS叠加层' },
  { id: 'log', label: '日志' },
  { id: 'about', label: '关于' },
]

/** 点击导航项，滚动到对应 section（锁定高亮直到用户滚动） */
function scrollToSection(id: string) {
  activeNav.value = id
  navLocked = true
  if (navLockTimer) clearTimeout(navLockTimer)
  navLockTimer = setTimeout(() => { navLocked = false }, 600)
  const el = document.getElementById(`section-${id}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

/** 滚动时自动高亮当前可见的 section */
function onBodyScroll() {
  if (navLocked) return
  const container = settingsBodyRef.value
  if (!container) return
  // 偏移 180px，确保 section 标题已经进入视野才切换
  const containerTop = container.scrollTop + 180
  for (let i = navItems.length - 1; i >= 0; i--) {
    const el = document.getElementById(`section-${navItems[i].id}`)
    if (el && el.offsetTop <= containerTop) {
      activeNav.value = navItems[i].id
      break
    }
  }
}

onMounted(async () => {
  try { alwaysOnTop.value = await window.electronAPI.isAlwaysOnTop() } catch {}
  try { isResizable.value = await window.electronAPI.isResizable() } catch {}
  try { cacheSongs.value = await window.electronAPI.getRecentCache() } catch {}
  try { idleQueueSize.value = await window.electronAPI.getIdleQueueSize() } catch {}
  try { obsPort.value = await window.electronAPI.getObsPort() } catch {}

  // 如果 OBS 服务已开启但端口未获取到，重试一次
  if (obsPort.value === 0 && settingsStore.settings.obsOverlayEnabled) {
    // 可能服务已运行但初次获取失败，稍后重试
    setTimeout(async () => {
      try { obsPort.value = await window.electronAPI.getObsPort() } catch {}
    }, 500)
  }
})

// 日志列表自动滚动到底部
watch(
  () => danmakuStore.logs.length,
  () => {
    nextTick(() => {
      const el = logContainerRef.value
      if (el) el.scrollTop = el.scrollHeight
    })
  },
)

async function toggleAlwaysOnTop() {
  alwaysOnTop.value = !alwaysOnTop.value
  try {
    await window.electronAPI.setAlwaysOnTop(alwaysOnTop.value)
    settingsStore.settings.alwaysOnTop = alwaysOnTop.value
  } catch (e) { console.error('[SettingsModal] toggleAlwaysOnTop failed:', e) }
}

async function toggleResizable() {
  isResizable.value = !isResizable.value
  try {
    await window.electronAPI.setResizable(isResizable.value)
    settingsStore.settings.resizable = isResizable.value
  } catch (e) { console.error('[SettingsModal] toggleResizable failed:', e) }
}

async function saveIdleQueueSize() {
  try {
    await window.electronAPI.setIdleQueueSize(idleQueueSize.value)
  } catch (e) { console.error('[SettingsModal] saveIdleQueueSize failed:', e) }
}

function resetAccent() {
  const c = settingsStore.settings.theme === 'dark' ? '#00b5e5' : '#00a1d6'
  settingsStore.setAccentColor(c)
}

async function playCached(entry: any) {
  // HistoryEntry 使用 songId/sourceId 非 id；需重建 SongItem 兼容对象
  const song: any = {
    id: entry.songId ?? entry.id,
    sourceId: entry.sourceId,
    // 根据 sourceId 推断来源：BV 开头为B站，其余为网易云
    source: entry.sourceId?.startsWith?.('BV') ? 'bilibili' : 'netease',
    title: entry.title,
    artist: entry.artist || '',
    coverUrl: entry.coverUrl || '',
    duration: entry.duration || 0,
    cid: entry.cid || 0,
    requesterName: '控制台',
  }
  await window.electronAPI.playlistInsertTop(song)
}

async function clearAllCache() {
  try {
    await window.electronAPI.clearCache()
    cacheSongs.value = []
  } catch (e) { console.error('[SettingsModal] clearAllCache failed:', e) }
}

async function onObsOverlayToggled(event: Event) {
  const enabled = (event.target as HTMLInputElement).checked
  try {
    const result = await window.electronAPI.toggleObsOverlay(enabled)
    if (result.error) {
      console.error('[SettingsModal] OBS 服务切换失败:', result.error)
    }
    obsPort.value = result.port
  } catch (e) {
    console.error('[SettingsModal] onObsOverlayToggled 失败:', e)
  }
}

function copyObsUrl(page: string) {
  if (obsPort.value <= 0) return
  const url = `http://localhost:${obsPort.value}/${page}`
  navigator.clipboard.writeText(url)
}

function openStyleWindow() {
  if (obsPort.value <= 0) return
  window.electronAPI.openStyleWindow(obsPort.value)
}

async function logoutBilibili() {
  await window.electronAPI.logoutBilibili()
  authStore.authState.bilibili = false
  authStore.authState.bilibiliUname = ''
  authStore.authState.bilibiliFace = ''
  authStore.authState.bilibiliUid = 0
  emit('close')
  router.push('/')
}

async function logoutNetease() {
  await window.electronAPI.logoutNetease()
  authStore.authState.netease = false
  authStore.authState.neteaseUname = ''
  authStore.authState.neteaseFace = ''
  authStore.authState.neteaseUid = 0
  emit('close')
  router.push('/')
}

function toggleTranslation() {
  settingsStore.settings.showLyricTranslation = !settingsStore.settings.showLyricTranslation
}

function toggleSplitTranslation() {
  settingsStore.settings.splitLyricTranslation = !settingsStore.settings.splitLyricTranslation
}

function toggleDanmakuTime() {
  settingsStore.settings.showDanmakuTime = !settingsStore.settings.showDanmakuTime
}

const showResetConfirm = ref(false)

function resetAllData() {
  showResetConfirm.value = true
}

async function handleResetConfirm() {
  try {
    await window.electronAPI.resetAllData()
    // 等待数据落盘后重启
    await new Promise(r => setTimeout(r, 300))
    await window.electronAPI.appRelaunch()
  } catch (e) {
    console.error('[SettingsModal] resetAllData failed:', e)
    showResetConfirm.value = false
    alert('重置失败：' + (e as Error).message)
  }
}

async function openDevTools() {
  try {
    await window.electronAPI.openDevTools()
  } catch (e) {
    console.error('[SettingsModal] openDevTools failed:', e)
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: var(--modal-overlay); display: flex;
  align-items: center; justify-content: center; z-index: 1000;
}
.modal-content {
  width: 560px; max-height: 80vh; background: var(--modal-bg);
  border: 1px solid var(--border); display: flex; flex-direction: column;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; border-bottom: 1px solid var(--section-border); background: var(--bg-secondary);
  flex-shrink: 0;
}
.modal-header h2 { font-size: 14px; font-weight: 400; color: var(--text-primary); }
.close-btn {
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--text-muted); cursor: pointer; border-radius: 0;
}
.close-btn:hover { background: #e74c3c; color: #fff; }

/* 左右布局：导航栏 + 内容 */
.modal-layout { display: flex; flex: 1; min-height: 0; overflow: hidden; }

/* 左侧导航栏 */
.settings-nav {
  width: 80px; flex-shrink: 0; overflow-y: auto; padding: 6px 0;
  border-right: 1px solid var(--section-border); background: var(--bg-secondary);
  scrollbar-width: none;
}
.settings-nav::-webkit-scrollbar { display: none; }
.nav-item {
  display: block; width: 100%; padding: 7px 10px; font-size: 11px; color: var(--text-secondary);
  background: none; border: none; cursor: pointer; text-align: left;
  transition: background 0.1s, color 0.1s; border-radius: 0;
}
.nav-item:hover { background: var(--bg-tertiary); color: var(--text-primary); }
.nav-item.active { color: var(--accent); background: var(--bg-tertiary); font-weight: 600; }

/* 右侧内容区 */
.modal-body { flex: 1; overflow-y: auto; padding: 12px 14px; min-width: 0; }
.section { margin-bottom: 16px; }
.section h3 { font-size: 12px; font-weight: 600; color: var(--section-title); margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid var(--section-border); }
.section-desc { font-size: 10px; color: var(--text-muted); margin-bottom: 6px; line-height: 1.4; }
.setting-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 12px; color: var(--text-primary); }
.setting-row > span { text-align: left; flex: 1; margin-right: 12px; }
.connected { color: #4ec9b0; }
.disconnected { color: var(--text-muted); }
span.status-text { text-align: right; min-width: 50px; flex: none; }
.input { width: 90px; padding: 4px 6px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text-primary); font-size: 12px; }
.input:focus { border-color: var(--accent); outline: none; }
.btn {
  padding: 4px 12px; border: 1px solid var(--border); border-radius: 0;
  background: var(--btn-bg); color: var(--btn-text); font-size: 10px; cursor: pointer;
}
.btn:hover { background: var(--btn-hover-bg); }
.accent-picker-row { display: flex; align-items: center; gap: 8px; }
.reset-btn {
  padding: 3px 8px; font-size: 10px; color: var(--text-secondary); border-radius: 0;
  background: var(--bg-secondary); border: 1px solid var(--border);
  cursor: pointer; transition: background 0.1s, color 0.1s;
}
.reset-btn:hover { color: var(--accent); border-color: var(--accent); }
.toggle-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 11px; color: var(--text-muted); flex-direction: row-reverse; }
.toggle-label input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--accent); }
.toggle-text { font-size: 11px; min-width: 48px; text-align: right; }
.log-container {
  height: 180px; overflow-y: auto; background: var(--bg-primary); border: 1px solid var(--border);
  padding: 6px; font-size: 11px; font-family: monospace;
  scrollbar-width: none;
}
.log-container::-webkit-scrollbar { display: none; }
.log-line { color: var(--text-secondary); padding: 1px 0; white-space: pre-wrap; }
.log-empty { color: var(--text-muted); font-style: italic; }
.about-header { display: flex; justify-content: space-between; align-items: flex-start; }
.about-text { font-size: 11px; color: var(--text-secondary); line-height: 1.8; }
.about-actions { display: flex; gap: 8px; flex-shrink: 0; }
.dev-btn { }
.reset-data-btn { }

/* 缓存列表 */
.cache-list { height: 180px; overflow-y: auto; background: var(--bg-primary); border: 1px solid var(--border); scrollbar-width: none; }
.cache-list::-webkit-scrollbar { display: none; }
.cache-item {
  display: flex; align-items: center; padding: 4px 8px; gap: 6px;
  font-size: 11px; border-bottom: 1px solid var(--border);
}
.cache-item:hover { background: var(--bg-tertiary); }
.add-btn {
  width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
  background: none; border: 1px solid var(--border); color: var(--accent);
  font-size: 14px; cursor: pointer; flex-shrink: 0; padding: 0; line-height: 1;
}
.add-btn:hover { background: var(--accent); color: var(--btn-primary-text); border-color: var(--accent); }
.cache-idx { color: var(--text-muted); width: 20px; text-align: center; flex-shrink: 0; }
.cache-title { flex: 1; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cache-artist { color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px; }
.cache-empty { padding: 12px; text-align: center; color: var(--text-muted); font-size: 11px; }
.clear-cache-btn { margin-top: 6px; width: 100%; }
.range-row { display: flex; align-items: center; gap: 8px; flex: 1; justify-content: flex-end; }
.range-slider {
  -webkit-appearance: none; appearance: none;
  width: 100px; height: 4px; background: var(--border); outline: none;
}
.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 14px; height: 14px; background: var(--accent); cursor: pointer;
}
.range-slider::-moz-range-thumb {
  width: 14px; height: 14px; background: var(--accent); cursor: pointer; border: none;
}
.range-value { font-size: 11px; color: var(--text-muted); min-width: 36px; text-align: left; }
.path-row { display: flex; gap: 6px; align-items: center; }
.input-path { width: 300px; flex: 1; min-width: 0; }

</style>