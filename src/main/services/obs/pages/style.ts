// ---------- 样式设置页面 ----------

import { DEFAULT_SETTINGS } from '../../../../shared/constants/defaults'
import {
  COMMON_CSS,
  buildFontRow, buildColorRow, buildSelectRow, buildCheckboxRow,
  buildFontSelectRow, buildFontStyleRow, buildTextareaRow
} from '../common'

export function getStylePage(port: number): string {
  const dl = DEFAULT_SETTINGS.obsLyricStyle
  const dq = DEFAULT_SETTINGS.obsQueueStyle
  const ds = DEFAULT_SETTINGS.obsSongInfoStyle

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OBS 叠加层样式设置</title>
<style>${COMMON_CSS}</style>
</head>
<body class="style-mode">
<h1>OBS 叠加层 · 样式设置</h1>
<p class="style-subtitle">端口：${port} &nbsp;|&nbsp; 修改样式后自动推送到 OBS 浏览器源</p>

<div class="style-section" id="section-lyric">
  <h2 onclick="toggleSection(this)"><span><span class="h2-arrow">▼</span>歌词叠加层</span> <button class="reset-btn" onclick="event.stopPropagation();resetDefaults('lyric')" title="恢复默认">↺ 重置</button></h2>
  <div class="section-body">
    <div class="style-panel">
      <div class="style-subsection">
        <h3 onclick="toggleSubsection(this)"><span class="h3-arrow">▼</span> 歌词文本</h3>
        <div class="subsection-body">
          ${buildFontRow('lyric', '歌词大小', 'fontSize', 12, 72, dl.fontSize, 'px')}
          ${buildFontSelectRow('lyric', '歌词字体', 'fontFamily', dl.fontFamily)}
          ${buildFontStyleRow('lyric', 'fontWeight', 'fontStyle', 'textDecoration')}
          ${buildColorRow('lyric', '歌词颜色', 'fontColor', dl.fontColor)}
        </div>
      </div>
      <div class="style-subsection" id="lyric-sub-idle">
        <h3 onclick="toggleSubsection(this)"><span class="h3-arrow">▼</span> 空闲文本(歌词占用文本，换行定时轮询)</h3>
        <div class="subsection-body">
          ${buildTextareaRow('lyric', '空闲文本', 'idleText', dl.idleText)}
          ${buildFontRow('lyric', '刷新间隔', 'idleTextRefreshInterval', 0, 60, dl.idleTextRefreshInterval, 's')}
        </div>
      </div>
      <div class="style-subsection" id="lyric-sub-translation">
        <h3 onclick="toggleSubsection(this)"><span class="h3-arrow">▼</span> 翻译</h3>
        <div class="subsection-body">
          ${buildCheckboxRow('lyric', '显示翻译', 'showTranslation', dl.showTranslation)}
          <div id="lyric-cond-translation">
            ${buildCheckboxRow('lyric', '翻译分行', 'splitTranslation', dl.splitTranslation)}
            ${buildFontRow('lyric', '翻译大小', 'translationFontSize', 10, 72, dl.translationFontSize, 'px')}
            ${buildFontSelectRow('lyric', '翻译字体', 'translationFontFamily', dl.translationFontFamily)}
            ${buildFontStyleRow('lyric', 'translationFontWeight', 'translationFontStyle', 'translationTextDecoration')}
            ${buildColorRow('lyric', '翻译颜色', 'translationColor', dl.translationColor)}
          </div>
        </div>
      </div>
      <div class="style-subsection">
        <h3 onclick="toggleSubsection(this)"><span class="h3-arrow">▼</span> 布局</h3>
        <div class="subsection-body">
          ${buildSelectRow('lyric', '文字对齐', 'textAlign', [{ value: 'left', label: '左' }, { value: 'center', label: '中' }, { value: 'right', label: '右' }], dl.textAlign)}
          ${buildFontRow('lyric', '行间距', 'lineSpacing', 0, 40, dl.lineSpacing, 'px')}
        </div>
      </div>
      <div class="style-subsection">
        <h3 onclick="toggleSubsection(this)"><span class="h3-arrow">▼</span> 背景效果</h3>
        <div class="subsection-body">
          ${buildColorRow('lyric', '背景颜色', 'bgColor', dl.bgColor)}
          ${buildFontRow('lyric', '背景透明度', 'bgOpacity', 0, 100, dl.bgOpacity, '%')}
          ${buildColorRow('lyric', '阴影颜色', 'shadowColor', dl.shadowColor)}
          ${buildFontRow('lyric', '阴影大小', 'shadowSize', 0, 20, dl.shadowSize, 'px')}
          ${buildFontRow('lyric', '阴影上下', 'shadowOffsetY', -30, 30, dl.shadowOffsetY, 'px')}
          ${buildFontRow('lyric', '阴影左右', 'shadowOffsetX', -30, 30, dl.shadowOffsetX, 'px')}
        </div>
      </div>
    </div>
    <div class="preview-wrap">
      <div class="preview-box" id="preview-box-lyric">
        <iframe class="preview-iframe" id="preview-lyric" src="http://localhost:${port}/lyric"></iframe>
      </div>
      <div class="obs-url-bar">
        <input value="http://localhost:${port}/lyric" readonly onclick="this.select()">
        <button onclick="copyObsUrl('lyric', this)">复制</button>
      </div>
    </div>
  </div>
</div>

<div class="style-section" id="section-queue">
  <h2 onclick="toggleSection(this)"><span><span class="h2-arrow">▼</span>队列叠加层</span> <button class="reset-btn" onclick="event.stopPropagation();resetDefaults('queue')" title="恢复默认">↺ 重置</button></h2>
  <div class="section-body">
    <div class="style-panel">
      <div class="style-subsection">
        <h3 onclick="toggleSubsection(this)"><span class="h3-arrow">▼</span> 文字样式</h3>
        <div class="subsection-body">
          ${buildFontRow('queue', '字体大小', 'fontSize', 12, 48, dq.fontSize, 'px')}
          ${buildFontSelectRow('queue', '文字字体', 'fontFamily', dq.fontFamily)}
          ${buildFontStyleRow('queue', 'fontWeight', 'fontStyle', 'textDecoration')}
          ${buildColorRow('queue', '文字颜色', 'fontColor', dq.fontColor)}
          ${buildColorRow('queue', '高亮颜色', 'highlightColor', dq.highlightColor)}
          ${buildCheckboxRow('queue', '显示序号', 'showIndex', dq.showIndex)}
          <div id="queue-cond-index">
            ${buildColorRow('queue', '序号颜色', 'indexColor', dq.indexColor)}
          </div>
        </div>
      </div>
      <div class="style-subsection" id="queue-sub-requester">
        <h3 onclick="toggleSubsection(this)"><span class="h3-arrow">▼</span> 点歌人</h3>
        <div class="subsection-body">
          ${buildCheckboxRow('queue', '显示点歌人', 'showRequester', dq.showRequester)}
          <div id="queue-cond-requester">
            ${buildColorRow('queue', '点歌人颜色', 'requesterColor', dq.requesterColor)}
          </div>
        </div>
      </div>
      <div class="style-subsection">
        <h3 onclick="toggleSubsection(this)"><span class="h3-arrow">▼</span> 布局</h3>
        <div class="subsection-body">
          ${buildCheckboxRow('queue', '自动换行', 'wordWrap', dq.wordWrap)}
          ${buildSelectRow('queue', '文字对齐', 'textAlign', [{ value: 'left', label: '左' }, { value: 'center', label: '中' }, { value: 'right', label: '右' }], dq.textAlign)}
          ${buildSelectRow('queue', '垂直对齐', 'verticalAlign', [{ value: 'top', label: '靠顶' }, { value: 'bottom', label: '靠底' }], dq.verticalAlign)}
          ${buildFontRow('queue', '行间距', 'lineSpacing', 0, 40, dq.lineSpacing, 'px')}
          ${buildFontRow('queue', '最大行数', 'maxLines', 3, 20, dq.maxLines, '条')}
        </div>
      </div>
      <div class="style-subsection">
        <h3 onclick="toggleSubsection(this)"><span class="h3-arrow">▼</span> 背景效果</h3>
        <div class="subsection-body">
          ${buildColorRow('queue', '背景颜色', 'bgColor', dq.bgColor)}
          ${buildFontRow('queue', '背景透明度', 'bgOpacity', 0, 100, dq.bgOpacity, '%')}
          ${buildColorRow('queue', '阴影颜色', 'shadowColor', dq.shadowColor)}
          ${buildFontRow('queue', '阴影大小', 'shadowSize', 0, 20, dq.shadowSize, 'px')}
          ${buildFontRow('queue', '阴影上下', 'shadowOffsetY', -30, 30, dq.shadowOffsetY, 'px')}
          ${buildFontRow('queue', '阴影左右', 'shadowOffsetX', -30, 30, dq.shadowOffsetX, 'px')}
        </div>
      </div>
    </div>
    <div class="preview-wrap">
      <div class="preview-box" id="preview-box-queue">
        <iframe class="preview-iframe" id="preview-queue" src="http://localhost:${port}/queue"></iframe>
      </div>
      <div class="obs-url-bar">
        <input value="http://localhost:${port}/queue" readonly onclick="this.select()">
        <button onclick="copyObsUrl('queue', this)">复制</button>
      </div>
    </div>
  </div>
</div>

<div class="style-section" id="section-songinfo">
  <h2 onclick="toggleSection(this)"><span><span class="h2-arrow">▼</span>歌曲信息叠加层</span> <button class="reset-btn" onclick="event.stopPropagation();resetDefaults('songinfo')" title="恢复默认">↺ 重置</button></h2>
  <div class="section-body">
    <div class="style-panel">
      <div class="style-subsection">
        <h3 onclick="toggleSubsection(this)"><span class="h3-arrow">▼</span> 标题</h3>
        <div class="subsection-body">
          ${buildFontRow('songinfo', '标题大小', 'titleFontSize', 16, 64, ds.titleFontSize, 'px')}
          ${buildFontSelectRow('songinfo', '标题字体', 'titleFontFamily', ds.titleFontFamily)}
          ${buildFontStyleRow('songinfo', 'titleFontWeight', 'titleFontStyle', 'titleTextDecoration')}
          ${buildColorRow('songinfo', '标题颜色', 'titleColor', ds.titleColor)}
        </div>
      </div>
      <div class="style-subsection">
        <h3 onclick="toggleSubsection(this)"><span class="h3-arrow">▼</span> 作者</h3>
        <div class="subsection-body">
          ${buildCheckboxRow('songinfo', '作者分行', 'splitArtist', ds.splitArtist)}
          <div id="songinfo-cond-artist">
            ${buildFontRow('songinfo', '作者大小', 'artistFontSize', 12, 48, ds.artistFontSize, 'px')}
            ${buildFontSelectRow('songinfo', '作者字体', 'artistFontFamily', ds.artistFontFamily)}
            ${buildFontStyleRow('songinfo', 'artistFontWeight', 'artistFontStyle', 'artistTextDecoration')}
            ${buildColorRow('songinfo', '作者颜色', 'artistColor', ds.artistColor)}
          </div>
        </div>
      </div>
      <div class="style-subsection">
        <h3 onclick="toggleSubsection(this)"><span class="h3-arrow">▼</span> 点歌人</h3>
        <div class="subsection-body">
          ${buildCheckboxRow('songinfo', '显示点歌人', 'showRequester', ds.showRequester)}
          <div id="songinfo-cond-requester">
            ${buildFontRow('songinfo', '点歌人大小', 'requesterFontSize', 10, 48, ds.requesterFontSize, 'px')}
            ${buildFontSelectRow('songinfo', '点歌人字体', 'requesterFontFamily', ds.requesterFontFamily)}
            ${buildFontStyleRow('songinfo', 'requesterFontWeight', 'requesterFontStyle', 'requesterTextDecoration')}
            ${buildColorRow('songinfo', '点歌人颜色', 'requesterColor', ds.requesterColor)}
          </div>
        </div>
      </div>
      <div class="style-subsection">
        <h3 onclick="toggleSubsection(this)"><span class="h3-arrow">▼</span> 布局</h3>
        <div class="subsection-body">
          ${buildSelectRow('songinfo', '文字对齐', 'textAlign', [{ value: 'left', label: '左' }, { value: 'center', label: '中' }, { value: 'right', label: '右' }], ds.textAlign)}
          ${buildFontRow('songinfo', '行间距', 'lineSpacing', 0, 40, ds.lineSpacing, 'px')}
        </div>
      </div>
      <div class="style-subsection">
        <h3 onclick="toggleSubsection(this)"><span class="h3-arrow">▼</span> 背景效果</h3>
        <div class="subsection-body">
          ${buildColorRow('songinfo', '背景颜色', 'bgColor', ds.bgColor)}
          ${buildFontRow('songinfo', '背景透明度', 'bgOpacity', 0, 100, ds.bgOpacity, '%')}
          ${buildColorRow('songinfo', '阴影颜色', 'shadowColor', ds.shadowColor)}
          ${buildFontRow('songinfo', '阴影大小', 'shadowSize', 0, 20, ds.shadowSize, 'px')}
          ${buildFontRow('songinfo', '阴影上下', 'shadowOffsetY', -30, 30, ds.shadowOffsetY, 'px')}
          ${buildFontRow('songinfo', '阴影左右', 'shadowOffsetX', -30, 30, ds.shadowOffsetX, 'px')}
        </div>
      </div>
    </div>
    <div class="preview-wrap">
      <div class="preview-box" id="preview-box-songinfo">
        <iframe class="preview-iframe" id="preview-songinfo" src="http://localhost:${port}/songinfo"></iframe>
      </div>
      <div class="obs-url-bar">
        <input value="http://localhost:${port}/songinfo" readonly onclick="this.select()">
        <button onclick="copyObsUrl('songinfo', this)">复制</button>
      </div>
    </div>
  </div>
</div>

<script>${getStylePageJs(port)}</script>
</body>
</html>`
}

// ---------- /style 页面 JS ----------

function getStylePageJs(port: number): string {
  const dl = DEFAULT_SETTINGS.obsLyricStyle
  const dq = DEFAULT_SETTINGS.obsQueueStyle
  const ds = DEFAULT_SETTINGS.obsSongInfoStyle
  const idleTextEscaped = dl.idleText.replace(/'/g, "\\'").replace(/\n/g, '\\n')

  return `var PORT = ${port}
var DEFAULTS = {
  lyric: {
    fontSize: ${dl.fontSize}, fontFamily: '${dl.fontFamily}', fontWeight: '${dl.fontWeight}', fontStyle: '${dl.fontStyle}', textDecoration: '${dl.textDecoration}', fontColor: '${dl.fontColor}', idleText: '${idleTextEscaped}', idleTextRefreshInterval: ${dl.idleTextRefreshInterval},
    showTranslation: ${dl.showTranslation}, translationFontSize: ${dl.translationFontSize}, translationFontFamily: '${dl.translationFontFamily}', translationFontWeight: '${dl.translationFontWeight}', translationFontStyle: '${dl.translationFontStyle}', translationTextDecoration: '${dl.translationTextDecoration}', translationColor: '${dl.translationColor}', splitTranslation: ${dl.splitTranslation},
    textAlign: '${dl.textAlign}', lineSpacing: ${dl.lineSpacing},
    bgColor: '${dl.bgColor}', bgOpacity: ${dl.bgOpacity}, shadowColor: '${dl.shadowColor}', shadowSize: ${dl.shadowSize}, shadowOffsetX: ${dl.shadowOffsetX}, shadowOffsetY: ${dl.shadowOffsetY}
  },
  queue: {
    fontSize: ${dq.fontSize}, fontFamily: '${dq.fontFamily}', fontWeight: '${dq.fontWeight}', fontStyle: '${dq.fontStyle}', textDecoration: '${dq.textDecoration}', fontColor: '${dq.fontColor}', highlightColor: '${dq.highlightColor}', showIndex: ${dq.showIndex}, indexColor: '${dq.indexColor}',
    showRequester: ${dq.showRequester}, requesterColor: '${dq.requesterColor}',
    wordWrap: ${dq.wordWrap}, textAlign: '${dq.textAlign}', verticalAlign: '${dq.verticalAlign}', lineSpacing: ${dq.lineSpacing}, maxLines: ${dq.maxLines},
    bgColor: '${dq.bgColor}', bgOpacity: ${dq.bgOpacity}, shadowColor: '${dq.shadowColor}', shadowSize: ${dq.shadowSize}, shadowOffsetX: ${dq.shadowOffsetX}, shadowOffsetY: ${dq.shadowOffsetY}
  },
  songinfo: {
    titleFontSize: ${ds.titleFontSize}, titleFontFamily: '${ds.titleFontFamily}', titleFontWeight: '${ds.titleFontWeight}', titleFontStyle: '${ds.titleFontStyle}', titleTextDecoration: '${ds.titleTextDecoration}', titleColor: '${ds.titleColor}',
    splitArtist: ${ds.splitArtist}, artistFontSize: ${ds.artistFontSize}, artistFontFamily: '${ds.artistFontFamily}', artistFontWeight: '${ds.artistFontWeight}', artistFontStyle: '${ds.artistFontStyle}', artistTextDecoration: '${ds.artistTextDecoration}', artistColor: '${ds.artistColor}',
    showRequester: ${ds.showRequester}, requesterFontSize: ${ds.requesterFontSize}, requesterFontFamily: '${ds.requesterFontFamily}', requesterFontWeight: '${ds.requesterFontWeight}', requesterFontStyle: '${ds.requesterFontStyle}', requesterTextDecoration: '${ds.requesterTextDecoration}', requesterColor: '${ds.requesterColor}',
    textAlign: '${ds.textAlign}', lineSpacing: ${ds.lineSpacing},
    bgColor: '${ds.bgColor}', bgOpacity: ${ds.bgOpacity}, shadowColor: '${ds.shadowColor}', shadowSize: ${ds.shadowSize}, shadowOffsetX: ${ds.shadowOffsetX}, shadowOffsetY: ${ds.shadowOffsetY}
  }
}
var styleState = JSON.parse(JSON.stringify(DEFAULTS))

var ws, saveTimer, cpOpenId, cpHue = 0, cpSat = 1, cpbri = 1

// ===== 折叠/展开 =====
function toggleSection(h2) {
  h2.classList.toggle('collapsed')
  var body = h2.nextElementSibling
  if (body) body.classList.toggle('collapsed')
}
function toggleSubsection(h3) {
  h3.classList.toggle('collapsed')
  var body = h3.nextElementSibling
  if (body) body.classList.toggle('collapsed')
}

// ===== 自定义颜色选择器 =====
function ensurePopup() {
  var p = document.getElementById('cp-popup')
  if (p) return p
  var overlay = document.createElement('div')
  overlay.id = 'cp-overlay'
  overlay.className = 'cp-overlay'
  overlay.addEventListener('click', dismissPopup)
  document.body.appendChild(overlay)
  p = document.createElement('div')
  p.id = 'cp-popup'
  p.className = 'cp-popup'
  p.onclick = function(e) { e.stopPropagation() }
  p.innerHTML = '<div class="cp-sb-canvas" id="cp-sb-canvas"><div class="cp-sb-cursor" id="cp-sb-cursor"></div></div>' +
    '<div class="cp-hue-slider" id="cp-hue-slider"><div class="cp-slider-cursor" id="cp-slider-cursor"></div></div>' +
    '<div class="cp-input-row"><div class="cp-preview" id="cp-preview" onclick="dismissPopup()"></div><input class="cp-text-input" id="cp-text-input" maxlength="7" placeholder="#HEX" spellcheck="false"></div>'
  document.body.appendChild(p)

  var sbCanvas = document.getElementById('cp-sb-canvas')
  sbCanvas.addEventListener('mousedown', function(e) {
    pickSBColor(e)
    function onMove(ev) { pickSBColor(ev) }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })

  var hueEl = document.getElementById('cp-hue-slider')
  hueEl.addEventListener('mousedown', function(e) {
    pickHue(e)
    function onMove(ev) { pickHue(ev) }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })

  var textInput = document.getElementById('cp-text-input')
  textInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') { commitColor() } })
  textInput.addEventListener('blur', function() { commitColorFromInput() })
  return p
}

function pickSBColor(e) {
  var area = document.getElementById('cp-sb-canvas')
  if (!area) return
  var rect = area.getBoundingClientRect()
  cpSat = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  cpbri = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height))
  updateColorArea()
}

