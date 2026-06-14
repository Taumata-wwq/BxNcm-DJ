<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useSettingsStore } from '../../stores/settings.store'

const settingsStore = useSettingsStore()
const alwaysOnTop = ref(false)
const appVersion = __APP_VERSION__

onMounted(async () => {
  try { alwaysOnTop.value = await window.electronAPI.isAlwaysOnTop() } catch {}
})

// 监听设置中 alwaysOnTop 变化，同步按钮状态
watch(() => settingsStore.settings.alwaysOnTop, (val) => {
  alwaysOnTop.value = val
})

async function toggleAlwaysOnTop() {
  alwaysOnTop.value = !alwaysOnTop.value
  try {
    await window.electronAPI.setAlwaysOnTop(alwaysOnTop.value)
    settingsStore.settings.alwaysOnTop = alwaysOnTop.value
  } catch {}
}

async function minimize() { window.electronAPI.minimizeWindow() }
async function closeWindow() { window.electronAPI.closeWindow() }
</script>

<template>
  <header class="titlebar">
    <span class="tb-title">
      <span class="tb-logo">BxNcm DJ</span>
      <span class="tb-version">v{{ appVersion }}</span>
    </span>
    <div class="tb-drag-spacer"></div>
    <div class="tb-actions">
      <button
        class="tb-btn"
        :class="{ active: alwaysOnTop }"
        title="窗口置顶"
        @click="toggleAlwaysOnTop"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      <button class="tb-btn" title="最小化" @click="minimize">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14" />
        </svg>
      </button>
      <button class="tb-btn tb-close" title="关闭" @click="closeWindow">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.titlebar {
  display: flex; align-items: center; justify-content: space-between;
  height: 34px; padding: 0 14px; background: var(--titlebar-bg);
  border-bottom: 1px solid var(--border); user-select: none;
  -webkit-user-select: none; -webkit-app-region: drag; cursor: default;
  contain: layout style paint; flex-shrink: 0;
}
.tb-title { display: flex; align-items: baseline; gap: 7px; white-space: nowrap; flex-shrink: 0; }
.tb-logo { font-size: 12px; color: var(--accent); font-weight: 700; letter-spacing: 0.2px; }
.tb-version { font-size: 9px; color: var(--text-muted); font-weight: 400; }

.tb-drag-spacer { flex: 1; -webkit-app-region: drag; }
.tb-actions { display: flex; align-items: center; gap: 1px; }
.tb-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 26px; color: var(--text-muted);
  border: none; background: none;
  border-radius: 0; transition: background 0.12s, color 0.12s;
  -webkit-app-region: no-drag;
}
.tb-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); }
.tb-btn.active { color: var(--accent); background: var(--accent-light); }
.tb-close:hover { background: #e74c3c; color: #fff; }
</style>