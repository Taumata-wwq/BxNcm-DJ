<template>
  <yt-live-chat-renderer class="style-scope yt-live-chat-app" style="--scrollbar-width: 11px;" hide-timestamps
    @mousemove="refreshCantScrollStartTime"
    :style="computedDanmakuVariables"
  >
    <Ticker class="style-scope yt-live-chat-renderer" v-model:messages="paidMessages" :showGiftName="showGiftName"></Ticker>
    <yt-live-chat-item-list-renderer class="style-scope yt-live-chat-renderer" allow-scroll
      :reverse-scroll="settingsStore.settings.danmakuStyle.messageReverseScroll ? '' : undefined"
      :blc-animated="showAnimated ? '' : undefined"
    >
      <div ref="scroller" id="item-scroller" class="style-scope yt-live-chat-item-list-renderer animated" @scroll="onScroll">
        <div ref="itemOffset" id="item-offset" class="style-scope yt-live-chat-item-list-renderer">
          <div ref="items" id="items" class="style-scope yt-live-chat-item-list-renderer" style="overflow: hidden"
            :style="{ transform: `translateY(${Math.floor(scrollPixelsRemaining)}px)` }"
          >
            <template v-for="message in displayMessages" :key="message.id">
              <TextMessage v-if="message.type === MESSAGE_TYPE_TEXT"
                class="style-scope yt-live-chat-item-list-renderer"
                :time="message.time!"
                :avatarUrl="message.avatarUrl"
                :authorName="getShowAuthorName(message)"
                :authorType="message.authorType"
                :privilegeType="message.privilegeType"
                :contentParts="getShowContentParts(message)"
                :repeated="message.repeated"
              ></TextMessage>
              <PaidMessage v-else-if="message.type === MESSAGE_TYPE_GIFT"
                class="style-scope yt-live-chat-item-list-renderer"
                :time="message.time!"
                :avatarUrl="message.avatarUrl"
                :authorName="getShowAuthorName(message)"
                :price="message.price"
                :priceText="message.price <= 0 ? getGiftShowNameAndNum(message) : ''"
                :content="message.price <= 0 ? '' : getGiftShowContent(message)"
              ></PaidMessage>
              <MembershipItem v-else-if="message.type === MESSAGE_TYPE_MEMBER"
                class="style-scope yt-live-chat-item-list-renderer"
                :time="message.time!"
                :avatarUrl="message.avatarUrl"
                :authorName="getShowAuthorName(message)"
                :privilegeType="message.privilegeType"
                :title="message.title"
              ></MembershipItem>
              <PaidMessage v-else-if="message.type === MESSAGE_TYPE_SUPER_CHAT"
                class="style-scope yt-live-chat-item-list-renderer"
                :time="message.time!"
                :avatarUrl="message.avatarUrl"
                :authorName="getShowAuthorName(message)"
                :price="message.price"
                :priceText="''"
                :content="getShowContent(message)"
              ></PaidMessage>
            </template>
          </div>
        </div>
      </div>
    </yt-live-chat-item-list-renderer>
  </yt-live-chat-renderer>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue'
import {
  MESSAGE_TYPE_TEXT, MESSAGE_TYPE_GIFT, MESSAGE_TYPE_MEMBER, MESSAGE_TYPE_SUPER_CHAT,
  MESSAGE_TYPE_DEL, MESSAGE_TYPE_UPDATE, CONTENT_PART_TYPE_TEXT,
} from './constants'
import { useSettingsStore } from '../../stores/settings.store'

// 用来统计进队列时间间隔
const ENQUEUE_INTERVALS_MAX_TIME_RANGE = 3000
const ENQUEUE_INTERVALS_MAX_LENGTH = 10
// 要添加的消息类型
const ADD_MESSAGE_TYPES = [
  MESSAGE_TYPE_TEXT,
  MESSAGE_TYPE_GIFT,
  MESSAGE_TYPE_MEMBER,
  MESSAGE_TYPE_SUPER_CHAT,
]
// 发送消息时间间隔范围
const MESSAGE_MIN_INTERVAL = 80
const MESSAGE_MAX_INTERVAL = 1000

