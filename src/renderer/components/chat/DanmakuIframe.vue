<template>
  <div class="danmaku-iframe-container" :class="{ 'splitter-dragging': isDragging }">
    <iframe
      ref="iframeRef"
      :key="iframeKey"
      :src="iframeSrc"
      class="danmaku-iframe"
      frameborder="0"
      allow="autoplay"
      scrolling="no"
      @load="onIframeLoad"
      @error="onIframeError"
    ></iframe>
    <div v-if="!connected" class="danmaku-iframe-placeholder">
      <span>弹幕未连接</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, inject } from 'vue'
import { useDanmakuStore } from '../../stores/danmaku.store'
import { useSettingsStore } from '../../stores/settings.store'
import defaultDanmakuCss from '../../assets/styles/danmaku.css?raw'

const props = defineProps<{
  roomId: number
}>()

const danmakuStore = useDanmakuStore()
const settingsStore = useSettingsStore()

const iframeRef = ref<HTMLIFrameElement | null>(null)
const iframeReady = ref(false)
const iframeKey = ref(0)

// iframe 加载失败重试
const IFRAME_RETRY_MAX = 5
const IFRAME_RETRY_DELAY = 3000
let iframeRetryCount = 0
let iframeRetryTimer: ReturnType<typeof setTimeout> | null = null

const connected = computed(() => danmakuStore.status.connected)

// 分割条拖拽状态（由 MainView 提供，拖拽时禁用 iframe pointer-events）
const splitterDragging = inject('splitterDragging', ref(false))
const isDragging = ref(false)
watch(splitterDragging, (val) => {
  isDragging.value = val
})

// ---- 自适应缩放：根据容器宽度动态计算 --base-size ----
const DESIGNED_WIDTH = 400 // blivechat 设计稿基准宽度
const MIN_SCALE = 0.5
const MAX_SCALE = 3.0
const currentBaseSize = ref(1)

let resizeObserver: ResizeObserver | null = null
let resizeTimer: ReturnType<typeof setTimeout> | null = null

function updateBaseSize(width: number) {
  const newSize = Math.max(MIN_SCALE, Math.min(MAX_SCALE, width / DESIGNED_WIDTH))
  // 变化超过 2% 才更新，避免频繁重注入
  if (Math.abs(newSize - currentBaseSize.value) / currentBaseSize.value > 0.02) {
    currentBaseSize.value = newSize
    if (iframeReady.value) {
      injectCustomCss()
    }
  }
}

// ---- 弹幕设置 URL 构建（对齐 blivechat-dev chatConfig 全部参数） ----
const iframeSrc = computed(() => {
  const code = settingsStore.settings.identityCode
  if (!code && !props.roomId) return 'about:blank'

  const s = settingsStore.settings
  const params = new URLSearchParams()

  // 房间标识
  if (code) {
    params.set('roomKeyType', '2')
  } else {
    params.set('roomKeyType', '1')
  }

  // 语言
  params.set('lang', s.blivechatLang || 'zh')

  // 显示控制（对齐 blivechat-dev config）
  params.set('showDanmaku', s.showDanmaku ? 'true' : 'false')
  params.set('showGift', s.showPaidMessages ? 'true' : 'false')
  params.set('showGiftName', s.showGiftName ? 'true' : 'false')
  params.set('mergeSimilarDanmaku', s.mergeSimilarDanmaku ? 'true' : 'false')
  params.set('mergeGift', s.mergeSimilarGift ? 'true' : 'false')
  params.set('maxNumber', String(s.maxDanmakuCount))
  params.set('minGiftPrice', String(s.minPaidMessagePrice))

  // 屏蔽（对齐 blivechat-dev config）
  params.set('blockGiftDanmaku', s.blockGiftDanmaku ? 'true' : 'false')
  params.set('blockMirrorMessages', s.blockMirrorMessages ? 'true' : 'false')
  params.set('blockLevel', String(s.blockLevel))
  params.set('blockMedalLevel', String(s.blockMedalLevel))
  params.set('blockNewbie', s.blockNewbie ? 'true' : 'false')
  params.set('blockNotMobileVerified', s.blockNotMobileVerified ? 'true' : 'false')
  if (s.blockKeywords) params.set('blockKeywords', s.blockKeywords)
  if (s.blockUsers) params.set('blockUsers', s.blockUsers)

  // 调试
  params.set('showDebugMessages', s.showDebugMessages ? 'true' : 'false')

  const roomKey = code || String(props.roomId)
  return `https://blive.chat/room/${roomKey}?${params.toString()}`
})