function pickHue(e) {
  var slider = document.getElementById('cp-hue-slider')
  if (!slider) return
  var rect = slider.getBoundingClientRect()
  cpHue = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360))
  updateColorArea()
}

function openColorPopup(elId) {
  cpOpenId = elId
  var txt = document.getElementById(elId)
  if (!txt) return
  var hex = txt.value || '#ffffff'
  ensurePopup()
  setHex(hex)
  updatePopupPosition()
  document.getElementById('cp-popup').classList.add('show')
  document.getElementById('cp-overlay').style.display = 'block'
}

function updatePopupPosition() {
  var popup = document.getElementById('cp-popup')
  if (!popup || !cpOpenId) return
  var wrap = document.getElementById(cpOpenId + '-wrap')
  if (!wrap) return
  var wrapRect = wrap.getBoundingClientRect()
  var pw = 232, ph = 246
  var l = wrapRect.left
  var t = wrapRect.bottom + 6
  if (l + pw > window.innerWidth - 10) l = window.innerWidth - pw - 10
  if (l < 10) l = 10
  if (t + ph > window.innerHeight - 10) t = wrapRect.top - ph - 6
  if (t < 10) t = 10
  popup.style.left = l + 'px'
  popup.style.top = t + 'px'
}

window.addEventListener('scroll', function() { if (cpOpenId) updatePopupPosition() }, true)
window.addEventListener('resize', function() { if (cpOpenId) updatePopupPosition() })
document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && cpOpenId) dismissPopup() })

