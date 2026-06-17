<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>设置</h2>
        <button class="close-btn" @click="$emit('close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="modal-layout">
        <!-- 左侧分类标签 -->
        <nav class="settings-nav">
          <button
            v-for="cat in categories"
            :key="cat.id"
            class="nav-item"
            :class="{ active: activeCategory === cat.id }"
            @click="switchCategory(cat.id)"
          >{{ cat.label }}</button>
        </nav>
        <!-- 右侧内容区 -->
        <div ref="settingsBodyRef" class="modal-body" @scroll="onBodyScroll">

        <!-- ==================== 基本 ==================== -->
        <div v-show="activeCategory === 'basic'">

        <!-- 帐号 -->
        <div id="section-account" class="section">
          <h3>帐号</h3>
          <div class="setting-row">
            <span>B站: {{ authStore.authState.bilibili ? authStore.authState.bilibiliUname : '未登录' }}</span>
            <button class="btn" @click="logoutBilibili" v-if="authStore.authState.bilibili">退出登录</button>
          </div>
          <div class="setting-row">
            <span>网易云: {{ authStore.authState.netease ? authStore.authState.neteaseUname : '未登录' }}</span>
            <button class="btn" @click="logoutNetease" v-if="authStore.authState.netease">退出登录</button>
          </div>
        </div>

        <!-- 窗口及外观 -->
        <div id="section-window-appearance" class="section">
          <h3>窗口及外观</h3>
          <div class="setting-row">
            <span>主题</span>
            <button class="btn" @click="settingsStore.toggleTheme()">
              {{ settingsStore.settings.theme === 'dark' ? '暗色' : '亮色' }}
            </button>
          </div>
          <div class="setting-row">
            <span>主题颜色</span>
            <div class="accent-picker-row">
              <ColorPicker :model-value="settingsStore.settings.accentColor" @update:model-value="settingsStore.setAccentColor($event)" />
              <button class="reset-btn" @click="resetAccent()">恢复默认</button>
            </div>
          </div>
          <div class="setting-row">
            <span>窗口置顶</span>
            <label class="toggle-label">
              <input type="checkbox" :checked="alwaysOnTop" @change="toggleAlwaysOnTop" />
              <span class="toggle-text">{{ alwaysOnTop ? '已开启' : '已关闭' }}</span>
            </label>
          </div>
          <div class="setting-row">
            <span>固定大小</span>
            <label class="toggle-label">
              <input type="checkbox" :checked="!isResizable" @change="toggleResizable" />
              <span class="toggle-text">{{ isResizable ? '可调整' : '已固定' }}</span>
            </label>
          </div>
        </div>

        </div><!-- end basic -->


        <!-- ==================== 弹幕窗口 ==================== -->
        <div v-show="activeCategory === 'danmaku-window'">

        <!-- 弹幕窗口设置 -->
        <div id="section-danmaku-window" class="section">
          <h3>弹幕窗口</h3>
          <div class="setting-row">
            <span>弹幕窗口</span>
            <label class="toggle-label">
              <input type="checkbox" :checked="danmakuWindowOpen" @change="toggleDanmakuWindow" />
              <span class="toggle-text">{{ danmakuWindowOpen ? '已开启' : '已关闭' }}</span>
            </label>
          </div>
          <div class="setting-row" v-if="danmakuWindowOpen">
            <span>显示边框</span>
            <label class="toggle-label">
              <input type="checkbox" :checked="danmakuWindowShowBorder" @change="toggleDanmakuWindowShowBorder" />
              <span class="toggle-text">{{ danmakuWindowShowBorder ? '显示' : '隐藏' }}</span>
            </label>
          </div>
          <div class="setting-row" v-if="danmakuWindowOpen">
            <span>固定弹幕窗口</span>
            <label class="toggle-label">
              <input type="checkbox" :checked="danmakuWindowFixed" @change="toggleDanmakuWindowFixed" />
              <span class="toggle-text">{{ danmakuWindowFixed ? '已固定' : '可移动' }}</span>
            </label>
          </div>
          <div class="setting-row" v-if="danmakuWindowOpen">
            <span>固定窗口快捷键</span>
            <div class="shortcut-row">
              <input
                class="shortcut-input"
                :value="settingsStore.settings.danmakuWindowFixShortcut"
                @keydown.prevent="onShortcutKeyDown"
                placeholder="Alt+B"
                readonly
              />
              <button class="reset-btn" @click="resetFixShortcut">恢复默认</button>
            </div>
          </div>
          <div class="setting-row" v-if="danmakuWindowOpen">
            <span>弹幕背景色</span>
            <div class="accent-picker-row">
              <ColorPicker :model-value="settingsStore.settings.danmakuWindowBgColor" @update:model-value="onDanmakuBgColorChange" show-alpha />
              <button class="reset-btn" @click="resetDanmakuBgColor">恢复默认</button>
            </div>
          </div>
          <div class="setting-row" v-if="danmakuWindowOpen">
            <span>窗口透明度</span>
            <div class="range-row">
              <span class="range-value">{{ danmakuWindowOpacity }}%</span>
              <input type="range" :min="5" :max="100" :value="danmakuWindowOpacity" @input="onDanmakuWindowOpacityChange" class="range-slider" />
            </div>
          </div>
          <p class="section-desc" v-if="danmakuWindowOpen" style="margin-top: 2px;">弹幕窗口为透明底、无边框、置顶显示。固定后鼠标可穿透窗口上半部分，下半部分表情栏和发送框保持可交互。</p>
        </div>

        </div><!-- end danmaku-window -->


        <!-- ==================== 歌曲 ==================== -->
        <div v-show="activeCategory === 'songs'">

        <!-- 点歌规则 -->
        <div id="section-song-request" class="section">
          <h3>点歌规则</h3>
          <div class="setting-row">
            <span>同用户间隔(秒)</span>
            <input v-model.number="settingsStore.settings.userCooldown" type="number" class="input" />
          </div>
          <div class="setting-row">
            <span>队列上限</span>
            <input v-model.number="settingsStore.settings.maxQueueSize" type="number" class="input" />
          </div>
          <div class="setting-row">
            <span>同歌曲间隔(秒)</span>
            <input v-model.number="settingsStore.settings.songCooldown" type="number" class="input" />
          </div>
        </div>

        <!-- 歌词 -->
        <div id="section-lyric" class="section">
          <h3>歌词</h3>
          <div class="setting-row">
            <span>显示翻译</span>
            <label class="toggle-label">
              <input type="checkbox" :checked="settingsStore.settings.showLyricTranslation" @change="toggleTranslation" />
              <span class="toggle-text">{{ settingsStore.settings.showLyricTranslation ? '已开启' : '已关闭' }}</span>
            </label>
          </div>
          <div class="setting-row">
            <span>翻译分行</span>
            <label class="toggle-label">
              <input type="checkbox" :checked="settingsStore.settings.splitLyricTranslation" @change="toggleSplitTranslation" />
              <span class="toggle-text">{{ settingsStore.settings.splitLyricTranslation ? '分两行' : '合并为一行' }}</span>
            </label>
          </div>
          <div class="setting-row">
            <span>歌词延迟</span>
            <div class="range-row">
              <span class="range-value">{{ settingsStore.settings.lyricDelay }}ms</span>
              <input
                type="range"
                min="0"
                max="1000"
                step="10"
                v-model.number="settingsStore.settings.lyricDelay"
                class="range-slider"
              />
            </div>
          </div>
          <div class="setting-row">
            <span>字体大小</span>
            <div class="range-row">
              <span class="range-value">{{ settingsStore.settings.lyricFontSize }}px</span>
              <input
                type="range"
                min="10"
                max="30"
                v-model.number="settingsStore.settings.lyricFontSize"
                class="range-slider"
              />
            </div>
          </div>
          <div class="setting-row">
            <span>段落间距</span>
            <div class="range-row">
              <span class="range-value">{{ settingsStore.settings.lyricLineSpacing }}px</span>
              <input
                type="range"
                min="0"
                max="50"
                v-model.number="settingsStore.settings.lyricLineSpacing"
                class="range-slider"
              />
            </div>
          </div>
        </div>

        <!-- 空闲歌单设置 -->
        <div id="section-idle" class="section">
          <h3>空闲歌单</h3>
          <div class="setting-row">
            <span>显示空闲歌曲</span>
            <label class="toggle-label">
              <input type="checkbox" :checked="settingsStore.settings.showIdleSongs" @change="settingsStore.settings.showIdleSongs = !settingsStore.settings.showIdleSongs" />
              <span class="toggle-text">{{ settingsStore.settings.showIdleSongs ? '显示' : '隐藏' }}</span>
            </label>
          </div>
          <div class="setting-row">
            <span>待选数量</span>
            <div class="range-row">
              <span class="range-value">{{ idleQueueSize }} 首</span>
              <input
                type="range"
                min="2"
                max="5"
                v-model.number="idleQueueSize"
                @change="saveIdleQueueSize"
                class="range-slider"
              />
            </div>
          </div>
        </div>

        <!-- 缓存 -->
        <div id="section-cache" class="section">
          <h3>音频文件缓存 <span class="cache-count">({{ cacheSongs.length }}/20)</span></h3>
          <div class="cache-list" v-if="cacheSongs.length > 0">
            <div v-for="(entry, i) in cacheSongs" :key="entry.songId" class="cache-item">
              <button class="add-btn" @click="playCached(entry)" title="添加到队列">+</button>
              <span class="cache-idx">{{ i + 1 }}</span>
              <span class="cache-title">{{ entry.title || '(未知)' }}</span>
              <span class="cache-artist">{{ entry.artist }}</span>
              <span class="cache-size">{{ formatSize(entry.size) }}</span>
            </div>
          </div>
          <div v-else class="cache-empty">暂无缓存文件</div>
          <button v-if="cacheSongs.length > 0" class="btn clear-cache-btn" @click="clearAllCache">清空缓存</button>
          <p class="section-desc" style="margin-top: 6px;">自动缓存队列后续歌曲，最多20首，超出自动清理。点击 + 添加到队列</p>
        </div>

        </div><!-- end songs -->


        <!-- ==================== 弹幕 ==================== -->
        <div v-show="activeCategory === 'danmaku'">

        <!-- 常规 -->
        <div id="section-danmaku-general" class="section">
          <h3>常规</h3>
          <div class="setting-row">
            <span>显示弹幕</span>
            <label class="toggle-label">
              <input type="checkbox" v-model="settingsStore.settings.showDanmaku" />
              <span class="toggle-text">{{ settingsStore.settings.showDanmaku ? '已开启' : '已关闭' }}</span>
            </label>
          </div>
          <div class="setting-row">
            <span>显示付费消息</span>
            <label class="toggle-label">
              <input type="checkbox" v-model="settingsStore.settings.showPaidMessages" />
              <span class="toggle-text">{{ settingsStore.settings.showPaidMessages ? '已开启' : '已关闭' }}</span>
            </label>
          </div>
          <div class="setting-row">
            <span>最低付费价格</span>
            <div class="input-with-unit">
              <input v-model.number="settingsStore.settings.minPaidMessagePrice" type="number" class="input" min="0" step="0.1" />
              <span class="unit">元</span>
            </div>
          </div>
          <div class="setting-row">
            <span>最多显示消息数</span>
            <div class="range-row">
              <span class="range-value">{{ settingsStore.settings.maxDanmakuCount }}</span>
              <input
                type="range"
                min="10"
                max="500"
                step="10"
                v-model.number="settingsStore.settings.maxDanmakuCount"
                class="range-slider"
              />
            </div>
          </div>
          <div class="setting-row">
            <span>合并相似弹幕</span>
            <label class="toggle-label">
              <input type="checkbox" v-model="settingsStore.settings.mergeSimilarDanmaku" />
              <span class="toggle-text">{{ settingsStore.settings.mergeSimilarDanmaku ? '已开启' : '已关闭' }}</span>
            </label>
          </div>
          <div class="setting-row">
            <span>合并连续礼物</span>
            <label class="toggle-label">
              <input type="checkbox" v-model="settingsStore.settings.mergeSimilarGift" />
              <span class="toggle-text">{{ settingsStore.settings.mergeSimilarGift ? '已开启' : '已关闭' }}</span>
            </label>
          </div>
        </div>

        <!-- 屏蔽 -->
        <div id="section-danmaku-block" class="section">
          <h3>屏蔽</h3>
          <div class="setting-row">
            <span>屏蔽礼物弹幕</span>
            <label class="toggle-label">
              <input type="checkbox" v-model="settingsStore.settings.blockGiftDanmaku" />
              <span class="toggle-text">{{ settingsStore.settings.blockGiftDanmaku ? '已屏蔽' : '未屏蔽' }}</span>
            </label>
          </div>
          <div class="setting-row">
            <span>用户等级屏蔽</span>
            <div class="range-row">
              <span class="range-value">{{ settingsStore.settings.blockLevel }}</span>
              <input
                type="range"
                min="0"
                max="60"
                step="1"
                v-model.number="settingsStore.settings.blockLevel"
                class="range-slider"
              />
            </div>
          </div>
          <div class="setting-row">
            <span>粉丝牌等级屏蔽</span>
            <div class="range-row">
              <span class="range-value">{{ settingsStore.settings.blockMedalLevel }}</span>
              <input
                type="range"
                min="0"
                max="120"
                step="1"
                v-model.number="settingsStore.settings.blockMedalLevel"
                class="range-slider"
              />
            </div>
          </div>
          <div class="setting-row">
            <span>屏蔽关键词</span>
          </div>
          <div class="setting-row">
            <textarea
              v-model="settingsStore.settings.blockKeywords"
              class="textarea"
              rows="4"
              placeholder="每行一个关键词"
            ></textarea>
          </div>
          <div class="setting-row">
            <span>屏蔽用户</span>
          </div>
          <div class="setting-row">
            <textarea
              v-model="settingsStore.settings.blockUsers"
              class="textarea"
              rows="4"
              placeholder="每行一个用户UID"
            ></textarea>
          </div>
        </div>

        <!-- 高级 -->
        <div id="section-danmaku-advanced" class="section">
          <h3>高级</h3>
          <div class="setting-row">
            <span>显示礼物名</span>
            <label class="toggle-label">
              <input type="checkbox" v-model="settingsStore.settings.showGiftName" />
              <span class="toggle-text">{{ settingsStore.settings.showGiftName ? '已开启' : '已关闭' }}</span>
            </label>
          </div>
          <div class="setting-row">
            <span>显示弹幕时间</span>
            <label class="toggle-label">
              <input type="checkbox" v-model="settingsStore.settings.showDanmakuTime" />
              <span class="toggle-text">{{ settingsStore.settings.showDanmakuTime ? '已开启' : '已关闭' }}</span>
            </label>
          </div>
          <div class="setting-row">
            <span>显示调试信息</span>
            <label class="toggle-label">
              <input type="checkbox" v-model="settingsStore.settings.showDebugMessages" />
              <span class="toggle-text">{{ settingsStore.settings.showDebugMessages ? '已开启' : '已关闭' }}</span>
            </label>
          </div>
          <div class="setting-row">
            <span>自定义 CSS</span>
          </div>
          <div class="setting-row">
            <textarea
              v-model="settingsStore.settings.customDanmakuCss"
              class="textarea css-textarea"
              rows="20"
              placeholder="/* 在此输入自定义 CSS */"
            ></textarea>
          </div>
          <p class="section-desc" style="margin-top: 4px;">自定义 CSS 将注入到 blive.chat 弹幕 iframe 中，覆盖默认弹幕样式。输入后即时生效。</p>
          <button class="btn" style="margin-top: 6px;" @click="resetDanmakuCss">重置为默认</button>
        </div>

        </div><!-- end danmaku -->


        <!-- ==================== OBS ==================== -->
        <div v-show="activeCategory === 'obs'">

        <!-- OBS 叠加层 -->
        <div id="section-obs-overlay" class="section">
          <h3>OBS 叠加层</h3>
          <div class="setting-row">
            <span>启用 HTTP 服务（实时推送到 OBS 浏览器源）</span>
            <label class="toggle-label">
              <input type="checkbox" v-model="settingsStore.settings.obsOverlayEnabled" @change="onObsOverlayToggled($event)" />
              <span class="toggle-text">{{ settingsStore.settings.obsOverlayEnabled ? '已开启' : '已关闭' }}</span>
            </label>
          </div>
          <template v-if="settingsStore.settings.obsOverlayEnabled">
            <div class="setting-row">
              <span>样式设置地址</span>
              <div class="path-row">
                <input :value="obsPort > 0 ? `http://localhost:${obsPort}/style` : ''" readonly class="input input-path" style="max-width: 249px" placeholder="http://localhost:4680/style" />
                <button class="btn" @click="copyObsUrl('style')">复制</button>
                <button class="btn" @click="openStyleWindow">打开</button>
              </div>
            </div>
            <p class="section-desc">
              打开「样式设置地址」可调整各叠加层的字体、颜色等样式。
            </p>
            <div class="setting-row">
              <span>歌词叠加层</span>
              <div class="path-row">
                <input :value="obsPort > 0 ? `http://localhost:${obsPort}/lyric` : ''" readonly class="input input-path" placeholder="http://localhost:4680/lyric" />
                <button class="btn" @click="copyObsUrl('lyric')">复制</button>
              </div>
            </div>
            <div class="setting-row">
              <span>队列叠加层</span>
              <div class="path-row">
                <input :value="obsPort > 0 ? `http://localhost:${obsPort}/queue` : ''" readonly class="input input-path" placeholder="http://localhost:4680/queue" />
                <button class="btn" @click="copyObsUrl('queue')">复制</button>
              </div>
            </div>
            <div class="setting-row">
              <span>歌信息叠加层</span>
              <div class="path-row">
                <input :value="obsPort > 0 ? `http://localhost:${obsPort}/songinfo` : ''" readonly class="input input-path" placeholder="http://localhost:4680/songinfo" />
                <button class="btn" @click="copyObsUrl('songinfo')">复制</button>
              </div>
            </div>
            <p class="section-desc">
              将歌词/队列/歌曲地址粘贴到 OBS「浏览器」源即可实时捕获。
            </p>
          </template>
        </div>
        <!-- 弹幕捕获 -->
        <div id="section-danmaku-capture" class="section">
          <h3>弹幕捕获</h3>
          <div class="setting-row">
            <span>身份码</span>
            <div class="path-row">
              <input
                v-model="settingsStore.settings.identityCode"
                class="input input-path"
                placeholder="点击「获取」自动填写"
              />
              <button class="btn" @click="fetchIdentityCode" :disabled="idCodeLoading">
                {{ idCodeLoading ? '加载' : '获取' }}
              </button>
            </div>
          </div>
          <p class="section-desc" style="margin-top: 2px;">
            身份码用于 blivechat 弹幕捕获，登录后自动获取。获取失败可在 <a href="https://link.bilibili.com/#/my-room/start-live" target="_blank" class="link">开播设置</a> 查看并手动填入。
          </p>
          <div class="setting-row">
            <span>blivechat地址</span>
            <div class="path-row">
              <input
                readonly
                class="input input-path"
                :placeholder="blivechatUrl"
              />
              <button class="btn" @click="copyText(blivechatUrl)">复制</button>
            </div>
          </div>
          <p class="section-desc">
            将此地址粘贴到 OBS「浏览器」源，即可在直播画面中捕获弹幕。
          </p>
          <div class="setting-row">
            <span>blivechat CSS</span>
            <div class="path-row">
              <input
                readonly
                class="input input-path"
                placeholder="https://blive.chat/stylegen"
              />
              <button class="btn" @click="copyText('https://blive.chat/stylegen')">复制</button>
            </div>
          </div>
          <p class="section-desc">
            打开 blivechat 样式生成器，生成自定义 CSS 后粘贴到 OBS 浏览器源的「自定义 CSS」中。
          </p>
          <div class="setting-row">
            <span>自定义 CSS</span>
          </div>
          <div class="setting-row">
            <textarea
              v-model="settingsStore.settings.customDanmakuCss"
              class="textarea css-textarea"
              rows="12"
              placeholder="/* 将 blivechat/stylegen 生成的 CSS 粘贴到这里 */"
            ></textarea>
          </div>
          <p class="section-desc">
            此 CSS 将注入到 in-app 弹幕显示以及 OBS 浏览器源中。修改后即时生效。
          </p>
        </div>

        </div><!-- end obs -->


        <!-- ==================== 关于 ==================== -->
        <div v-show="activeCategory === 'about'">

        <!-- 日志 -->
        <div id="section-log" class="section">
          <h3>日志</h3>
          <div ref="logContainerRef" class="log-container">
            <div v-for="(log, i) in danmakuStore.logs" :key="i" class="log-line">{{ log }}</div>
            <div v-if="danmakuStore.logs.length === 0" class="log-empty">暂无日志</div>
          </div>
        </div>

        <!-- 致谢 -->
        <div id="section-thanks" class="section">
          <h3>致谢</h3>
          <p class="thanks-text">blivechat</p>
        </div>

        <!-- 关于 -->
        <div id="section-about" class="section">
          <h3>关于</h3>
          <div class="about-header">
            <span class="about-text">BxNcm DJ v1.1.1 by Taumata<br/>技术栈: Vue3 + Electron + TypeScript</span>
            <div class="about-actions">
              <button class="btn dev-btn" @click="openDevTools">Dev</button>
              <button class="btn reset-data-btn" @click="resetAllData">重置数据</button>
            </div>
          </div>
        </div>
        </div><!-- end about -->
      </div><!-- end modal-body -->
      </div><!-- end modal-layout -->
    </div>
  </div>

  <!-- 重置数据确认弹窗 -->
  <ConfirmDialog
    v-if="showResetConfirm"
    title="重置数据"
    message="此操作将清除所有本地数据（数据库、缓存、操作记录、设置项），仅保留登录状态。确认后程序将自动重启。"
    @confirm="handleResetConfirm"
    @cancel="showResetConfirm = false"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth.store'
