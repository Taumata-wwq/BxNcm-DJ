// electron-builder afterPack hook: 精简打包体积
// 移除不必要的 Electron 文件（locale、PDF viewer 等）
const fs = require('fs')
const path = require('path')

/** @param {import('electron-builder').AfterPackContext} context */
exports.default = async function (context) {
  const { appOutDir } = context
  const platform = context.electronPlatformName

  if (platform !== 'win32') return

  const localesDir = path.join(appOutDir, 'locales')
  const keepLocales = new Set(['zh-CN.pak', 'en-US.pak', 'en.pak'])

  // 1. 移除多余语言包（保留中英文，节省约 3MB）
  if (fs.existsSync(localesDir)) {
    let removed = 0
    const files = fs.readdirSync(localesDir)
    for (const f of files) {
      if (!keepLocales.has(f)) {
        const filePath = path.join(localesDir, f)
        if (fs.statSync(filePath).isFile()) {
          removed++
          fs.unlinkSync(filePath)
        }
      }
    }
    console.log(`[afterPack] 移除 ${removed} 个多余 locale 文件`)
  }

  // 2. 移除 PDF viewer（不使用的 Chromium 组件，约 1.5MB）
  const pdfDll = path.join(appOutDir, 'pdf.dll')
  if (fs.existsSync(pdfDll)) {
    fs.unlinkSync(pdfDll)
    console.log('[afterPack] 移除 pdf.dll')
  }

  // 3. 移除 crashpad（崩溃上报，非必要，约 2MB）
  const crashpad = path.join(appOutDir, 'crashpad_handler.exe')
  if (fs.existsSync(crashpad)) {
    fs.unlinkSync(crashpad)
    console.log('[afterPack] 移除 crashpad_handler.exe')
  }
}