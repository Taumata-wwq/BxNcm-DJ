<template>
  <div class="app-root">
    <!-- 加载覆盖层：loading / loading-data 阶段显示，ready 阶段带淡出动画 -->
    <div
      v-show="showOverlay"
      class="init-overlay"
      :class="{ 'overlay-fading': fadingOut }"
    >
      <div class="init-container">
        <div class="app-title">BxNcm DJ</div>
        <div class="spinner"></div>
        <div class="task-text">{{ currentTask }}</div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
        </div>
      </div>
    </div>
    <!-- 路由视图：login / ready 阶段可见 -->
    <router-view v-show="routerVisible" />
  </div>
</template>

<script setup lang="ts">
import { ref, provide, computed, onUnmounted, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from './stores/settings.store'
import { useAuthStore } from './stores/auth.store'

const router = useRouter()
const settingsStore = useSettingsStore()
const authStore = useAuthStore()

// ── 关闭前响应：保存设置后通知主进程 ──
onMounted(() => {
  window.electronAPI.onBeforeClose(async () => {
    await settingsStore.save()
    window.electronAPI.appSaveDone()
  })
})

// ── 状态机 ──
// loading      → 初始加载（设置 + 鉴权），显示 overlay
// login        → 未登录，显示登录页
// loading-data → 登录后加载数据，显示 overlay
// ready        → 主界面就绪（MainView 已挂载且队列已加载）
type AppPhase = 'loading' | 'login' | 'loading-data' | 'ready'
const appPhase = ref<AppPhase>('loading')

// 主界面就绪时的淡出控制
const fadingOut = ref(false)

const progress = ref(0)
const currentTask = ref('正在启动...')

// overlay 可见：loading / loading-data 阶段，以及 ready 阶段的淡出过程中
const showOverlay = computed(() =>
  appPhase.value === 'loading' || appPhase.value === 'loading-data' || fadingOut.value
)

// 路由视图可见：login 阶段（登录页）、loading-data 阶段（数据加载，overlay 遮盖）、ready 阶段（主界面）
const routerVisible = computed(() =>
  appPhase.value === 'login' || appPhase.value === 'loading-data' || appPhase.value === 'ready'
)

// ── 工具 ──
function updateProgress(pct: number, task: string) {
  progress.value = pct
  currentTask.value = task
}

// ── LoginView 回调：用户点击"进入"后触发 ──
async function onLoginComplete() {
  appPhase.value = 'loading-data'
  updateProgress(15, '正在刷新登录状态...')
  // 重新初始化 authStore（QR 登录期间的凭据已由主进程保存）
  await authStore.init()
  updateProgress(30, '登录状态已刷新')
  updateProgress(45, '正在进入主界面...')
  await loadAndEnterMain()
}

// MainView.onMounted 队列加载完毕后调用
let fadeTimer: ReturnType<typeof setTimeout> | null = null

function signalMainReady() {
  currentTask.value = '加载完成'
  progress.value = 100
  // 先触发 CSS 淡出动画
  fadingOut.value = true
  // 动画结束后切到 ready 状态，清理残留
  fadeTimer = setTimeout(() => {
    fadingOut.value = false
    appPhase.value = 'ready'
    const ls = document.getElementById('loading-screen')
    if (ls) ls.remove()
  }, 400)
}

onUnmounted(() => {
  if (fadeTimer) clearTimeout(fadeTimer)
})

// 注入给子组件
provide('signalMainReady', signalMainReady)
provide('onLoginComplete', onLoginComplete)
provide('updateLoadingProgress', updateProgress)

// ── 核心：加载数据后进入主界面 ──
async function loadAndEnterMain() {
  // 此处可扩展：预加载数据库、预热缓存等
  updateProgress(55, '正在准备播放队列...')
  await router.push('/main')
  // MainView.onMounted 异步加载队列，完成后调用 signalMainReady
}

// ── 主初始化流程 ──
async function initApp() {
  // 隐藏静态 loading-screen，Vue overlay 接管
  const staticLs = document.getElementById('loading-screen')
  if (staticLs) staticLs.style.display = 'none'

  // ====== 阶段1：启动配置（0%-20%）主题色、窗口信息 ======
  updateProgress(5, '正在加载启动配置...')
  await settingsStore.loadBoot()
  updateProgress(20, '启动配置已加载')

  // ====== 阶段2：应用数据（25%-50%）软件本体设置 ======
  updateProgress(25, '正在加载应用设置...')
  await settingsStore.loadApp()
  updateProgress(50, '应用设置已加载')

  // 阶段3：检测登录状态（50%-60%）
  updateProgress(55, '正在检查登录状态...')
  await authStore.init()
  updateProgress(60, '登录状态已确认')

  const isLoggedIn = authStore.authState.bilibili && authStore.authState.netease

  if (isLoggedIn) {
    await router.push('/main')
    appPhase.value = 'loading-data'
    // 60% → MainView 继续推进到 100%
  } else {
    appPhase.value = 'login'
  }
}

initApp()
</script>

<style>
/* 根容器：确保过渡期间无白屏 */
.app-root {
  background: var(--bg-primary);
  min-height: 100vh;
}

.init-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: grid;
  place-items: center;
  background: #1e1e1e;
  z-index: 9999;
  will-change: opacity;
  -webkit-app-region: drag;
}
/* 主界面就绪时的淡出动画 */
.overlay-fading {
  opacity: 0;
  transition: opacity 0.35s ease;
  pointer-events: none;
}

.init-container {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  width: 280px;
}
.app-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--accent, #00b5e5);
  letter-spacing: 2px;
}
.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255,255,255,0.08);
  border-top-color: var(--accent, #00b5e5);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.task-text {
  font-size: 13px;
  color: #888;
  min-height: 20px;
}
.progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--accent, #00b5e5);
  border-radius: 2px;
  transition: width 0.4s ease;
}
</style>