import { useSettingsStore } from '../../stores/settings.store'
import { useDanmakuStore } from '../../stores/danmaku.store'
import ColorPicker from './ColorPicker.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import defaultDanmakuCss from '../../assets/styles/danmaku.css?raw'

const emit = defineEmits(['close'])
const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const danmakuStore = useDanmakuStore()

const cacheSongs = ref<any[]>([])
const alwaysOnTop = ref(false)
const isResizable = ref(true)
const idleQueueSize = ref(3)
const obsPort = ref(0)
const danmakuWindowOpen = ref(false)
const danmakuWindowFixed = ref(false)
const danmakuWindowShowBorder = ref(true)
const danmakuWindowOpacity = ref(100)
const logContainerRef = ref<HTMLElement | null>(null)
const settingsBodyRef = ref<HTMLElement | null>(null)
const activeCategory = ref('basic')
const idCodeLoading = ref(false)
let navLocked = false
let navLockTimer: ReturnType<typeof setTimeout> | null = null

/** 计算 blivechat 地址：基于身份码 + 完整弹幕设置 */
const blivechatUrl = computed(() => {
  const code = settingsStore.settings.identityCode
  if (!code) return ''
  const s = settingsStore.settings
  const params = new URLSearchParams()
  params.set('roomKeyType', '2')
  params.set('lang', s.blivechatLang || 'zh')
  // 显示控制
  params.set('showDanmaku', s.showDanmaku ? 'true' : 'false')
  params.set('showGift', s.showPaidMessages ? 'true' : 'false')
  params.set('showGiftName', s.showGiftName ? 'true' : 'false')
  params.set('mergeSimilarDanmaku', s.mergeSimilarDanmaku ? 'true' : 'false')
  params.set('mergeGift', s.mergeSimilarGift ? 'true' : 'false')
  params.set('maxNumber', String(s.maxDanmakuCount))
  params.set('minGiftPrice', String(s.minPaidMessagePrice))
  // 屏蔽
  params.set('blockGiftDanmaku', s.blockGiftDanmaku ? 'true' : 'false')
  params.set('blockMirrorMessages', s.blockMirrorMessages ? 'true' : 'false')
  params.set('blockLevel', String(s.blockLevel))
  params.set('blockMedalLevel', String(s.blockMedalLevel))
  params.set('blockNewbie', s.blockNewbie ? 'true' : 'false')
  params.set('blockNotMobileVerified', s.blockNotMobileVerified ? 'true' : 'false')
  if (s.blockKeywords) params.set('blockKeywords', s.blockKeywords)
  if (s.blockUsers) params.set('blockUsers', s.blockUsers)
  // 调试
  params.set('showDebugMessages', s.showDebugMessages ? 'true' : 'false')
  return `https://blive.chat/room/${code}?${params.toString()}`
})

