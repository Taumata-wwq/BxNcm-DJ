// ---------- 歌词叠加层页面 ----------

import { DEFAULT_SETTINGS } from '../../../../shared/constants/defaults'
import { COMMON_CSS, hexToRgbJs, buildFontCssJs, buildShadowJs } from '../common'

export function getLyricPage(port: number): string {
  const d = DEFAULT_SETTINGS.obsLyricStyle
  const idleTextEscaped = d.idleText.replace(/'/g, "\\'").replace(/\n/g, '\\n')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OBS 歌词叠加层</title>
<style>${COMMON_CSS}</style>
</head>
<body class="overlay-mode">
<div id="overlay">
  <div class="lyric-container" id="lyric-container">
    <div class="lyric-text" id="lyric-text"></div>
    <div class="lyric-translation" id="lyric-translation"></div>
  </div>
</div>
<script>
var PORT = ${port}
var PAGE = 'lyric'
var currentStyle = {
  fontSize: ${d.fontSize}, fontFamily: '${d.fontFamily}', fontWeight: '${d.fontWeight}', fontStyle: '${d.fontStyle}', textDecoration: '${d.textDecoration}', fontColor: '${d.fontColor}', idleText: '${idleTextEscaped}', idleTextRefreshInterval: ${d.idleTextRefreshInterval},
  showTranslation: ${d.showTranslation}, translationFontSize: ${d.translationFontSize}, translationFontFamily: '${d.translationFontFamily}', translationFontWeight: '${d.translationFontWeight}', translationFontStyle: '${d.translationFontStyle}', translationTextDecoration: '${d.translationTextDecoration}', translationColor: '${d.translationColor}', splitTranslation: ${d.splitTranslation},
  textAlign: '${d.textAlign}', lineSpacing: ${d.lineSpacing},
  bgColor: '${d.bgColor}', bgOpacity: ${d.bgOpacity}, shadowColor: '${d.shadowColor}', shadowSize: ${d.shadowSize}, shadowOffsetX: ${d.shadowOffsetX}, shadowOffsetY: ${d.shadowOffsetY}
}

${hexToRgbJs()}
${buildFontCssJs()}
${buildShadowJs()}

var DEFAULT_IDLE_TEXT = '${idleTextEscaped}'

function applyStyle(cfg) {
  var ov = document.getElementById('overlay')
  var container = document.getElementById('lyric-container')
  var txt = document.getElementById('lyric-text')
  var tr = document.getElementById('lyric-translation')

  ov.style.backgroundColor = 'rgba(' + hexToRgb(cfg.bgColor) + ',' + (cfg.bgOpacity / 100) + ')'

  var ta = cfg.textAlign || 'center'
  container.style.textAlign = ta
  var ai = ta === 'left' ? 'flex-start' : ta === 'right' ? 'flex-end' : 'center'
  container.style.alignItems = ai

  txt.style.cssText = buildFontCss('', cfg) + '; font-size: ' + cfg.fontSize + 'px; color: ' + cfg.fontColor + '; text-shadow: ' + buildShadow(cfg)

  if (tr) {
    tr.style.cssText = buildFontCss('translation', cfg) + '; font-size: ' + cfg.translationFontSize + 'px; color: ' + cfg.translationColor + '; text-shadow: ' + buildShadow(cfg) + '; margin-top: ' + cfg.lineSpacing + 'px'
    if (cfg.showTranslation && cfg.splitTranslation) {
      tr.style.display = 'block'
    } else {
      tr.style.display = 'none'
    }
  }
}

var lastLyricText = ''
var lastLyricTrans = ''
var idleLines = []
var idleLineIdx = 0
var idleTimer = null

function getIdleLine() {
  var raw = currentStyle.idleText || ''
  idleLines = raw.split('\\n').filter(function(l) { return l.trim() !== '' })
  if (idleLines.length === 0) return DEFAULT_IDLE_TEXT || '欢迎来到直播间'
  if (idleLineIdx >= idleLines.length) idleLineIdx = 0
  return idleLines[idleLineIdx]
}

function startIdleTimer() {
  stopIdleTimer()
  var interval = Number(currentStyle.idleTextRefreshInterval) || 0
  if (interval <= 0) return
  idleTimer = setInterval(function() {
    if (!lastLyricText) {
      idleLineIdx++
      if (idleLineIdx >= idleLines.length) idleLineIdx = 0
      renderLyric('', lastLyricTrans)
    }
  }, interval * 1000)
}

function stopIdleTimer() {
  if (idleTimer) { clearInterval(idleTimer); idleTimer = null }
}

function renderLyric(text, translation) {
  var txt = document.getElementById('lyric-text')
  var tr = document.getElementById('lyric-translation')
  var newText = text || ''
  var newTrans = translation || ''
  if (!newText) { newText = getIdleLine() }
  if (!currentStyle.splitTranslation && currentStyle.showTranslation && newTrans) {
    txt.textContent = newText + '  \u300c' + newTrans + '\u300d'
  } else {
    txt.textContent = newText
  }
  if (tr) {
    if (currentStyle.splitTranslation && currentStyle.showTranslation && newTrans) {
      tr.textContent = newTrans
    } else {
      tr.textContent = ''
    }
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
    case 'lyric':
      lastLyricText = msg.text || ''
      lastLyricTrans = msg.translation || ''
      renderLyric(lastLyricText, lastLyricTrans)
      break
    case 'style':
      if (msg.page && msg.page !== PAGE) return
      Object.assign(currentStyle, cleanStyleMsg(msg))
      applyStyle(currentStyle)
      idleLineIdx = 0
      renderLyric(lastLyricText, lastLyricTrans)
      startIdleTimer()
      break
  }
}

applyStyle(currentStyle)

var ws
function connectWS() {
  ws = new WebSocket('ws://localhost:' + PORT + '/lyric')
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
    } else if (msg && msg.type === 'lyric') {
      handleMessage(msg)
    }
  } catch(ex) {}
})
</script>
</body>
</html>`
}