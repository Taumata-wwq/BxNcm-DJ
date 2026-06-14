<script setup lang="ts">
import { ref } from 'vue'
import PlaylistPanel from './PlaylistPanel.vue'
import LivePanel from './LivePanel.vue'
import DanmakuPanel from './DanmakuPanel.vue'

const activeTab = ref<'queue' | 'live' | 'danmaku'>('queue')
</script>

<template>
  <div class="sidebar-tabs">
    <div class="tab-header">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'queue' }"
        @click="activeTab = 'queue'"
      >队列</button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'live' }"
        @click="activeTab = 'live'"
      >直播</button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'danmaku' }"
        @click="activeTab = 'danmaku'"
      >弹幕</button>
    </div>
    <div class="tab-content">
      <PlaylistPanel v-show="activeTab === 'queue'" />
      <LivePanel v-show="activeTab === 'live'" />
      <DanmakuPanel v-show="activeTab === 'danmaku'" />
    </div>
  </div>
</template>

<style scoped>
.sidebar-tabs { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.tab-header {
  display: flex; flex-shrink: 0; border-bottom: 1px solid var(--border);
  background: var(--bg-tertiary);
}
.tab-btn {
  flex: 1; padding: 6px 0; font-size: 12px; border: none; border-radius: 0;
  background: none; color: var(--text-muted); cursor: pointer;
  border-bottom: 2px solid transparent; transition: all 0.15s;
}
.tab-btn:hover { color: var(--text-primary); background: var(--bg-secondary); }
.tab-btn.active {
  color: var(--accent); border-bottom-color: var(--accent);
  background: var(--bg-primary);
}
.tab-content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
</style>