// 分类标签
const categories = [
  { id: 'basic', label: '基础设置' },
  { id: 'danmaku-window', label: '弹幕窗口' },
  { id: 'songs', label: '歌曲相关' },
  { id: 'danmaku', label: '弹幕设置' },
  { id: 'obs', label: 'OBS捕获' },
  { id: 'about', label: '关于' },
]

// section ID → 分类 ID 映射（用于滚动高亮）
const sectionToCategory: Record<string, string> = {
  'account': 'basic',
  'window-appearance': 'basic',
  'danmaku-window': 'danmaku-window',
  'song-request': 'songs',
  'lyric': 'songs',
  'idle': 'songs',
  'cache': 'songs',
  'danmaku-general': 'danmaku',
  'danmaku-block': 'danmaku',
  'danmaku-advanced': 'danmaku',
  'obs-overlay': 'obs',
  'danmaku-capture': 'obs',
  'log': 'about',
  'thanks': 'about',
  'about': 'about',
}

// 每个分类的第一个 section（用于 switchCategory 时滚动定位）
const categoryFirstSection: Record<string, string> = {
  'basic': 'account',
  'danmaku-window': 'danmaku-window',
  'songs': 'song-request',
  'danmaku': 'danmaku-general',
  'obs': 'obs-overlay',
  'about': 'log',
}