function setHex(hex) {
  var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  var max = Math.max(r,g,b), min = Math.min(r,g,b)
  cpbri = max / 255
  cpSat = max ? (max - min) / max : 0
  if (cpSat === 0) cpHue = 0
  else if (max === r) cpHue = ((g - b) / (max - min) + 6) % 6 * 60
  else if (max === g) cpHue = ((b - r) / (max - min) + 2) * 60
  else cpHue = ((r - g) / (max - min) + 4) * 60
  updateColorArea()
}

function updateColorArea() {
  var sbCanvas = document.getElementById('cp-sb-canvas')
  var sbCursor = document.getElementById('cp-sb-cursor')
  var hueCursor = document.getElementById('cp-slider-cursor')
  var preview = document.getElementById('cp-preview')

  if (sbCanvas) sbCanvas.style.backgroundColor = 'hsl(' + cpHue + ', 100%, 50%)'
  if (hueCursor) hueCursor.style.left = (cpHue / 360 * 100) + '%'
  var x = cpSat * 100, y = (1 - cpbri) * 100
  if (sbCursor) { sbCursor.style.left = x + '%'; sbCursor.style.top = y + '%' }
  var hex = hslToHex()
  if (preview) preview.style.backgroundColor = hex
  document.getElementById('cp-text-input').value = hex
  if (cpOpenId) {
    var txt = document.getElementById(cpOpenId)
    var sw = document.getElementById(cpOpenId + '-swatch')
    if (txt) txt.value = hex
    if (sw) sw.style.background = hex
    sendColorChange(cpOpenId, hex)
  }
}

