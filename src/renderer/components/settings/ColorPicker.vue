<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
}>(), {})

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
}>()

interface HSB { h: number; s: number; b: number }
interface RGBA { r: number; g: number; b: number; a: number }

function parseColor(val: string): RGBA {
  if (val.startsWith('#')) {
    const h = val.slice(1)
    if (h.length === 3)
      return { r: parseInt(h[0]+h[0],16), g: parseInt(h[1]+h[1],16), b: parseInt(h[2]+h[2],16), a: 1 }
    if (h.length === 6)
      return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16), a: 1 }
  }
  return { r: 0, g: 0, b: 0, a: 1 }
}

function rgbaToHsb(c: RGBA): HSB {
  const r=c.r/255,g=c.g/255,b=c.b/255
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min
  let h=0
  if(d!==0){if(max===r)h=((g-b)/d+(g<b?6:0))/6;else if(max===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6}
  return {h:h*360,s:max===0?0:d/max,b:max}
}

function hsbToRgba(hsb:HSB,a:number): RGBA {
  const h=hsb.h/60,c=hsb.b*hsb.s,x=c*(1-Math.abs((h%2)-1)),m=hsb.b-c
  let r=0,g=0,b=0
  if(h<1){r=c;g=x}else if(h<2){r=x;g=c}else if(h<3){g=c;b=x}else if(h<4){g=x;b=c}else if(h<5){r=x;b=c}else{r=c;b=x}
  return {r:Math.round((r+m)*255),g:Math.round((g+m)*255),b:Math.round((b+m)*255),a}
}

function rgbaToHex(c:RGBA): string {
  const toHex=(n:number)=>n.toString(16).padStart(2,'0')
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`
}

const current = ref<RGBA>(parseColor(props.modelValue))
const hsb = ref<HSB>(rgbaToHsb(current.value))
const open = ref(false)
const rootEl = ref<HTMLElement>()
const sbCanvas = ref<HTMLElement>()
const hueSlider = ref<HTMLElement>()
const inputText = ref(rgbaToHex(current.value))

watch(() => props.modelValue, (val) => {
  const c = parseColor(val); current.value = c; hsb.value = rgbaToHsb(c); inputText.value = rgbaToHex(c)
})

const swatchStyle = computed(() => ({ background: rgbaToHex(current.value) }))
const sbCanvasBg = computed(() => {
  const c = hsbToRgba({h:hsb.value.h,s:1,b:1},1)
  return { backgroundColor: `rgb(${c.r},${c.g},${c.b})` }
})
const sbCursorStyle = computed(() => ({
  left:`${hsb.value.s*100}%`,top:`${(1-hsb.value.b)*100}%`,
  background:rgbaToHex(hsbToRgba(hsb.value,1))
}))
const hueCursorStyle = computed(() => ({
  left:`${(hsb.value.h/360)*100}%`,
  background:rgbaToHex(hsbToRgba({h:hsb.value.h,s:1,b:1},1))
}))
const popupStyle = ref<Record<string,string>>({})
const previewStyle = computed(() => ({ background: rgbaToHex(current.value) }))

function positionPopup() {
  if(!rootEl.value) return
  const rect = rootEl.value.getBoundingClientRect()
  const pw=240,ph=226
  let l=rect.left,t=rect.bottom+6
  if(l+pw>window.innerWidth-10) l=window.innerWidth-pw-10
  if(l<10) l=10
  if(t+ph>window.innerHeight-10) t=rect.top-ph-6
  if(t<10) t=10
  popupStyle.value={left:`${l}px`,top:`${t}px`}
}

function toggle() { if(open.value){open.value=false}else{open.value=true;nextTick(()=>positionPopup())} }
function close() { open.value=false }

function emitColor() { emit('update:modelValue',rgbaToHex(current.value)) }
function updateFromHSB() { current.value=hsbToRgba(hsb.value,1);inputText.value=rgbaToHex(current.value) }
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}

// SB drag
function startSB(e:MouseEvent) { e.preventDefault(); updateSB(e)
  const m=(ev:MouseEvent)=>{updateSB(ev)}
  const u=()=>{emitColor();document.removeEventListener('mousemove',m);document.removeEventListener('mouseup',u)}
  document.addEventListener('mousemove',m);document.addEventListener('mouseup',u)
}
function updateSB(e:MouseEvent) { if(!sbCanvas.value)return
  const r=sbCanvas.value.getBoundingClientRect()
  hsb.value.s=clamp((e.clientX-r.left)/r.width,0,1)
  hsb.value.b=clamp(1-(e.clientY-r.top)/r.height,0,1)
  updateFromHSB()
}

// Hue drag
function startHue(e:MouseEvent) { e.preventDefault(); updateHue(e)
  const m=(ev:MouseEvent)=>{updateHue(ev)}
  const u=()=>{emitColor();document.removeEventListener('mousemove',m);document.removeEventListener('mouseup',u)}
  document.addEventListener('mousemove',m);document.addEventListener('mouseup',u)
}
function updateHue(e:MouseEvent) { if(!hueSlider.value)return
  const r=hueSlider.value.getBoundingClientRect()
  hsb.value.h=clamp(((e.clientX-r.left)/r.width)*360,0,360)
  updateFromHSB()
}

function onInputBlur() {
  const c=parseColor(inputText.value);current.value=c;hsb.value=rgbaToHsb(c);emitColor()
}

onMounted(() => document.addEventListener('keydown', handleKey))
onBeforeUnmount(() => document.removeEventListener('keydown', handleKey))

function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
</script>

<template>
  <div class="cp-root" ref="rootEl">
    <button class="cp-swatch" @click="toggle" :style="swatchStyle" type="button"></button>
    <Teleport to="body">
      <div v-if="open" class="cp-overlay" @click="close"></div>
      <div v-if="open" class="cp-popup" :style="popupStyle" @click.stop>
        <div class="cp-sb-canvas" ref="sbCanvas" :style="sbCanvasBg" @mousedown="startSB">
          <div class="cp-sb-cursor" :style="sbCursorStyle"></div>
        </div>
        <div class="cp-hue-slider" ref="hueSlider" @mousedown="startHue">
          <div class="cp-slider-cursor" :style="hueCursorStyle"></div>
        </div>
        <div class="cp-input-row">
          <div class="cp-preview" :style="previewStyle" @click="toggle"></div>
          <input class="cp-text-input" :value="inputText" @blur="onInputBlur" @keyup.enter="onInputBlur" spellcheck="false"/>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.cp-root { display: inline-flex; align-items: center; position: relative; }
.cp-swatch {
  width: 26px; height: 22px; border: 1px solid var(--border); cursor: pointer;
  padding: 0; flex-shrink: 0; border-radius: 2px;
}
.cp-swatch:hover { border-color: var(--accent); }
.cp-overlay { position: fixed; inset: 0; z-index: 9998; }
.cp-popup {
  position: fixed; z-index: 9999; width: 232px;
  background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px;
  padding: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
.cp-sb-canvas {
  position: relative; width: 100%; height: 150px; border-radius: 4px;
  cursor: crosshair; overflow: hidden; margin-bottom: 8px;
}
.cp-sb-canvas::before {
  content: ''; position: absolute; inset: 0; z-index: 1;
  background: linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent);
}
.cp-sb-cursor {
  position: absolute; z-index: 3; width: 14px; height: 14px;
  border: 2px solid #fff; border-radius: 50%; transform: translate(-50%,-50%);
  box-shadow: 0 0 2px rgba(0,0,0,0.4),inset 0 0 2px rgba(0,0,0,0.3); pointer-events: none;
}
.cp-hue-slider {
  position: relative; width: 100%; height: 12px; border-radius: 6px;
  cursor: pointer; margin-bottom: 8px;
  background: linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);
}
.cp-slider-cursor {
  position: absolute; top: 50%; z-index: 3; width: 16px; height: 16px;
  border: 2px solid #fff; border-radius: 50%; transform: translate(-50%,-50%);
  box-shadow: 0 0 2px rgba(0,0,0,0.4); pointer-events: none; background: inherit;
}
.cp-input-row { display: flex; align-items: center; gap: 8px; }
.cp-preview { width: 28px; height: 28px; border-radius: 4px; border: 1px solid var(--border); cursor: pointer; flex-shrink: 0; }
.cp-text-input {
  flex: 1; min-width: 0; padding: 4px 8px; font-size: 12px;
  font-family: 'Consolas', monospace; background: var(--bg-secondary);
  border: 1px solid var(--border); border-radius: 3px; color: var(--text-primary); outline: none;
}
.cp-text-input:focus { border-color: var(--accent); }
</style>