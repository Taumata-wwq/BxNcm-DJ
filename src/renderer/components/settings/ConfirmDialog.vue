<template>
  <div class="modal-overlay" @click.self="$emit('cancel')">
    <div class="modal-content confirm-dialog">
      <div class="modal-header">
        <h2>{{ title }}</h2>
        <button class="close-btn" @click="$emit('cancel')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <p class="confirm-message">{{ message }}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-cancel" @click="$emit('cancel')">取消</button>
        <button class="btn btn-confirm" @click="$emit('confirm')">确认</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  message: string
}>()

defineEmits(['confirm', 'cancel'])
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: var(--modal-overlay); display: flex;
  align-items: center; justify-content: center; z-index: 2000;
}
.confirm-dialog {
  width: 380px;
}
.modal-content {
  background: var(--modal-bg);
  border: 1px solid var(--border); display: flex; flex-direction: column;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; border-bottom: 1px solid var(--section-border); background: var(--bg-secondary);
}
.modal-header h2 { font-size: 14px; font-weight: 400; color: var(--text-primary); }
.close-btn {
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--text-muted); cursor: pointer; border-radius: 0;
}
.close-btn:hover { background: #e74c3c; color: #fff; }
.modal-body { padding: 16px 14px; }
.confirm-message { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
.modal-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 10px 14px; border-top: 1px solid var(--section-border); background: var(--bg-secondary);
}
.btn {
  padding: 5px 18px; border: 1px solid var(--border); border-radius: 0;
  background: var(--btn-bg); color: var(--btn-text); font-size: 12px; cursor: pointer;
}
.btn:hover { background: var(--btn-hover-bg); }
.btn-cancel:hover { color: var(--text-primary); }
.btn-confirm {
  background: var(--accent); color: #fff; border-color: var(--accent);
}
.btn-confirm:hover { filter: brightness(1.1); }
</style>