// 每次发送消息后增加的动画时间，要比 MESSAGE_MIN_INTERVAL 稍微大一点
// 84 = ceil((1000 / 60) * 5)
const CHAT_SMOOTH_ANIMATION_TIME_MS = 84
// 滚动条距离底部小于多少像素则认为在底部
const SCROLLED_TO_BOTTOM_EPSILON = 15

interface ContentPart {
  type: number
  text?: string
  url?: string
  width?: number
  height?: number
}

interface DisplayMessage {
  id: string
  type: number
  authorName: string
  authorType: number
  privilegeType: number
  avatarUrl: string
  content: string
  contentParts: ContentPart[]
  price: number
  priceText: string
  title: string
  repeated: number
  giftName?: string
  num?: number
  translation?: string
  isMirror?: boolean
  authorNamePronunciation?: string
  addTime?: Date
  time?: Date
}

const props = withDefaults(defineProps<{
  maxNumber?: number
  customCss?: string
  showGiftName?: boolean
}>(), {
  maxNumber: 200,
  customCss: '',
  showGiftName: true,
})

const settingsStore = useSettingsStore()

/** 是否启用动画 */
const showAnimated = computed(() => {
  return settingsStore.settings.danmakuStyle.animateIn || settingsStore.settings.danmakuStyle.animateOut
})

