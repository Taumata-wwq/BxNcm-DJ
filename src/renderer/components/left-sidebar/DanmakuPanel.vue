<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useDanmakuStore } from '../../stores/danmaku.store'
import { useSettingsStore } from '../../stores/settings.store'
import type { DanmakuMessage, EmoticonPackage, EmoticonItem, ViewerInfo } from '@shared/types/danmaku'

const danmakuStore = useDanmakuStore()
const settingsStore = useSettingsStore()

const sendText = ref('')
const sending = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
const sendInputRef = ref<HTMLElement | null>(null)
const smallEmoticonBarRef = ref<HTMLElement | null>(null)

// 表情相关
const showEmoticonPopup = ref(false)
const emoticonPackages = ref<EmoticonPackage[]>([])
const emoticonLoading = ref(false)
const emoticonError = ref('')
const emoticonPopupRef = ref<HTMLElement | null>(null)
const emoticonTabsRef = ref<HTMLElement | null>(null)
const activePackageId = ref<number>(0)

// ========== B站直播间文字表情（精确匹配 B站直播间 "全部表情" 面板，共 82 个） ==========
// 来源：B站直播间 Web 端 emoji-wrap 面板，与通用 B站emoji API 存在差异（如 [dog] vs [doge]）
const BILI_LIVE_EMOTICONS: { emoji: string; url: string }[] = [
  { emoji: '[dog]', url: 'http://i0.hdslb.com/bfs/live/4428c84e694fbf4e0ef6c06e958d9352c3582740.png' },
  { emoji: '[花]', url: 'http://i0.hdslb.com/bfs/live/7dd2ef03e13998575e4d8a803c6e12909f94e72b.png' },
  { emoji: '[妙]', url: 'http://i0.hdslb.com/bfs/live/08f735d950a0fba267dda140673c9ab2edf6410d.png' },
  { emoji: '[哇]', url: 'http://i0.hdslb.com/bfs/live/650c3e22c06edcbca9756365754d38952fc019c3.png' },
  { emoji: '[爱]', url: 'http://i0.hdslb.com/bfs/live/1daaa5d284dafaa16c51409447da851ff1ec557f.png' },
  { emoji: '[手机]', url: 'http://i0.hdslb.com/bfs/live/b159f90431148a973824f596288e7ad6a8db014b.png' },
  { emoji: '[撇嘴]', url: 'http://i0.hdslb.com/bfs/live/4255ce6ed5d15b60311728a803d03dd9a24366b2.png' },
  { emoji: '[委屈]', url: 'http://i0.hdslb.com/bfs/live/69312e99a00d1db2de34ef2db9220c5686643a3f.png' },
  { emoji: '[抓狂]', url: 'http://i0.hdslb.com/bfs/live/a7feb260bb5b15f97d7119b444fc698e82516b9f.png' },
  { emoji: '[比心]', url: 'http://i0.hdslb.com/bfs/live/4e029593562283f00d39b99e0557878c4199c71d.png' },
  { emoji: '[赞]', url: 'http://i0.hdslb.com/bfs/live/2dd666d3651bafe8683acf770b7f4163a5f49809.png' },
  { emoji: '[滑稽]', url: 'http://i0.hdslb.com/bfs/live/8624fd172037573c8600b2597e3731ef0e5ea983.png' },
  { emoji: '[吃瓜]', url: 'http://i0.hdslb.com/bfs/live/ffb53c252b085d042173379ac724694ce3196194.png' },
  { emoji: '[笑哭]', url: 'http://i0.hdslb.com/bfs/live/c5436c6806c32b28d471bb23d42f0f8f164a187a.png' },
  { emoji: '[捂脸]', url: 'http://i0.hdslb.com/bfs/live/e6073c6849f735ae6cb7af3a20ff7dcec962b4c5.png' },
  { emoji: '[喝彩]', url: 'http://i0.hdslb.com/bfs/live/b51824125d09923a4ca064f0c0b49fc97d3fab79.png' },
  { emoji: '[偷笑]', url: 'http://i0.hdslb.com/bfs/live/e2ba16f947a23179cdc00420b71cc1d627d8ae25.png' },
  { emoji: '[大笑]', url: 'http://i0.hdslb.com/bfs/live/e2589d086df0db8a7b5ca2b1273c02d31d4433d4.png' },
  { emoji: '[惊喜]', url: 'http://i0.hdslb.com/bfs/live/9c75761c5b6e1ff59b29577deb8e6ad996b86bd7.png' },
  { emoji: '[傲娇]', url: 'http://i0.hdslb.com/bfs/live/b5b44f099059a1bafb2c2722cfe9a6f62c1dc531.png' },
  { emoji: '[疼]', url: 'http://i0.hdslb.com/bfs/live/492b10d03545b7863919033db7d1ae3ef342df2f.png' },
  { emoji: '[吓]', url: 'http://i0.hdslb.com/bfs/live/c6bed64ffb78c97c93a83fbd22f6fdf951400f31.png' },
  { emoji: '[阴险]', url: 'http://i0.hdslb.com/bfs/live/a4df45c035b0ca0c58f162b5fb5058cf273d0d09.png' },
  { emoji: '[惊讶]', url: 'http://i0.hdslb.com/bfs/live/bc26f29f62340091737c82109b8b91f32e6675ad.png' },
  { emoji: '[生病]', url: 'http://i0.hdslb.com/bfs/live/84c92239591e5ece0f986c75a39050a5c61c803c.png' },
  { emoji: '[嘘]', url: 'http://i0.hdslb.com/bfs/live/b6226219384befa5da1d437cb2ff4ba06c303844.png' },
  { emoji: '[奸笑]', url: 'http://i0.hdslb.com/bfs/live/5935e6a4103d024955f749d428311f39e120a58a.png' },
  { emoji: '[囧]', url: 'http://i0.hdslb.com/bfs/live/204413d3cf330e122230dcc99d29056f2a60e6f2.png' },
  { emoji: '[捂脸2]', url: 'http://i0.hdslb.com/bfs/live/a2ad0cc7e390a303f6d243821479452d31902a5f.png' },
  { emoji: '[出窍]', url: 'http://i0.hdslb.com/bfs/live/bb8e95fa54512ffea07023ea4f2abee4a163e7a0.png' },
  { emoji: '[吐了啊]', url: 'http://i0.hdslb.com/bfs/live/2b6b4cc33be42c3257dc1f6ef3a39d666b6b4b1a.png' },
  { emoji: '[鼻子]', url: 'http://i0.hdslb.com/bfs/live/f4ed20a70d0cb85a22c0c59c628aedfe30566b37.png' },
  { emoji: '[调皮]', url: 'http://i0.hdslb.com/bfs/live/84fe12ecde5d3875e1090d83ac9027cb7d7fba9f.png' },
  { emoji: '[酸]', url: 'http://i0.hdslb.com/bfs/live/98fd92c6115b0d305f544b209c78ec322e4bb4ff.png' },
  { emoji: '[冷]', url: 'http://i0.hdslb.com/bfs/live/b804118a1bdb8f3bec67d9b108d5ade6e3aa93a9.png' },
  { emoji: '[OK]', url: 'http://i0.hdslb.com/bfs/live/86268b09e35fbe4215815a28ef3cf25ec71c124f.png' },
  { emoji: '[微笑]', url: 'http://i0.hdslb.com/bfs/live/f605dd8229fa0115e57d2f16cb019da28545452b.png' },
  { emoji: '[藏狐]', url: 'http://i0.hdslb.com/bfs/live/05ef7849e7313e9c32887df922613a7c1ad27f12.png' },
  { emoji: '[龇牙]', url: 'http://i0.hdslb.com/bfs/live/8b99266ea7b9e86cf9d25c3d1151d80c5ba5c9a1.png' },
  { emoji: '[防护]', url: 'http://i0.hdslb.com/bfs/live/17435e60dcc28ce306762103a2a646046ff10b0a.png' },
  { emoji: '[笑]', url: 'http://i0.hdslb.com/bfs/live/a91a27f83c38b5576f4cd08d4e11a2880de78918.png' },
  { emoji: '[一般]', url: 'http://i0.hdslb.com/bfs/live/8d436de0c3701d87e4ca9c1be01c01b199ac198e.png' },
  { emoji: '[嫌弃]', url: 'http://i0.hdslb.com/bfs/live/c409425ba1ad2c6534f0df7de350ba83a9c949e5.png' },
  { emoji: '[无语]', url: 'http://i0.hdslb.com/bfs/live/4781a77be9c8f0d4658274eb4e3012c47a159f23.png' },
  { emoji: '[哈欠]', url: 'http://i0.hdslb.com/bfs/live/6e496946725cd66e7ff1b53021bf1cc0fc240288.png' },
  { emoji: '[可怜]', url: 'http://i0.hdslb.com/bfs/live/8e88e6a137463703e96d4f27629f878efa323456.png' },
  { emoji: '[歪嘴笑]', url: 'http://i0.hdslb.com/bfs/live/bea1f0497888f3e9056d3ce14ba452885a485c02.png' },
  { emoji: '[亲亲]', url: 'http://i0.hdslb.com/bfs/live/10662d9c0d6ddb3203ecf50e77788b959d4d1928.png' },
  { emoji: '[问号]', url: 'http://i0.hdslb.com/bfs/live/a0c456b6d9e3187399327828a9783901323bfdb5.png' },
  { emoji: '[波吉]', url: 'http://i0.hdslb.com/bfs/live/57dee478868ed9f1ce3cf25a36bc50bde489c404.png' },
  { emoji: '[OH]', url: 'http://i0.hdslb.com/bfs/live/0d5123cddf389302df6f605087189fd10919dc3c.png' },
  { emoji: '[再见]', url: 'http://i0.hdslb.com/bfs/live/f408e2af700adcc2baeca15510ef620bed8d4c43.png' },
  { emoji: '[白眼]', url: 'http://i0.hdslb.com/bfs/live/7fa907ae85fa6327a0466e123aee1ac32d7c85f7.png' },
  { emoji: '[鼓掌]', url: 'http://i0.hdslb.com/bfs/live/d581d0bc30c8f9712b46ec02303579840c72c42d.png' },
  { emoji: '[大哭]', url: 'http://i0.hdslb.com/bfs/live/816402551e6ce30d08b37a917f76dea8851fe529.png' },
  { emoji: '[呆]', url: 'http://i0.hdslb.com/bfs/live/179c7e2d232cd74f30b672e12fc728f8f62be9ec.png' },
  { emoji: '[流汗]', url: 'http://i0.hdslb.com/bfs/live/b00e2e02904096377061ec5f93bf0dd3321f1964.png' },
  { emoji: '[生气]', url: 'http://i0.hdslb.com/bfs/live/2c69dad2e5c0f72f01b92746bc9d148aee1993b2.png' },
  { emoji: '[加油]', url: 'http://i0.hdslb.com/bfs/live/fbc3c8bc4152a65bbf4a9fd5a5d27710fbff2119.png' },
  { emoji: '[害羞]', url: 'http://i0.hdslb.com/bfs/live/d8ce9b05c0e40cec61a15ba1979c8517edd270bf.png' },
  { emoji: '[虎年]', url: 'http://i0.hdslb.com/bfs/live/a51af0d7d9e60ce24f139c468a3853f9ba9bb184.png' },
  { emoji: '[doge2]', url: 'http://i0.hdslb.com/bfs/live/f547cc853cf43e70f1e39095d9b3b5ac1bf70a8d.png' },
  { emoji: '[金钱豹]', url: 'http://i0.hdslb.com/bfs/live/b6e8131897a9a718ee280f2510bfa92f1d84429b.png' },
  { emoji: '[瓜子]', url: 'http://i0.hdslb.com/bfs/live/fd35718ac5a278fd05fe5287ebd41de40a59259d.png' },
  { emoji: '[墨镜]', url: 'http://i0.hdslb.com/bfs/live/5e01c237642c8b662a69e21b8e0fbe6e7dbc2aa1.png' },
  { emoji: '[难过]', url: 'http://i0.hdslb.com/bfs/live/5776481e380648c0fb3d4ad6173475f69f1ce149.png' },
  { emoji: '[抱抱]', url: 'http://i0.hdslb.com/bfs/live/abddb0b621b389fc8c2322b1cfcf122d8936ba91.png' },
  { emoji: '[跪了]', url: 'http://i0.hdslb.com/bfs/live/4f2155b108047d60c1fa9dccdc4d7abba18379a0.png' },
  { emoji: '[摊手]', url: 'http://i0.hdslb.com/bfs/live/1e0a2baf088a34d56e2cc226b2de36a5f8d6c926.png' },
  { emoji: '[热]', url: 'http://i0.hdslb.com/bfs/live/6df760280b17a6cbac8c1874d357298f982ba4cf.png' },
  { emoji: '[三星堆]', url: 'http://i0.hdslb.com/bfs/live/0a1ab3f0f2f2e29de35c702ac1ecfec7f90e325d.png' },
  { emoji: '[鼠]', url: 'http://i0.hdslb.com/bfs/live/98f842994035505c728e32e32045d649e371ecd6.png' },
  { emoji: '[汤圆]', url: 'http://i0.hdslb.com/bfs/live/23ae12d3a71b9d7a22c8773343969fcbb94b20d0.png' },
  { emoji: '[泼水]', url: 'http://i0.hdslb.com/bfs/live/29533893115c4609a4af336f49060ea13173ca78.png' },
  { emoji: '[鬼魂]', url: 'http://i0.hdslb.com/bfs/live/5d86d55ba9a2f99856b523d8311cf75cfdcccdbc.png' },
  { emoji: '[不行]', url: 'http://i0.hdslb.com/bfs/live/607f74ccf5eec7d2b17d91b9bb36be61a5dd196b.png' },
  { emoji: '[响指]', url: 'http://i0.hdslb.com/bfs/live/3b2fedf09b0ac79679b5a47f5eb3e8a38e702387.png' },
  { emoji: '[牛]', url: 'http://i0.hdslb.com/bfs/live/5e61223561203c50340b4c9b41ba7e4b05e48ae2.png' },
  { emoji: '[保佑]', url: 'http://i0.hdslb.com/bfs/live/241b13adb4933e38b7ea6f5204e0648725e76fbf.png' },
  { emoji: '[抱拳]', url: 'http://i0.hdslb.com/bfs/live/3f170894dd08827ee293afcb5a3d2b60aecdb5b1.png' },
  { emoji: '[给力]', url: 'http://i0.hdslb.com/bfs/live/d1ba5f4c54332a21ed2ca0dcecaedd2add587839.png' },
  { emoji: '[耶]', url: 'http://i0.hdslb.com/bfs/live/eb2d84ba623e2335a48f73fb5bef87bcf53c1239.png' },
]

