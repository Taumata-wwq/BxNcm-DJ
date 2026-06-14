// ---------- OBS 叠加层 HTTP + WebSocket 服务器 ----------

import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { store } from '../store'
import { getLyricPage } from './pages/lyric'
import { getQueuePage } from './pages/queue'
import { getSongInfoPage } from './pages/songinfo'
import { getStylePage } from './pages/style'

// ===== 类型 =====

interface ObsState {
  lyric: { text: string; translation: string }
  queue: { songs: Array<{ title: string; artist: string; requesterName?: string }>; currentIndex: number }
  songInfo: { title: string; artist: string; requester: string }
}

// ===== 运行时状态缓存 =====

const state: ObsState = {
  lyric: { text: '', translation: '' },
  queue: { songs: [], currentIndex: 0 },
  songInfo: { title: '', artist: '', requester: '' },
}

// ===== 服务器实例 =====

let server: http.Server | null = null
let wss: WebSocketServer | null = null
let currentPort = 0
const clients = new Set<WebSocket>()

// ===== 页面映射 =====

const pageMap: Record<string, string> = {
  '/lyric': 'lyric',
  '/': 'lyric',
  '/queue': 'queue',
  '/songinfo': 'songinfo',
}

function getPageKey(pathname: string): string {
  return pageMap[pathname] || 'lyric'
}

// ===== 页面生成 =====

function getPageHtml(page: string, port: number): string {
  switch (page) {
    case 'lyric':    return getLyricPage(port)
    case 'queue':    return getQueuePage(port)
    case 'songinfo': return getSongInfoPage(port)
    case 'style':    return getStylePage(port)
    default: throw new Error('Unknown page: ' + page)
  }
}

// ===== 初始化消息 =====

function getInitMessage(pathname: string): { type: string } & Record<string, unknown> | null {
  if (pathname === '/lyric' || pathname === '/') {
    return { type: 'lyric', ...state.lyric }
  }
  if (pathname === '/queue') {
    return { type: 'queue', ...state.queue }
  }
  if (pathname === '/songinfo') {
    return { type: 'songinfo', ...state.songInfo }
  }
  return null
}

function getPageStyle(pathname: string): Record<string, unknown> | null {
  const page = pageMap[pathname]
  if (!page) return null
  const raw = store.get(`obs_${page}_style`)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function getAllSavedStyles(): Record<string, Record<string, unknown> | null> {
  return {
    lyric: getPageStyle('/lyric'),
    queue: getPageStyle('/queue'),
    songinfo: getPageStyle('/songinfo'),
  }
}

// ===== 端口尝试 =====

async function tryListen(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server!.listen(port, '127.0.0.1', () => {
      currentPort = port
      resolve(port)
    })
    server!.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && port < 4690) {
        resolve(tryListen(port + 1))
      } else {
        reject(err)
      }
    })
  })
}

// ===== 公开接口 =====

export async function startObsServer(): Promise<number> {
  if (server) {
    console.warn('[OBS-Server] 服务器已在运行中')
    return currentPort
  }

  const startPort = 4680

  server = http.createServer((req, res) => {
    const url = req.url || '/'
    const pathname = url.split('?')[0]

    if (pathname === '/') {
      res.writeHead(302, { Location: '/lyric' })
      res.end()
      return
    }

    if (pathname === '/lyric' || pathname === '/queue' || pathname === '/songinfo' || pathname === '/style') {
      try {
        const html = getPageHtml(pathname.replace('/', ''), currentPort)
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html)
      } catch (e) {
        console.error(`[OBS-Server] 生成页面 ${pathname} 失败:`, (e as Error).message)
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Internal Server Error')
      }
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not Found')
  })

  // WebSocket
  wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url || '/'

    wss!.handleUpgrade(request, socket, head, (ws) => {
      ;(ws as any)._page = pathname
      clients.add(ws)

      // 发送初始数据
      const initMsg = getInitMessage(pathname)
      if (initMsg) {
        ws.send(JSON.stringify(initMsg))
      }

      // 发送已保存的样式
      const style = getPageStyle(pathname)
      if (style) {
        ws.send(JSON.stringify({ type: 'style', page: getPageKey(pathname), ...style }))
      }

      // /style 页面：发送所有已保存样式和当前实时数据
      if (pathname === '/style') {
        const allStyles = getAllSavedStyles()
        ws.send(JSON.stringify({ type: 'style-init', styles: allStyles }))
        ws.send(JSON.stringify({
          type: 'state-data',
          lyric: state.lyric,
          queue: state.queue,
          songinfo: state.songInfo,
        }))
      }

      ws.on('close', () => {
        clients.delete(ws)
      })

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString())
          if (msg.type === 'style-update') {
            const page = msg.page
            const { type: _t, page: _p, ...config } = msg
            if (page) {
              store.set(`obs_${page}_style`, JSON.stringify(config))
            }
            // 广播样式变更给所有客户端（包括 iframe）
            broadcastObsData('style', { page, ...config })
          } else if (msg.type === 'request-state') {
            // 向后兼容：请求当前数据
            const requestedPage = msg.page
            if (requestedPage === 'lyric' || !requestedPage) {
              ws.send(JSON.stringify({ type: 'lyric', ...state.lyric }))
            }
            if (requestedPage === 'queue' || !requestedPage) {
              ws.send(JSON.stringify({ type: 'queue', ...state.queue }))
            }
            if (requestedPage === 'songinfo' || !requestedPage) {
              ws.send(JSON.stringify({ type: 'songinfo', ...state.songInfo }))
            }
          }
        } catch {
          // 忽略解析失败
        }
      })

      ws.on('error', (err) => {
        console.error('[OBS-Server] WebSocket 错误:', err.message)
        clients.delete(ws)
      })
    })
  })

  return new Promise((resolve, reject) => {
    tryListen(startPort).then(resolve).catch(reject)
  })
}

export function stopObsServer(): void {
  if (wss) {
    for (const client of clients) {
      client.close()
    }
    clients.clear()
    wss.close()
    wss = null
  }

  if (server) {
    server.close()
    server = null
  }

  currentPort = 0
}

export function getObsServerPort(): number {
  return currentPort
}

export function broadcastObsData(type: string, data: any): void {
  if (!wss) return

  // 更新运行时缓存
  switch (type) {
    case 'lyric':
      state.lyric = {
        text: data.text ?? state.lyric.text,
        translation: data.translation ?? state.lyric.translation,
      }
      break
    case 'queue':
      state.queue = {
        songs: data.songs ?? state.queue.songs,
        currentIndex: Math.max(0, data.currentIndex ?? state.queue.currentIndex),
      }
      break
    case 'songinfo':
      state.songInfo = {
        title: data.title ?? state.songInfo.title,
        artist: data.artist ?? state.songInfo.artist,
        requester: data.requester ?? state.songInfo.requester,
      }
      break
    case 'style':
      // 样式不缓存到 state，按页面分别存储到 store
      break
  }

  // 确保 type 不会被 data 中可能存在的同名属性覆盖
  const message = JSON.stringify(Object.assign({}, data, { type }))

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  }
}