/** 将 danmakuStyle 配置转为 CSS 变量对象（对齐 blivechat-dev common.js getVariableStyle） */
const computedDanmakuVariables = computed<Record<string, string>>(() => {
  const s = settingsStore.settings.danmakuStyle
  const baseSize = `${s.globalScale}px`
  const fontBaseSize = `calc(${s.fontScale} * var(--base-size))`

  // 计算动画 CSS 变量（对齐 common.js getAnimationStyle）
  let animTotalTime = 0
  if (s.animateIn) animTotalTime += s.fadeInTime
  if (s.animateOut) {
    animTotalTime += s.animateOutWaitTime * 1000
    animTotalTime += s.fadeOutTime
  }
  let animStartOpacity = '1'
  let animStartTranslate = 'none'
  if (s.animateIn) {
    animStartOpacity = '0'
    animStartTranslate = s.slide ? `calc(${s.reverseSlide ? 16 : -16} * var(--base-size))` : 'none'
  }
  let animEndOpacity = '1'
  let animEndTranslate = 'none'
  if (s.animateOut) {
    animEndOpacity = '0'
    animEndTranslate = s.slide ? `calc(${s.reverseSlide ? -16 : 16} * var(--base-size))` : 'none'
  }

  // 描边（对齐 bilibili-tool generator.ts getOutlineStyle）
  let textShadow = 'none'
  if (s.showOutlines && s.outlineSize > 0) {
    if (s.blurryOutline) {
      textShadow = `0 0 ${s.outlineSize}px ${s.outlineColor}`
    } else {
      const shadows: string[] = []
      const step = Math.ceil(s.outlineSize / 4)
      for (let x = -s.outlineSize; x <= s.outlineSize; x += step) {
        for (let y = -s.outlineSize; y <= s.outlineSize; y += step) {
          shadows.push(`${x}px ${y}px ${s.outlineColor}`)
        }
      }
      textShadow = shadows.join(', ')
    }
  }

  return {
    '--base-size': baseSize,
    '--font-base-size': fontBaseSize,
    // 头像
    '--avatar-size': `calc(${s.avatarSize} * var(--base-size))`,
    '--avatar-display': s.showAvatars ? 'block' : 'none',
    // 用户名
    '--username-color': s.userNameColor,
    '--username-color-owner': s.ownerUserNameColor,
    '--username-color-moderator': s.moderatorUserNameColor,
    '--username-color-member': s.memberUserNameColor,
    '--username-size': `calc(${s.userNameFontSize} * var(--font-base-size))`,
    '--username-weight': String(s.userNameWeight),
    '--username-display': s.showUserNames ? 'inline' : 'none',
    '--username-font': s.userNameFont ? `${s.userNameFont}, var(--fallback-fonts)` : 'var(--fallback-fonts)',
    // 文本消息
    '--text-content-color': s.messageColor,
    '--text-content-size': `calc(${s.messageFontSize} * var(--font-base-size))`,
    '--text-content-weight': String(s.messageWeight),
    '--text-content-font': s.messageFont ? `${s.messageFont}, var(--fallback-fonts)` : 'inherit',
    // 表情
    '--emote-size': `calc(${s.emoticonSize} * var(--font-base-size))`,
    '--large-emote-size': `calc(${s.largeEmoticonSize} * var(--font-base-size))`,
    // 时间
    '--time-color': s.timeColor,
    '--time-size': `calc(${s.timeFontSize} * var(--font-base-size))`,
    '--time-weight': String(s.timeWeight),
    '--time-display': (s.showTime && settingsStore.settings.showDanmakuTime) ? 'inline' : 'none',
    '--time-font': s.timeFont ? `${s.timeFont}, var(--fallback-fonts)` : 'inherit',
    // 勋章（对齐 common.js getUserNameStyle）
    '--badges-display': s.showBadges ? 'inline' : 'none',
    // 付费消息（对齐 common.js getScAndNewMemberFontStyle）
    '--paid-msg-margin': '4px 0',
    '--paid-msg-line-1-size': `calc(${s.firstLineFontSize} * var(--font-base-size))`,
    '--paid-msg-line-1-weight': String(s.firstLineWeight),
    '--paid-msg-line-1-color': s.firstLineColor,
    '--paid-msg-line-1-font': s.firstLineFont ? `${s.firstLineFont}, var(--fallback-fonts)` : 'inherit',
    '--paid-msg-line-2-size': `calc(${s.secondLineFontSize} * var(--font-base-size))`,
    '--paid-msg-line-2-weight': String(s.secondLineWeight),
    '--paid-msg-line-2-color': s.secondLineColor,
    '--paid-msg-line-2-font': s.secondLineFont ? `${s.secondLineFont}, var(--fallback-fonts)` : 'inherit',
    '--paid-msg-content-size': `calc(${s.scContentFontSize} * var(--font-base-size))`,
    '--paid-msg-content-weight': String(s.scContentWeight),
    '--paid-msg-content-color': s.scContentColor,
    '--paid-msg-content-font': s.scContentFont ? `${s.scContentFont}, var(--fallback-fonts)` : 'inherit',
    // 显示/隐藏控制（对齐 common.js getScTickerStyle / getScAndNewMemberStyle）
    '--ticker-display': s.showScTicker ? 'block' : 'none',
    '--item-list-display': s.showOtherThings ? 'block' : 'none',
    // 描边（对齐 bilibili-tool generator.ts getOutlineStyle）
    '--outline-color': s.outlineColor,
    '--text-shadow': textShadow,
    // 冒号（对齐 bilibili-tool showColon）
    '--colon-display': s.showColon ? 'inline' : 'none',
    // 换行（对齐 bilibili-tool messageOnNewLine）
    '--message-newline-display': s.messageOnNewLine ? 'block' : 'inline',
    '--message-newline-valign': s.messageOnNewLine ? 'top' : 'baseline',
    // 背景色（对齐 bilibili-tool getBgStyleForAuthorType）
    '--danmaku-bg-color': s.bgColor,
    '--text-msg-bg-color': s.messageBgColor || 'transparent',
    '--text-msg-bg-color-owner': s.ownerMessageBgColor || 'transparent',
    '--text-msg-bg-color-moderator': s.moderatorMessageBgColor || 'transparent',
    '--text-msg-bg-color-member': s.memberMessageBgColor || 'transparent',
    // 上舰消息背景色（对齐 bilibili-tool getScAndNewMemberStyle）
    '--membership-msg-bg-color': `var(--username-color-member)`,
    // 装饰条模式（对齐 bilibili-tool getBgStyleForAuthorType useBars）
    '--bar-padding': s.useBarsInsteadOfBg ? '20px' : '4px',
    '--bar-content': s.useBarsInsteadOfBg ? "''" : 'none',
    '--bar-display': s.useBarsInsteadOfBg ? 'block' : 'none',
    // 装饰条模式下隐藏背景色
    ...(s.useBarsInsteadOfBg ? {
      '--bar-bg-override': 'transparent',
      '--bar-bg-override-owner': 'transparent',
      '--bar-bg-override-moderator': 'transparent',
      '--bar-bg-override-member': 'transparent',
    } : {}),
    // 动画（对齐 common.js getAnimationStyle）
    '--anim-opacity-start': animStartOpacity,
    '--anim-translate-start': animStartTranslate,
    '--anim-opacity-end': animEndOpacity,
    '--anim-translate-end': animEndTranslate,
    '--anim-duration': `${animTotalTime}ms`,
  }
})