// 转为 EmoticonItem 用于小表情栏和 Trie
const biliLiveEmoticonItems: EmoticonItem[] = BILI_LIVE_EMOTICONS.map((e, i) => ({
  emoticon_id: -100 - i,
  emoticon_unique: e.emoji,
  emoji: e.emoji,
  descript: e.emoji,
  url: e.url,
  width: 32,
  height: 32,
  is_dynamic: 0,
  perm: 1,
  emote_size: 1,
}))

// ========== 表情字典 Trie（用于弹幕文本中的 [表情] → 图片转换） ==========
interface EmoticonEntry { keyword: string; url: string }
interface TrieNode { children: Map<string, TrieNode>; value: EmoticonEntry | null }
function makeTrieNode(): TrieNode { return { children: new Map(), value: null } }

class EmoticonTrie {
  private root: TrieNode = makeTrieNode()

  set(keyword: string, url: string) {
    let node = this.root
    for (const ch of keyword) {
      let next = node.children.get(ch)
      if (!next) { next = makeTrieNode(); node.children.set(ch, next) }
      node = next
    }
    node.value = { keyword, url }
  }

  /** 从 str[startPos] 开始做最短匹配，返回匹配到的表情或 null */
  lazyMatch(str: string, startPos: number): EmoticonEntry | null {
    let node = this.root
    for (let i = startPos; i < str.length; i++) {
      const next = node.children.get(str[i])
      if (!next) return null
      if (next.value) return next.value
      node = next
    }
    return null
  }
}

