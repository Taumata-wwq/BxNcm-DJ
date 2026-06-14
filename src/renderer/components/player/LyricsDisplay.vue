<template>
  <div class="lyrics-display" ref="lyricsContainer">
    <div class="top-padding"></div>
    <div v-if="playerStore.lyrics.length === 0" class="no-lyrics">暂无歌词</div>
    <div
      v-for="(line, idx) in playerStore.lyrics"
      :key="idx"
      class="lyric-paragraph"
      :class="{ active: idx === playerStore.currentLyricIndex }"
      :style="lyricStyle"
    >
      <!-- 分行模式：歌词和翻译各自独立一行 -->
      <template v-if="splitLyricTranslation">
        <div class="lyric-original">{{ line.text }}</div>
        <div class="lyric-translation" v-if="showTranslation && line.translation">{{ line.translation }}</div>
      </template>
      <!-- 合并模式：翻译紧跟在歌词后面，同行显示 -->
      <div v-else class="lyric-original">
        {{ line.text }}<span v-if="showTranslation && line.translation" class="lyric-translation-inline">  「{{ line.translation }}」</span>
      </div>
    </div>
    <div class="bottom-padding"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { usePlayerStore } from '../../stores/player.store'
import { useSettingsStore } from '../../stores/settings.store'

const playerStore = usePlayerStore()
const settingsStore = useSettingsStore()
const lyricsContainer = ref<HTMLElement | null>(null)

const showTranslation = computed(() => settingsStore.settings.showLyricTranslation)
const splitLyricTranslation = computed(() => settingsStore.settings.splitLyricTranslation)
const lyricStyle = computed(() => ({
  fontSize: `${settingsStore.settings.lyricFontSize}px`,
  marginBottom: `${settingsStore.settings.lyricLineSpacing}px`,
}))

watch(() => playerStore.currentLyricIndex, () => {
  if (!lyricsContainer.value) return
  const paragraphs = lyricsContainer.value.querySelectorAll('.lyric-paragraph')
  const el = paragraphs[playerStore.currentLyricIndex] as HTMLElement
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
})
</script>

<style scoped>
.lyrics-display {
  height: 100%; overflow-y: auto; text-align: center;
  background: var(--bg-primary);
  padding: 20px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.lyrics-display::-webkit-scrollbar { display: none; }
/* 上下填充，让第一行/最后一行也能滚动到容器视觉中央 */
.top-padding { height: 50%; }
.bottom-padding { height: 50%; }
.lyric-paragraph {
  padding: 0;
  transition: color 0.2s;
}
.lyric-paragraph.active .lyric-original {
  color: var(--text-primary); font-weight: 500;
}
.lyric-paragraph.active .lyric-translation {
  color: var(--text-primary); opacity: 0.8;
}
.lyric-paragraph.active .lyric-translation-inline {
  color: var(--text-primary); opacity: 0.85;
}
.lyric-original { font-size: inherit; color: var(--text-muted); line-height: 1.5; white-space: pre-wrap; }
.lyric-translation { font-size: 0.85em; color: var(--text-muted); opacity: 0.6; line-height: 1.4; white-space: pre-wrap; margin-top: 2px; }
.lyric-translation-inline { font-size: 0.85em; opacity: 0.75; }
.no-lyrics { padding: 32px; color: var(--text-muted); font-size: 13px; }
</style>