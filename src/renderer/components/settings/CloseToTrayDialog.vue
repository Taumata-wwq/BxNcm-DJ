<template>
  <div class="modal-overlay">
    <div class="close-tray-dialog">
      <div class="dialog-header">
        <h2>关闭窗口</h2>
      </div>
      <div class="dialog-body">
        <p class="dialog-message">关闭窗口时，您希望怎么做？</p>
        <div class="dialog-actions">
          <button class="btn btn-tray" @click="handleTray">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
            最小化到托盘
          </button>
          <button class="btn btn-quit" @click="handleQuit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            退出程序
          </button>
        </div>
        <label class="remember-label">
          <input type="checkbox" v-model="remember" />
          <span>不再提示</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits(['result'])

const remember = ref(false)

function handleTray() {
  emit('result', { action: 'tray', remember: remember.value })
}

function handleQuit() {
  emit('result', { action: 'quit', remember: remember.value })
}
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
  z-index: 3000;
  -webkit-app-region: no-drag;
}
.close-tray-dialog {
  width: 360px;
  background: var(--modal-bg);
  border: 1px solid var(--border);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.dialog-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--section-border);
  background: var(--bg-secondary);
}
.dialog-header h2 {
  font-size: 14px; font-weight: 400; color: var(--text-primary);
  margin: 0;
}
.dialog-body {
  padding: 20px 16px;
  display: flex; flex-direction: column; gap: 16px;
}
.dialog-message {
  font-size: 13px; color: var(--text-secondary); margin: 0;
  text-align: center;
}
.dialog-actions {
  display: flex; gap: 10px;
}
.btn {
  flex: 1;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 10px 16px;
  border: 1px solid var(--border);
  background: var(--btn-bg);
  color: var(--btn-text);
  font-size: 13px; cursor: pointer;
  border-radius: 0;
  transition: background 0.15s;
}
.btn:hover { background: var(--btn-hover-bg); }
.btn-tray:hover { border-color: var(--accent); color: var(--accent); }
.btn-quit:hover { border-color: #e74c3c; color: #e74c3c; }
.remember-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--text-muted); cursor: pointer;
  justify-content: center;
}
.remember-label input { cursor: pointer; }
</style>