// 小表情（仅使用直播间面板82个表情，不合并 API 表情）
const smallEmoticons = computed<EmoticonItem[]>(() => {
  return [...biliLiveEmoticonItems]
})

/** 从直播间82个表情构建 Trie（仅用于弹幕文本中的 [表情] → 图片转换） */
const emoticonTrie = computed(() => {
  const trie = new EmoticonTrie()
  for (const emo of biliLiveEmoticonItems) {
    if (emo.emoji && emo.url) {
      trie.set(emo.emoji, emo.url)
    }
  }
  return trie
})

// 表情按钮随机封面（启动时从已加载表情包中随机选取一个有封面的包）
const emojiBtnCover = ref<string>('')
function pickRandomCover() {
  const covers = emoticonPackages.value
    .map(p => p.pkg_url)
    .filter(url => url && url.length > 0)
  if (covers.length > 0) {
    emojiBtnCover.value = covers[Math.floor(Math.random() * covers.length)] ?? ''
  }
}

// 表情包缓存 key
const EMOTICON_CACHE_KEY = 'bili_emoticon_cache_v2'

/** 从 localStorage 读取缓存 */
function loadCache(): EmoticonPackage[] | null {
  try {
    const raw = localStorage.getItem(EMOTICON_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as EmoticonPackage[]
  } catch { return null }
}

/** 写入 localStorage 缓存 */
function saveCache(packages: EmoticonPackage[]) {
  try {
    localStorage.setItem(EMOTICON_CACHE_KEY, JSON.stringify(packages))
  } catch { /* ignore quota errors */ }
}

/** 计算缓存指纹（包 ID + mtime，用于变更检测） */
function cacheFingerprint(packages: EmoticonPackage[]): string {
  return packages
    .map(p => `${p.pkg_id}:${p.pkg_mtime || 0}:${p.pkg_url || ''}`)
    .sort()
    .join('|')
}

type DisplayPart = { type: 'text'; text: string } | { type: 'image'; url: string; text: string; standalone?: boolean }

// ========== 消息折叠：连续重复消息合并为一条，标记 repeat 次数 ==========
/** 生成消息指纹（用于判断两条消息是否相同） */
function msgFingerprint(msg: DanmakuMessage): string {
  switch (msg.type) {
    case 'danmaku':   return `${msg.type}|${msg.uid}|${msg.text || ''}`
    case 'gift':      return `${msg.type}|${msg.uid}|${msg.gift_name || ''}`
    case 'combo_gift': return `${msg.type}|${msg.uid}|${msg.gift_name || ''}`
    case 'super_chat':  return `${msg.type}|${msg.uid}|${msg.text || ''}|${msg.price || 0}`
    default:          return `${msg.type}|${msg.uid}|${msg.text || ''}`
  }
}

/** 折叠后的消息列表：连续相同消息合并，通过 repeat 字段标记次数 */
const foldedMessages = computed<DanmakuMessage[]>(() => {
  const raw = danmakuStore.messages
  if (raw.length === 0) return []
  const result: DanmakuMessage[] = []
  for (const msg of raw) {
    const last = result[result.length - 1]
    if (last && msgFingerprint(last) === msgFingerprint(msg)) {
      // 折叠到前一条
      last.repeat = (last.repeat || 1) + 1
    } else {
      result.push({ ...msg, repeat: 1 })
    }
  }
  return result
})

// 自动加载表情包（连接成功后自动获取）
watch(
  () => danmakuStore.status.connected,
  (connected) => {
    if (connected && !emoticonLoading.value) {
      loadEmoticons()
    }
  },
)

// 监听观众加入事件
const viewerContainerRef = ref<HTMLElement | null>(null)

// —— 粉丝数实时监控 ——
const followerCount = ref(-1)
const prevFollowerCount = ref(-1)
const followerColorClass = ref('')
let followerTimer: ReturnType<typeof setInterval> | null = null
let anchorUid = 0

function formatFollowerCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return n.toLocaleString()
}

async function fetchFollowerCount() {
  if (!danmakuStore.status.connected) return
  // 首次需要获取主播UID（通过房间号查询）
  if (anchorUid === 0) {
    try {
      const roomInfo = await window.electronAPI.liveGetRoomInfoByRoom(danmakuStore.status.roomId)
      if (roomInfo?.uid) {
        anchorUid = roomInfo.uid
      }
    } catch { /* 继续等待下次轮询 */ }
    if (anchorUid === 0) return
  }

  try {
    const result = await window.electronAPI.liveGetFollowerCount(anchorUid)
    if (result?.code === 0 && result?.follower >= 0) {
      prevFollowerCount.value = followerCount.value >= 0 ? followerCount.value : result.follower
      followerCount.value = result.follower
      // 颜色变化标记（动画持续 2s 后恢复）
      if (prevFollowerCount.value >= 0) {
        if (followerCount.value > prevFollowerCount.value) {
          followerColorClass.value = 'dm-follower-up'
        } else if (followerCount.value < prevFollowerCount.value) {
          followerColorClass.value = 'dm-follower-down'
        }
        if (followerColorClass.value) {
          setTimeout(() => { followerColorClass.value = '' }, 2000)
        }
      }
    }
  } catch { /* 忽略网络错误 */ }
}

function startFollowerPolling() {
  stopFollowerPolling()
  followerCount.value = -1
  prevFollowerCount.value = -1
  anchorUid = 0
  followerColorClass.value = ''
  fetchFollowerCount()
  followerTimer = setInterval(fetchFollowerCount, 5000)
}

function stopFollowerPolling() {
  if (followerTimer) {
    clearInterval(followerTimer)
    followerTimer = null
  }
}

// 连接/断开时控制轮询
watch(
  () => danmakuStore.status.connected,
  (connected) => {
    if (connected) {
      startFollowerPolling()
    } else {
      stopFollowerPolling()
      followerCount.value = -1
    }
  },
)