// ---- 监视弹幕设置变化，触发 iframe 重载以同步更新 ----
// 防抖：避免频繁重载
let reloadTimer: ReturnType<typeof setTimeout> | null = null
function scheduleReload() {
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => {
    reloadTimer = null
    iframeReady.value = false
    iframeKey.value++
  }, 500)
}

// 监视所有会改变 blivechat URL 参数的设置
watch(
  () => [
    settingsStore.settings.showDanmaku,
    settingsStore.settings.showPaidMessages,
    settingsStore.settings.showGiftName,
    settingsStore.settings.mergeSimilarDanmaku,
    settingsStore.settings.mergeSimilarGift,
    settingsStore.settings.maxDanmakuCount,
    settingsStore.settings.minPaidMessagePrice,
    settingsStore.settings.blockGiftDanmaku,
    settingsStore.settings.blockMirrorMessages,
    settingsStore.settings.blockLevel,
    settingsStore.settings.blockMedalLevel,
    settingsStore.settings.blockNewbie,
    settingsStore.settings.blockNotMobileVerified,
    settingsStore.settings.blockKeywords,
    settingsStore.settings.blockUsers,
    settingsStore.settings.showDebugMessages,
    settingsStore.settings.blivechatLang,
  ],
  () => { scheduleReload() },
)

// ---- CSS 注入：三层降级策略（IPC → 直接 DOM → postMessage） ----
const CssInjectRetryMax = 20
const CssInjectRetryInterval = 500
const CSS_STYLE_ID = 'blc-external-css'

let cssInjectRetryCount = 0
let cssInjectTimer: ReturnType<typeof setTimeout> | null = null

function clearCssInjectTimer() {
  if (cssInjectTimer) {
    clearTimeout(cssInjectTimer)
    cssInjectTimer = null
  }
}

/** 获取要注入的 CSS（自动追加 base-size 覆盖） */
function getCssToInject(): string {
  const customCss = settingsStore.settings.customDanmakuCss
  const baseCss = customCss && customCss.trim() ? customCss : defaultDanmakuCss
  return baseCss + `\nyt-live-chat-renderer{--base-size-override:${currentBaseSize.value}px;}`
}

/**
 * CSS 注入：三层降级策略
 * 1. IPC 注入（主进程通过 webContents.frames 找到 blivechat iframe 并 executeJavaScript）
 * 2. 直接 DOM 操作（iframe.contentDocument，Electron webSecurity:false 时可用）
 * 3. postMessage（roomSetCustomStyle，同源场景可用）
 */
async function injectCustomCss() {
  const iframe = iframeRef.value
  if (!iframe) {
    retryInjectCss()
    return
  }

  const css = getCssToInject()

  // 方法1：IPC 注入（最可靠，通过 Electron 主进程在 iframe 中执行 JS）
  try {
    const result = await window.electronAPI.injectCssToBlivechatFrame(css)
    if (result.success) {
      cssInjectRetryCount = 0
      console.log('[DanmakuIframe] CSS IPC 注入成功, 长度:', css.length)
      return
    }
    console.log('[DanmakuIframe] IPC 注入返回失败:', result.error)
  } catch (e) {
    console.warn('[DanmakuIframe] IPC 注入异常:', e)
  }

  // 方法2：直接 DOM 操作（降级）
  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (iframeDoc && iframeDoc.head) {
      let styleEl = iframeDoc.getElementById(CSS_STYLE_ID) as HTMLStyleElement | null
      if (!styleEl) {
        styleEl = iframeDoc.createElement('style')
        styleEl.id = CSS_STYLE_ID
        iframeDoc.head.appendChild(styleEl)
      }
      styleEl.textContent = css
      cssInjectRetryCount = 0
      console.log('[DanmakuIframe] CSS 直接 DOM 注入成功')
      return
    }
  } catch {
    // 跨域，降级
  }

  // 方法3：postMessage（降级，同源时有效）
  try {
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: 'roomSetCustomStyle', data: { css } },
        '*',
      )
      cssInjectRetryCount = 0
      console.log('[DanmakuIframe] CSS postMessage 已发送')
      return
    }
  } catch {
    // 继续重试
  }

  retryInjectCss()
}

function retryInjectCss() {
  if (cssInjectRetryCount >= CssInjectRetryMax) {
    console.warn('[DanmakuIframe] CSS 注入重试已达上限，放弃')
    cssInjectRetryCount = 0
    return
  }
  cssInjectRetryCount++
  clearCssInjectTimer()
  const delay = CssInjectRetryInterval + cssInjectRetryCount * 200
  cssInjectTimer = setTimeout(() => {
    cssInjectTimer = null
    console.log(`[DanmakuIframe] CSS 注入重试 ${cssInjectRetryCount}/${CssInjectRetryMax}`)
    injectCustomCss()
  }, delay)
}