const scroller = ref<HTMLElement | null>(null)
const itemOffset = ref<HTMLElement | null>(null)
const items = ref<HTMLElement | null>(null)

// 显示的消息
const displayMessages = ref<DisplayMessage[]>([])
// 顶部 Ticker 展示用的付费消息（礼物、SC、舰长），由 Ticker 双向同步
const paidMessages = ref<DisplayMessage[]>([])
// 平滑消息队列，由外部调用 addMessages 等方法添加
const smoothedMessageQueue = ref<DisplayMessage[][]>([])
const emitSmoothedMessageTimerId = ref<number | null>(null)
const enqueueIntervals = ref<number[]>([])
const lastEnqueueTime = ref<Date | null>(null)
const estimatedEnqueueInterval = ref<number | null>(null)
// 暂时未显示的消息，当不能自动滚动时会积压在这
const messagesBuffer = ref<DisplayMessage[]>([])
let preinsertHeight = 0
let isSmoothed = true
let chatRateMs = 1000
const scrollPixelsRemaining = ref(0)
const scrollTimeRemainingMs = ref(0)
let lastSmoothChatMessageAddMs: number | null = null
let smoothScrollRafHandle: number | null = null
let lastSmoothScrollUpdate: number | null = null
const atBottom = ref(true)
let cantScrollStartTime: Date | null = null

// ===== 辅助函数 =====
function getShowContentParts(message: DisplayMessage): ContentPart[] {
  let frontParts: ContentPart[] = []
  if (message.isMirror) {
    frontParts.push({ type: CONTENT_PART_TYPE_TEXT, text: '[Mirror]' })
  }
  let backParts: ContentPart[] = []
  if (message.translation) {
    backParts.push({ type: CONTENT_PART_TYPE_TEXT, text: `（${message.translation}）` })
  }
  return frontParts.concat(message.contentParts, backParts)
}

function getShowContent(message: DisplayMessage): string {
  if (message.translation) {
    return `${message.content}（${message.translation}）`
  }
  return message.content
}

function getGiftShowContent(message: DisplayMessage): string {
  return `赠送 ${message.giftName}x${message.num}`
}

function getGiftShowNameAndNum(message: DisplayMessage): string {
  return `${message.giftName}x${message.num}`
}

function getShowAuthorName(message: DisplayMessage): string {
  if (message.authorNamePronunciation && message.authorNamePronunciation !== message.authorName) {
    return `${message.authorName}(${message.authorNamePronunciation})`
  }
  return message.authorName
}

// ===== 消息队列系统 =====
function isAddMessage({ type }: { type: number }): boolean {
  return ADD_MESSAGE_TYPES.indexOf(type) !== -1
}