onMounted(() => {
  document.addEventListener('click', onDocumentClick)

  try {
    window.electronAPI.onDanmakuViewerJoin((data) => {
      const viewer = data as ViewerInfo
      if (viewer && viewer.uid && viewer.uname) {
        danmakuStore.addViewer(viewer)
      }
    })
  } catch (e) {
    // 非 Electron 环境（开发模式）忽略
  }
})

// 自动滚动到底部
watch(
  () => danmakuStore.messages.length,
  () => {
    nextTick(() => {
      const el = messagesContainer.value
      if (el) el.scrollTop = el.scrollHeight
    })
  },
)

// 点击表情弹窗外关闭
function onDocumentClick(e: MouseEvent) {
  if (showEmoticonPopup.value && emoticonPopupRef.value && !emoticonPopupRef.value.contains(e.target as Node)) {
    showEmoticonPopup.value = false
  }
}

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  stopFollowerPolling()
})

// 获取表情包（直播间表情 + 用户个人表情 + 全量表情兜底 + 缓存）
async function loadEmoticons() {
  if (!danmakuStore.status.connected || !danmakuStore.status.roomId) return
  emoticonLoading.value = true
  emoticonError.value = ''
  try {
    const packages: EmoticonPackage[] = []
    const seenEmoji = new Set<string>()

    const addEmoticons = (pkg: any): EmoticonItem[] => {
      const emotes = (pkg.emote || pkg.emoticons || []) as any[]
      return emotes.map((e: any) => {
        const emojiText = e.text || e.emoji || ''
        const emoticonUrl = e.url || ''
        const dedupKey = emojiText + '|' + emoticonUrl
        if (seenEmoji.has(dedupKey)) return null
        seenEmoji.add(dedupKey)
        return {
          emoticon_id: e.emoticon_id || e.id || 0,
          emoticon_unique: e.emoticon_unique || e.text || '',
          emoji: emojiText,
          descript: e.descript || e.text || emojiText,
          url: emoticonUrl,
          width: e.width || 60,
          height: e.height || 60,
          is_dynamic: e.is_dynamic || 0,
          perm: e.perm ?? 1,
          emote_size: e.meta?.size ?? 1,
        } as EmoticonItem
      }).filter(Boolean) as EmoticonItem[]
    }

    // 1. 获取直播间表情包
    const result = await window.electronAPI.getEmoticons(danmakuStore.status.roomId)
    if (result?.code === 0 && result?.data?.data) {
      const roomPackages = (result.data.data as any[]).map((pkg: any) => {
        const pkgUrl = pkg.pkg_url || pkg.url || pkg.cover || pkg.pkg_icon || pkg.icon || ''
        return {
          pkg_id: pkg.pkg_id,
          pkg_name: pkg.pkg_name,
          pkg_type: pkg.pkg_type,
          pkg_url: pkgUrl,
          pkg_mtime: pkg.mtime || 0,
          emoticons: addEmoticons(pkg),
        }
      })
      // 直播间"通用表情"包封面补丁（API 未返回该字段）
      for (const rp of roomPackages) {
        if (rp.pkg_name === '通用表情' && !rp.pkg_url) {
          rp.pkg_url = 'https://i0.hdslb.com/bfs/live/39b7667c2601e4da8019472f5e3df1f2278278b6.png'
        }
      }
      packages.push(...roomPackages)
    }

    // 2. 获取用户个人评论表情包
    const userResult = await window.electronAPI.getUserEmoticons()
    let biliEmojiPackage: EmoticonPackage | null = null

    if (userResult?.code === 0 && userResult?.packages?.length) {
      for (const pkg of userResult.packages) {
        const emotes = (pkg.emote || []) as any[]
        if (emotes.length === 0) continue

        if (pkg.id === 1) {
          const newEmotes = addEmoticons(pkg)
          const existingEmoji = new Set((biliEmojiPackage?.emoticons || []).map(e => e.emoji))
          const merged: EmoticonItem[] = [
            ...(biliEmojiPackage?.emoticons || []),
            ...newEmotes.filter(e => !existingEmoji.has(e.emoji)),
          ]
          biliEmojiPackage = {
            pkg_id: -1,
            pkg_name: 'B站emoji',
            pkg_type: 1,
            pkg_url: pkg.url || '',
            pkg_mtime: pkg.mtime || 0,
            emoticons: merged,
          }
          continue
        }

        if (pkg.id === 4) continue

        packages.push({
          pkg_id: pkg.id,
          pkg_name: pkg.text || `表情包${pkg.id}`,
          pkg_type: pkg.type,
          pkg_url: pkg.url || '',
          pkg_mtime: pkg.mtime || 0,
          emoticons: addEmoticons(pkg),
        })
      }
    }

    // 3. 获取全量表情包（兜底，补充 B站通用emoji 如 [dog] [花] 等）
    try {
      const allResult = await window.electronAPI.getAllEmoticons()
      if (allResult?.code === 0 && allResult?.packages?.length) {
        const addedPkgIds = new Set(packages.map(p => p.pkg_id))
        for (const pkg of allResult.packages) {
          const pkgId = pkg.id as number
          const emotes = (pkg.emote || []) as any[]
          if (emotes.length === 0) continue

          if (pkgId === 1) {
            const newEmotes = addEmoticons(pkg)
            const existingEmoji = new Set((biliEmojiPackage?.emoticons || []).map(e => e.emoji))
            const merged2: EmoticonItem[] = [
              ...(biliEmojiPackage?.emoticons || []),
              ...newEmotes.filter(e => !existingEmoji.has(e.emoji)),
            ]
            biliEmojiPackage = {
              pkg_id: -1,
              pkg_name: 'B站emoji',
              pkg_type: 1,
              pkg_url: pkg.url || biliEmojiPackage?.pkg_url || '',
              pkg_mtime: pkg.mtime || biliEmojiPackage?.pkg_mtime || 0,
              emoticons: merged2,
            }
            continue
          }

          if (pkgId === 4) continue
          if (addedPkgIds.has(pkgId)) continue

          packages.push({
            pkg_id: pkgId,
            pkg_name: pkg.text || `表情包${pkgId}`,
            pkg_type: pkg.type,
            pkg_url: pkg.url || '',
            pkg_mtime: pkg.mtime || 0,
            emoticons: addEmoticons(pkg),
          })
          addedPkgIds.add(pkgId)
        }
      }
    } catch { /* 全量表情API可能不可用，忽略 */ }

    if (biliEmojiPackage) {
      // B站通用emoji 包通常没有独立封面，使用第一个表情图片作为封面
      if (!biliEmojiPackage.pkg_url && biliEmojiPackage.emoticons.length > 0) {
        biliEmojiPackage.pkg_url = biliEmojiPackage.emoticons[0].url
      }
      packages.unshift(biliEmojiPackage)
    }

    // 缓存对比：如果指纹一致则跳过更新
    const newFingerprint = cacheFingerprint(packages)
    const cached = loadCache()
    const cachedFingerprint = cached ? cacheFingerprint(cached) : ''

    if (newFingerprint === cachedFingerprint && cached) {
      // 无变更，使用缓存（但刷新引用确保响应式）
      emoticonPackages.value = cached
      pickRandomCover()
    } else {
      emoticonPackages.value = packages
      saveCache(packages)
    }

    if (emoticonPackages.value.length > 0) {
      activePackageId.value = emoticonPackages.value[0].pkg_id
      pickRandomCover()
    } else {
      emoticonError.value = '暂无可用表情'
    }
  } catch (e: any) {
    // 网络失败时尝试加载缓存
    const cached = loadCache()
    if (cached && cached.length > 0) {
      emoticonPackages.value = cached
      activePackageId.value = cached[0].pkg_id
    } else {
      emoticonError.value = e.message || '获取表情包失败'
    }
  } finally {
    emoticonLoading.value = false
  }
}

