<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useDanmakuStore } from '../../stores/danmaku.store'
import { useSettingsStore } from '../../stores/settings.store'
import type { EmoticonPackage, EmoticonItem } from '@shared/types/danmaku'
import DanmakuIframe from '../chat/DanmakuIframe.vue'

const danmakuStore = useDanmakuStore()
const settingsStore = useSettingsStore()

const sendText = ref('')
const sending = ref(false)
const sendInputRef = ref<HTMLElement | null>(null)
const smallEmoticonBarRef = ref<HTMLElement | null>(null)

// 表情弹窗相关
const showEmoticonPopup = ref(false)
const emoticonPackages = ref<EmoticonPackage[]>([])
const emoticonLoading = ref(false)
const emoticonError = ref('')
const emoticonPopupRef = ref<HTMLElement | null>(null)
const emoticonTabsRef = ref<HTMLElement | null>(null)
const activePackageId = ref<number>(0)

// ========== B站直播间文字表情（硬编码 82 个） ==========
// 此数组与 public/danmaku-window.html 中的 BILI_LIVE_EMOTICONS 完全一致
const BILI_LIVE_EMOTICONS: { emoji: string; url: string }[] = [
  { emoji: '[dog]', url: 'https://i0.hdslb.com/bfs/live/4428c84e694fbf4e0ef6c06e958d9352c3582740.png' },
  { emoji: '[花]', url: 'https://i0.hdslb.com/bfs/live/7dd2ef03e13998575e4d8a803c6e12909f94e72b.png' },
  { emoji: '[妙]', url: 'https://i0.hdslb.com/bfs/live/08f735d950a0fba267dda140673c9ab2edf6410d.png' },
  { emoji: '[哇]', url: 'https://i0.hdslb.com/bfs/live/650c3e22c06edcbca9756365754d38952fc019c3.png' },
  { emoji: '[爱]', url: 'https://i0.hdslb.com/bfs/live/1daaa5d284dafaa16c51409447da851ff1ec557f.png' },
  { emoji: '[手机]', url: 'https://i0.hdslb.com/bfs/live/b159f90431148a973824f596288e7ad6a8db014b.png' },
  { emoji: '[撇嘴]', url: 'https://i0.hdslb.com/bfs/live/4255ce6ed5d15b60311728a803d03dd9a24366b2.png' },
  { emoji: '[委屈]', url: 'https://i0.hdslb.com/bfs/live/69312e99a00d1db2de34ef2db9220c5686643a3f.png' },
  { emoji: '[抓狂]', url: 'https://i0.hdslb.com/bfs/live/a7feb260bb5b15f97d7119b444fc698e82516b9f.png' },
  { emoji: '[比心]', url: 'https://i0.hdslb.com/bfs/live/4e029593562283f00d39b99e0557878c4199c71d.png' },
  { emoji: '[赞]', url: 'https://i0.hdslb.com/bfs/live/2dd666d3651bafe8683acf770b7f4163a5f49809.png' },
  { emoji: '[滑稽]', url: 'https://i0.hdslb.com/bfs/live/8624fd172037573c8600b2597e3731ef0e5ea983.png' },
  { emoji: '[吃瓜]', url: 'https://i0.hdslb.com/bfs/live/ffb53c252b085d042173379ac724694ce3196194.png' },
  { emoji: '[笑哭]', url: 'https://i0.hdslb.com/bfs/live/c5436c6806c32b28d471bb23d42f0f8f164a187a.png' },
  { emoji: '[捂脸]', url: 'https://i0.hdslb.com/bfs/live/e6073c6849f735ae6cb7af3a20ff7dcec962b4c5.png' },
  { emoji: '[喝彩]', url: 'https://i0.hdslb.com/bfs/live/b51824125d09923a4ca064f0c0b49fc97d3fab79.png' },
  { emoji: '[偷笑]', url: 'https://i0.hdslb.com/bfs/live/e2ba16f947a23179cdc00420b71cc1d627d8ae25.png' },
  { emoji: '[大笑]', url: 'https://i0.hdslb.com/bfs/live/e2589d086df0db8a7b5ca2b1273c02d31d4433d4.png' },
  { emoji: '[惊喜]', url: 'https://i0.hdslb.com/bfs/live/9c75761c5b6e1ff59b29577deb8e6ad996b86bd7.png' },
  { emoji: '[傲娇]', url: 'https://i0.hdslb.com/bfs/live/b5b44f099059a1bafb2c2722cfe9a6f62c1dc531.png' },
  { emoji: '[疼]', url: 'https://i0.hdslb.com/bfs/live/492b10d03545b7863919033db7d1ae3ef342df2f.png' },
  { emoji: '[吓]', url: 'https://i0.hdslb.com/bfs/live/c6bed64ffb78c97c93a83fbd22f6fdf951400f31.png' },
  { emoji: '[阴险]', url: 'https://i0.hdslb.com/bfs/live/a4df45c035b0ca0c58f162b5fb5058cf273d0d09.png' },
  { emoji: '[惊讶]', url: 'https://i0.hdslb.com/bfs/live/bc26f29f62340091737c82109b8b91f32e6675ad.png' },
  { emoji: '[生病]', url: 'https://i0.hdslb.com/bfs/live/84c92239591e5ece0f986c75a39050a5c61c803c.png' },
  { emoji: '[嘘]', url: 'https://i0.hdslb.com/bfs/live/b6226219384befa5da1d437cb2ff4ba06c303844.png' },
  { emoji: '[奸笑]', url: 'https://i0.hdslb.com/bfs/live/5935e6a4103d024955f749d428311f39e120a58a.png' },
  { emoji: '[囧]', url: 'https://i0.hdslb.com/bfs/live/204413d3cf330e122230dcc99d29056f2a60e6f2.png' },
  { emoji: '[捂脸2]', url: 'https://i0.hdslb.com/bfs/live/a2ad0cc7e390a303f6d243821479452d31902a5f.png' },
  { emoji: '[出窍]', url: 'https://i0.hdslb.com/bfs/live/bb8e95fa54512ffea07023ea4f2abee4a163e7a0.png' },
  { emoji: '[吐了啊]', url: 'https://i0.hdslb.com/bfs/live/2b6b4cc33be42c3257dc1f6ef3a39d666b6b4b1a.png' },
  { emoji: '[鼻子]', url: 'https://i0.hdslb.com/bfs/live/f4ed20a70d0cb85a22c0c59c628aedfe30566b37.png' },
  { emoji: '[调皮]', url: 'https://i0.hdslb.com/bfs/live/84fe12ecde5d3875e1090d83ac9027cb7d7fba9f.png' },
  { emoji: '[酸]', url: 'https://i0.hdslb.com/bfs/live/98fd92c6115b0d305f544b209c78ec322e4bb4ff.png' },
  { emoji: '[冷]', url: 'https://i0.hdslb.com/bfs/live/b804118a1bdb8f3bec67d9b108d5ade6e3aa93a9.png' },
  { emoji: '[OK]', url: 'https://i0.hdslb.com/bfs/live/86268b09e35fbe4215815a28ef3cf25ec71c124f.png' },
  { emoji: '[微笑]', url: 'https://i0.hdslb.com/bfs/live/f605dd8229fa0115e57d2f16cb019da28545452b.png' },
  { emoji: '[藏狐]', url: 'https://i0.hdslb.com/bfs/live/05ef7849e7313e9c32887df922613a7c1ad27f12.png' },
  { emoji: '[龇牙]', url: 'https://i0.hdslb.com/bfs/live/8b99266ea7b9e86cf9d25c3d1151d80c5ba5c9a1.png' },
  { emoji: '[防护]', url: 'https://i0.hdslb.com/bfs/live/17435e60dcc28ce306762103a2a646046ff10b0a.png' },
  { emoji: '[笑]', url: 'https://i0.hdslb.com/bfs/live/a91a27f83c38b5576f4cd08d4e11a2880de78918.png' },
  { emoji: '[一般]', url: 'https://i0.hdslb.com/bfs/live/8d436de0c3701d87e4ca9c1be01c01b199ac198e.png' },
  { emoji: '[嫌弃]', url: 'https://i0.hdslb.com/bfs/live/c409425ba1ad2c6534f0df7de350ba83a9c949e5.png' },
  { emoji: '[无语]', url: 'https://i0.hdslb.com/bfs/live/4781a77be9c8f0d4658274eb4e3012c47a159f23.png' },
  { emoji: '[哈欠]', url: 'https://i0.hdslb.com/bfs/live/6e496946725cd66e7ff1b53021bf1cc0fc240288.png' },
  { emoji: '[可怜]', url: 'https://i0.hdslb.com/bfs/live/8e88e6a137463703e96d4f27629f878efa323456.png' },
  { emoji: '[歪嘴笑]', url: 'https://i0.hdslb.com/bfs/live/bea1f0497888f3e9056d3ce14ba452885a485c02.png' },
  { emoji: '[亲亲]', url: 'https://i0.hdslb.com/bfs/live/10662d9c0d6ddb3203ecf50e77788b959d4d1928.png' },
  { emoji: '[问号]', url: 'https://i0.hdslb.com/bfs/live/a0c456b6d9e3187399327828a9783901323bfdb5.png' },
  { emoji: '[波吉]', url: 'https://i0.hdslb.com/bfs/live/57dee478868ed9f1ce3cf25a36bc50bde489c404.png' },
  { emoji: '[OH]', url: 'https://i0.hdslb.com/bfs/live/0d5123cddf389302df6f605087189fd10919dc3c.png' },
  { emoji: '[再见]', url: 'https://i0.hdslb.com/bfs/live/f408e2af700adcc2baeca15510ef620bed8d4c43.png' },
  { emoji: '[白眼]', url: 'https://i0.hdslb.com/bfs/live/7fa907ae85fa6327a0466e123aee1ac32d7c85f7.png' },
  { emoji: '[鼓掌]', url: 'https://i0.hdslb.com/bfs/live/d581d0bc30c8f9712b46ec02303579840c72c42d.png' },
  { emoji: '[大哭]', url: 'https://i0.hdslb.com/bfs/live/816402551e6ce30d08b37a917f76dea8851fe529.png' },
  { emoji: '[呆]', url: 'https://i0.hdslb.com/bfs/live/179c7e2d232cd74f30b672e12fc728f8f62be9ec.png' },
  { emoji: '[流汗]', url: 'https://i0.hdslb.com/bfs/live/b00e2e02904096377061ec5f93bf0dd3321f1964.png' },
  { emoji: '[生气]', url: 'https://i0.hdslb.com/bfs/live/2c69dad2e5c0f72f01b92746bc9d148aee1993b2.png' },
  { emoji: '[加油]', url: 'https://i0.hdslb.com/bfs/live/fbc3c8bc4152a65bbf4a9fd5a5d27710fbff2119.png' },
  { emoji: '[害羞]', url: 'https://i0.hdslb.com/bfs/live/d8ce9b05c0e40cec61a15ba1979c8517edd270bf.png' },
  { emoji: '[虎年]', url: 'https://i0.hdslb.com/bfs/live/a51af0d7d9e60ce24f139c468a3853f9ba9bb184.png' },
  { emoji: '[doge2]', url: 'https://i0.hdslb.com/bfs/live/f547cc853cf43e70f1e39095d9b3b5ac1bf70a8d.png' },
  { emoji: '[金钱豹]', url: 'https://i0.hdslb.com/bfs/live/b6e8131897a9a718ee280f2510bfa92f1d84429b.png' },
  { emoji: '[瓜子]', url: 'https://i0.hdslb.com/bfs/live/fd35718ac5a278fd05fe5287ebd41de40a59259d.png' },
  { emoji: '[墨镜]', url: 'https://i0.hdslb.com/bfs/live/5e01c237642c8b662a69e21b8e0fbe6e7dbc2aa1.png' },
  { emoji: '[难过]', url: 'https://i0.hdslb.com/bfs/live/5776481e380648c0fb3d4ad6173475f69f1ce149.png' },
  { emoji: '[抱抱]', url: 'https://i0.hdslb.com/bfs/live/abddb0b621b389fc8c2322b1cfcf122d8936ba91.png' },
  { emoji: '[跪了]', url: 'https://i0.hdslb.com/bfs/live/4f2155b108047d60c1fa9dccdc4d7abba18379a0.png' },
  { emoji: '[摊手]', url: 'https://i0.hdslb.com/bfs/live/1e0a2baf088a34d56e2cc226b2de36a5f8d6c926.png' },
  { emoji: '[热]', url: 'https://i0.hdslb.com/bfs/live/6df760280b17a6cbac8c1874d357298f982ba4cf.png' },
  { emoji: '[三星堆]', url: 'https://i0.hdslb.com/bfs/live/0a1ab3f0f2f2e29de35c702ac1ecfec7f90e325d.png' },
  { emoji: '[鼠]', url: 'https://i0.hdslb.com/bfs/live/98f842994035505c728e32e32045d649e371ecd6.png' },
  { emoji: '[汤圆]', url: 'https://i0.hdslb.com/bfs/live/23ae12d3a71b9d7a22c8773343969fcbb94b20d0.png' },
  { emoji: '[泼水]', url: 'https://i0.hdslb.com/bfs/live/29533893115c4609a4af336f49060ea13173ca78.png' },
  { emoji: '[鬼魂]', url: 'https://i0.hdslb.com/bfs/live/5d86d55ba9a2f99856b523d8311cf75cfdcccdbc.png' },
  { emoji: '[不行]', url: 'https://i0.hdslb.com/bfs/live/607f74ccf5eec7d2b17d91b9bb36be61a5dd196b.png' },
  { emoji: '[响指]', url: 'https://i0.hdslb.com/bfs/live/3b2fedf09b0ac79679b5a47f5eb3e8a38e702387.png' },
  { emoji: '[牛]', url: 'https://i0.hdslb.com/bfs/live/5e61223561203c50340b4c9b41ba7e4b05e48ae2.png' },
  { emoji: '[保佑]', url: 'https://i0.hdslb.com/bfs/live/241b13adb4933e38b7ea6f5204e0648725e76fbf.png' },
  { emoji: '[抱拳]', url: 'https://i0.hdslb.com/bfs/live/3f170894dd08827ee293afcb5a3d2b60aecdb5b1.png' },
  { emoji: '[给力]', url: 'https://i0.hdslb.com/bfs/live/d1ba5f4c54332a21ed2ca0dcecaedd2add587839.png' },
  { emoji: '[耶]', url: 'https://i0.hdslb.com/bfs/live/eb2d84ba623e2335a48f73fb5bef87bcf53c1239.png' },
]