function enqueueMessages(messages: DisplayMessage[]) {
  // 估计进队列时间间隔
  if (!lastEnqueueTime.value) {
    lastEnqueueTime.value = new Date()
  } else {
    let curTime = new Date()
    let interval = curTime.getTime() - lastEnqueueTime.value.getTime()
    enqueueIntervals.value.push(interval)

    // 统计最近 ENQUEUE_INTERVALS_MAX_TIME_RANGE 内的间隔，最多 ENQUEUE_INTERVALS_MAX_LENGTH 个
    let keepFrom = enqueueIntervals.value.length - 1
    let minKeepFrom = Math.max(enqueueIntervals.value.length - ENQUEUE_INTERVALS_MAX_LENGTH, 0)
    let prevIdxPassedTime = 0
    for (; keepFrom > minKeepFrom; keepFrom--) {
      let itInterval = enqueueIntervals.value[keepFrom]
      prevIdxPassedTime += itInterval
      if (prevIdxPassedTime > ENQUEUE_INTERVALS_MAX_TIME_RANGE) {
        break
      }
    }
    if (keepFrom > 0) {
      enqueueIntervals.value.splice(0, keepFrom)
    }

    let maxEnqueueInterval = enqueueIntervals.value[0]
    for (let interval_ of enqueueIntervals.value) {
      if (interval_ > maxEnqueueInterval) {
        maxEnqueueInterval = interval_
      }
    }
    estimatedEnqueueInterval.value = maxEnqueueInterval
    lastEnqueueTime.value = curTime
  }

  // 把 messages 分成 messageGroup，每个组里最多有 1 个需要平滑的消息
  let messageGroup: DisplayMessage[] = []
  for (let message of messages) {
    messageGroup.push(message)
    if (isAddMessage(message)) {
      smoothedMessageQueue.value.push(messageGroup)
      messageGroup = []
    }
  }
  if (messageGroup.length > 0) {
    if (smoothedMessageQueue.value.length > 0) {
      let lastMessageGroup = smoothedMessageQueue.value[smoothedMessageQueue.value.length - 1]
      for (let message of messageGroup) {
        lastMessageGroup.push(message)
      }
    } else {
      smoothedMessageQueue.value.push(messageGroup)
    }
  }

  if (!emitSmoothedMessageTimerId.value) {
    emitSmoothedMessageTimerId.value = window.setTimeout(emitSmoothedMessages)
  }
}

function emitSmoothedMessages() {
  emitSmoothedMessageTimerId.value = null
  if (smoothedMessageQueue.value.length <= 0) {
    return
  }

  // 估计的下次进队列剩余时间
  let estimatedNextEnqueueRemainTime = 10 * 1000
  if (estimatedEnqueueInterval.value) {
    estimatedNextEnqueueRemainTime = Math.max(
      (lastEnqueueTime.value?.getTime() || Date.now()) - Date.now() + estimatedEnqueueInterval.value,
      1
    )
  }
  let shouldEmitGroupNum = Math.max(smoothedMessageQueue.value.length, 0)
  let maxCanEmitCount = estimatedNextEnqueueRemainTime / MESSAGE_MIN_INTERVAL
  let groupNumToEmit: number
  if (shouldEmitGroupNum < maxCanEmitCount) {
    groupNumToEmit = 1
  } else {
    groupNumToEmit = Math.ceil(shouldEmitGroupNum / maxCanEmitCount)
  }

  // 发消息
  let messageGroups = smoothedMessageQueue.value.splice(0, groupNumToEmit)
  let mergedGroup: DisplayMessage[] = []
  for (let messageGroup of messageGroups) {
    for (let message of messageGroup) {
      mergedGroup.push(message)
    }
  }
  handleMessageGroup(mergedGroup)

  if (smoothedMessageQueue.value.length <= 0) {
    return
  }

  let sleepTime: number
  if (groupNumToEmit === 1) {
    sleepTime = estimatedNextEnqueueRemainTime / smoothedMessageQueue.value.length
    sleepTime *= 0.5 + Math.random()
    if (sleepTime > MESSAGE_MAX_INTERVAL) {
      sleepTime = MESSAGE_MAX_INTERVAL
    } else if (sleepTime < MESSAGE_MIN_INTERVAL) {
      sleepTime = MESSAGE_MIN_INTERVAL
    }
  } else {
    sleepTime = MESSAGE_MIN_INTERVAL
  }
  emitSmoothedMessageTimerId.value = window.setTimeout(emitSmoothedMessages, sleepTime)
}