function hslToHex() {
  var h = cpHue / 60
  var s = cpSat
  var b = cpbri
  var c = b * s
  var x = c * (1 - Math.abs(h % 2 - 1))
  var m = b - c
  var r1, g1, b1
  if (h < 1) { r1 = c; g1 = x; b1 = 0 }
  else if (h < 2) { r1 = x; g1 = c; b1 = 0 }
  else if (h < 3) { r1 = 0; g1 = c; b1 = x }
  else if (h < 4) { r1 = 0; g1 = x; b1 = c }
  else if (h < 5) { r1 = x; g1 = 0; b1 = c }
  else { r1 = c; g1 = 0; b1 = x }
  var toHex = function(v) { var s = Math.round((v + m) * 255).toString(16); return s.length === 1 ? '0' + s : s }
  return '#' + toHex(r1) + toHex(g1) + toHex(b1)
}

function sendColorChange(elId, hex) {
  var el = document.getElementById(elId)
  if (!el) return
  var page = el.getAttribute('data-page')
  var key = el.getAttribute('data-key')
  if (!page || !key || !styleState[page]) return
  styleState[page][key] = hex
  postStyleToIframe(page)
  scheduleStyleUpdate(page)
}

function commitColor() {
  var hexInput = document.getElementById('cp-text-input')
  if (hexInput) {
    var v = hexInput.value.trim()
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { setHex(v) }
  }
  dismissPopup()
}

