<template>
  <div class="account-panel" @click="authStore.toggleSettings()">
    <div class="account-row">
      <div class="account-item">
        <img v-if="authStore.authState.bilibiliFace" :src="authStore.authState.bilibiliFace" class="avatar" />
        <span v-else class="avatar-placeholder">B</span>
        <span class="status-dot" :class="authStore.authState.bilibili ? 'online' : 'offline'"></span>
        <span class="account-id">{{ authStore.authState.bilibili ? authStore.authState.bilibiliUname : 'B站未登录' }}</span>
      </div>
      <div class="account-item">
        <img v-if="authStore.authState.neteaseFace" :src="authStore.authState.neteaseFace" class="avatar" />
        <span v-else class="avatar-placeholder">N</span>
        <span class="status-dot" :class="authStore.authState.netease ? 'online' : 'offline'"></span>
        <span class="account-id">{{ authStore.authState.netease ? authStore.authState.neteaseUname : '网易云未登录' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '../../stores/auth.store'

const authStore = useAuthStore()
</script>

<style scoped>
.account-panel {
  padding: 6px 10px; border-top: 1px solid var(--border); cursor: pointer;
  background: var(--sidebar-bg);
}
.account-panel:hover { background: var(--bg-tertiary); }
.account-row {
  display: flex; gap: 0;
}
.account-item {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px;
  padding: 3px 4px; font-size: 11px; color: var(--text-secondary);
}
.avatar { width: 16px; height: 16px; border-radius: 50%; }
.avatar-placeholder {
  width: 16px; height: 16px; border-radius: 50%; background: var(--bg-tertiary);
  display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--text-muted);
}
.status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.status-dot.online { background: #4ec9b0; }
.status-dot.offline { background: var(--text-muted); }
.account-id { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>