function handleMessageGroup(messageGroup: DisplayMessage[]) {
  if (messageGroup.length <= 0) return

  for (let message of messageGroup) {
    switch (message.type) {
      case MESSAGE_TYPE_TEXT:
      case MESSAGE_TYPE_GIFT:
      case MESSAGE_TYPE_MEMBER:
      case MESSAGE_TYPE_SUPER_CHAT:
        handleAddMessage(message)
        break
      case MESSAGE_TYPE_DEL:
        handleDelMessage(message)
        break
      case MESSAGE_TYPE_UPDATE:
        handleUpdateMessage(message as any)
        break
    }
  }

  maybeResizeScrollContainer()
  flushMessagesBuffer()
  nextTick(maybeScrollToBottom)
}

function handleAddMessage(message: DisplayMessage) {
  message.addTime = new Date()

  if (message.type !== MESSAGE_TYPE_TEXT) {
    paidMessages.value.unshift(structuredClone(message) as DisplayMessage)
    const MAX_PAID_MESSAGE_NUM = 100
    if (paidMessages.value.length > MAX_PAID_MESSAGE_NUM) {
      paidMessages.value.splice(MAX_PAID_MESSAGE_NUM, paidMessages.value.length - MAX_PAID_MESSAGE_NUM)
    }
  }

  messagesBuffer.value.push(message)
}

function handleDelMessage({ id }: { id: string }) {
  let arrs = [displayMessages.value, paidMessages.value, messagesBuffer.value]
  let needResetSmoothScroll = false
  for (let arr of arrs) {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].id !== id) continue
      arr.splice(i, 1)
      if (arr === displayMessages.value) {
        needResetSmoothScroll = true
      }
      break
    }
  }
  if (needResetSmoothScroll) {
    resetSmoothScroll()
  }
}

function handleUpdateMessage({ id, newValuesObj }: { id: string; newValuesObj: any }) {
  if (!newValuesObj) return
  let arrs = [displayMessages.value, paidMessages.value, messagesBuffer.value]
  let needResetSmoothScroll = false
  for (let arr of arrs) {
    for (let message of arr) {
      if (message.id !== id) continue
      doUpdateMessage(message as any, newValuesObj)
      if (arr === displayMessages.value) {
        needResetSmoothScroll = true
      }
      break
    }
  }
  if (needResetSmoothScroll) {
    resetSmoothScroll()
  }
}

function doUpdateMessage(message: any, newValuesObj: any) {
  // +=
  let addValuesObj = newValuesObj.$add
  if (addValuesObj !== undefined) {
    for (let name in addValuesObj) {
      message[name] += addValuesObj[name]
    }
  }
  // =
  for (let name in newValuesObj) {
    if (!name.startsWith('$')) {
      message[name] = newValuesObj[name]
    }
  }
}

// ===== 消息合并 =====
function mergeSimilarText(content: string): boolean {
  content = content.trim().toLowerCase()
  for (let message of iterRecentMessages(5)) {
    if (message.type !== MESSAGE_TYPE_TEXT) continue

    let messageContent = message.content.trim().toLowerCase()
    let longer: string, shorter: string
    if (messageContent.length > content.length) {
      longer = messageContent
      shorter = content
    } else {
      longer = content
      shorter = messageContent
    }

    if (
      longer.indexOf(shorter) !== -1
      && longer.length - shorter.length < shorter.length
    ) {
      handleUpdateMessage({
        id: message.id,
        newValuesObj: { $add: { repeated: 1 } }
      })
      return true
    }
  }
  return false
}