// 切换表情弹窗
function toggleEmoticonPopup() {
  if (showEmoticonPopup.value) {
    showEmoticonPopup.value = false
  } else {
    if (emoticonPackages.value.length === 0 && !emoticonLoading.value) {
      loadEmoticons()
    }
    showEmoticonPopup.value = true
  }
}

// 当前激活的表情包
const activePackage = ref<EmoticonPackage | null>(null)
watch([activePackageId, emoticonPackages], () => {
  activePackage.value = emoticonPackages.value.find(p => p.pkg_id === activePackageId.value) || null
})

// ========== 水平平滑滚动工具：rAF 批量累积 deltaY，避免快速滚动卡顿 ==========
/** 创建一个平滑水平滚动的 wheel 事件处理器 */
function createSmoothWheelHandler(elRef: { value: HTMLElement | null }) {
  let pendingDelta = 0
  let rafId = 0

  return function onWheel(e: WheelEvent) {
    const el = elRef.value
    if (!el) return
    e.preventDefault()
    pendingDelta += e.deltaY
    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, el.scrollLeft + pendingDelta)
        pendingDelta = 0
        rafId = 0
      })
    }
  }
}

/** 判断是否为评论表情（emoticon_unique 以 [ 开头，如 "[孤独摇滚!剧场总集篇_思考]"） */
function isCommentEmoticon(emo: EmoticonItem): boolean {
  return emo.emoticon_unique.startsWith('[')
}

// 点击表情发送
async function sendEmoticon(emo: EmoticonItem) {
  if (sending.value) return
  if (!danmakuStore.status.connected) {
    danmakuStore.addLog('弹幕未连接，无法发送')
    return
  }

  sending.value = true
  showEmoticonPopup.value = false
  try {
    let result: any

    if (isCommentEmoticon(emo)) {
      const upowerMsg = `upower_${emo.emoji}`
      danmakuStore.addLog(`发送评论表情(upower格式): ${upowerMsg}`)
      result = await window.electronAPI.sendDanmaku(
        danmakuStore.status.roomId,
        upowerMsg,
        undefined,
        undefined,
        1,
      )
      if (result?.code !== 0) {
        danmakuStore.addLog(`upower 格式失败(code=${result?.code})，降级为文本发送: ${emo.emoji}`)
        result = await window.electronAPI.sendDanmaku(
          danmakuStore.status.roomId,
          emo.emoji,
        )
      }
    } else {
      result = await window.electronAPI.sendDanmaku(
        danmakuStore.status.roomId,
        emo.emoticon_unique,
        emo.emoticon_unique,
        emo.emoticon_id,
      )
    }

    if (result?.code === 0) {
      danmakuStore.addLog(`表情已发送: ${emo.descript || emo.emoji}`)
    } else {
      danmakuStore.addLog(`发送失败: ${result?.message || '未知错误'}`)
    }
  } catch (e: any) {
    danmakuStore.addLog(`发送失败: ${e.message || '未知错误'}`)
  } finally {
    sending.value = false
  }
}

/** 从 contenteditable div 提取纯文本（img 转为 data-emoji 值） */
function getInputText(): string {
  const el = sendInputRef.value
  if (!el) return ''
  let text = ''
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || ''
    } else if (node instanceof HTMLImageElement) {
      text += node.dataset.emoji || node.alt || ''
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // 递归处理 <br> 等
      text += (node as HTMLElement).textContent || ''
    }
  })
  return text
}

/** 点击小表情：将图片插入到输入框 */
function insertSmallEmoticon(emo: EmoticonItem) {
  const el = sendInputRef.value
  if (!el) return
  el.focus()
  const img = document.createElement('img')
  img.src = emo.url
  img.alt = emo.emoji
  img.dataset.emoji = emo.emoji
  img.className = 'dm-input-emoticon'
  img.referrerPolicy = 'no-referrer'
  // 内联样式强制 20×20px（scoped 样式无法命中动态创建的 DOM 节点）
  img.style.cssText = 'width:20px;height:20px;object-fit:contain;vertical-align:middle;display:inline;flex-shrink:0'
  // 插入到光标位置
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0)
    range.deleteContents()
    range.insertNode(img)
    // 光标移到图片后面
    range.setStartAfter(img)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  } else {
    el.appendChild(img)
  }
  // 更新纯文本
  sendText.value = getInputText()
  el.focus()
}

// 创建平滑滚轮处理器（rAF 批量累积，避免快速滚动卡顿）
const onTabsWheel = createSmoothWheelHandler(emoticonTabsRef)
const onSmallBarWheel = createSmoothWheelHandler(smallEmoticonBarRef)
const onViewerWheel = createSmoothWheelHandler(viewerContainerRef)

// 发送文本弹幕
async function sendMessage() {
  const text = getInputText().trim()
  if (!text || sending.value) return
  if (!danmakuStore.status.connected) {
    danmakuStore.addLog('弹幕未连接，无法发送')
    return
  }

  sending.value = true
  try {
    const result = await window.electronAPI.sendDanmaku(danmakuStore.status.roomId, text)
    if (result?.code === 0) {
      danmakuStore.addLog(`弹幕已发送: ${text}`)
      // 清空输入框
      if (sendInputRef.value) sendInputRef.value.innerHTML = ''
      sendText.value = ''
    } else {
      danmakuStore.addLog(`发送失败: ${result?.message || '未知错误'}`)
    }
  } catch (e: any) {
    danmakuStore.addLog(`发送失败: ${e.message || '未知错误'}`)
  } finally {
    sending.value = false
  }
}

// 回车发送（Shift+Enter 换行），方向键和空格阻止冒泡避免触发右侧播放器控制
function onSendKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.stopPropagation()
  }
}

// contenteditable 输入时更新 sendText（限制 40 字符）
function onContentInput() {
  const text = getInputText()
  if (text.length > 40) {
    // 截断 contenteditable 内容
    truncateContentEditable(40)
    sendText.value = getInputText()
  } else {
    sendText.value = text
  }
}

/** 截断 contenteditable 内容到指定字符数 */
function truncateContentEditable(maxChars: number) {
  const el = sendInputRef.value
  if (!el) return
  const text = getInputText()
  if (text.length <= maxChars) return
  // 保留表情图片，简单截断文本
  const truncated = text.slice(0, maxChars)
  el.innerHTML = ''
  for (const ch of truncated) {
    el.appendChild(document.createTextNode(ch))
  }
}

// 格式化时间戳
function formatTime(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour12: false })
}

// 消息类型标签
function getTypeLabel(msg: DanmakuMessage): string {
  switch (msg.type) {
    case 'danmaku': return ''
    case 'gift': return '礼物'
    case 'combo_gift': return '连击'
    case 'interact': return '互动'
    case 'guard': return '大航海'
    case 'super_chat': return 'SC'
    case 'like': return '点赞'
    case 'entry_effect': return '入场'
    default: return ''
  }
}

// 消息类型样式类
function getTypeClass(msg: DanmakuMessage): string {
  return `dm-type-${msg.type}`
}