function commitColorFromInput() {
  var hexInput = document.getElementById('cp-text-input')
  if (hexInput) {
    var v = hexInput.value.trim()
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { setHex(v) }
  }
}

function dismissPopup() {
  var p = document.getElementById('cp-popup')
  if (p) p.classList.remove('show')
  var overlay = document.getElementById('cp-overlay')
  if (overlay) overlay.style.display = 'none'
  cpOpenId = null
}

// ===== 设置逻辑 =====
function readValue(el) {
  if (el.classList.contains('fs-btn')) return el.classList.contains('active')
  if (el.type === 'checkbox') return el.checked
  if (el.type === 'range') return Number(el.value)
  return el.value
}

function applyChange(el) {
  var page = el.getAttribute('data-page')
  var key = el.getAttribute('data-key')
  if (!page || !key || !styleState[page]) return
  var val = readValue(el)
  if (el.classList.contains('fs-btn')) {
    var onVal = el.getAttribute('data-on')
    var offVal = el.getAttribute('data-off')
    styleState[page][key] = val ? onVal : offVal
  } else {
    styleState[page][key] = val
  }
  if (el.type === 'range') {
    var vid = el.id + '-val'
    var vEl = document.getElementById(vid)
    if (vEl) vEl.textContent = val + (el.getAttribute('data-unit') || '')
  }
  if (el.classList.contains('cp-input')) {
    var sw = document.getElementById(el.id + '-swatch')
    if (sw) sw.style.background = val
  }
  updateConditionalVisibility(page, key, val)
}