function mergeSimilarGift(authorName: string, price: number, giftName: string, num: number): boolean {
  for (let message of iterRecentMessages(5)) {
    if (
      message.type === MESSAGE_TYPE_GIFT
      && message.authorName === authorName
      && message.giftName === giftName
    ) {
      handleUpdateMessage({
        id: message.id,
        newValuesObj: {
          $add: { price, num }
        }
      })
      return true
    }
  }
  return false
}

// 从新到老迭代 num 条消息
function* iterRecentMessages(num: number, onlyCountAddMessages = true): Generator<DisplayMessage> {
  if (num <= 0) return
  for (let arr of iterMessageArrs()) {
    for (let i = arr.length - 1; i >= 0 && num > 0; i--) {
      let message = arr[i]
      yield message
      if (!onlyCountAddMessages || isAddMessage(message)) {
        num--
      }
    }
    if (num <= 0) break
  }
}

// 从新到老迭代消息数组
function* iterMessageArrs(): Generator<DisplayMessage[]> {
  for (let i = smoothedMessageQueue.value.length - 1; i >= 0; i--) {
    yield smoothedMessageQueue.value[i]
  }
  yield messagesBuffer.value
  yield displayMessages.value
}

// ===== 缓冲区管理 =====
function flushMessagesBuffer() {
  if (messagesBuffer.value.length <= 0) return
  if (!canScrollToBottomOrTimedOut()) {
    if (messagesBuffer.value.length > props.maxNumber) {
      messagesBuffer.value.splice(0, messagesBuffer.value.length - props.maxNumber)
    }
    return
  }

  let removeNum = Math.max(displayMessages.value.length + messagesBuffer.value.length - props.maxNumber, 0)
  if (removeNum > 0) {
    displayMessages.value.splice(0, removeNum)
  }

  if (items.value) {
    preinsertHeight = items.value.clientHeight
  }
  for (let message of messagesBuffer.value) {
    displayMessages.value.push(message)
  }
  messagesBuffer.value = []
  nextTick(showNewMessages)
}

// ===== 滚动动画 =====
function showNewMessages() {
  if (!scroller.value || !items.value || !itemOffset.value) return

  let hasScrollBar = items.value.clientHeight > scroller.value.clientHeight
  itemOffset.value.style.height = `${items.value.clientHeight}px`
  if (!canScrollToBottomOrTimedOut() || !hasScrollBar) {
    return
  }

  scrollPixelsRemaining.value += items.value.clientHeight - preinsertHeight
  scrollToBottom()

  if (!lastSmoothChatMessageAddMs) {
    lastSmoothChatMessageAddMs = performance.now()
  }
  let interval = performance.now() - lastSmoothChatMessageAddMs
  chatRateMs = (0.9 * chatRateMs) + (0.1 * interval)
  if (isSmoothed) {
    if (chatRateMs < 400) {
      isSmoothed = false
    }
  } else {
    if (chatRateMs > 450) {
      isSmoothed = true
    }
  }
  scrollTimeRemainingMs.value += isSmoothed ? CHAT_SMOOTH_ANIMATION_TIME_MS : 0

  if (!smoothScrollRafHandle) {
    smoothScrollRafHandle = window.requestAnimationFrame(smoothScroll)
  }
  lastSmoothChatMessageAddMs = performance.now()
}

function smoothScroll(time: number) {
  if (!lastSmoothScrollUpdate) {
    lastSmoothScrollUpdate = time
    smoothScrollRafHandle = window.requestAnimationFrame(smoothScroll)
    return
  }

  let interval = time - lastSmoothScrollUpdate
  if (
    scrollPixelsRemaining.value <= 0
    || scrollPixelsRemaining.value >= 400
    || interval >= 1000
    || scrollTimeRemainingMs.value <= 0
  ) {
    resetSmoothScroll()
    return
  }

  let pixelsToScroll = interval / scrollTimeRemainingMs.value * scrollPixelsRemaining.value
  scrollPixelsRemaining.value -= pixelsToScroll
  if (scrollPixelsRemaining.value < 0) {
    scrollPixelsRemaining.value = 0
  }
  scrollTimeRemainingMs.value -= interval
  if (scrollTimeRemainingMs.value < 0) {
    scrollTimeRemainingMs.value = 0
  }
  lastSmoothScrollUpdate = time
  smoothScrollRafHandle = window.requestAnimationFrame(smoothScroll)
}

