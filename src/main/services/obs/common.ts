// ---------- OBS 叠加层共享模块 ----------
// 包含 CSS、JS 模板函数、字体列表、样式 UI 构建器

import { DEFAULT_SETTINGS } from '../../../shared/constants/defaults'

// ===== 公共 CSS =====

export const COMMON_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }

/* OBS 叠加模式（/lyric /queue /songinfo） */
body.overlay-mode {
  margin: 0; padding: 0;
  background: transparent;
  overflow: hidden;
  font-family: -apple-system, 'Microsoft YaHei', sans-serif;
}
body.overlay-mode #overlay { width: 100vw; height: 100vh; }

/* 歌词叠加层 */
.lyric-container {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
}
.lyric-text {
  display: block;
  max-width: 90%;
  word-break: break-word;
  white-space: normal;
}
.lyric-translation {
  display: block;
  max-width: 90%;
  word-break: break-word;
  white-space: normal;
  overflow-wrap: break-word;
}

/* 队列叠加层 */
.queue-container {
  width: 100%; height: 100%;
  padding: 12px;
  overflow: hidden;
}
.queue-item {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 歌曲信息叠加层 */
.songinfo-container {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
}
.song-title { white-space: normal; word-break: break-word; max-width: 90%; }
.song-artist { white-space: normal; word-break: break-word; max-width: 90%; }
.song-requester { white-space: normal; word-break: break-word; max-width: 90%; }

/* ---------- /style 设置页面 ---------- */
body.style-mode {
  font-family: -apple-system, 'Microsoft YaHei', sans-serif;
  background: #1e1e1e;
  color: #ccc;
  padding: 20px 16px;
  overflow-y: auto;
  max-width: 1600px;
  margin: 0 auto;
  user-select: none;
  -webkit-user-select: none;
  scrollbar-width: thin;
  scrollbar-color: #555 #252526;
}
body.style-mode::-webkit-scrollbar,
body.style-mode .style-panel::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
body.style-mode::-webkit-scrollbar-track,
body.style-mode .style-panel::-webkit-scrollbar-track {
  background: #1e1e1e;
  border-left: 1px solid #2d2d2d;
}
body.style-mode::-webkit-scrollbar-thumb,
body.style-mode .style-panel::-webkit-scrollbar-thumb {
  background: #3e3e42;
  border-radius: 5px;
  border: 2px solid #1e1e1e;
  transition: background 0.2s;
}
body.style-mode::-webkit-scrollbar-thumb:hover,
body.style-mode .style-panel::-webkit-scrollbar-thumb:hover {
  background: #00b5e5;
}
body.style-mode::-webkit-scrollbar-thumb:active,
body.style-mode .style-panel::-webkit-scrollbar-thumb:active {
  background: #0099cc;
}
body.style-mode::-webkit-scrollbar-corner,
body.style-mode .style-panel::-webkit-scrollbar-corner {
  background: #1e1e1e;
}
.style-mode h1 { font-size: 18px; color: #ddd; margin-bottom: 6px; }
.style-mode .style-subtitle { font-size: 11px; color: #888; margin-bottom: 16px; }
.style-section {
  background: #252526; border: 1px solid #3e3e42; margin-bottom: 14px; padding: 14px;
}
.style-section h2 {
  font-size: 14px; color: #ddd; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #3e3e42;
  display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;
}
.style-section h2 .h2-arrow { margin-right: 6px; font-size: 10px; display: inline-block; }
.style-section h2.collapsed .h2-arrow { transform: rotate(-90deg); }
.reset-btn {
  padding: 2px 10px; font-size: 11px; background: #3c3c3c; color: #aaa; border: 1px solid #555;
  cursor: pointer; border-radius: 3px;
}
.reset-btn:hover { background: #555; color: #fff; }
.section-body { display: flex; gap: 14px; overflow: hidden; }
.section-body.collapsed { max-height: 0; }
.style-panel { width: 310px; flex-shrink: 0; overflow-y: auto; }
.preview-wrap { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.preview-box {
  min-height: 400px; border: 1px solid #3e3e42; overflow: hidden; flex: 1;
}
.preview-iframe { width: 100%; height: 100%; border: none; }
.obs-url-bar {
  display: flex; gap: 6px; margin-top: 8px;
}
.obs-url-bar input {
  flex: 1; min-width: 0; padding: 4px 8px; font-size: 11px; font-family: 'Consolas', monospace;
  background: #3c3c3c; color: #aaa; border: 1px solid #555; outline: none;
}
.obs-url-bar button {
  padding: 4px 12px; font-size: 12px; background: #00b5e5; color: #fff; border: none; cursor: pointer;
}
.obs-url-bar button:hover { background: #0099cc; }
.obs-url-bar button.copied { background: #4ec9b0; }

/* 子区域 */
.style-subsection {
  border: 1px solid #3e3e42; margin-bottom: 8px; padding: 8px 10px; background: #2a2a2b;
}
.style-subsection h3 {
  font-size: 12px; color: #bbb; margin-bottom: 6px; font-weight: 400;
  cursor: pointer; user-select: none; display: flex; align-items: center;
}
.style-subsection h3 .h3-arrow { margin-right: 4px; font-size: 9px; display: inline-block; }
.style-subsection h3.collapsed .h3-arrow { transform: rotate(-90deg); }
.subsection-body { overflow: hidden; }
.subsection-body.collapsed { max-height: 0; }

.style-row { display: flex; align-items: center; justify-content: space-between; padding: 3px 0; font-size: 12px; }
.style-row > span:first-child { color: #aaa; width: 90px; flex-shrink: 0; }
.style-row .range-wrap { display: flex; align-items: center; gap: 4px; min-width: 0; }
.style-row input[type="range"] { width: 90px; accent-color: #00b5e5; }
.style-row select {
  background: #3c3c3c; color: #ccc; border: 1px solid #555; padding: 2px 4px; font-size: 12px; min-width: 72px; max-width: 140px;
}
.style-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: #00b5e5; }
.style-row input[type="text"] {
  padding: 3px 5px; font-size: 11px; background: #3c3c3c; color: #ccc; border: 1px solid #555; outline: none;
}
.style-row input[type="text"]:focus { border-color: #00b5e5; }
.range-val { font-size: 11px; color: #888; min-width: 36px; text-align: right; }

/* 字体样式按钮 */
.font-style-row { display: flex; align-items: center; gap: 4px; }
.fs-btn {
  width: 28px; height: 22px; font-size: 12px; line-height: 1; text-align: center;
  background: #3c3c3c; color: #aaa; border: 1px solid #555; cursor: pointer; border-radius: 2px;
  padding: 0; font-family: inherit;
}
.fs-btn:hover { border-color: #00b5e5; color: #fff; }
.fs-btn.active { background: #00b5e5; color: #fff; border-color: #00b5e5; }
.fs-btn.bold { font-weight: 700; }
.fs-btn.italic { font-style: italic; }
.fs-btn.underline { text-decoration: underline; }

/* 颜色选择器 */
.cp-wrap { display: flex; align-items: center; gap: 6px; position: relative; }
.cp-swatch {
  width: 24px; height: 20px; border: 1px solid #555; cursor: pointer; flex-shrink: 0;
  border-radius: 2px; padding: 0; background: #000;
}
.cp-swatch:hover { border-color: #00b5e5; }
.cp-input {
  width: 68px; padding: 3px 5px; font-size: 11px; font-family: 'Consolas', monospace;
  background: #3c3c3c; color: #ccc; border: 1px solid #555; outline: none;
}
.cp-input:focus { border-color: #00b5e5; }

/* 自定义颜色选择器弹窗 */
.cp-overlay { position: fixed; inset: 0; z-index: 9998; }
.cp-popup {
  position: fixed; z-index: 9999; width: 232px;
  background: #252526; border: 1px solid #3e3e42; border-radius: 6px;
  padding: 10px; display: none; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
.cp-popup.show { display: block; }
.cp-sb-canvas {
  position: relative; width: 100%; height: 150px; border-radius: 4px;
  cursor: crosshair; overflow: hidden; margin-bottom: 8px;
}
.cp-sb-canvas::before {
  content: ''; position: absolute; inset: 0; z-index: 1;
  background: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent);
}
.cp-sb-cursor {
  position: absolute; z-index: 3; width: 14px; height: 14px;
  border: 2px solid #fff; border-radius: 50%; transform: translate(-50%, -50%);
  box-shadow: 0 0 2px rgba(0,0,0,0.4), inset 0 0 2px rgba(0,0,0,0.3); pointer-events: none;
}
.cp-hue-slider {
  position: relative; width: 100%; height: 12px; border-radius: 6px;
  cursor: pointer; margin-bottom: 8px;
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
}
.cp-slider-cursor {
  position: absolute; top: 50%; z-index: 3; width: 16px; height: 16px;
  border: 2px solid #fff; border-radius: 50%; transform: translate(-50%, -50%);
  box-shadow: 0 0 2px rgba(0,0,0,0.4); pointer-events: none;
}
.cp-input-row { display: flex; align-items: center; gap: 8px; }
.cp-preview { width: 28px; height: 28px; border-radius: 4px; border: 1px solid #555; cursor: pointer; flex-shrink: 0; }
.cp-text-input {
  flex: 1; min-width: 0; padding: 4px 8px; font-size: 12px;
  font-family: 'Consolas', monospace; background: #3c3c3c;
  border: 1px solid #555; border-radius: 3px; color: #ccc; outline: none;
}
.cp-text-input:focus { border-color: #00b5e5; }

/* 条件隐藏 */
.cond-hidden { display: none !important; }
`

// ===== 字体列表 =====

export const FONT_LIST = [
  { value: '', label: '默认（系统）' },
  { value: 'Microsoft YaHei', label: '微软雅黑' },
  { value: 'SimSun', label: '宋体' },
  { value: 'SimHei', label: '黑体' },
  { value: 'KaiTi', label: '楷体' },
  { value: 'FangSong', label: '仿宋' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Courier New', label: 'Courier New' },
]

// ===== 内联 JS 工具函数模板 =====

/** 返回 hexToRgb 函数的 JS 代码字符串 */
export function hexToRgbJs(): string {
  return `function hexToRgb(h){var r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return r+','+g+','+b}`
}

/** 返回 escapeHtml 函数的 JS 代码字符串 */
export function escapeHtmlJs(): string {
  return `function escapeHtml(s){var d=document.createElement('div');d.appendChild(document.createTextNode(s));return d.innerHTML}`
}

/** 返回 buildFontCss(pfx, cfg) 函数的 JS 代码字符串 */
export function buildFontCssJs(): string {
  return `function buildFontCss(pfx,cfg){var p=[];var fk=pfx?pfx+'FontFamily':'fontFamily';var wk=pfx?pfx+'FontWeight':'fontWeight';var sk=pfx?pfx+'FontStyle':'fontStyle';var dk=pfx?pfx+'TextDecoration':'textDecoration';if(cfg[fk])p.push("font-family:'"+cfg[fk]+"','Microsoft YaHei',sans-serif");else p.push("font-family:'Microsoft YaHei',sans-serif");if(cfg[wk])p.push('font-weight:'+cfg[wk]);if(cfg[sk])p.push('font-style:'+cfg[sk]);if(cfg[dk])p.push('text-decoration:'+cfg[dk]);return p.join('; ')}`
}

/** 返回 buildShadow(cfg) 函数的 JS 代码字符串 */
export function buildShadowJs(): string {
  return `function buildShadow(cfg){var ox=cfg.shadowOffsetX||0,oy=cfg.shadowOffsetY||0,sb=cfg.shadowSize||0,sc=cfg.shadowColor||'#000000';return ox+'px '+oy+'px '+sb+'px '+sc}`
}

// ===== 样式设置页 UI 构建器 =====

export function buildFontRow(page: string, label: string, key: string, min: number, max: number, def: number, unit: string): string {
  const id = `${page}-${key}`
  return `<div class="style-row">
  <span>${label}</span>
  <div class="range-wrap">
    <input type="range" id="${id}" min="${min}" max="${max}" value="${def}" step="1" data-unit="${unit}" data-page="${page}" data-key="${key}">
    <span class="range-val" id="${id}-val">${def}${unit}</span>
  </div>
</div>`
}

export function buildColorRow(page: string, label: string, key: string, def: string): string {
  const id = `${page}-${key}`
  return `<div class="style-row">
  <span>${label}</span>
  <div class="cp-wrap" id="${id}-wrap">
    <button class="cp-swatch" id="${id}-swatch" style="background:${def}" data-for="${id}" data-page="${page}" data-key="${key}"></button>
    <input class="cp-input" id="${id}" type="text" value="${def}" data-page="${page}" data-key="${key}" maxlength="7">
  </div>
</div>`
}

export function buildSelectRow(page: string, label: string, key: string, options: { value: string; label: string }[], def: string): string {
  const opts = options.map(o => `<option value="${o.value}"${o.value === def ? ' selected' : ''}>${o.label}</option>`).join('')
  return `<div class="style-row"><span>${label}</span><select id="${page}-${key}" data-page="${page}" data-key="${key}">${opts}</select></div>`
}

export function buildCheckboxRow(page: string, label: string, key: string, def: boolean): string {
  return `<div class="style-row"><span>${label}</span><input type="checkbox" id="${page}-${key}" data-page="${page}" data-key="${key}"${def ? ' checked' : ''}></div>`
}

export function buildFontSelectRow(page: string, label: string, key: string, def: string = ''): string {
  const opts = FONT_LIST.map(f => `<option value="${f.value}"${f.value === def ? ' selected' : ''}>${f.label}</option>`).join('')
  return `<div class="style-row"><span>${label}</span><select id="${page}-${key}" data-page="${page}" data-key="${key}">${opts}</select></div>`
}

export function buildFontStyleRow(page: string, weightKey: string, styleKey: string, decoKey: string): string {
  const idW = `${page}-${weightKey}`
  const idS = `${page}-${styleKey}`
  const idD = `${page}-${decoKey}`
  return `<div class="style-row">
  <span>字体样式</span>
  <div class="font-style-row">
    <button class="fs-btn bold" id="${idW}-btn" data-page="${page}" data-key="${weightKey}" data-on="bold" data-off="normal" title="加粗">B</button>
    <button class="fs-btn italic" id="${idS}-btn" data-page="${page}" data-key="${styleKey}" data-on="italic" data-off="normal" title="倾斜">I</button>
    <button class="fs-btn underline" id="${idD}-btn" data-page="${page}" data-key="${decoKey}" data-on="underline" data-off="none" title="下划线">U</button>
  </div>
</div>`
}

export function buildTextRow(page: string, label: string, key: string, def: string): string {
  const id = `${page}-${key}`
  return `<div class="style-row">
  <span>${label}</span>
  <input type="text" id="${id}" value="${def}" data-page="${page}" data-key="${key}" style="width:140px">
</div>`
}

export function buildTextareaRow(page: string, label: string, key: string, def: string): string {
  const id = `${page}-${key}`
  const escaped = def.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  return `<div class="style-row" style="flex-direction: column; align-items: stretch;">
  <span style="margin-bottom: 4px;">${label}</span>
  <textarea id="${id}" data-page="${page}" data-key="${key}" rows="3" style="width: 100%; min-height: 54px; font-size: 12px; padding: 4px 6px; background: #3c3c3c; color: #ccc; border: 1px solid #555; outline: none; resize: vertical; font-family: inherit; box-sizing: border-box;">${escaped}</textarea>
</div>`
}