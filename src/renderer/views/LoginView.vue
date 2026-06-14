<template>
  <div class="login-page" style="-webkit-app-region: drag">
    <button class="close-btn" @click="closeWindow" style="-webkit-app-region: no-drag">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    <div class="login-header">
      <h1>BxNcm DJ</h1>
      <p class="subtitle">v{{ appVersion }} by Taumata</p>
    </div>
    <div class="login-content">
      <!-- B站 -->
      <div class="login-card">
        <div class="card-title">B站账号登录</div>
        <div class="qr-section">
          <div v-if="bilibiliLoggedIn" class="user-info">
            <div class="avatar-wrapper">
              <img v-if="bilibiliFace" :src="bilibiliFace" class="user-avatar" @error="onBiliAvatarError" />
              <span v-if="!bilibiliAvatarOk" class="avatar-fallback">头像</span>
            </div>
            <p class="user-name">{{ bilibiliUname }}</p>
            <p class="user-uid">UID: {{ bilibiliUid }}</p>
          </div>
          <div v-else-if="bilibiliQrUrl" class="qr-container">
            <img :src="bilibiliQrUrl" alt="二维码" class="qr-image" />
            <p class="qr-status">{{ bilibiliQrStatus }}</p>
          </div>
          <div v-else class="qr-loading">获取中...</div>
          <button class="btn" @click="refreshBilibiliQR" :disabled="bilibiliPolling" style="-webkit-app-region: no-drag">
            {{ bilibiliPolling ? '等待扫码...' : '刷新' }}
          </button>
        </div>
      </div>
      <!-- 网易云 -->
      <div class="login-card">
        <div class="card-title">网易云音乐登录</div>
        <div class="qr-section">
          <div v-if="neteaseLoggedIn" class="user-info">
            <div class="avatar-wrapper">
              <img v-if="neteaseFace" :src="neteaseFace" class="user-avatar" @error="onNeteaseAvatarError" />
              <span v-if="!neteaseAvatarOk" class="avatar-fallback">头像</span>
            </div>
            <p class="user-name">{{ neteaseUname }}</p>
            <p class="user-uid">ID: {{ neteaseUid }}</p>
          </div>
          <div v-else-if="neteaseQrUrl" class="qr-container">
            <img :src="neteaseQrUrl" alt="二维码" class="qr-image" />
            <p class="qr-status">{{ neteaseQrStatus }}</p>
          </div>
          <div v-else class="qr-loading">获取中...</div>
          <button class="btn" @click="refreshNeteaseQR" :disabled="neteasePolling" style="-webkit-app-region: no-drag">
            {{ neteasePolling ? '等待扫码...' : '刷新' }}
          </button>
        </div>
      </div>
    </div>
    <div class="login-footer">
      <button
        class="btn btn-enter"
        :class="{ disabled: !bothReady }"
        :disabled="!bothReady"
        @click="enterApp"
        style="-webkit-app-region: no-drag"
      >
        进入
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'

const router = useRouter()
const authStore = useAuthStore()
const appVersion = __APP_VERSION__

// 注入 App.vue 提供的回调：登录完成后调用
const onLoginComplete = inject<() => void>('onLoginComplete', () => {
  // fallback：如果未被注入，直接导航（兼容旧逻辑）
  router.push('/main')
})

// B站
const bilibiliQrUrl = ref('')
const bilibiliQrStatus = ref('')
const bilibiliLoggedIn = ref(false)
const bilibiliFace = ref('')
const bilibiliUname = ref('')
const bilibiliUid = ref(0)
const bilibiliPolling = ref(false)
const bilibiliAvatarOk = ref(false)
let bilibiliQrKey = ''
let bilibiliPollTimer: ReturnType<typeof setInterval> | null = null

// 网易云
const neteaseQrUrl = ref('')
const neteaseQrStatus = ref('')
const neteaseLoggedIn = ref(false)
const neteaseFace = ref('')
const neteaseUname = ref('')
const neteaseUid = ref(0)
const neteasePolling = ref(false)
const neteaseAvatarOk = ref(false)
let neteaseUnikey = ''
let neteasePollTimer: ReturnType<typeof setInterval> | null = null

const bothReady = computed(() => bilibiliLoggedIn.value && neteaseLoggedIn.value)

