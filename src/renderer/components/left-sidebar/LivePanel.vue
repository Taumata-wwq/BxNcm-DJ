<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuthStore } from '../../stores/auth.store'
import { useSettingsStore } from '../../stores/settings.store'

const auth = useAuthStore()
const settingsStore = useSettingsStore()

interface AreaItem { id: number; name: string; subs: { id: number; name: string }[] }
interface StreamInfo {
  rtmp: { addr: string; code: string }
}

const loading = ref(false)
const busy = ref(false)
const error = ref('')
const log = ref<string[]>([])

const roomInfo = ref<any>(null)
const roomId = ref<number | null>(null)
const titleInput = ref('')
const areas = ref<AreaItem[]>([])
const parentAreaIdx = ref(settingsStore.settings.liveParentAreaIdx)
const subAreaId = ref<number | null>(settingsStore.settings.liveSubAreaId || null)
const isLive = ref(false)

const streamData = ref<StreamInfo | null>(null)

let autoFetched = false
let areaRestored = false

// 自定义下拉状态
const parentDropdownOpen = ref(false)
const subDropdownOpen = ref(false)
const parentDropdownRef = ref<HTMLElement | null>(null)
const subDropdownRef = ref<HTMLElement | null>(null)
const titleInputRef = ref<HTMLInputElement | null>(null)

function toggleParentDropdown() {
  parentDropdownOpen.value = !parentDropdownOpen.value
  subDropdownOpen.value = false
}

function toggleSubDropdown() {
  subDropdownOpen.value = !subDropdownOpen.value
  parentDropdownOpen.value = false
}

function selectParentArea(idx: number) {
  parentAreaIdx.value = idx
  subAreaId.value = areas.value[idx]?.subs[0]?.id || null
  parentDropdownOpen.value = false
  // 自动保存分区选择到 settings
  settingsStore.settings.liveParentAreaIdx = idx
  settingsStore.settings.liveSubAreaId = subAreaId.value || 0
  // 自动更新服务器分区
  saveArea()
}

function selectSubArea(id: number) {
  subAreaId.value = id
  subDropdownOpen.value = false
  // 自动保存分区选择到 settings
  settingsStore.settings.liveSubAreaId = id
  // 自动更新服务器分区
  saveArea()
}

function closeAllDropdowns() {
  parentDropdownOpen.value = false
  subDropdownOpen.value = false
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (parentDropdownRef.value && !parentDropdownRef.value.contains(target)) {
    parentDropdownOpen.value = false
  }
  if (subDropdownRef.value && !subDropdownRef.value.contains(target)) {
    subDropdownOpen.value = false
  }
}

function addLog(msg: string) {
  log.value.push(`[${new Date().toLocaleTimeString()}] ${msg}`)
  if (log.value.length > 50) log.value = log.value.slice(-50)
  nextTick(() => {
    const el = document.querySelector('.live-log-list')
    if (el) el.scrollTop = el.scrollHeight
  })
}

function copyText(text: string) {
  if (!text) return
  navigator.clipboard.writeText(text).then(() => addLog('已复制'))
}

watch(
  () => auth.authState.bilibili,
  (loggedIn) => {
    if (loggedIn && !autoFetched) {
      autoFetched = true
      fetchRoomInfo()
      fetchAreas()
    } else if (!loggedIn) {
      autoFetched = false
      areaRestored = false
    }
  },
  { immediate: true },
)

// 从 settings 恢复分区选择
watch(() => [settingsStore.settings.liveParentAreaIdx, settingsStore.settings.liveSubAreaId], () => {
  if (areas.value.length === 0) return
  const pIdx = settingsStore.settings.liveParentAreaIdx
  const sId = settingsStore.settings.liveSubAreaId
  if (sId && areas.value[pIdx]?.subs.find(s => s.id === sId)) {
    parentAreaIdx.value = pIdx
    subAreaId.value = sId
    areaRestored = true
  }
})

