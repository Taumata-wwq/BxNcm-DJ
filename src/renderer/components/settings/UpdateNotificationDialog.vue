<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="update-dialog" @click.stop>
      <div class="dialog-header">
        <h2>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7,10 12,15 17,10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          软件更新
        </h2>
        <button class="close-btn" @click="$emit('close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="dialog-body">
        <!-- 检查中 -->
        <template v-if="status === 'checking'">
          <div class="status-row">
            <div class="mini-spinner"></div>
            <span>正在检查更新...</span>
          </div>
        </template>

        <!-- 发现新版本 -->
        <template v-else-if="status === 'available'">
          <p class="update-message">发现新版本 <strong>v{{ version }}</strong></p>
          <div class="dialog-actions">
            <button class="btn btn-primary" @click="$emit('download')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7,10 12,15 17,10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              下载更新
            </button>
            <button class="btn btn-cancel" @click="$emit('close')">稍后</button>
          </div>
        </template>

        <!-- 下载中 -->
        <template v-else-if="status === 'downloading'">
          <p class="update-message">正在下载更新...</p>
          <div class="progress-wrap">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progress + '%' }"></div>
            </div>
            <span class="progress-text">{{ progress }}%</span>
          </div>
        </template>

        <!-- 下载完成 -->
        <template v-else-if="status === 'downloaded'">
          <p class="update-message">更新已下载完成，是否立即安装？</p>
          <div class="dialog-actions">
            <button class="btn btn-primary" @click="$emit('install')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              立即安装
            </button>
            <button class="btn btn-cancel" @click="$emit('close')">稍后</button>
          </div>
        </template>

        <!-- 已是最新 -->
        <template v-else-if="status === 'not-available'">
          <p class="update-message">当前已是最新版本</p>
          <div class="dialog-actions">
            <button class="btn btn-cancel" @click="$emit('close')">确定</button>
          </div>
        </template>

        <!-- 错误 -->
        <template v-else-if="status === 'error'">
          <p class="update-message update-error">{{ message || '检查更新失败' }}</p>
          <div class="dialog-actions">
            <button class="btn btn-cancel" @click="$emit('close')">确定</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  status: string
  version?: string
  progress?: number
  message?: string
}>()

defineEmits(['close', 'download', 'install'])
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
  z-index: 3000;
  -webkit-app-region: no-drag;
}
.update-dialog {
  width: 380px;
  background: var(--modal-bg);
  border: 1px solid var(--border);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.dialog-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--section-border);
  background: var(--bg-secondary);
}
.dialog-header h2 {
  font-size: 14px; font-weight: 400; color: var(--text-primary);
  margin: 0; display: flex; align-items: center; gap: 6px;
}
.close-btn {
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--text-muted); cursor: pointer; border-radius: 0;
}
.close-btn:hover { background: #e74c3c; color: #fff; }
.dialog-body {
  padding: 20px 16px;
  display: flex; flex-direction: column; gap: 16px;
}
.status-row {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-size: 13px; color: var(--text-secondary);
}
.mini-spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.08);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.update-message {
  font-size: 13px; color: var(--text-secondary); margin: 0;
  text-align: center; line-height: 1.6;
}
.update-message strong { color: var(--accent); }
.update-error { color: #e74c3c; }
.dialog-actions {
  display: flex; gap: 10px; justify-content: center;
}
.btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 20px;
  border: 1px solid var(--border);
  background: var(--btn-bg);
  color: var(--btn-text);
  font-size: 13px; cursor: pointer;
  border-radius: 0;
  transition: background 0.15s;
}
.btn:hover { background: var(--btn-hover-bg); }
.btn-primary {
  background: var(--accent); color: #fff; border-color: var(--accent);
}
.btn-primary:hover { filter: brightness(1.1); }
.btn-cancel:hover { color: var(--text-primary); }
.progress-wrap {
  display: flex; align-items: center; gap: 10px;
}
.progress-bar {
  flex: 1; height: 6px;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
}
.progress-fill {
  height: 100%; background: var(--accent);
  transition: width 0.3s ease;
}
.progress-text {
  font-size: 12px; color: var(--text-muted); min-width: 32px;
}
</style>