onMounted(async () => {
  // App.vue 已初始化 authStore，直接读取登录状态
  if (authStore.authState.bilibili) {
    bilibiliLoggedIn.value = true
    bilibiliFace.value = authStore.authState.bilibiliFace || ''
    bilibiliUname.value = authStore.authState.bilibiliUname || ''
    bilibiliUid.value = authStore.authState.bilibiliUid || 0
    bilibiliAvatarOk.value = !!bilibiliFace.value
  }
  if (authStore.authState.netease) {
    neteaseLoggedIn.value = true
    neteaseFace.value = authStore.authState.neteaseFace || ''
    neteaseUname.value = authStore.authState.neteaseUname || ''
    neteaseUid.value = authStore.authState.neteaseUid || 0
    neteaseAvatarOk.value = !!neteaseFace.value
  }

  // 已登录的不需要二维码，未登录的获取二维码
  if (!bilibiliLoggedIn.value) getBilibiliQR()
  if (!neteaseLoggedIn.value) getNeteaseQR()
})

onUnmounted(() => {
  if (bilibiliPollTimer) clearInterval(bilibiliPollTimer)
  if (neteasePollTimer) clearInterval(neteasePollTimer)
})

// ========== B站 ==========

async function getBilibiliQR() {
  bilibiliQrStatus.value = '获取中...'
  bilibiliLoggedIn.value = false
  bilibiliAvatarOk.value = false
  try {
    const result = await window.electronAPI.getBilibiliQRCode()
    if (result?.url) {
      bilibiliQrKey = result.qrcodeKey
      bilibiliQrUrl.value = result.url
      bilibiliQrStatus.value = '请用B站APP扫码'
      bilibiliPolling.value = true
      startBilibiliPolling()
    } else {
      bilibiliQrStatus.value = '获取失败'
    }
  } catch {
    bilibiliQrStatus.value = '网络异常'
  }
}

function refreshBilibiliQR() {
  if (bilibiliPollTimer) { clearInterval(bilibiliPollTimer); bilibiliPollTimer = null }
  bilibiliPolling.value = false
  bilibiliQrUrl.value = ''
  getBilibiliQR()
}

function startBilibiliPolling() {
  if (bilibiliPollTimer) clearInterval(bilibiliPollTimer)
  bilibiliPollTimer = setInterval(async () => {
    try {
      const result = await window.electronAPI.checkBilibiliQRCode(bilibiliQrKey)
      if (!result) return
      if (result.success) {
        bilibiliLoggedIn.value = true
        bilibiliFace.value = result.faceDataUrl || result.face || ''
        bilibiliUname.value = result.uname || 'B站用户'
        bilibiliUid.value = result.uid || 0
        bilibiliAvatarOk.value = !!bilibiliFace.value
        bilibiliPolling.value = false
        clearInterval(bilibiliPollTimer!)
        bilibiliPollTimer = null
      } else if (result.status === 86090) {
        bilibiliQrStatus.value = '已扫码，请确认'
      } else if (result.status === 86101) {
        bilibiliQrStatus.value = '请用B站APP扫码'
      } else if (result.status === 86038) {
        bilibiliQrStatus.value = '已过期，刷新中...'
        bilibiliPolling.value = false
        clearInterval(bilibiliPollTimer!)
        bilibiliPollTimer = null
        setTimeout(() => getBilibiliQR(), 1000)
      }
    } catch (e) { console.error('[LoginView] bilibili poll failed:', e) }
  }, 2000)
}

function onBiliAvatarError() {
  bilibiliAvatarOk.value = false
}

// ========== 网易云 ==========

async function getNeteaseQR() {
  neteaseQrStatus.value = '获取中...'
  neteaseLoggedIn.value = false
  neteaseAvatarOk.value = false
  try {
    const result = await window.electronAPI.getNeteaseQRCode()
    if (result?.url) {
      neteaseUnikey = result.unikey
      neteaseQrUrl.value = result.url
      neteaseQrStatus.value = '请用网易云APP扫码'
      neteasePolling.value = true
      startNeteasePolling()
    } else {
      neteaseQrStatus.value = '获取失败'
    }
  } catch (e) {
    console.error('[LoginView] getNeteaseQR failed:', e)
    neteaseQrStatus.value = '网络异常'
  }
}