/** 点击分类标签，切换视图并滚动到该分类第一个 section */
function switchCategory(catId: string) {
  activeCategory.value = catId
  navLocked = true
  if (navLockTimer) clearTimeout(navLockTimer)
  navLockTimer = setTimeout(() => { navLocked = false }, 600)
  const firstSectionId = categoryFirstSection[catId]
  if (firstSectionId) {
    const el = document.getElementById(`section-${firstSectionId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
}

/** 滚动时自动高亮当前可见 section 所属的分类 */
function onBodyScroll() {
  if (navLocked) return
  const container = settingsBodyRef.value
  if (!container) return
  const containerTop = container.scrollTop + 180
  for (let i = categories.length - 1; i >= 0; i--) {
    const catId = categories[i].id
    // 找到该分类下最后一个有 offsetParent（可见）的 section
    const sectionsForCat = Object.entries(sectionToCategory)
      .filter(([, cat]) => cat === catId)
      .map(([sec]) => sec)
    for (let j = sectionsForCat.length - 1; j >= 0; j--) {
      const el = document.getElementById(`section-${sectionsForCat[j]}`)
      if (el && el.offsetTop <= containerTop && el.offsetParent !== null) {
        activeCategory.value = catId
        return
      }
    }
  }
}

onMounted(async () => {
  // 初始化自定义 CSS：如果为空，使用 danmaku.css 作为默认可编辑文本
  if (!settingsStore.settings.customDanmakuCss) {
    settingsStore.settings.customDanmakuCss = defaultDanmakuCss
  }

  try { alwaysOnTop.value = await window.electronAPI.isAlwaysOnTop() } catch {}
  try { isResizable.value = await window.electronAPI.isResizable() } catch {}
  try { cacheSongs.value = await window.electronAPI.getAudioCacheList() } catch {}
  try { idleQueueSize.value = await window.electronAPI.getIdleQueueSize() } catch {}
  try { obsPort.value = await window.electronAPI.getObsPort() } catch {}
  try {
    danmakuWindowOpen.value = await window.electronAPI.isDanmakuWindowOpen()
    danmakuWindowFixed.value = settingsStore.settings.danmakuWindowFixed
    danmakuWindowShowBorder.value = settingsStore.settings.danmakuWindowShowBorder
    danmakuWindowOpacity.value = settingsStore.settings.danmakuWindowOpacity || 100
  } catch {}

  // 监听弹幕窗口的固定状态变化（来自弹幕窗口的锁定按钮）
  window.electronAPI.onDanmakuWindowFixedChanged?.((fixed: boolean) => {
    danmakuWindowFixed.value = fixed
    settingsStore.settings.danmakuWindowFixed = fixed
  })

  // 监听弹幕窗口关闭（来自弹幕窗口的关闭按钮 / 原生关闭）
  window.electronAPI.onDanmakuWindowClosed?.(() => {
    danmakuWindowOpen.value = false
    settingsStore.settings.danmakuWindow = false
  })

  // 如果 OBS 服务已开启但端口未获取到，重试一次
  if (obsPort.value === 0 && settingsStore.settings.obsOverlayEnabled) {
    setTimeout(async () => {
      try { obsPort.value = await window.electronAPI.getObsPort() } catch {}
    }, 500)
  }

  // 启动时自动获取身份码：如果为空且已登录B站
  if (!settingsStore.settings.identityCode && authStore.authState.bilibili) {
    setTimeout(async () => {
      try {
        idCodeLoading.value = true
        const result = await window.electronAPI.fetchIdentityCode()
        if (result.success && result.code) {
          settingsStore.settings.identityCode = result.code
        }
      } catch (e) {
        // 静默失败，用户可以手动点击获取
        console.warn('[SettingsModal] 自动获取身份码失败:', e)
      } finally {
        idCodeLoading.value = false
      }
    }, 800)
  }
})

// 日志列表自动滚动到底部
watch(
  () => danmakuStore.logs.length,
  () => {
    nextTick(() => {
      const el = logContainerRef.value
      if (el) el.scrollTop = el.scrollHeight
    })
  },
)

// 监听自定义 CSS 变化，同步更新弹幕窗口
watch(
  () => settingsStore.settings.customDanmakuCss,
  (css) => {
    if (danmakuWindowOpen.value) {
      window.electronAPI.updateDanmakuWindowCss(css || defaultDanmakuCss)
    }
  },
)

// 监听弹幕设置变化，同步更新弹幕窗口 URL
watch(
  () => blivechatUrl.value,
  (url) => {
    if (danmakuWindowOpen.value && url) {
      window.electronAPI.updateDanmakuWindowUrl(url)
    }
  },
)

async function toggleAlwaysOnTop() {
  alwaysOnTop.value = !alwaysOnTop.value
  try {
    await window.electronAPI.setAlwaysOnTop(alwaysOnTop.value)
    settingsStore.settings.alwaysOnTop = alwaysOnTop.value
  } catch (e) { console.error('[SettingsModal] toggleAlwaysOnTop failed:', e) }
}

async function toggleResizable() {
  isResizable.value = !isResizable.value
  try {
    await window.electronAPI.setResizable(isResizable.value)
    settingsStore.settings.resizable = isResizable.value
  } catch (e) { console.error('[SettingsModal] toggleResizable failed:', e) }
}

async function toggleDanmakuWindow() {
  danmakuWindowOpen.value = !danmakuWindowOpen.value
  settingsStore.settings.danmakuWindow = danmakuWindowOpen.value
  try {
    if (danmakuWindowOpen.value) {
      if (!blivechatUrl.value) {
        danmakuWindowOpen.value = false
        settingsStore.settings.danmakuWindow = false
        alert('请先在「OBS → 弹幕捕获」中获取身份码，再打开弹幕窗口。')
        return
      }
      const css = settingsStore.settings.customDanmakuCss || defaultDanmakuCss
      const bgColor = settingsStore.settings.danmakuWindowBgColor || 'rgba(0,0,0,0.3)'
      const opacity = settingsStore.settings.danmakuWindowOpacity || 100
      await window.electronAPI.openDanmakuWindow(blivechatUrl.value, css, bgColor, opacity)
      // 同步固定模式和边框显示状态
      if (danmakuWindowFixed.value) {
        await window.electronAPI.setDanmakuWindowFixed(true)
      }
      await window.electronAPI.setDanmakuWindowShowBorder(danmakuWindowShowBorder.value)
    } else {
      await window.electronAPI.closeDanmakuWindow()
    }
  } catch (e) { console.error('[SettingsModal] toggleDanmakuWindow failed:', e) }
}

async function toggleDanmakuWindowFixed() {
  danmakuWindowFixed.value = !danmakuWindowFixed.value
  settingsStore.settings.danmakuWindowFixed = danmakuWindowFixed.value
  try {
    await window.electronAPI.setDanmakuWindowFixed(danmakuWindowFixed.value)
  } catch (e) { console.error('[SettingsModal] toggleDanmakuWindowFixed failed:', e) }
}

async function toggleDanmakuWindowShowBorder() {
  danmakuWindowShowBorder.value = !danmakuWindowShowBorder.value
  settingsStore.settings.danmakuWindowShowBorder = danmakuWindowShowBorder.value
  try {
    await window.electronAPI.setDanmakuWindowShowBorder(danmakuWindowShowBorder.value)
  } catch (e) { console.error('[SettingsModal] toggleDanmakuWindowShowBorder failed:', e) }
}

function onShortcutKeyDown(e: KeyboardEvent) {
  e.preventDefault()
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Meta')
  // 只取修饰键 + 一个非修饰键
  const key = e.key
  if (key && !['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    parts.push(key.length === 1 ? key.toUpperCase() : key)
  }
  if (parts.length >= 2) {
    const shortcut = parts.join('+')
    settingsStore.settings.danmakuWindowFixShortcut = shortcut
    window.electronAPI.registerDanmakuFixShortcut(shortcut)
  }
}

function resetFixShortcut() {
  const defaultShortcut = 'Alt+B'
  settingsStore.settings.danmakuWindowFixShortcut = defaultShortcut
  window.electronAPI.registerDanmakuFixShortcut(defaultShortcut)
}

function onDanmakuBgColorChange(rgba: string) {
  settingsStore.settings.danmakuWindowBgColor = rgba
  if (danmakuWindowOpen.value) {
    window.electronAPI.setDanmakuWindowBgColor(rgba)
  }
}

function resetDanmakuBgColor() {
  const defaultBg = 'rgba(0,0,0,0.3)'
  settingsStore.settings.danmakuWindowBgColor = defaultBg
  if (danmakuWindowOpen.value) {
    window.electronAPI.setDanmakuWindowBgColor(defaultBg)
  }
}

function onDanmakuWindowOpacityChange(e: Event) {
  const val = parseInt((e.target as HTMLInputElement).value)
  danmakuWindowOpacity.value = val
  settingsStore.settings.danmakuWindowOpacity = val
  if (danmakuWindowOpen.value) {
    window.electronAPI.setDanmakuWindowOpacity(val)
  }
}

async function saveIdleQueueSize() {
  try {
    await window.electronAPI.setIdleQueueSize(idleQueueSize.value)
  } catch (e) { console.error('[SettingsModal] saveIdleQueueSize failed:', e) }
}

function resetAccent() {
  const c = settingsStore.settings.theme === 'dark' ? '#00b5e5' : '#00a1d6'
  settingsStore.setAccentColor(c)
}

async function playCached(entry: any) {
  const song: any = {
    id: entry.songId,
    sourceId: entry.songId?.replace(/^(ne_|bv_)/, '') || '',
    source: entry.songId?.startsWith?.('bv_') ? 'bilibili' : 'netease',
    title: entry.title || '',
    artist: entry.artist || '',
    coverUrl: '',
    duration: 0,
    cid: 0,
    requesterName: '控制台',
  }
  await window.electronAPI.playlistInsertTop(song)
}

async function clearAllCache() {
  try {
    await window.electronAPI.clearAudioCache()
    cacheSongs.value = []
  } catch (e) { console.error('[SettingsModal] clearAllCache failed:', e) }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(1) + 'MB'
}

async function onObsOverlayToggled(event: Event) {
  const enabled = (event.target as HTMLInputElement).checked
  try {
    const result = await window.electronAPI.toggleObsOverlay(enabled)
    if (result.error) {
      console.error('[SettingsModal] OBS 服务切换失败:', result.error)
    }
    obsPort.value = result.port
  } catch (e) {
    console.error('[SettingsModal] onObsOverlayToggled 失败:', e)
  }
}

function copyObsUrl(page: string) {
  if (obsPort.value <= 0) return
  const url = `http://localhost:${obsPort.value}/${page}`
  navigator.clipboard.writeText(url)
}

/** 复制文本到剪贴板 */
function copyText(text: string) {
  if (!text) return
  navigator.clipboard.writeText(text)
}

/** 获取 blivechat 身份码 */
async function fetchIdentityCode() {
  idCodeLoading.value = true
  try {
    const result = await window.electronAPI.fetchIdentityCode()
    if (result.success && result.code) {
      settingsStore.settings.identityCode = result.code
    } else {
      alert('获取身份码失败：' + (result.message || '未知错误'))
    }
  } catch (e) {
    console.error('[SettingsModal] fetchIdentityCode 失败:', e)
    alert('获取身份码失败：' + (e as Error).message)
  } finally {
    idCodeLoading.value = false
  }
}

function openStyleWindow() {
  if (obsPort.value <= 0) return
  window.electronAPI.openStyleWindow(obsPort.value)
}

async function logoutBilibili() {
  await window.electronAPI.logoutBilibili()
  authStore.authState.bilibili = false
  authStore.authState.bilibiliUname = ''
  authStore.authState.bilibiliFace = ''
  authStore.authState.bilibiliUid = 0
  emit('close')
  router.push('/')
}

async function logoutNetease() {
  await window.electronAPI.logoutNetease()
  authStore.authState.netease = false
  authStore.authState.neteaseUname = ''
  authStore.authState.neteaseFace = ''
  authStore.authState.neteaseUid = 0
  emit('close')
  router.push('/')
}

function toggleTranslation() {
  settingsStore.settings.showLyricTranslation = !settingsStore.settings.showLyricTranslation
}

function toggleSplitTranslation() {
  settingsStore.settings.splitLyricTranslation = !settingsStore.settings.splitLyricTranslation
}

function resetDanmakuCss() {
  settingsStore.settings.customDanmakuCss = defaultDanmakuCss
}

const showResetConfirm = ref(false)

function resetAllData() {
  showResetConfirm.value = true
}

async function handleResetConfirm() {
  try {
    await window.electronAPI.resetAllData()
    // 清除 renderer 端 localStorage 中的表情包缓存（主进程已删除磁盘缓存文件）
    localStorage.removeItem('bili_emoticon_cache_v2')
    await new Promise(r => setTimeout(r, 300))
    await window.electronAPI.appRelaunch()
  } catch (e) {
    console.error('[SettingsModal] resetAllData failed:', e)
    showResetConfirm.value = false
    alert('重置失败：' + (e as Error).message)
  }
}

async function openDevTools() {
  try {
    await window.electronAPI.openDevTools()
  } catch (e) {
    console.error('[SettingsModal] openDevTools failed:', e)
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: var(--modal-overlay); display: flex;
  align-items: flex-start; justify-content: center; z-index: 1000;
  padding: 8vh 0;
}
.modal-content {
  width: 560px; height: 84vh; max-height: 84vh; background: var(--modal-bg);
  border: 1px solid var(--border); display: flex; flex-direction: column;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; border-bottom: 1px solid var(--section-border); background: var(--bg-secondary);
  flex-shrink: 0;
}
.modal-header h2 { font-size: 14px; font-weight: 400; color: var(--text-primary); }
.close-btn {
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--text-muted); cursor: pointer; border-radius: 0;
}
.close-btn:hover { background: #e74c3c; color: #fff; }

/* 左右布局：导航栏 + 内容 */
.modal-layout { display: flex; flex: 1; min-height: 0; overflow: hidden; }

/* 左侧分类标签 */
.settings-nav {
  width: 80px; flex-shrink: 0; overflow-y: auto; padding: 6px 0;
  border-right: 1px solid var(--section-border); background: var(--bg-secondary);
  scrollbar-width: none;
}
.settings-nav::-webkit-scrollbar { display: none; }
.nav-item {
  display: block; width: 100%; padding: 8px 10px; font-size: 12px; color: var(--text-secondary);
  background: none; border: none; cursor: pointer; text-align: left;
  transition: background 0.1s, color 0.1s; border-radius: 0;
}
.nav-item:hover { background: var(--bg-tertiary); color: var(--text-primary); }
.nav-item.active { color: var(--accent); background: var(--bg-tertiary); font-weight: 600; }

/* 右侧内容区 */
.modal-body { flex: 1; overflow-y: auto; padding: 12px 14px; min-width: 0; }
.section { margin-bottom: 16px; }
.section h3 { font-size: 12px; font-weight: 600; color: var(--section-title); margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid var(--section-border); }
.section-desc { font-size: 10px; color: var(--text-muted); margin-bottom: 6px; line-height: 1.4; }
.setting-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 12px; color: var(--text-primary); }
.setting-row > span { text-align: left; flex: 1; margin-right: 12px; }
.connected { color: #4ec9b0; }
.disconnected { color: var(--text-muted); }
span.status-text { text-align: right; min-width: 50px; flex: none; }
.input { width: 90px; padding: 4px 6px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text-primary); font-size: 12px; }
.input:focus { border-color: var(--accent); outline: none; }
.btn {
  padding: 4px 12px; border: 1px solid var(--border); border-radius: 0;
  background: var(--btn-bg); color: var(--btn-text); font-size: 10px; cursor: pointer;
}
.btn:hover { background: var(--btn-hover-bg); }
.accent-picker-row { display: flex; align-items: center; gap: 8px; }
.reset-btn {
  padding: 3px 8px; font-size: 10px; color: var(--text-secondary); border-radius: 0;
  background: var(--bg-secondary); border: 1px solid var(--border);
  cursor: pointer; transition: background 0.1s, color 0.1s;
}
.reset-btn:hover { color: var(--accent); border-color: var(--accent); }
.shortcut-row { display: flex; align-items: center; gap: 8px; }
.shortcut-input {
  width: 100px; padding: 3px 6px; font-size: 11px; text-align: center;
  background: var(--bg-primary); border: 1px solid var(--border);
  color: var(--text-primary); border-radius: 0; outline: none;
  cursor: pointer; font-family: monospace;
}
.shortcut-input:focus { border-color: var(--accent); }
.shortcut-input::placeholder { color: var(--text-muted); }
.toggle-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 11px; color: var(--text-muted); flex-direction: row-reverse; }
.toggle-label input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--accent); }
.toggle-text { font-size: 11px; min-width: 48px; text-align: right; }
.log-container {
  height: 180px; overflow-y: auto; background: var(--bg-primary); border: 1px solid var(--border);
  padding: 6px; font-size: 11px; font-family: monospace;
  scrollbar-width: none;
}
.log-container::-webkit-scrollbar { display: none; }
.log-line { color: var(--text-secondary); padding: 1px 0; white-space: pre-wrap; }
.log-empty { color: var(--text-muted); font-style: italic; }
.about-header { display: flex; justify-content: space-between; align-items: flex-start; }
.about-text { font-size: 11px; color: var(--text-secondary); line-height: 1.8; }
.about-actions { display: flex; gap: 8px; flex-shrink: 0; }
.dev-btn { display: flex; }
.reset-data-btn { display: flex; }