// 格式化消息显示文本
function getDisplayText(msg: DanmakuMessage): string {
  switch (msg.type) {
    case 'danmaku': {
      const medal = msg.medal ? `[${msg.medal.name} ${msg.medal.level}] ` : ''
      if (msg.emoticonUrl) {
        return `${medal}${msg.uname}: `
      }
      return `${medal}${msg.uname}: ${msg.text || ''}`
    }
    case 'gift':
      return `${msg.uname} 送出 ${msg.gift_name || ''} x${msg.num || 1}`
    case 'combo_gift':
      return `${msg.uname} 连击 ${msg.gift_name || ''} x${msg.combo_num || 0}（共${msg.total_num || 0}）`
    case 'interact':
      return msg.text || `${msg.uname} 进入直播间`
    case 'guard':
      return msg.text || `${msg.uname} 开通 ${msg.guard_name || ''}`
    case 'super_chat':
      return `${msg.uname} SC ¥${msg.price || 0}: ${msg.text || ''}`
    case 'like':
      return msg.text || `${msg.uname} 点赞了`
    case 'entry_effect':
      return msg.text || ''
    default:
      return `${msg.uname}: ${msg.text || ''}`
  }
}

/** 获取弹幕纯文本部分（不含用户名前缀，用于复制） */
function getTextContent(msg: DanmakuMessage): string {
  if (msg.type === 'danmaku') return msg.text || ''
  if (msg.type === 'super_chat') return msg.text || ''
  return ''
}