function updateConditionalVisibility(page, key, val) {
  if (page === 'lyric' && key === 'showTranslation') {
    var cond = document.getElementById('lyric-cond-translation')
    if (cond) cond.className = val ? '' : 'cond-hidden'
  }
  if (page === 'queue' && key === 'showIndex') {
    var cond = document.getElementById('queue-cond-index')
    if (cond) cond.className = val ? '' : 'cond-hidden'
  }
  if (page === 'queue' && key === 'showRequester') {
    var cond = document.getElementById('queue-cond-requester')
    if (cond) cond.className = val ? '' : 'cond-hidden'
  }
  if (page === 'songinfo' && key === 'splitArtist') {
    var cond = document.getElementById('songinfo-cond-artist')
    if (cond) cond.className = val ? '' : 'cond-hidden'
  }
  if (page === 'songinfo' && key === 'showRequester') {
    var cond = document.getElementById('songinfo-cond-requester')
    if (cond) cond.className = val ? '' : 'cond-hidden'
  }
}

function syncUI(page) {
  var s = styleState[page]
  if (!s) return
  Object.keys(s).forEach(function(key) {
    var el = document.getElementById(page + '-' + key)
    if (!el) {
      var btn = document.getElementById(page + '-' + key + '-btn')
      if (btn) {
        var onVal = btn.getAttribute('data-on')
        if (s[key] === onVal) btn.classList.add('active')
        else btn.classList.remove('active')
      }
      return
    }
    if (el.classList.contains('fs-btn')) {
      var onVal = el.getAttribute('data-on')
      if (s[key] === onVal) el.classList.add('active')
      else el.classList.remove('active')
    } else if (el.type === 'checkbox') {
      el.checked = s[key]
      updateConditionalVisibility(page, key, s[key])
    } else if (el.type === 'range') {
      el.value = s[key]; applyChange(el)
    } else if (el.classList.contains('cp-input')) {
      el.value = s[key]; applyChange(el)
    } else if (el.tagName === 'SELECT') {
      el.value = s[key]
    } else if (el.tagName === 'TEXTAREA') {
      el.value = s[key]
    } else if (el.type === 'text') {
      el.value = s[key]
    }
  })
}