/* 缓存列表 */
.cache-list { height: 180px; overflow-y: auto; background: var(--bg-primary); border: 1px solid var(--border); scrollbar-width: none; }
.cache-list::-webkit-scrollbar { display: none; }
.cache-item {
  display: flex; align-items: center; padding: 4px 8px; gap: 6px;
  font-size: 11px; border-bottom: 1px solid var(--border);
}
.cache-item:hover { background: var(--bg-tertiary); }
.add-btn {
  width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
  background: none; border: 1px solid var(--border); color: var(--accent);
  font-size: 14px; cursor: pointer; flex-shrink: 0; padding: 0; line-height: 1;
}
.add-btn:hover { background: var(--accent); color: var(--btn-primary-text); border-color: var(--accent); }
.cache-idx { color: var(--text-muted); width: 20px; text-align: center; flex-shrink: 0; }
.cache-title { flex: 1; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cache-artist { color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px; }
.cache-size { color: var(--text-muted); font-size: 10px; width: 45px; text-align: right; flex-shrink: 0; font-family: 'Consolas', monospace; }
.cache-count { font-size: 11px; color: var(--text-muted); font-weight: normal; }
.cache-empty { padding: 12px; text-align: center; color: var(--text-muted); font-size: 11px; }
.clear-cache-btn { margin-top: 6px; width: 100%; }
.range-row { display: flex; align-items: center; gap: 8px; flex: 1; justify-content: flex-end; }
.range-slider {
  -webkit-appearance: none; appearance: none;
  width: 100px; height: 4px; background: var(--border); outline: none;
}
.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 14px; height: 14px; background: var(--accent); cursor: pointer;
}
.range-slider::-moz-range-thumb {
  width: 14px; height: 14px; background: var(--accent); cursor: pointer; border: none;
}
.range-value { font-size: 11px; color: var(--text-muted); min-width: 36px; text-align: left; }
.path-row { display: flex; gap: 6px; align-items: center; }
.input-path { width: 300px; flex: 1; min-width: 0; }

.link {
  color: var(--accent); text-decoration: none;
}
.link:hover { text-decoration: underline; }

.input-with-unit {
  display: flex; align-items: center; gap: 4px;
}
.unit {
  font-size: 11px; color: var(--text-muted);
}

/* 通用 textarea */
.textarea {
  width: 100%; padding: 6px 8px; font-size: 11px; font-family: 'Consolas', monospace;
  background: var(--input-bg); border: 1px solid var(--input-border);
  color: var(--text-primary); resize: vertical; box-sizing: border-box;
}
.textarea:focus { border-color: var(--accent); outline: none; }
.textarea::placeholder { color: var(--text-muted); }

/* 自定义 CSS textarea */
.css-textarea {
  min-height: 160px; height: 160px; font-family: 'Consolas', 'Courier New', monospace;
  font-size: 11px; line-height: 1.5; tab-size: 2;
}

/* 致谢 */
.thanks-text {
  font-size: 11px; color: var(--text-secondary); line-height: 1.8; margin: 0;
}
</style>