function refreshNeteaseQR() {
  if (neteasePollTimer) { clearInterval(neteasePollTimer); neteasePollTimer = null }
  neteasePolling.value = false
  neteaseQrUrl.value = ''
  getNeteaseQR()
}

function startNeteasePolling() {
  if (neteasePollTimer) clearInterval(neteasePollTimer)
  neteasePollTimer = setInterval(async () => {
    try {
      const result = await window.electronAPI.checkNeteaseQRCode(neteaseUnikey)
      if (!result) return
      if (result.success) {
        neteaseLoggedIn.value = true
        neteaseFace.value = result.face || ''
        neteaseUname.value = result.uname || '网易云用户'
        neteaseUid.value = result.uid || 0
        neteaseAvatarOk.value = !!neteaseFace.value
        neteasePolling.value = false
        clearInterval(neteasePollTimer!)
        neteasePollTimer = null
      } else if (result.status === 802) {
        neteaseQrStatus.value = '已扫码，请确认'
      } else if (result.status === 801) {
        neteaseQrStatus.value = '请用网易云APP扫码'
      } else if (result.status === 800) {
        neteaseQrStatus.value = '已过期，刷新中...'
        neteasePolling.value = false
        clearInterval(neteasePollTimer!)
        neteasePollTimer = null
        setTimeout(() => getNeteaseQR(), 1000)
      }
    } catch (e) { console.error('[LoginView] netease poll failed:', e) }
  }, 2000)
}

function onNeteaseAvatarError() {
  neteaseAvatarOk.value = false
}

// ========== 窗口控制 ==========

function closeWindow() {
  window.electronAPI.closeWindow()
}

function enterApp() {
  if (!bothReady.value) return
  onLoginComplete()
}
</script>

<style scoped>
.login-page {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100vh; background: var(--bg-primary); color: var(--text-primary); position: relative;
}
.close-btn {
  position: absolute; top: 8px; right: 12px;
  background: none; border: none; color: var(--text-muted); cursor: pointer;
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  border-radius: 3px;
}
.close-btn:hover { background: #e74c3c; color: #fff; }
.login-header { text-align: center; margin-bottom: 20px; }
.login-header h1 { font-size: 22px; font-weight: 400; color: var(--text-primary); margin-bottom: 4px; }
.subtitle { font-size: 12px; color: var(--text-secondary); }
.login-content { display: flex; gap: 12px; margin-bottom: 16px; }
.login-card {
  background: var(--card-bg); padding: 14px; width: 280px; border: 1px solid var(--border);
}
.card-title { font-size: 13px; color: var(--text-primary); margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid var(--section-border); }
.qr-section { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.qr-container { display: flex; flex-direction: column; align-items: center; }
.qr-image { width: 150px; height: 150px; background: #fff; padding: 3px; border: 1px solid var(--border); }
.qr-status { margin-top: 4px; font-size: 11px; color: var(--text-muted); }
.qr-loading { font-size: 11px; color: var(--text-muted); padding: 16px 0; }
.user-info { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.avatar-wrapper { width: 60px; height: 60px; position: relative; }
.user-avatar { width: 60px; height: 60px; border-radius: 50%; border: 2px solid var(--accent); object-fit: cover; }
.avatar-fallback {
  position: absolute; inset: 0; border-radius: 50%; border: 2px solid var(--accent);
  background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: var(--text-muted);
}
.user-name { font-size: 14px; color: var(--text-primary); }
.user-uid { font-size: 11px; color: var(--text-muted); }
.btn {
  width: 100%; padding: 5px 10px; border: 1px solid var(--border);
  background: var(--accent); color: var(--btn-primary-text); font-size: 12px; cursor: pointer;
}
.btn:hover { opacity: 0.85; }
.btn:disabled { background: var(--btn-bg); color: var(--text-muted); cursor: default; }
.btn-enter {
  width: 572px; padding: 7px 14px; font-size: 13px;
}
.btn-enter.disabled { background: var(--btn-bg); color: var(--text-muted); cursor: not-allowed; }
.btn-enter:not(.disabled):hover { opacity: 0.85; }
</style>