function resetDefaults(page) {
  if (!DEFAULTS[page]) return
  styleState[page] = JSON.parse(JSON.stringify(DEFAULTS[page]))
  syncUI(page)
  sendStyleUpdate(page)
  postStyleToIframe(page)
}

// 即时预览：通过 postMessage 推送到预览 iframe
function postStyleToIframe(page) {
  var iframe = document.getElementById('preview-' + page)
  if (!iframe || !iframe.contentWindow) return
  var msg = JSON.parse(JSON.stringify(styleState[page]))
  msg.type = 'style'
  msg.page = page
  try {
    iframe.contentWindow.postMessage(msg, '*')
  } catch(e) {}
}

// 持久化：通过 WebSocket 发送到服务器，服务器广播给所有客户端
function sendStyleUpdate(page) {
  scheduleStyleUpdate(page)
}

var updateTimers = {}
function scheduleStyleUpdate(page) {
  clearTimeout(updateTimers[page])
  updateTimers[page] = setTimeout(function() {
    if (!ws || ws.readyState !== WebSocket.OPEN || !page || !styleState[page]) return
    var raw = styleState[page]
    var msg = {}
    Object.keys(raw).forEach(function(k) {
      if (k !== 'type' && k !== 'page') msg[k] = raw[k]
    })
    msg.type = 'style-update'
    msg.page = page
    ws.send(JSON.stringify(msg))
  }, 200)
}

function copyObsUrl(page, btn) {
  navigator.clipboard.writeText('http://localhost:' + PORT + '/' + page)
  if (btn) { btn.textContent = '已复制'; btn.classList.add('copied'); setTimeout(function() { btn.textContent = '复制'; btn.classList.remove('copied') }, 1500) }
}

