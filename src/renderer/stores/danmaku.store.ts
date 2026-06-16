import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { DanmakuStatus, DanmakuMessage, ViewerInfo } from '@shared/types/danmaku'

export const useDanmakuStore = defineStore('danmaku', () => {
  const status = ref<DanmakuStatus>({ connected: false, roomId: 0 })
  const logs = ref<string[]>([])
  const messages = ref<DanmakuMessage[]>([])
  const viewers = ref<ViewerInfo[]>([])
  const MAX_LOGS = 200
  const MAX_MESSAGES = 500
  const MAX_VIEWERS = 200

  function updateStatus(s: DanmakuStatus) {
    const wasConnected = status.value.connected
    status.value = s
    if (s.connected && !wasConnected) addLog(`弹幕已连接 - 直播间 ${s.roomId}`)
    else if (!s.connected && wasConnected) addLog('弹幕已断开')
  }

  function addLog(msg: string) {
    const time = new Date().toLocaleTimeString()
    logs.value.push(`[${time}] ${msg}`)
    if (logs.value.length > MAX_LOGS) {
      logs.value = logs.value.slice(-MAX_LOGS)
    }
  }

  function addMessage(msg: DanmakuMessage) {
    if (!msg.timestamp) msg.timestamp = Date.now()
    messages.value.push(msg)
    if (messages.value.length > MAX_MESSAGES) {
      messages.value = messages.value.slice(-MAX_MESSAGES)
    }
  }

  function addViewer(viewer: ViewerInfo) {
    // 已存在：仅更新可变字段，不改变数组顺序，避免头像闪烁
    const existingIdx = viewers.value.findIndex(v => v.uid === viewer.uid)
    if (existingIdx !== -1) {
      const existing = viewers.value[existingIdx]
      if (existing.avatarUrl !== viewer.avatarUrl || existing.uname !== viewer.uname) {
        // 创建新对象触发响应式更新，但不改变数组顺序
        viewers.value[existingIdx] = { ...viewer }
      }
      return
    }
    // 新增观众
    viewers.value.push(viewer)
    if (viewers.value.length > MAX_VIEWERS) {
      viewers.value = viewers.value.slice(-MAX_VIEWERS)
    }
  }

  /** 批量替换观众列表（用于定时全量刷新） */
  function setViewers(newViewers: ViewerInfo[]) {
    viewers.value = newViewers.slice(0, MAX_VIEWERS)
  }

  /** 清除观众列表（断开连接时） */
  function clearViewers() {
    viewers.value = []
  }

  return { status, logs, messages, viewers, updateStatus, addLog, addMessage, addViewer, setViewers, clearViewers }
})