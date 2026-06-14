import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AuthState } from '@shared/types/settings'

export const useAuthStore = defineStore('auth', () => {
  const authState = ref<AuthState>({
    bilibili: false,
    bilibiliUname: '',
    bilibiliFace: '',
    bilibiliUid: 0,
    netease: false,
    neteaseUname: '',
    neteaseFace: '',
    neteaseUid: 0
  })
  const showSettings = ref(false)

  async function init() {
    try {
      const result = await window.electronAPI.checkAutoLogin()
      authState.value = result.authState
    } catch {}
  }

  function toggleSettings() {
    showSettings.value = !showSettings.value
  }

  function closeSettings() {
    showSettings.value = false
  }

  return { authState, showSettings, init, toggleSettings, closeSettings }
})