// 转为 EmoticonItem 用于小表情栏
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

// 小表情（硬编码82个 + API 加载的表情包中提取的）
const smallEmoticons = computed<EmoticonItem[]>(() => {
  const seen = new Set(biliLiveEmoticonItems.map(e => e.emoji))
  const result = [...biliLiveEmoticonItems]
  for (const pkg of emoticonPackages.value) {
    for (const emo of pkg.emoticons) {
      if (emo.emoji && emo.url && !seen.has(emo.emoji)) {
        seen.add(emo.emoji)
        result.push(emo)
      }
    }
  }
  return result
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

/** 计算缓存指纹（仅基于包 ID + mtime，不含 URL——URL 会被替换为本地 file:// 路径） */
function cacheFingerprint(packages: EmoticonPackage[]): string {
  return packages
    .map(p => `${p.pkg_id}:${p.pkg_mtime || 0}`)
    .sort()
    .join('|')
}

// 监听观众加入事件
const viewerContainerRef = ref<HTMLElement | null>(null)

// —— 粉丝数实时监控 ——
const followerCount = ref(-1)
const prevFollowerCount = ref(-1)
const followerColorClass = ref('')
let followerTimer: ReturnType<typeof setInterval> | null = null
let followerColorTimer: ReturnType<typeof setTimeout> | null = null
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
      // 颜色变化标记
      if (prevFollowerCount.value >= 0) {
        if (followerColorTimer) { clearTimeout(followerColorTimer); followerColorTimer = null }
        if (followerCount.value > prevFollowerCount.value) {
          // 涨粉 → 红色持续 60 秒
          followerColorClass.value = 'dm-follower-up'
          followerColorTimer = setTimeout(() => { followerColorClass.value = '' }, 60000)
        } else if (followerCount.value < prevFollowerCount.value) {
          // 掉粉 → 绿色持续 30 秒
          followerColorClass.value = 'dm-follower-down'
          followerColorTimer = setTimeout(() => { followerColorClass.value = '' }, 30000)
        } else {
          // 不变 → 恢复原色
          followerColorClass.value = ''
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
  if (followerColorTimer) {
    clearTimeout(followerColorTimer)
    followerColorTimer = null
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
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('click', onDocumentClick)

  // 启动时预加载表情包（缓存到本地磁盘，避免每次启动重复下载）
  loadEmoticons()

  try {
    // 监听弹幕状态变化（连接/断开）
    window.electronAPI.onDanmakuStatusChanged?.((status: any) => {
      if (status) danmakuStore.updateStatus(status)
    })

    // 监听观众加入
    window.electronAPI.onDanmakuViewerJoin((data: any) => {
      const viewer = data as { uid: number; uname: string; avatarUrl: string }
      if (viewer && viewer.uid && viewer.uname) {
        danmakuStore.addViewer({ ...viewer, timestamp: Date.now() })
      }
    })
  } catch {
    // 非 Electron 环境（开发模式）忽略
  }
})

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

// 获取表情包（立即从缓存加载，后台从 API 刷新）
async function loadEmoticons() {
  if (emoticonLoading.value) return
  emoticonLoading.value = true
  emoticonError.value = ''

  // Step 1: 立即从 localStorage 缓存加载（同步，瞬时完成）
  const cached = loadCache()
  if (cached && cached.length > 0) {
    emoticonPackages.value = cached
    activePackageId.value = cached[0].pkg_id
    pickRandomCover()
  }

  // Step 2: 后台从 API 获取最新数据（不阻塞 UI）
  await fetchEmoticonsFromApi(cached)
}

/** 从 B站 API 获取表情包，与缓存比对后更新 */
async function fetchEmoticonsFromApi(cached: EmoticonPackage[] | null) {
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

    // 1. 获取直播间表情包（需要 roomId，没有则跳过）
    const roomId = danmakuStore.status.roomId
    if (roomId) {
      try {
        const result = await window.electronAPI.getEmoticons(roomId)
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
          // 直播间"通用表情"包封面补丁
          for (const rp of roomPackages) {
            if (rp.pkg_name === '通用表情' && !rp.pkg_url) {
              rp.pkg_url = 'https://i0.hdslb.com/bfs/live/39b7667c2601e4da8019472f5e3df1f2278278b6.png'
            }
          }
          packages.push(...roomPackages)
        }
      } catch { /* 直播间表情包获取失败，继续使用已有缓存 */ }
    }

    // 2. 获取用户个人评论表情包
    let biliEmojiPackage: EmoticonPackage | null = null
    try {
      const userResult = await window.electronAPI.getUserEmoticons()
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
    } catch { /* 用户表情包获取失败 */ }

    // 3. 获取全量表情包（兜底）
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
      if (!biliEmojiPackage.pkg_url && biliEmojiPackage.emoticons.length > 0) {
        biliEmojiPackage.pkg_url = biliEmojiPackage.emoticons[0].url
      }
      packages.unshift(biliEmojiPackage)
    }

    // 指纹比对：有变更才重新缓存
    const newFingerprint = cacheFingerprint(packages)
    const cachedFingerprint = cached ? cacheFingerprint(cached) : ''

    if (newFingerprint !== cachedFingerprint) {
      // 缓存新图片到本地磁盘
      try {
        const cacheResult = await window.electronAPI.cacheEmoticonImages(packages)
        if (cacheResult.success && cacheResult.urlMap) {
          const urlMap = cacheResult.urlMap
          for (const pkg of packages) {
            if (pkg.pkg_url && urlMap[pkg.pkg_url]) {
              pkg.pkg_url = urlMap[pkg.pkg_url]
            }
            if (pkg.emoticons) {
              for (const emo of pkg.emoticons) {
                if (emo.url && urlMap[emo.url]) {
                  emo.url = urlMap[emo.url]
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('[DanmakuPanel] 缓存表情图片失败:', e)
      }
      emoticonPackages.value = packages
      saveCache(packages)
    }
    // 指纹一致 → 已使用 Step 1 的缓存数据，无需更新

    if (emoticonPackages.value.length > 0) {
      activePackageId.value = emoticonPackages.value[0].pkg_id
      pickRandomCover()
    } else {
      emoticonError.value = '暂无可用表情'
    }
  } catch (e: any) {
    // API 失败时 Step 1 已从缓存加载，无需额外处理
    if (!cached || cached.length === 0) {
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
    showEmoticonPopup.value = true
  }
}

// 当前激活的表情包（computed，自动跟随 activePackageId 和 emoticonPackages 变化）
const activePackage = computed<EmoticonPackage | null>(() => {
  return emoticonPackages.value.find(p => p.pkg_id === activePackageId.value) || null
})
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

    <!-- 弹幕消息（blive.chat 官方 iframe 嵌入） -->
    <DanmakuIframe
      :roomId="danmakuStore.status.connected ? danmakuStore.status.roomId : 0"
      class="dm-chat-renderer"
    ></DanmakuIframe>

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
        <span v-else>表情</span>
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

/* iframe 弹幕容器 */
.dm-chat-renderer {
  flex: 1; overflow: hidden; min-height: 0; position: relative;
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