// iframe 加载完成后等待 blive.chat 应用就绪
function onIframeLoad() {
  iframeRetryCount = 0  // 加载成功，重置重试计数
  iframeReady.value = true
  cssInjectRetryCount = 0
  clearCssInjectTimer()
  // 延迟后开始注入，给 blive.chat 应用初始化时间
  cssInjectTimer = setTimeout(() => {
    cssInjectTimer = null
    injectCustomCss()
  }, 800)
}

// iframe 加载失败时重试（ERR_CONNECTION_CLOSED 等网络错误）
function onIframeError() {
  if (iframeRetryCount >= IFRAME_RETRY_MAX) {
    console.warn(`[DanmakuIframe] iframe 加载失败，已达最大重试次数 (${IFRAME_RETRY_MAX})`)
    return
  }
  iframeRetryCount++
  iframeReady.value = false
  clearCssInjectTimer()
  if (iframeRetryTimer) clearTimeout(iframeRetryTimer)
  const delay = IFRAME_RETRY_DELAY * iframeRetryCount
  console.warn(`[DanmakuIframe] iframe 加载失败，${delay/1000}s 后重试 (${iframeRetryCount}/${IFRAME_RETRY_MAX})`)
  iframeRetryTimer = setTimeout(() => {
    iframeRetryTimer = null
    iframeKey.value++
  }, delay)
}

// 监听 blive.chat 的 postMessage 就绪信号
function onBliveChatMessage(event: MessageEvent) {
  if (event.data?.type === 'blcIpcReady') {
    console.log('[DanmakuIframe] blive.chat 就绪, 注入 CSS')
    cssInjectRetryCount = 0
    injectCustomCss()
  } else if (event.data?.type === 'blcCssInjected') {
    console.log('[DanmakuIframe] blive.chat CSS 注入成功')
    cssInjectRetryCount = 0
  }
}

window.addEventListener('message', onBliveChatMessage)

// 监听自定义 CSS 变化
watch(
  () => settingsStore.settings.customDanmakuCss,
  () => {
    if (iframeReady.value) {
      cssInjectRetryCount = 0
      injectCustomCss()
    }
  },
)

onMounted(() => {
  // 启动 ResizeObserver，监听容器尺寸变化
  const container = iframeRef.value?.parentElement as HTMLElement | null
  if (container) {
    updateBaseSize(container.clientWidth)

    let prevHeight = container.clientHeight

    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width
        const h = entry.contentRect.height
        if (w <= 0 || h <= 0) continue
        if (resizeTimer) clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
          updateBaseSize(w)
          // 高度变化时：1) 重新注入 CSS  2) 向 iframe 派发 resize 事件触发 blive.chat 重排
          if (Math.abs(h - prevHeight) > 2) {
            prevHeight = h
            if (iframeReady.value) {
              injectCustomCss()
              try {
                iframeRef.value?.contentWindow?.dispatchEvent(new Event('resize'))
              } catch { /* 跨域安全限制，忽略 */ }
            }
          }
        }, 100)
      }
    })
    resizeObserver.observe(container)
  }

  clearCssInjectTimer()
  if (connected.value && iframeReady.value) {
    injectCustomCss()
  }
})

onBeforeUnmount(() => {
  iframeReady.value = false
  clearCssInjectTimer()
  if (reloadTimer) {
    clearTimeout(reloadTimer)
    reloadTimer = null
  }
  if (iframeRetryTimer) {
    clearTimeout(iframeRetryTimer)
    iframeRetryTimer = null
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  if (resizeTimer) {
    clearTimeout(resizeTimer)
    resizeTimer = null
  }
  window.removeEventListener('message', onBliveChatMessage)
})

/** 手动刷新 iframe */
function reload() {
  clearCssInjectTimer()
  if (reloadTimer) { clearTimeout(reloadTimer); reloadTimer = null }
  if (iframeRetryTimer) { clearTimeout(iframeRetryTimer); iframeRetryTimer = null }
  cssInjectRetryCount = 0
  iframeRetryCount = 0
  iframeReady.value = false
  iframeKey.value++
}

defineExpose({ reload })
</script>

<style scoped>
.danmaku-iframe-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: transparent;
}

.danmaku-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
}

/* 拖拽分割条期间禁用 iframe 鼠标事件，防止 mouseup 被 iframe 吞掉 */
.splitter-dragging .danmaku-iframe {
  pointer-events: none;
}

.danmaku-iframe-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 12px;
  pointer-events: none;
}
</style>