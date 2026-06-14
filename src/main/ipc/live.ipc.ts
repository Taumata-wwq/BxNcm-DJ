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
    return getRoomInfoByUid(uid)
  })

  ipcMain.handle('live:get-room-info-by-room', async (_event, roomId: number) => {
    return getRoomInfoByRoomId(roomId)
  })

  ipcMain.handle('live:get-follower-count', async (_event, vmid: number) => {
    return getFollowerCount(vmid)
  })

  ipcMain.handle('live:update-title', async (_event, roomId: number, title: string) => {
    return updateRoomTitle(roomId, title)
  })

  ipcMain.handle('live:update-area', async (_event, roomId: number, areaId: number) => {
    return updateRoomArea(roomId, areaId)
  })

  ipcMain.handle('live:get-area-list', async () => {
    return getAreaList()
  })

  ipcMain.handle('live:start', async (_event, roomId: number, areaId: number) => {
    return startLive(roomId, areaId)
  })

  ipcMain.handle('live:stop', async (_event, roomId: number) => {
    return stopLive(roomId)
  })
}