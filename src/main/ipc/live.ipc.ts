import { ipcMain } from 'electron'
import {
  getRoomInfoByUid,
  updateRoomTitle,
  updateRoomArea,
  getAreaList,
  startLive,
  stopLive,
  getFollowerCount,
  getRoomInfoByRoomId
} from '../services/live-manager'

export function registerLiveIpc() {
  ipcMain.handle('live:get-room-info', async (_event, uid: number) => {
    try {
      return await getRoomInfoByUid(uid)
    } catch (error: any) {
      console.error('[live:get-room-info]', error)
      return { success: false, error: error?.message || String(error) }
    }
  })

  ipcMain.handle('live:get-room-info-by-room', async (_event, roomId: number) => {
    try {
      return await getRoomInfoByRoomId(roomId)
    } catch (error: any) {
      console.error('[live:get-room-info-by-room]', error)
      return { success: false, error: error?.message || String(error) }
    }
  })

  ipcMain.handle('live:get-follower-count', async (_event, vmid: number) => {
    try {
      return await getFollowerCount(vmid)
    } catch (error: any) {
      console.error('[live:get-follower-count]', error)
      return { success: false, error: error?.message || String(error) }
    }
  })

  ipcMain.handle('live:update-title', async (_event, roomId: number, title: string) => {
    try {
      return await updateRoomTitle(roomId, title)
    } catch (error: any) {
      console.error('[live:update-title]', error)
      return { success: false, error: error?.message || String(error) }
    }
  })

  ipcMain.handle('live:update-area', async (_event, roomId: number, areaId: number) => {
    try {
      return await updateRoomArea(roomId, areaId)
    } catch (error: any) {
      console.error('[live:update-area]', error)
      return { success: false, error: error?.message || String(error) }
    }
  })

  ipcMain.handle('live:get-area-list', async () => {
    try {
      return await getAreaList()
    } catch (error: any) {
      console.error('[live:get-area-list]', error)
      return { success: false, error: error?.message || String(error) }
    }
  })

  ipcMain.handle('live:start', async (_event, roomId: number, areaId: number) => {
    try {
      return await startLive(roomId, areaId)
    } catch (error: any) {
      console.error('[live:start]', error)
      return { success: false, error: error?.message || String(error) }
    }
  })

  ipcMain.handle('live:stop', async (_event, roomId: number) => {
    try {
      return await stopLive(roomId)
    } catch (error: any) {
      console.error('[live:stop]', error)
      return { success: false, error: error?.message || String(error) }
    }
  })
}