// ---------- 队列叠加层页面 ----------

import { DEFAULT_SETTINGS } from '../../../../shared/constants/defaults'
import { COMMON_CSS, hexToRgbJs, escapeHtmlJs, buildFontCssJs, buildShadowJs } from '../common'

export function getQueuePage(port: number): string {
  const d = DEFAULT_SETTINGS.obsQueueStyle

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OBS 队列叠加层</title>
<style>${COMMON_CSS}</style>
</head>
<body class="overlay-mode">
<div id="overlay">
  <div class="queue-container" id="queue-list"></div>
</div>
<script>
var PORT = ${port}
var PAGE = 'queue'
var currentStyle = {
  fontSize: ${d.fontSize}, fontFamily: '${d.fontFamily}', fontWeight: '${d.fontWeight}', fontStyle: '${d.fontStyle}', textDecoration: '${d.textDecoration}', fontColor: '${d.fontColor}', highlightColor: '${d.highlightColor}', showIndex: ${d.showIndex}, indexColor: '${d.indexColor}',
  showRequester: ${d.showRequester}, requesterColor: '${d.requesterColor}',
  wordWrap: ${d.wordWrap}, textAlign: '${d.textAlign}', verticalAlign: '${d.verticalAlign}', lineSpacing: ${d.lineSpacing}, maxLines: ${d.maxLines},
  bgColor: '${d.bgColor}', bgOpacity: ${d.bgOpacity}, shadowColor: '${d.shadowColor}', shadowSize: ${d.shadowSize}, shadowOffsetX: ${d.shadowOffsetX}, shadowOffsetY: ${d.shadowOffsetY}
}
var lastSongs = []
var lastCurrentIndex = 0

${hexToRgbJs()}
${escapeHtmlJs()}
${buildFontCssJs()}
${buildShadowJs()}

function applyStyle(cfg) {
  var ov = document.getElementById('overlay')
  var list = document.getElementById('queue-list')
  ov.style.backgroundColor = 'rgba(' + hexToRgb(cfg.bgColor) + ',' + (cfg.bgOpacity / 100) + ')'
  if (list) {
    var vAlign = cfg.verticalAlign || 'top'
    var justifyContent = vAlign === 'bottom' ? 'flex-end' : 'flex-start'
    list.style.cssText = 'font-size: ' + cfg.fontSize + 'px; color: ' + cfg.fontColor + '; ' + buildFontCss('', cfg) + '; text-align: ' + (cfg.textAlign || 'left') + '; text-shadow: ' + buildShadow(cfg) + '; display: flex; flex-direction: column; justify-content: ' + justifyContent + ';'
  }
}

function renderQueue(songs, currentIndex) {
  var list = document.getElementById('queue-list')
  if (!list) return
  var max = currentStyle.maxLines
  var html = ''
  var start = Math.max(0, (currentIndex || 0) - Math.floor(max / 2))
  var end = Math.min(songs.length, start + max)
  if (end - start < max && start > 0) start = Math.max(0, end - max)
  for (var i = start; i < end; i++) {
    var s = songs[i]
    var isCurrent = (i === (currentIndex || 0))
    var color = isCurrent ? currentStyle.highlightColor : currentStyle.fontColor
    var idxStr = currentStyle.showIndex ? '<span style="color:' + currentStyle.indexColor + '">' + (i + 1) + '. </span>' : ''
    var reqStr = ''
    if (currentStyle.showRequester && s.requesterName) {
      reqStr = ' <span style="color:' + currentStyle.requesterColor + ';font-size:' + (currentStyle.fontSize * 0.8) + 'px">\uff08\u70b9\u6b4c\u4eba\uff1a' + escapeHtml(s.requesterName) + '\uff09</span>'
    }
    var ws = currentStyle.wordWrap ? 'white-space:normal;word-break:break-word;' : 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
    var ls = currentStyle.lineSpacing ? 'margin-bottom:' + currentStyle.lineSpacing + 'px;' : ''
    html += '<div class="queue-item' + (isCurrent ? ' current' : '') + '" style="color:' + color + ';' + ws + ls + '">' + idxStr + escapeHtml(s.title) + ' - ' + escapeHtml(s.artist) + reqStr + '</div>'
  }
  list.innerHTML = html
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
    case 'queue':
      lastSongs = msg.songs || []
      lastCurrentIndex = Math.max(0, msg.currentIndex ?? 0)
      renderQueue(lastSongs, lastCurrentIndex)
      break
    case 'style':
      if (msg.page && msg.page !== PAGE) return
      Object.assign(currentStyle, cleanStyleMsg(msg))
      applyStyle(currentStyle)
      renderQueue(lastSongs, lastCurrentIndex)
      break
  }
}

applyStyle(currentStyle)

var ws
function connectWS() {
  ws = new WebSocket('ws://localhost:' + PORT + '/queue')
  ws.onclose = function() { setTimeout(connectWS, 2000) }
  ws.onmessage = function(e) {
    try { handleMessage(JSON.parse(e.data)) } catch(ex) {}
  }
}
connectWS()

// 通过 postMessage 接收样式即时预览和数据转发（作为自有 WebSocket 的补充）
window.addEventListener('message', function(e) {
  try {
    var msg = e.data
    if (msg && msg.type === 'style') {
      if (msg.page && msg.page !== PAGE) return
      handleMessage(msg)
    } else if (msg && msg.type === 'queue') {
      handleMessage(msg)
    }
  } catch(ex) {}
})
</script>
</body>
</html>`
}