function resetSmoothScroll() {
  scrollTimeRemainingMs.value = 0
  scrollPixelsRemaining.value = 0
  lastSmoothScrollUpdate = null
  if (smoothScrollRafHandle) {
    window.cancelAnimationFrame(smoothScrollRafHandle)
    smoothScrollRafHandle = null
  }
}

// ===== 滚动控制 =====
function maybeResizeScrollContainer() {
  if (!scroller.value || !items.value || !itemOffset.value) return
  itemOffset.value.style.height = `${items.value.clientHeight}px`
  itemOffset.value.style.minHeight = `${scroller.value.clientHeight}px`
  maybeScrollToBottom()
}

function maybeScrollToBottom() {
  if (canScrollToBottomOrTimedOut()) {
    scrollToBottom()
  }
}

function scrollToBottom() {
  if (scroller.value) {
    scroller.value.scrollTop = Math.pow(2, 24)  // 同 blivechat-dev
  }
  atBottom.value = true
}

function onScroll() {
  refreshCantScrollStartTime()
  if (!scroller.value) return
  let el = scroller.value
  atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLLED_TO_BOTTOM_EPSILON
  flushMessagesBuffer()
}

function canScrollToBottomOrTimedOut(): boolean {
  if (atBottom.value) return true
  if (cantScrollStartTime) {
    return Date.now() - cantScrollStartTime.getTime() >= 5000
  }
  return false
}

function refreshCantScrollStartTime() {
  if (cantScrollStartTime) {
    cantScrollStartTime = new Date()
  }
}

watch(atBottom, (val) => {
  cantScrollStartTime = val ? null : new Date()
})

// ===== 自定义 CSS 动态注入 =====
const CUSTOM_CSS_ID = 'danmaku-custom-css'

function injectCustomCss(css: string) {
  let el = document.getElementById(CUSTOM_CSS_ID) as HTMLStyleElement | null
  if (!css) {
    if (el) el.remove()
    return
  }
  if (!el) {
    el = document.createElement('style')
    el.id = CUSTOM_CSS_ID
    document.head.appendChild(el)
  }
  el.textContent = css
}

watch(() => props.customCss, (css) => {
  injectCustomCss(css || '')
}, { immediate: true })

// ===== 生命周期 =====
onMounted(() => {
  scrollToBottom()
  maybeResizeScrollContainer()
})

onUnmounted(() => {
  injectCustomCss('')
  if (emitSmoothedMessageTimerId.value) {
    window.clearTimeout(emitSmoothedMessageTimerId.value)
    emitSmoothedMessageTimerId.value = null
  }
  clearMessages()
})

// ===== 对外 API =====
function addMessage(msg: DisplayMessage) {
  addMessages([msg])
}

function addMessages(messages: DisplayMessage[]) {
  enqueueMessages(messages)
}

function clearMessages() {
  displayMessages.value = []
  paidMessages.value = []
  smoothedMessageQueue.value = []
  messagesBuffer.value = []
  isSmoothed = true
  lastSmoothChatMessageAddMs = null
  chatRateMs = 1000
  lastSmoothScrollUpdate = null
  scrollTimeRemainingMs.value = 0
  scrollPixelsRemaining.value = 0
  smoothScrollRafHandle = null
  preinsertHeight = 0
  maybeResizeScrollContainer()
  if (!atBottom.value) {
    scrollToBottom()
  }
}

defineExpose({
  addMessage,
  addMessages,
  clearMessages,
  mergeSimilarText,
  mergeSimilarGift,
})
</script>
