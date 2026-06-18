// ---------- 歌曲信息叠加层页面 ----------

import { DEFAULT_SETTINGS } from '../../../../shared/constants/defaults'
import { COMMON_CSS, hexToRgbJs, buildFontCssJs, buildShadowJs } from '../common'

export function getSongInfoPage(port: number): string {
  const d = DEFAULT_SETTINGS.obsSongInfoStyle

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OBS 歌曲信息叠加层</title>
<style>${COMMON_CSS}</style>
</head>
<body class="overlay-mode">
<div id="overlay">
  <div class="songinfo-container" id="songinfo-container">
    <div class="song-title" id="song-title"></div>
    <div class="song-artist" id="song-artist"></div>
    <div class="song-requester" id="song-requester"></div>
  </div>
</div>
<script>
var PORT = ${port}
var PAGE = 'songinfo'
var currentStyle = {
  titleFontSize: ${d.titleFontSize}, titleFontFamily: '${d.titleFontFamily}', titleFontWeight: '${d.titleFontWeight}', titleFontStyle: '${d.titleFontStyle}', titleTextDecoration: '${d.titleTextDecoration}', titleColor: '${d.titleColor}',
  splitArtist: ${d.splitArtist}, artistFontSize: ${d.artistFontSize}, artistFontFamily: '${d.artistFontFamily}', artistFontWeight: '${d.artistFontWeight}', artistFontStyle: '${d.artistFontStyle}', artistTextDecoration: '${d.artistTextDecoration}', artistColor: '${d.artistColor}',
  showRequester: ${d.showRequester}, requesterFontSize: ${d.requesterFontSize}, requesterFontFamily: '${d.requesterFontFamily}', requesterFontWeight: '${d.requesterFontWeight}', requesterFontStyle: '${d.requesterFontStyle}', requesterTextDecoration: '${d.requesterTextDecoration}', requesterColor: '${d.requesterColor}',
  textAlign: '${d.textAlign}', lineSpacing: ${d.lineSpacing},
  bgColor: '${d.bgColor}', bgOpacity: ${d.bgOpacity}, shadowColor: '${d.shadowColor}', shadowSize: ${d.shadowSize}, shadowOffsetX: ${d.shadowOffsetX}, shadowOffsetY: ${d.shadowOffsetY}
}
var lastTitle = ''
var lastArtist = ''
var lastRequester = ''

${hexToRgbJs()}
${buildFontCssJs()}
${buildShadowJs()}

function applyStyle(cfg) {
  var ov = document.getElementById('overlay')
  var container = document.getElementById('songinfo-container')
  var t = document.getElementById('song-title')
  var a = document.getElementById('song-artist')
  var r = document.getElementById('song-requester')

  ov.style.backgroundColor = 'rgba(' + hexToRgb(cfg.bgColor) + ',' + (cfg.bgOpacity / 100) + ')'

  var ta = cfg.textAlign || 'center'
  container.style.textAlign = ta
  var ai = ta === 'left' ? 'flex-start' : ta === 'right' ? 'flex-end' : 'center'
  container.style.alignItems = ai

  var shadow = buildShadow(cfg)

  if (t) t.style.cssText = buildFontCss('title', cfg) + '; font-size: ' + cfg.titleFontSize + 'px; color: ' + cfg.titleColor + '; text-shadow: ' + shadow
  if (a) {
    a.style.cssText = buildFontCss('artist', cfg) + '; font-size: ' + cfg.artistFontSize + 'px; color: ' + cfg.artistColor + '; text-shadow: ' + shadow + '; margin-top: ' + cfg.lineSpacing + 'px'
    a.style.display = cfg.splitArtist ? 'block' : 'none'
  }
  if (r) {
    r.style.cssText = buildFontCss('requester', cfg) + '; font-size: ' + cfg.requesterFontSize + 'px; color: ' + cfg.requesterColor + '; text-shadow: ' + shadow + '; margin-top: ' + cfg.lineSpacing + 'px'
    r.style.display = cfg.showRequester ? 'block' : 'none'
  }
}

function renderSongInfo(title, artist, requester) {
  var t = document.getElementById('song-title')
  var a = document.getElementById('song-artist')
  var r = document.getElementById('song-requester')
  if (currentStyle.splitArtist) {
    if (t) t.textContent = title || ''
    if (a) a.textContent = artist || ''
  } else {
    // 不分开时：标题显示 "标题 - 作者"，作者元素隐藏
    if (t) t.textContent = (title || '') + (artist ? ' - ' + artist : '')
    if (a) a.textContent = ''
  }
  if (r) {
    if (currentStyle.showRequester) r.textContent = requester ? '\u70b9\u6b4c\u4eba: ' + requester : ''
    else r.textContent = ''
  }
}

function cleanStyleMsg(msg) {
  var s = {}
  Object.keys(msg).forEach(function(k) {
    if (k !== 'type' && k !== 'page') s[k] = msg[k]
  })
  return s
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'songinfo':
      lastTitle = msg.title || ''
      lastArtist = msg.artist || ''
      lastRequester = msg.requester || ''
      renderSongInfo(lastTitle, lastArtist, lastRequester)
      break
    case 'style':
      if (msg.page && msg.page !== PAGE) return
      Object.assign(currentStyle, cleanStyleMsg(msg))
      applyStyle(currentStyle)
      renderSongInfo(lastTitle, lastArtist, lastRequester)
      break
  }
}

applyStyle(currentStyle)

var ws, wsReconnectDelay = 1000
function connectWS() {
  ws = new WebSocket('ws://localhost:' + PORT + '/songinfo')
  ws.onclose = function() {
    wsReconnectDelay = Math.min(wsReconnectDelay * 2, 30000)
    setTimeout(connectWS, wsReconnectDelay)
  }
  ws.onopen = function() { wsReconnectDelay = 1000 }
  ws.onmessage = function(e) {
    try { handleMessage(JSON.parse(e.data)) } catch(ex) {}
  }
}
connectWS()

// 通过 postMessage 接收样式即时预览和数据转发（作为自有 WebSocket 的补充）
window.addEventListener('message', function(e) {
  if (e.origin !== 'http://localhost:' + PORT) return
  try {
    var msg = e.data
    if (msg && msg.type === 'style') {
      if (msg.page && msg.page !== PAGE) return
      handleMessage(msg)
    } else if (msg && msg.type === 'songinfo') {
      handleMessage(msg)
    }
  } catch(ex) {}
})
</script>
</body>
</html>`
}