async function fetchRoomInfo() {
  const uid = auth.authState.bilibiliUid
  if (!uid) return
  loading.value = true; error.value = ''; roomInfo.value = null
  try {
    const resp = await window.electronAPI.liveGetRoomInfo(uid)
    const info = resp?.data
    if (!info || !info.room_id) { error.value = '获取房间信息失败'; return }
    roomInfo.value = info
    roomId.value = info.room_id
    titleInput.value = info.title || ''
    isLive.value = info.live_status === 1
    addLog(`房间 ${info.room_id} 信息已加载`)
    if (isLive.value) addLog('当前正在直播中')
    // settings 已恢复则跳过
    if (settingsStore.settings.liveSubAreaId) return
    // 匹配已加载的分区
    const areaId = info.area_v2_id || info.area_id
    if (areas.value.length > 0 && areaId) {
      for (let i = 0; i < areas.value.length; i++) {
        const sub = areas.value[i].subs.find(s => s.id === areaId)
        if (sub) {
          settingsStore.settings.liveParentAreaIdx = i
          settingsStore.settings.liveSubAreaId = sub.id
          break
        }
      }
    }
  } catch (e: unknown) { error.value = e instanceof Error ? e.message : String(e) }
  finally { loading.value = false }
}

async function fetchAreas() {
  if (areas.value.length > 0) return
  try {
    const resp = await window.electronAPI.liveGetAreaList()
    const areaData = resp?.data || resp
    if (Array.isArray(areaData)) {
      areas.value = areaData.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        subs: (cat.list || []).map((s: any) => ({ id: s.id, name: s.name })),
      }))
      // 尝试从 settings 恢复（如果已有值的话不用再匹配）
      if (settingsStore.settings.liveSubAreaId) {
        const pIdx = settingsStore.settings.liveParentAreaIdx
        const sId = settingsStore.settings.liveSubAreaId
        if (areas.value[pIdx]?.subs.find(s => s.id === sId)) {
          parentAreaIdx.value = pIdx
          subAreaId.value = sId
          areaRestored = true
          return
        }
      }
      // 回退到房间信息
      if (roomInfo.value?.area_id) {
        const areaId = roomInfo.value.area_v2_id || roomInfo.value.area_id
        for (let i = 0; i < areas.value.length; i++) {
          const sub = areas.value[i].subs.find(s => s.id === areaId)
          if (sub) {
            settingsStore.settings.liveParentAreaIdx = i
            settingsStore.settings.liveSubAreaId = sub.id
            return
          }
        }
      }
      // 默认选中第一个
      if (areas.value.length > 0 && areas.value[0].subs.length > 0) {
        settingsStore.settings.liveParentAreaIdx = 0
        settingsStore.settings.liveSubAreaId = areas.value[0].subs[0].id
      }
    }
  } catch { addLog('获取分区列表失败') }
}

async function saveTitle() {
  if (!roomId.value) return
  busy.value = true; error.value = ''
  try {
    await window.electronAPI.liveUpdateTitle(roomId.value, titleInput.value)
    addLog('标题已保存')
  } catch (e: unknown) { error.value = e instanceof Error ? e.message : String(e) }
  finally { busy.value = false }
}

// 回车自动保存标题（仅内容变化时）
function onTitleEnter() {
  if (titleInput.value !== roomInfo.value?.title) {
    saveTitle()
  }
}

// 失焦自动保存标题（仅内容变化时）
function onTitleBlur() {
  if (titleInput.value !== roomInfo.value?.title) {
    saveTitle()
  }
}

async function saveArea() {
  if (!roomId.value || !subAreaId.value) return
  busy.value = true; error.value = ''
  try {
    await window.electronAPI.liveUpdateArea(roomId.value, Number(subAreaId.value))
    addLog('分区已保存')
  } catch (e: unknown) { error.value = e instanceof Error ? e.message : String(e) }
  finally { busy.value = false }
}