/** 复制弹幕文本 */
async function copyDanmakuText(text: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

/** 将消息解析为展示部件（文本 + 表情图片） */
function getDisplayParts(msg: DanmakuMessage): DisplayPart[] {
  const parts: DisplayPart[] = []

  if (msg.type === 'danmaku') {
    const medal = msg.medal ? `[${msg.medal.name} ${msg.medal.level}] ` : ''
    const prefix = `${medal}${msg.uname}: `

    // 纯表情弹幕（dm_type==1）：显示表情图片
    if (msg.emoticonUrl) {
      parts.push({ type: 'text', text: prefix })
      parts.push({ type: 'image', url: msg.emoticonUrl, text: msg.text || '', standalone: true })
      return parts
    }

    // 普通文本弹幕：使用 Trie 解析 [文本] 表情为图片
    const text = msg.text || ''
    const trie = emoticonTrie.value
    const contentParts: DisplayPart[] = []
    let startPos = 0
    let pos = 0

    while (pos < text.length) {
      const match = trie.lazyMatch(text, pos)
      if (!match) {
        pos++
        continue
      }
      // 匹配前的纯文本
      if (pos !== startPos) {
        contentParts.push({ type: 'text', text: text.slice(startPos, pos) })
      }
      // 表情图片
      contentParts.push({ type: 'image', url: match.url, text: match.keyword })
      pos += match.keyword.length
      startPos = pos
    }
    // 尾部文本
    if (pos !== startPos) {
      contentParts.push({ type: 'text', text: text.slice(startPos, pos) })
    }

    if (contentParts.length === 0) {
      // 没有匹配到任何表情，全部当文本
      parts.push({ type: 'text', text: prefix + text })
    } else {
      parts.push({ type: 'text', text: prefix })
      parts.push(...contentParts)
    }
    return parts
  }

  // 其他类型消息：直接显示文本
  parts.push({ type: 'text', text: getDisplayText(msg) })
  return parts
}
</script>

<template>
  <div class="danmaku-panel">
    <!-- 状态栏 -->
    <div class="dm-header">
      <span class="dm-dot" :class="{ on: danmakuStore.status.connected }"></span>
      <span class="dm-status-text">
        {{ danmakuStore.status.connected ? `已连接` : '未连接' }}
      </span>
      <!-- 主播粉丝数（实时监控，5s轮询） -->
      <span
        v-if="danmakuStore.status.connected && followerCount >= 0"
        class="dm-follower-count"
        :class="followerColorClass"
        :title="'粉丝数: ' + followerCount.toLocaleString()"
      >粉丝 {{ formatFollowerCount(followerCount) }}</span>
    </div>

    <!-- 在线观众列表（常驻，仅头像） -->
    <div ref="viewerContainerRef" class="dm-viewer-list" @wheel="onViewerWheel">
      <template v-if="danmakuStore.viewers.length > 0">
        <span class="dm-viewer-count">观众 {{ danmakuStore.viewers.length }}</span>
        <span
          v-for="v in danmakuStore.viewers"
          :key="v.uid"
          class="dm-viewer-item"
          :title="v.uname"
        >
          <img
            v-if="v.avatarUrl"
            :src="v.avatarUrl"
            class="dm-viewer-avatar"
            loading="lazy"
            referrerpolicy="no-referrer"
          />
        </span>
      </template>
      <span v-else class="dm-viewer-empty">暂无观众数据</span>
    </div>

    <!-- 消息列表 -->
    <div ref="messagesContainer" class="dm-messages">
      <div v-if="foldedMessages.length === 0" class="dm-empty">
        {{ danmakuStore.status.connected ? '弹幕在这喵~' : '连接直播间后查看弹幕' }}
      </div>
      <div
        v-for="(msg, i) in foldedMessages"
        :key="i"
        class="dm-item"
        :class="getTypeClass(msg)"
      >
        <span v-if="settingsStore.settings.showDanmakuTime" class="dm-time">{{ formatTime(msg.timestamp) }}</span>
        <span v-if="getTypeLabel(msg)" class="dm-type-tag">{{ getTypeLabel(msg) }}</span>
        <!-- 头像（有avatarUrl时显示） -->
        <img
          v-if="msg.avatarUrl"
          :src="msg.avatarUrl"
          class="dm-avatar"
          loading="lazy"
          referrerpolicy="no-referrer"
        />
        <!-- 礼物图标 -->
        <img
          v-if="(msg.type === 'gift' || msg.type === 'combo_gift') && msg.gift_icon_url"
          :src="msg.gift_icon_url"
          class="dm-gift-icon"
          loading="lazy"
          referrerpolicy="no-referrer"
        />
        <span class="dm-text">
          <template v-for="(part, i) in getDisplayParts(msg)" :key="i">
            <span v-if="part.type === 'text'">{{ part.text }}</span>
            <img
              v-else-if="part.type === 'image'"
              :src="part.url"
              :alt="part.text"
              :title="part.text"
              :class="part.standalone ? 'dm-emoticon-standalone' : 'dm-emoticon'"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
          </template>
        </span>
        <!-- 重复次数标记 -->
        <span v-if="(msg.repeat || 1) > 1" class="dm-repeat-tag">x{{ msg.repeat }}</span>
        <!-- 复制按钮（仅弹幕和SC） -->
        <button
          v-if="msg.type === 'danmaku' || msg.type === 'super_chat'"
          class="dm-copy-btn"
          title="复制"
          @click="copyDanmakuText(getTextContent(msg))"
        >复制</button>
      </div>
    </div>

    <!-- 小表情栏（支持滚轮滚动） -->
    <div
      v-if="smallEmoticons.length > 0"
      ref="smallEmoticonBarRef"
      class="dm-small-emoticon-bar"
      @wheel="onSmallBarWheel"
    >
      <button
        v-for="emo in smallEmoticons"
        :key="emo.emoticon_id"
        class="dm-small-emoticon-item"
        :title="emo.descript || emo.emoji"
        @click="insertSmallEmoticon(emo)"
      >
        <img
          :src="emo.url"
          :alt="emo.emoji"
          class="dm-small-emoticon-img"
          loading="lazy"
          referrerpolicy="no-referrer"
        />
      </button>
    </div>

    <!-- 发送框 -->
    <div class="dm-send-row">
      <!-- 表情按钮 -->
      <button
        class="dm-emoji-btn"
        :class="{ active: showEmoticonPopup }"
        :disabled="!danmakuStore.status.connected"
        title="发送表情"
        @click.stop="toggleEmoticonPopup"
      >
        <img
          v-if="emojiBtnCover"
          :src="emojiBtnCover"
          class="dm-emoji-btn-cover"
          loading="lazy"
          referrerpolicy="no-referrer"
        />
        <span v-else>😊</span>
      </button>
      <div
        ref="sendInputRef"
        class="dm-send-input"
        contenteditable="true"
        :data-placeholder="'biu~'"
        @keydown="onSendKeydown"
        @input="onContentInput"
      ></div>
      <button
        class="dm-send-btn"
        :disabled="!danmakuStore.status.connected || sending || !sendText.trim()"
        @click="sendMessage"
      >发送</button>
    </div>

    <!-- 表情弹窗 -->
    <div v-if="showEmoticonPopup" ref="emoticonPopupRef" class="dm-emoticon-popup">
      <!-- 加载中 -->
      <div v-if="emoticonLoading" class="dm-emoticon-loading">加载中...</div>
      <!-- 错误 -->
      <div v-else-if="emoticonError" class="dm-emoticon-error">{{ emoticonError }}</div>
      <!-- 表情包列表 -->
      <div v-else-if="emoticonPackages.length > 0" class="dm-emoticon-body">
        <!-- 表情网格 -->
        <div
          class="dm-emoticon-grid"
          :class="activePackage?.pkg_id === -1 ? 'dm-emoticon-grid--small' : 'dm-emoticon-grid--large'"
        >
          <button
            v-for="emo in activePackage?.emoticons || []"
            :key="emo.emoticon_unique"
            class="dm-emoticon-item"
            :title="emo.descript || emo.emoji"
            :disabled="emo.perm !== 1"
            @click="sendEmoticon(emo)"
          >
            <img
              :src="emo.url"
              :alt="emo.emoji"
              class="dm-emoticon-img"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
          </button>
        </div>
      </div>
      <!-- 空状态 -->
      <div v-else class="dm-emoticon-empty">暂无可用表情</div>
      <!-- 表情包切换栏（底部） -->
      <div
        v-if="emoticonPackages.length > 0"
        ref="emoticonTabsRef"
        class="dm-emoticon-tabs"
        @wheel="onTabsWheel"
      >
        <button
          v-for="pkg in emoticonPackages"
          :key="pkg.pkg_id"
          class="dm-emoticon-tab"
          :class="{ active: activePackageId === pkg.pkg_id }"
          @click="activePackageId = pkg.pkg_id"
        >
          <img
            v-if="pkg.pkg_url"
            :src="pkg.pkg_url"
            :alt="pkg.pkg_name"
            class="dm-emoticon-tab-cover"
            loading="lazy"
            referrerpolicy="no-referrer"
          />
          <span v-else class="dm-emoticon-tab-text">{{ pkg.pkg_name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.danmaku-panel {
  flex: 1; display: flex; flex-direction: column; overflow: hidden;
  position: relative;
}

/* 状态栏 */
.dm-header {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-bottom: 1px solid var(--border);
  font-size: 11px; color: var(--text-secondary);
  background: var(--bg-tertiary); flex-shrink: 0;
}
.dm-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); flex-shrink: 0; }
.dm-dot.on { background: #27ae60; }
.dm-status-text { flex: 1; min-width: 0; }

/* 粉丝数显示 */
.dm-follower-count {
  padding: 1px 5px; font-size: 10px; flex-shrink: 0;
  color: var(--text-secondary); cursor: default;
}
.dm-follower-up { color: #e74c3c !important; }
.dm-follower-down { color: #27ae60 !important; }

/* 消息列表 */
.dm-messages {
  flex: 1; overflow-y: auto; padding: 2px 0; min-height: 0;
}
.dm-empty {
  padding: 20px 10px; text-align: center; color: var(--text-muted); font-size: 12px;
}
.dm-item {
  padding: 3px 10px; font-size: 11px; line-height: 1.5; word-break: break-all;
  display: flex; align-items: center; gap: 4px;
}
.dm-item:nth-child(even) { background: var(--bg-secondary); }
.dm-item:hover { background: var(--bg-tertiary); }
.dm-time {
  flex-shrink: 0; font-size: 10px; color: var(--text-muted);
  min-width: 48px; font-family: monospace;
}
.dm-type-tag {
  flex-shrink: 0; font-size: 9px; padding: 0 4px; border-radius: 0;
  color: #fff; white-space: nowrap; line-height: 16px;
}
.dm-type-danmaku .dm-type-tag { display: none; }
.dm-type-gift .dm-type-tag { background: #e91e63; }
.dm-type-combo_gift .dm-type-tag { background: #ff5722; }
.dm-type-interact .dm-type-tag { background: #607d8b; }
.dm-type-guard .dm-type-tag { background: #ff9800; }
.dm-type-super_chat .dm-type-tag { background: #ffc107; color: #333; }
.dm-type-like .dm-type-tag { background: #9c27b0; }
.dm-type-entry_effect .dm-type-tag { background: #00bcd4; }
.dm-text { flex: 1; min-width: 0; color: var(--text-primary); }
/* 重复次数标记 */
.dm-repeat-tag {
  flex-shrink: 0; font-size: 10px; color: var(--text-muted);
  font-weight: 600; margin-left: 2px;
}
.dm-type-super_chat .dm-text { color: #ff9800; font-weight: 600; }
.dm-type-guard .dm-text { color: #ff9800; }
.dm-type-gift .dm-text, .dm-type-combo_gift .dm-text { color: #e91e63; }

/* 头像 */
.dm-avatar {
  width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
  object-fit: cover; border: 1px solid var(--border);
}
/* 礼物图标 */
.dm-gift-icon {
  width: 18px; height: 18px; border-radius: 2px; flex-shrink: 0;
  object-fit: contain;
}
/* 文本弹幕内嵌 [文字] 表情 — 固定 20×20px */
.dm-emoticon {
  width: 20px; height: 20px; flex-shrink: 0;
  object-fit: contain; vertical-align: middle;
}
/* 纯表情弹幕（dm_type==1 独立表情）— 固定宽度 40px，高度自适应 */
.dm-emoticon-standalone {
  width: 40px; height: auto; flex-shrink: 0;
  object-fit: contain; vertical-align: middle;
}

/* 发送框 */
.dm-send-row {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 10px; border-top: 1px solid var(--border); flex-shrink: 0;
}
.dm-emoji-btn {
  width: 26px; height: 26px; padding: 0; font-size: 14px; line-height: 1;
  border: 1px solid var(--input-border); border-radius: 0;
  background: var(--input-bg); color: var(--text-secondary); cursor: pointer;
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  box-sizing: border-box; overflow: hidden;
}
.dm-emoji-btn-cover {
  width: 22px; height: 22px; object-fit: contain;
}
.dm-emoji-btn:hover { border-color: var(--accent); color: var(--accent); }
.dm-emoji-btn.active { border-color: var(--accent); background: var(--bg-tertiary); }
.dm-emoji-btn:disabled { opacity: 0.5; cursor: default; }
.dm-send-input {
  flex: 1; min-width: 0; min-height: 26px; max-height: 60px;
  padding: 2px 6px; font-size: 11px; line-height: 20px;
  background: var(--input-bg); border: 1px solid var(--input-border);
  color: var(--text-primary); outline: none; box-sizing: border-box;
  border-radius: 0; box-shadow: none; appearance: none; -webkit-appearance: none;
  overflow-y: auto; word-break: break-all; white-space: pre-wrap;
  display: flex; align-items: center; flex-wrap: wrap; gap: 1px;
}
.dm-send-input:focus { border-color: var(--accent); }
/* contenteditable 空状态 placeholder */
.dm-send-input:empty::before {
  content: attr(data-placeholder);
  color: var(--text-muted);
  pointer-events: none;
}
/* 输入框内的表情图片（强制20x20px，contenteditable 中需要 !important 覆盖浏览器默认） */
.dm-input-emoticon {
  width: 20px !important; height: 20px !important; object-fit: contain;
  vertical-align: middle; display: inline; flex-shrink: 0;
}
.dm-send-btn {
  padding: 4px 12px; font-size: 11px; border: none; border-radius: 0;
  background: var(--accent); color: var(--btn-primary-text); cursor: pointer;
  white-space: nowrap; flex-shrink: 0; height: 26px; box-sizing: border-box;
}
.dm-send-btn:hover { opacity: 0.85; }
.dm-send-btn:disabled { opacity: 0.5; cursor: default; }

/* 表情弹窗 */
.dm-emoticon-popup {
  position: absolute; bottom: 36px; left: 10px; right: 10px;
  max-height: 260px; background: var(--bg-primary); border: 1px solid var(--border);
  box-shadow: 0 -2px 8px rgba(0,0,0,0.15); z-index: 100;
  display: flex; flex-direction: column; overflow: hidden;
}
.dm-emoticon-loading, .dm-emoticon-error, .dm-emoticon-empty {
  padding: 20px; text-align: center; color: var(--text-muted); font-size: 11px;
}
.dm-emoticon-error { color: #e74c3c; }
.dm-emoticon-body { flex: 1; overflow: hidden; min-height: 0; display: flex; flex-direction: column; }

/* 表情网格：B站emoji（小表情）最大 32x32，其他表情最大 54x54 */
.dm-emoticon-grid {
  overflow-y: auto; padding: 2px; min-height: 0;
  display: grid; gap: 1px; align-content: flex-start;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.dm-emoticon-grid::-webkit-scrollbar { display: none; }

/* 小表情（B站emoji/大头表情）：最大 32x32，最少4列，auto-fill 自适应 */
.dm-emoticon-grid--small {
  grid-template-columns: repeat(auto-fill, minmax(min(26px, calc(16.7% - 1px)), 1fr));
  max-height: 180px;
}
.dm-emoticon-grid--small .dm-emoticon-item {
  max-width: 26px; max-height: 26px;
}
.dm-emoticon-grid--small .dm-emoticon-img {
  max-width: 30px; max-height: 30px;
}

/* 大表情：最大 54x54，最少4列，auto-fill 自适应 */
.dm-emoticon-grid--large {
  grid-template-columns: repeat(auto-fill, minmax(min(54px, calc(25% - 1px)), 1fr));
  max-height: 220px;
}
.dm-emoticon-grid--large .dm-emoticon-item {
  max-width: 54px; max-height: 54px;
}
.dm-emoticon-grid--large .dm-emoticon-img {
  max-width: 52px; max-height: 52px;
}

.dm-emoticon-item {
  aspect-ratio: 1; width: 100%; height: auto; padding: 1px;
  border: 1px solid transparent; border-radius: 0;
  background: none; cursor: pointer; display: flex;
  align-items: center; justify-content: center; box-sizing: border-box;
}
.dm-emoticon-item:hover { border-color: var(--accent); background: var(--bg-tertiary); }
.dm-emoticon-item:disabled { opacity: 0.3; cursor: default; }
.dm-emoticon-img {
  width: 100%; height: 100%; object-fit: contain;
}

/* 复制按钮（hover 时向左滑出） */
.dm-copy-btn {
  flex-shrink: 0; width: 0; height: 18px; padding: 0; font-size: 10px;
  font-weight: 700; line-height: 1; border: 1px solid var(--border);
  border-radius: 0; background: none; color: var(--text-muted); cursor: pointer;
  opacity: 0; overflow: hidden;
  transition: width 0.12s, opacity 0.12s, background 0.12s, color 0.12s;
  display: flex; align-items: center; justify-content: center;
}
.dm-item:hover .dm-copy-btn { width: 26px; opacity: 1; }
.dm-copy-btn:hover { color: var(--accent); border-color: var(--accent); }

/* 在线观众列表（仅头像） */
.dm-viewer-list {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-bottom: 1px solid var(--border);
  overflow-x: auto; flex-shrink: 0; white-space: nowrap;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.dm-viewer-list::-webkit-scrollbar { display: none; }
.dm-viewer-item {
  display: flex; align-items: center; flex-shrink: 0; cursor: default;
}
.dm-viewer-avatar {
  width: 18px; height: 18px; border-radius: 50%; object-fit: cover;
  border: 1px solid var(--border);
}
.dm-viewer-empty {
  font-size: 10px; color: var(--text-muted); padding: 2px 0;
}

/* 小表情栏（输入框上方） */
.dm-small-emoticon-bar {
  display: flex; align-items: center; gap: 2px;
  padding: 3px 10px; border-top: 1px solid var(--border);
  overflow-x: auto; flex-shrink: 0; white-space: nowrap;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.dm-small-emoticon-bar::-webkit-scrollbar { display: none; }
.dm-small-emoticon-item {
  width: 24px; height: 24px; padding: 0; flex-shrink: 0;
  border: 1px solid transparent; border-radius: 0;
  background: none; cursor: pointer; display: flex;
  align-items: center; justify-content: center;
}
.dm-small-emoticon-item:hover { border-color: var(--accent); background: var(--bg-tertiary); }
.dm-small-emoticon-img {
  width: 20px; height: 20px; object-fit: contain;
}

/* 表情包切换栏（底部） */
.dm-emoticon-tabs {
  display: flex; gap: 0; padding: 4px 6px; border-top: 1px solid var(--border);
  overflow-x: auto; flex-shrink: 0;
  /* 隐藏滚动条 */
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.dm-emoticon-tabs::-webkit-scrollbar { display: none; }
.dm-emoticon-tab {
  padding: 2px 6px; font-size: 10px; border: 1px solid var(--border);
  background: none; color: var(--text-secondary); cursor: pointer;
  white-space: nowrap; border-radius: 0; flex-shrink: 0;
  display: flex; align-items: center; gap: 3px; min-height: 24px;
}
.dm-emoticon-tab:not(:first-child) { border-left: none; }
.dm-emoticon-tab.active { background: var(--accent); color: var(--btn-primary-text); border-color: var(--accent); }
.dm-emoticon-tab:hover:not(.active) { background: var(--bg-tertiary); }
.dm-emoticon-tab-cover {
  width: 16px; height: 16px; object-fit: contain; border-radius: 2px;
}
.dm-emoticon-tab-text {
  font-size: 10px;
}
</style>

<!-- 动态创建的 DOM 节点不受 scoped 样式影响，这里提供全局后备 -->
<style>
.dm-input-emoticon {
  width: 20px !important; height: 20px !important; object-fit: contain;
  vertical-align: middle; display: inline; flex-shrink: 0;
}
</style>