// 转发数据到预览 iframe（作为 iframe 自有 WebSocket 的补充）
function forwardToIframe(page, data) {
  var iframe = document.getElementById('preview-' + page)
  if (!iframe || !iframe.contentWindow) return
  try {
    var msg = JSON.parse(JSON.stringify(data))
    msg.type = page
    iframe.contentWindow.postMessage(msg, '*')
  } catch(e) {}
}

function connect() {
  ws = new WebSocket('ws://localhost:' + PORT + '/style')
  ws.onclose = function() { setTimeout(connect, 2000) }
  ws.onmessage = function(e) {
    try {
      var msg = JSON.parse(e.data)
      switch (msg.type) {
        case 'style':
          // 其他页面保存的样式变更广播，同步 UI
          if (msg.page && styleState[msg.page]) {
            var clean = {}
            Object.keys(msg).forEach(function(k) {
              if (k !== 'type' && k !== 'page') clean[k] = msg[k]
            })
            Object.assign(styleState[msg.page], clean)
            syncUI(msg.page)
            postStyleToIframe(msg.page)
          }
          break
        case 'style-init':
          // 初始化：加载所有已保存的样式
          if (msg.styles) {
            Object.keys(msg.styles).forEach(function(page) {
              if (msg.styles[page] && styleState[page]) {
                Object.assign(styleState[page], msg.styles[page])
                syncUI(page)
                postStyleToIframe(page)
              }
            })
          }
          break
        case 'state-data':
          // 打开页面时服务器主动推送的全部实时数据，转发给预览 iframe
          if (msg.lyric) forwardToIframe('lyric', msg.lyric)
          if (msg.queue) forwardToIframe('queue', msg.queue)
          if (msg.songinfo) forwardToIframe('songinfo', msg.songinfo)
          break
        case 'lyric':
          forwardToIframe('lyric', msg)
          break
        case 'queue':
          forwardToIframe('queue', msg)
          break
        case 'songinfo':
          forwardToIframe('songinfo', msg)
          break
      }
    } catch(ex) {}
  }
}

// ===== 事件绑定 =====
document.addEventListener('input', function(e) {
  var el = e.target
  if (!el.closest || !el.closest('.style-section')) return
  applyChange(el)
  var page = el.getAttribute('data-page')
  if (page) postStyleToIframe(page)
  scheduleStyleUpdate(page)
})

document.addEventListener('change', function(e) {
  var el = e.target
  if (!el.closest || !el.closest('.style-section')) return
  applyChange(el)
  var page = el.getAttribute('data-page')
  if (page) postStyleToIframe(page)
  scheduleStyleUpdate(page)
})

document.addEventListener('click', function(e) {
  var sw = e.target.closest('.cp-swatch')
  if (sw) {
    e.stopPropagation()
    var forId = sw.getAttribute('data-for')
    if (forId) openColorPopup(forId)
    return
  }
  var fsBtn = e.target.closest('.fs-btn')
  if (fsBtn) {
    fsBtn.classList.toggle('active')
    applyChange(fsBtn)
    var page = fsBtn.getAttribute('data-page')
    if (page) postStyleToIframe(page)
    scheduleStyleUpdate(page)
  }
})

document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return
  var el = e.target
  if (el.classList.contains('cp-input')) {
    applyChange(el)
    var sw = document.getElementById(el.id + '-swatch')
    if (sw && /^#[0-9a-fA-F]{6}$/.test(el.value)) sw.style.background = el.value
    var page = el.getAttribute('data-page')
    if (page) postStyleToIframe(page)
    scheduleStyleUpdate(page)
  } else if (el.type === 'text' && el.closest('.style-section')) {
    applyChange(el)
    var page = el.getAttribute('data-page')
    if (page) postStyleToIframe(page)
    scheduleStyleUpdate(page)
  }
})
document.addEventListener('blur', function(e) {
  var el = e.target
  if (!el.classList.contains('cp-input')) return
  applyChange(el)
  var sw = document.getElementById(el.id + '-swatch')
  if (sw && /^#[0-9a-fA-F]{6}$/.test(el.value)) sw.style.background = el.value
}, true)

connect()
syncUI('lyric')
syncUI('queue')
syncUI('songinfo')

// 禁用右键菜单和文本选择
document.addEventListener('contextmenu', function(e) { e.preventDefault() })
document.addEventListener('selectstart', function(e) { e.preventDefault() })
`
}