async function handleStartLive() {
  if (!roomId.value) return
  busy.value = true; error.value = ''; streamData.value = null
  try {
    const resp = await window.electronAPI.liveStart(roomId.value, subAreaId.value || 0)
    isLive.value = true
    const streamInfo = resp?.data
    if (streamInfo) {
      streamData.value = {
        rtmp: { addr: streamInfo.rtmp?.addr || '', code: streamInfo.rtmp?.code || '' },
      }
      addLog('开播成功！推流码已获取')
    } else {
      addLog('开播成功')
    }
  } catch (e: unknown) { error.value = e instanceof Error ? e.message : String(e) }
  finally { busy.value = false }
}

async function handleStopLive() {
  if (!roomId.value) return
  busy.value = true; error.value = ''
  try {
    await window.electronAPI.liveStop(roomId.value)
    isLive.value = false
    streamData.value = null
    addLog('已关播')
  } catch (e: unknown) { error.value = e instanceof Error ? e.message : String(e) }
  finally { busy.value = false }
}

// 当前推流信息
const curStream = computed(() => streamData.value?.rtmp)

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="live-panel">
    <div v-if="error" class="live-error" @click="error = ''">{{ error }}</div>

    <!-- 未登录 -->
    <div v-if="!auth.authState.bilibili" class="live-empty">请先登录 B站账号</div>

    <!-- 已登录：加载中 -->
    <div v-else-if="loading" class="live-empty">加载中...</div>

    <!-- 有房间信息 -->
    <template v-else-if="roomInfo">
      <!-- 房间头部 -->
      <div class="live-header">
        <span class="live-dot" :class="{ on: isLive }"></span>
        <span class="live-room-id">房间 {{ roomInfo.room_id }}</span>
        <span class="live-status">{{ isLive ? '直播中' : '未开播' }}</span>
        <button class="live-refresh" title="刷新" :disabled="loading" @click="fetchRoomInfo">↻</button>
      </div>

      <!-- 标题 -->
      <div class="live-row">
        <input
          ref="titleInputRef"
          v-model="titleInput"
          class="live-input"
          maxlength="30"
          placeholder="直播间标题"
          @keyup.enter="onTitleEnter"
          @blur="onTitleBlur"
        />
        <button class="live-btn-save" :disabled="busy" @click="saveTitle">保存</button>
      </div>

      <!-- 分区 -->
      <div class="live-row">
        <!-- 父分区下拉 -->
        <div class="live-dropdown live-dropdown-parent" ref="parentDropdownRef">
          <button class="live-dropdown-trigger" @click.stop="toggleParentDropdown">
            <span class="live-dropdown-text">{{ areas[parentAreaIdx]?.name || '选择分区' }}</span>
            <span class="live-dropdown-arrow" :class="{ open: parentDropdownOpen }">▾</span>
          </button>
          <div v-show="parentDropdownOpen" class="live-dropdown-menu">
            <div
              v-for="(a, i) in areas"
              :key="a.id"
              class="live-dropdown-item"
              :class="{ active: i === parentAreaIdx }"
              @click="selectParentArea(i)"
            >{{ a.name }}</div>
          </div>
        </div>

        <!-- 子分区下拉 -->
        <div class="live-dropdown live-dropdown-sub" ref="subDropdownRef">
          <button class="live-dropdown-trigger" @click.stop="toggleSubDropdown">
            <span class="live-dropdown-text">{{ areas[parentAreaIdx]?.subs.find(s => s.id === subAreaId)?.name || '选择子分区' }}</span>
            <span class="live-dropdown-arrow" :class="{ open: subDropdownOpen }">▾</span>
          </button>
          <div v-show="subDropdownOpen" class="live-dropdown-menu">
            <div
              v-for="s in areas[parentAreaIdx]?.subs || []"
              :key="s.id"
              class="live-dropdown-item"
              :class="{ active: s.id === subAreaId }"
              @click="selectSubArea(s.id)"
            >{{ s.name }}</div>
          </div>
        </div>

        </div>

      <!-- 开播/关播 -->
      <div class="live-action">
        <button
          v-if="!isLive"
          class="live-btn-big live-btn-start"
          :disabled="busy"
          @click="handleStartLive"
        >{{ busy ? '处理中...' : '开始直播' }}</button>
        <button
          v-else
          class="live-btn-big live-btn-stop"
          :disabled="busy"
          @click="handleStopLive"
        >{{ busy ? '处理中...' : '停止直播' }}</button>
      </div>

      <!-- 推流信息 -->
      <div v-if="streamData" class="live-stream">
        <div class="live-stream-header">
          <span class="live-stream-title">推流信息</span>
        </div>

        <div class="live-stream-item">
          <span class="live-stream-label">服务地址</span>
          <div class="live-stream-row">
            <code class="live-code">{{ curStream?.addr || '—' }}</code>
            <button v-if="curStream?.addr" class="live-btn-copy" @click="copyText(curStream!.addr)">复制</button>
          </div>
        </div>

        <div class="live-stream-item">
          <span class="live-stream-label">推流码</span>
          <div class="live-stream-row">
            <code class="live-code">{{ curStream?.code || '—' }}</code>
            <button v-if="curStream?.code" class="live-btn-copy" @click="copyText(curStream!.code)">复制</button>
          </div>
        </div>

        <div class="live-stream-item">
          <span class="live-stream-label">完整串流地址</span>
          <div class="live-stream-row">
            <code class="live-code live-full-url">{{ curStream?.addr && curStream?.code ? curStream.addr + curStream.code : '—' }}</code>
            <button v-if="curStream?.addr && curStream?.code" class="live-btn-copy" @click="copyText(curStream!.addr + curStream!.code)">复制</button>
          </div>
        </div>
      </div>
    </template>

    <!-- 获取房间失败 -->
    <div v-else-if="!loading && !error" class="live-empty">无法获取直播间信息</div>

    <!-- 操作日志 -->
    <div v-if="log.length > 0" class="live-log">
      <div class="live-log-title">操作日志</div>
      <div class="live-log-list">
        <div v-for="(msg, i) in log" :key="i" class="live-log-item">{{ msg }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.live-panel { flex: 1; display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; }

.live-error {
  padding: 6px 10px; font-size: 11px; color: #e74c3c; background: rgba(231,76,60,0.1);
  cursor: pointer; flex-shrink: 0;
}
.live-empty {
  padding: 20px 10px; text-align: center; color: var(--text-muted); font-size: 12px;
}

/* 房间头部 */
.live-header {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-bottom: 1px solid var(--border);
  font-size: 12px; font-weight: 600; color: var(--text-primary);
  background: var(--bg-tertiary); flex-shrink: 0;
}
.live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-muted); flex-shrink: 0; }
.live-dot.on { background: #27ae60; }
.live-room-id { color: var(--text-primary); }
.live-status { font-size: 11px; color: var(--text-muted); margin-left: auto; }
.live-refresh {
  width: 20px; height: 20px; font-size: 13px; background: none; border: 1px solid var(--border);
  color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; border-radius: 0; padding: 0;
}
.live-refresh:hover { color: var(--accent); border-color: var(--accent); }

/* 输入行 */
.live-row {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 10px; border-bottom: 1px solid var(--border);
}
.live-input {
  flex: 1; min-width: 0; height: 24px; padding: 0 6px; font-size: 11px;
  background: var(--input-bg); border: 1px solid var(--input-border);
  color: var(--text-primary); outline: none; box-sizing: border-box;
  border-radius: 0; box-shadow: none; appearance: none; -webkit-appearance: none;
}
.live-input:focus { border-color: var(--accent); }
.live-input::placeholder { color: var(--text-muted); }

/* 自定义下拉菜单 */
.live-dropdown {
  min-width: 0; position: relative;
}
.live-dropdown-parent { flex: 3; }
.live-dropdown-sub { flex: 7; }
.live-dropdown-trigger {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; height: 24px; padding: 0 6px;
  font-size: 11px; font-family: inherit;
  background: var(--input-bg); border: 1px solid var(--input-border);
  color: var(--text-primary); outline: none; cursor: pointer;
  border-radius: 0; box-shadow: none; box-sizing: border-box;
  line-height: 24px;
}
.live-dropdown-trigger:hover { border-color: var(--accent); }
.live-dropdown-text {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  text-align: left;
}
.live-dropdown-arrow {
  flex-shrink: 0; font-size: 10px; color: var(--text-muted);
  margin-left: 4px; transition: transform 0.15s;
}
.live-dropdown-arrow.open { transform: rotate(180deg); }
.live-dropdown-menu {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 100;
  max-height: 300px; overflow-y: auto;
  background: var(--bg-tertiary); border: 1px solid var(--border);
  scrollbar-width: none;
}
.live-dropdown-menu::-webkit-scrollbar { display: none; }
.live-dropdown-item {
  padding: 4px 8px; font-size: 11px; color: var(--text-primary);
  cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.live-dropdown-item:hover { background: var(--accent); color: #fff; }
.live-dropdown-item.active { background: var(--accent); color: #fff; }

.live-btn-save {
  padding: 3px 8px; font-size: 11px; border: none; border-radius: 0;
  background: var(--btn-bg); color: var(--btn-text); cursor: pointer; white-space: nowrap;
  flex-shrink: 0;
}
.live-btn-save:hover { background: var(--btn-hover-bg); }
.live-btn-save:disabled { opacity: 0.5; cursor: default; }

/* 开播/关播 */
.live-action { padding: 6px 10px; border-bottom: 1px solid var(--border); }
.live-btn-big { width: 100%; padding: 5px 0; font-size: 12px; border: none; border-radius: 0; cursor: pointer; }
.live-btn-start { background: var(--accent); color: var(--btn-primary-text); }
.live-btn-start:hover { opacity: 0.85; }
.live-btn-stop { background: #e74c3c; color: #fff; }
.live-btn-stop:hover { opacity: 0.85; }
.live-btn-big:disabled { opacity: 0.5; cursor: default; }

/* 推流信息区域 */
.live-stream { border-bottom: 1px solid var(--border); flex-shrink: 0; }
.live-stream-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px 4px;
}
.live-stream-title { font-size: 11px; font-weight: 600; color: var(--text-primary); }

.live-stream-item { display: flex; flex-direction: column; gap: 2px; padding: 0 10px 6px; }
.live-stream-label { font-size: 10px; color: var(--text-muted); }
.live-stream-row { display: flex; align-items: center; gap: 4px; }
.live-code {
  flex: 1; min-width: 0; padding: 3px 6px; font-size: 10px; font-family: "Consolas","Courier New",monospace;
  background: var(--bg-tertiary); color: var(--text-secondary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  user-select: text; -webkit-user-select: text;
}
.live-full-url { font-size: 9px; }
.live-btn-copy {
  padding: 2px 6px; font-size: 10px; border: 1px solid var(--border); border-radius: 0;
  background: var(--bg-tertiary); color: var(--text-muted); cursor: pointer; white-space: nowrap;
  flex-shrink: 0;
}
.live-btn-copy:hover { border-color: var(--accent); color: var(--accent); }

/* 操作日志 */
.live-log { border-top: 1px solid var(--border); flex: 1; display: flex; flex-direction: column; min-height: 0; }
.live-log-title {
  padding: 4px 10px; font-size: 11px; font-weight: 600; color: var(--text-primary);
  border-bottom: 1px solid var(--border); background: var(--bg-tertiary); flex-shrink: 0;
}
.live-log-list { flex: 1; overflow-y: auto; padding: 4px 10px; }
.live-log-item { font-size: 10px; color: var(--text-muted); padding: 1px 0; line-height: 1.4; word-break: break-all; }
</style>