<template>
  <div ref="rootEl" class="vpb-root" :class="{ 'vpb-hide-cursor': hideNativeCursor }" :style="rootStyle">
    <div ref="layerEl" class="vpb-pointer-layer" :style="layerStyle"></div>

    <!-- 用户自己写的 DOM，所有带 .vpb-box 的元素都会被自动识别 -->
    <slot></slot>

    <div v-if="hintText" class="vpb-hint">{{ hintText }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { gsap } from 'gsap'
import { injectStyles } from './styles.js'

const DIR_MAP = {
  br: [1, 1], tr: [1, -1], bl: [-1, 1], tl: [-1, -1],
  right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1],
}
const CURSOR_SVG =
    '<svg viewBox="0 0 32 32">' +
    '<path d="M8 4L24 16L16 18L20 26L16 28L12 20L8 24L8 4Z" fill="currentColor"' +
    ' stroke="#e8eaf2" stroke-width="1" stroke-linejoin="round" stroke-opacity="0.7"/>' +
    '</svg>'

const props = defineProps({
  selector: { type: String, default: '.vpb-box' },
  scanRoot: { type: [String, Object], default: null },

  // 初始尺寸（全局默认，可被 data-* 覆盖）
  initialWidth: { type: Number, default: 48 },
  initialHeight: { type: Number, default: 48 },
  initialRadius: { type: Number, default: 10 },

  // 指针
  pointerCount: { type: Number, default: 20 },
  pointerSize: { type: Number, default: 26 },
  pointerDragSize: { type: Number, default: 38 },
  minSpeed: { type: Number, default: 0.3 },
  maxSpeed: { type: Number, default: 1.1 },
  nearRadius: { type: Number, default: 150 },
  lockRadius: { type: Number, default: 90 },
  // 等待中的 box 会召唤最近的空闲指针，以这个最高速（px/帧）直奔过去
  seekSpeed: { type: Number, default: 7 },
  idleOpacity: { type: Number, default: 0.35 },
  nearOpacity: { type: Number, default: 0.75 },
  pointerZIndex: { type: Number, default: 9999 },
  hideNativeCursor: { type: Boolean, default: true },

  // 动画
  normalStagger: { type: Number, default: 0.14 },
  bigTextStagger: { type: Number, default: 0.045 },
  typeDelay: { type: Number, default: 700 },
  autoResetDistance: { type: Number, default: 500 },

  // 颜色
  background: { type: String, default: '#f4f5fa' },
  darkSaturation: { type: Number, default: 15 },
  darkLightness: { type: Number, default: 28 },
  brightSaturation: { type: Number, default: 75 },
  brightLightness: { type: Number, default: 62 },

  hintText: { type: String, default: '' },
})

const emit = defineEmits(['dragstart', 'dragend', 'typed', 'ready'])

const rootEl = ref(null)
const layerEl = ref(null)

const rootStyle = computed(() => ({
  background: props.background,
  '--vpb-pointer-size': props.pointerSize + 'px',
  '--vpb-pointer-drag-size': props.pointerDragSize + 'px',
  '--vpb-idle-opacity': String(props.idleOpacity),
  '--vpb-near-opacity': String(props.nearOpacity),
}))
const layerStyle = computed(() => ({ zIndex: String(props.pointerZIndex) }))

// ======= 工具 =======
const num = (v, fb) => { const n = parseFloat(v); return Number.isFinite(n) ? n : fb }
const parseDir = (d) => Array.isArray(d) ? [Math.sign(d[0]||0), Math.sign(d[1]||0)] : (DIR_MAP[d] || [1,1])
const darkColor = (h) => `hsl(${h}, ${props.darkSaturation}%, ${props.darkLightness}%)`
const brightColor = (h) => `hsl(${h}, ${props.brightSaturation}%, ${props.brightLightness}%)`

// ======= 运行时状态 =======
let boxes = []
let pointers = []
let rafId = null
let observer = null
let resizeTimer = null
const timeouts = new Set()
const tweens = []
const later = (fn, ms) => {
  const id = setTimeout(() => { timeouts.delete(id); fn() }, ms)
  timeouts.add(id); return id
}

// ======= 从 DOM element 读配置 =======
function readBoxConfig(el, knownText) {
  const cs = getComputedStyle(el)
  const offW = el.offsetWidth || 0
  const offH = el.offsetHeight || 0
  // 从 data-text 属性读，否则用已知文本（setupBoxes 处理完 DOM 后传入）
  let text = el.dataset.text !== undefined ? el.dataset.text : (knownText ?? '')
  return {
    finalW: num(el.dataset.width, offW || 190),
    finalH: num(el.dataset.height, offH || 190),
    finalR: num(el.dataset.radius, parseFloat(cs.borderRadius) || 18),
    text,
    dir: parseDir(el.dataset.dir),
    rate: num(el.dataset.growthRate, 2.8),
    bigText: el.hasAttribute('data-big-text') || el.classList.contains('big-text-box'),
    // data-placeholder 显式设置时以它为准（允许空字符串，拖拽中不显示占位符）
    placeholder: el.dataset.placeholder !== undefined ? el.dataset.placeholder : '·',
    initW: num(el.dataset.initialWidth, props.initialWidth),
    initH: num(el.dataset.initialHeight, props.initialHeight),
    initR: num(el.dataset.initialRadius, props.initialRadius),
  }
}

// ======= 实时计算 inner 的最终位置（滚动后也正确）=======
// inner 是 position:absolute; left:0; top:0 在 el 内，final 尺寸 finalW×finalH
// 所以 naturalRect = el 的视口位置 + (0,0)，尺寸 = finalW × finalH
function getNaturalRect(b) {
  const elRect = b.el.getBoundingClientRect()
  return {
    left: elRect.left,
    top: elRect.top,
    width: b.cfg.finalW,
    height: b.cfg.finalH,
    right: elRect.left + b.cfg.finalW,
    bottom: elRect.top + b.cfg.finalH,
  }
}

// ======= 扫描 + 注入 inner =======
function setupBoxes() {
  boxes = []
  const scanNode = props.scanRoot
      ? (typeof props.scanRoot === 'string' ? document.querySelector(props.scanRoot) : props.scanRoot)
      : rootEl.value
  if (!scanNode) return

  const allBoxEls = Array.from(scanNode.querySelectorAll(props.selector))
  const rootIsBox = scanNode.matches && scanNode.matches(props.selector)
  const els = rootIsBox ? [scanNode, ...allBoxEls] : allBoxEls

  // 第一遍：给每个 box 注入 inner + text span，读配置，拿 naturalRect
  els.forEach((el, i) => {
    const cs = getComputedStyle(el)
    if (cs.position === 'static') el.style.position = 'relative'

    // 先注入 inner（把文本节点搬到 span 里），这样后面才能读到正确的文本
    let inner = el.querySelector(':scope > .vpb-inner')
    let span = null
    if (!inner) {
      inner = document.createElement('div')
      inner.className = 'vpb-inner'

      // 把 el 的直接子节点（文本 + 非 box 元素）搬到 inner
      const directChildren = Array.from(el.childNodes)
      const childBoxes = []
      directChildren.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('vpb-box')) {
          childBoxes.push(node) // 子 box 不动，留在 el 里
        } else {
          inner.appendChild(node)
        }
      })

      // 确保 inner 有一个 span.vpb-text（打字用）
      span = inner.querySelector(':scope > span.vpb-text')
      if (!span) {
        span = document.createElement('span')
        span.className = 'vpb-text'
        Array.from(inner.childNodes).forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) span.appendChild(node)
          else if (node.nodeType === Node.ELEMENT_NODE) span.appendChild(node)
        })
        inner.appendChild(span)
      }
      inner._span = span
      inner._originText = span.textContent.trim()

      el.appendChild(inner)
      childBoxes.forEach((cb) => el.appendChild(cb))
    } else {
      span = inner._span || inner.querySelector('span.vpb-text')
      // 首次扫描时缓存原始文本，restart 清空 span 后依然能找回
      if (inner._originText === undefined) inner._originText = span ? span.textContent.trim() : ''
    }

    // inner 创建好、文本搬好之后再读配置（用缓存的原始文本，重播也不会丢）
    const cfg = readBoxConfig(el, inner._originText ?? '')

    // data-big-text 需要配套的 big-text-box 类才能启用换行样式
    if (cfg.bigText && !el.classList.contains('big-text-box')) el.classList.add('big-text-box')

    // inner 始终用 absolute 定位在 el 的 (0,0)，动画时改 width/height/left/top
    inner.style.position = 'absolute'
    inner.style.left = '0'
    inner.style.top = '0'

    // 缩回初始状态（show 后 opacity 由 CSS 类控制）
    inner.style.opacity = '0'
    inner.style.width = cfg.initW + 'px'
    inner.style.height = cfg.initH + 'px'
    inner.style.borderRadius = cfg.initR + 'px'

    boxes.push({
      i, el, inner, span: inner._span || inner.querySelector('span.vpb-text'),
      cfg,
      parentIdx: -1, children: [],
      state: 0, stretch: 0,
      maxStretch: Math.max(cfg.finalW - cfg.initW, cfg.finalH - cfg.initH, 1),
      dragPointerIdx: -1, dragLine: null,
      _signX: 1, _signY: 1,
    })
  })

  // 第二遍：父子关系
  boxes.forEach((b) => {
    let parentEl = b.el.parentElement
    while (parentEl) {
      const idx = boxes.findIndex((bb) => bb.el === parentEl)
      if (idx >= 0) {
        b.parentIdx = idx
        boxes[idx].children.push(b.i)
        break
      }
      parentEl = parentEl.parentElement
    }
  })
}

// ======= 状态控制 =======
function isParentReady(b) {
  if (b.parentIdx < 0) return true
  const p = boxes[b.parentIdx]
  return p && p.state === 3
}

function showBox(b) {
  if (b.state !== 0) return
  if (!isParentReady(b)) return
  b.state = 1
  b.el.classList.add('show')
  // 清掉 inline opacity，让 CSS 类 .vpb-box.show .vpb-inner { opacity:1 } 生效
  b.inner.style.opacity = ''
  // show 状态下不显示任何文字（占位字符或文本都不显示），等拖拽完成后再打字
  if (b.span) b.span.textContent = ''
}

function resetBox(b) {
  b.state = 0; b.stretch = 0; b.dragPointerIdx = -1
  b.el.classList.remove('show', 'dragging', 'done', 'typing')
  b.inner.style.opacity = '0'
  b.inner.style.width = b.cfg.initW + 'px'
  b.inner.style.height = b.cfg.initH + 'px'
  b.inner.style.borderRadius = b.cfg.initR + 'px'
  b.inner.style.left = ''
  b.inner.style.top = ''
  b.span.style.opacity = '1'
  b.span.innerHTML = ''
  b.span.textContent = b.cfg.placeholder
  if (b.dragLine) { b.dragLine.remove(); b.dragLine = null }
  b.children.forEach((ci) => resetBox(boxes[ci]))
}

// ======= 指针 =======
function initPointers() {
  const layer = layerEl.value
  if (!layer) return
  layer.innerHTML = ''
  pointers.length = 0
  const vw = window.innerWidth, vh = window.innerHeight
  for (let i = 0; i < props.pointerCount; i++) {
    const div = document.createElement('div')
    div.className = 'vpb-cursor-mock'
    div.innerHTML = CURSOR_SVG
    const hue = Math.floor(Math.random() * 360)
    const ang = Math.random() * Math.PI * 2
    const sp = props.minSpeed + Math.random() * (props.maxSpeed - props.minSpeed)
    const x = 30 + Math.random() * Math.max(vw - 60, 1)
    const y = 30 + Math.random() * Math.max(vh - 60, 1)
    div.style.color = darkColor(hue)
    div.style.left = x + 'px'; div.style.top = y + 'px'
    layer.appendChild(div)
    pointers.push({
      el: div, x, y,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      hue, lockedBox: -1, cooldown: 0, typing: false, chaseBox: -1,
    })
  }
}

// ======= 拖拽 =======
function startDrag(b, pointerIdx) {
  if (b.state !== 1) return
  const p = pointers[pointerIdx]
  if (!p || p.lockedBox >= 0 || p.typing) return
  for (const bb of boxes) if (bb !== b && bb.dragPointerIdx === pointerIdx) return

  b.state = 2; b.dragPointerIdx = pointerIdx; b.stretch = 0
  p.lockedBox = b.i
  p.chaseBox = -1
  p.el.classList.add('dragging'); p.el.classList.remove('near')
  p.el.style.color = brightColor(p.hue)
  b.el.classList.add('dragging')
  emit('dragstart', { index: b.i })

  // 实时取 inner 在屏幕上的最终位置
  const r = getNaturalRect(b)
  const scx = r.left + b.cfg.finalW / 2
  const scy = r.top + b.cfg.finalH / 2
  const dir = b.cfg.dir
  const signX = Math.sign(dir[0]) || 1
  const signY = Math.sign(dir[1]) || 1

  // 锚点 = dir 对应的角
  const ax = scx - signX * b.cfg.finalW / 2
  const ay = scy - signY * b.cfg.finalH / 2

  // pointer 起点 = 锚点沿 dir 方向推出 init 尺寸
  const px0 = signX !== 0 ? ax + signX * b.cfg.initW : scx
  const py0 = signY !== 0 ? ay + signY * b.cfg.initH : scy
  p.x = px0; p.y = py0
  p.vx = signX * 3.0 || 0.1
  p.vy = signY * 3.0 || 0.1
  p.el.style.left = px0 + 'px'; p.el.style.top = py0 + 'px'
  b._signX = signX; b._signY = signY

  // inner 放到锚点位置（相对于 el），尺寸初始
  const elRect = b.el.getBoundingClientRect()
  let innerLeft = signX >= 0 ? ax - elRect.left : ax - elRect.left - b.cfg.initW
  let innerTop = signY >= 0 ? ay - elRect.top : ay - elRect.top - b.cfg.initH
  if (signX === 0) innerLeft = scx - elRect.left - b.cfg.initW / 2
  if (signY === 0) innerTop = scy - elRect.top - b.cfg.initH / 2

  b.inner.style.position = 'absolute'
  b.inner.style.left = innerLeft + 'px'
  b.inner.style.top = innerTop + 'px'
  b.inner.style.width = b.cfg.initW + 'px'
  b.inner.style.height = b.cfg.initH + 'px'
  b.inner.style.borderRadius = b.cfg.initR + 'px'

  const line = document.createElement('div')
  line.className = 'vpb-drag-line'
  layerEl.value.appendChild(line)
  b.dragLine = line
}

function finishDrag(b) {
  const r = getNaturalRect(b)
  const elRect = b.el.getBoundingClientRect()

  b.inner.style.left = (r.left - elRect.left) + 'px'
  b.inner.style.top = (r.top - elRect.top) + 'px'
  b.inner.style.width = b.cfg.finalW + 'px'
  b.inner.style.height = b.cfg.finalH + 'px'
  b.inner.style.borderRadius = b.cfg.finalR + 'px'

  b.span.style.opacity = '0'
  b.span.innerHTML = ''
  b.span.textContent = ''

  const typePIdx = b.dragPointerIdx
  b.dragPointerIdx = -1; b.stretch = b.maxStretch; b.state = 3
  b.el.classList.remove('dragging'); b.el.classList.add('done')
  if (b.dragLine) { b.dragLine.remove(); b.dragLine = null }
  emit('dragend', { index: b.i })

  if (typePIdx >= 0 && pointers[typePIdx]) {
    const p = pointers[typePIdx]
    p.el.classList.remove('dragging'); p.el.classList.add('typing-cursor')
    p.el.style.color = darkColor(p.hue)
    p.lockedBox = -1; p.cooldown = 9999; p.typing = true
  }

  // 父完成 → 检查子 box 能否激活
  b.children.forEach((ci) => {
    const child = boxes[ci]
    if (child.state === 0) showBox(child)
  })

  later(() => startTyping(b, typePIdx), 400)
}

// ======= 打字 =======
function startTyping(b, pointerIdx) {
  const text = readText(b)
  if (!text) {
    b.el.classList.remove('typing')
    if (pointerIdx >= 0 && pointers[pointerIdx]) {
      const p = pointers[pointerIdx]
      p.el.classList.remove('typing-cursor'); p.typing = false; p.cooldown = 0
    }
    return
  }

  b.span.style.opacity = '1'
  b.span.innerHTML = ''
  for (const ch of text) {
    // 换行符直接插入 <br>，不参与逐字动画
    if (ch === '\n') {
      b.span.appendChild(document.createElement('br'))
      continue
    }
    const c = document.createElement('span')
    c.className = 'vpb-char'
    c.textContent = ch
    c.style.display = 'inline-block'
    c.style.opacity = '0'
    c.style.transform = 'translateY(8px) scale(0.7)'
    c.style.filter = 'blur(3px)'
    b.span.appendChild(c)
  }
  const chars = Array.from(b.span.querySelectorAll('.vpb-char'))
  b.el.classList.add('typing')

  const r = getNaturalRect(b)
  const targetX = r.left + r.width / 2
  const targetY = r.top + r.height / 2

  if (pointerIdx >= 0 && pointers[pointerIdx]) {
    const p = pointers[pointerIdx]
    p.vx = 0; p.vy = 0
    p.cooldown = chars.length + 120
    p.el.classList.add('typing-cursor')
    tweens.push(gsap.to(p, {
      x: targetX, y: targetY, duration: 0.6, ease: 'power2.out',
      onUpdate: () => {
        p.el.style.left = p.x.toFixed(1) + 'px'
        p.el.style.top = p.y.toFixed(1) + 'px'
      },
    }))
  }

  const stagger = b.cfg.bigText ? props.bigTextStagger : props.normalStagger
  const tl = gsap.timeline({
    delay: props.typeDelay / 1000,
    onComplete: () => {
      if (pointerIdx >= 0 && pointers[pointerIdx]) {
        const p = pointers[pointerIdx]
        p.el.classList.remove('typing-cursor')
        p.typing = false; p.cooldown = 0
        const ang = Math.random() * Math.PI * 2
        p.vx = Math.cos(ang) * 1.8; p.vy = Math.sin(ang) * 1.8
      }
      b.el.classList.remove('typing')
      emit('typed', { index: b.i, text })
    },
  })
  tweens.push(tl)
  tl.to(chars, {
    opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
    duration: 0.22, ease: 'back.out(1.5)', stagger,
  })
}

function readText(b) {
  // data-text 显式设置时以它为准（允许空字符串，表示只展示图片、不显示文字）
  if (b.el.dataset.text !== undefined) return b.el.dataset.text.trim()
  if (b.cfg.text && b.cfg.text.trim()) return b.cfg.text.trim()
  return b.span.textContent.trim()
}

// ======= 主循环 =======
let geomTick = 0

function tick() {
  const vw = window.innerWidth, vh = window.innerHeight

  // 1. 指针游走
  for (const p of pointers) {
    // 被等待中的 box 召唤：直线加速飞过去，不再靠随机游走碰运气
    if (p.chaseBox >= 0) {
      const b = boxes[p.chaseBox]
      if (!b || b.state !== 1) {
        p.chaseBox = -1
      } else {
        const r = getNaturalRect(b)
        const dx = r.left + r.width / 2 - p.x
        const dy = r.top + r.height / 2 - p.y
        const d = Math.hypot(dx, dy) || 1
        const speed = Math.min(props.seekSpeed, Math.max(2, d * 0.06))
        p.x += (dx / d) * speed
        p.y += (dy / d) * speed
        p.el.classList.add('near')
        p.el.style.left = p.x.toFixed(1) + 'px'
        p.el.style.top = p.y.toFixed(1) + 'px'
        continue
      }
    }

    if (p.lockedBox >= 0 || p.typing) continue
    if (p.cooldown > 0) {
      p.cooldown--
      p.x += p.vx; p.y += p.vy
      if (p.x < -40) p.x = vw + 40
      if (p.x > vw + 40) p.x = -40
      if (p.y < -40) p.y = vh + 40
      if (p.y > vh + 40) p.y = -40
    } else {
      if (Math.random() < 0.015) {
        const ang = Math.atan2(p.vy, p.vx) + (Math.random() - 0.5) * 0.6
        const sp = Math.hypot(p.vx, p.vy)
        p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp
      }
      p.x += p.vx; p.y += p.vy
      const m = 20
      if (p.x < m) { p.x = m; p.vx *= -0.9 }
      if (p.x > vw - m) { p.x = vw - m; p.vx *= -0.9 }
      if (p.y < m) { p.y = m; p.vy *= -0.9 }
      if (p.y > vh - m) { p.y = vh - m; p.vy *= -0.9 }
      const sp = Math.hypot(p.vx, p.vy)
      if (sp < 0.3) {
        const a = Math.random() * Math.PI * 2
        p.vx = Math.cos(a) * 0.9; p.vy = Math.sin(a) * 0.9
      }
    }
    p.el.classList.remove('near')
    p.el.style.left = p.x.toFixed(1) + 'px'
    p.el.style.top = p.y.toFixed(1) + 'px'
  }

  // 2. 等待中的 box 吸引自由指针
  for (const b of boxes) {
    if (b.state !== 1) continue
    const r = getNaturalRect(b)
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2

    let bestIdx = -1, bestDist = Infinity
    for (let i = 0; i < pointers.length; i++) {
      const pp = pointers[i]
      if (pp.lockedBox >= 0 || pp.cooldown > 0 || pp.typing) continue
      // 已被其他 box 召唤的指针不再参与竞争
      if (pp.chaseBox >= 0 && pp.chaseBox !== b.i) continue
      const d = Math.hypot(pp.x - cx, pp.y - cy)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }
    if (bestIdx < 0) continue

    const np = pointers[bestIdx]
    if (bestDist < props.nearRadius) {
      np.el.classList.add('near')
      const dx = cx - np.x, dy = cy - np.y
      const d = Math.hypot(dx, dy) || 1
      const pull = 0.08 * (1 - bestDist / props.nearRadius)
      np.vx += (dx / d) * pull; np.vy += (dy / d) * pull
    }
    if (bestDist < props.lockRadius) {
      startDrag(b, bestIdx)
    } else {
      // 还在远处：直接指派它高速奔向这个 box
      np.chaseBox = b.i
    }
  }

  // 3. 拖拽中：每帧重算 inner 位置 + pointer 位置
  for (const b of boxes) {
    if (b.state !== 2 || b.dragPointerIdx < 0) continue
    const dp = pointers[b.dragPointerIdx]
    if (!dp) { finishDrag(b); continue }

    b.stretch = Math.min(b.maxStretch, b.stretch + b.cfg.rate)
    const t = b.stretch / b.maxStretch
    const w = b.cfg.initW + (b.cfg.finalW - b.cfg.initW) * t
    const h = b.cfg.initH + (b.cfg.finalH - b.cfg.initH) * t
    const rad = b.cfg.initR + (b.cfg.finalR - b.cfg.initR) * t

    const sx = b._signX, sy = b._signY
    const r = getNaturalRect(b)
    const scx = r.left + r.width / 2
    const scy = r.top + r.height / 2
    const ax = scx - sx * b.cfg.finalW / 2
    const ay = scy - sy * b.cfg.finalH / 2

    dp.x = sx !== 0 ? ax + sx * w : scx
    dp.y = sy !== 0 ? ay + sy * h : scy

    let innerLeft = sx >= 0 ? ax : ax - w
    let innerTop = sy >= 0 ? ay : ay - h
    if (sx === 0) innerLeft = scx - w / 2
    if (sy === 0) innerTop = scy - h / 2

    const elRect = b.el.getBoundingClientRect()
    innerLeft -= elRect.left; innerTop -= elRect.top

    b.inner.style.width = w.toFixed(1) + 'px'
    b.inner.style.height = h.toFixed(1) + 'px'
    b.inner.style.borderRadius = rad.toFixed(1) + 'px'
    b.inner.style.left = innerLeft.toFixed(1) + 'px'
    b.inner.style.top = innerTop.toFixed(1) + 'px'

    // 放大过程中只显示占位符（字号由 CSS 控制，方便外部覆盖）
    b.span.textContent = b.cfg.placeholder

    dp.el.style.left = dp.x.toFixed(1) + 'px'
    dp.el.style.top = dp.y.toFixed(1) + 'px'

    if (b.dragLine) {
      const lx = dp.x - ax, ly = dp.y - ay
      const L = Math.hypot(lx, ly)
      const ang = Math.atan2(ly, lx)
      b.dragLine.style.left = ax + 'px'
      b.dragLine.style.top = ay + 'px'
      b.dragLine.style.width = L.toFixed(1) + 'px'
      b.dragLine.style.transform = `rotate(${ang}rad)`
      b.dragLine.style.opacity = '1'
    }

    if (b.stretch >= b.maxStretch - 0.5) finishDrag(b)
  }

  // 4. 位置安全网
  geomTick++
  if (geomTick >= 30) {
    geomTick = 0
    for (const b of boxes) {
      if (b.state !== 3) continue
      const r = getNaturalRect(b)
      const ir = b.inner.getBoundingClientRect()
      const err = Math.abs(ir.left - r.left) + Math.abs(ir.top - r.top) +
          Math.abs(ir.width - b.cfg.finalW) + Math.abs(ir.height - b.cfg.finalH)
      if (err > 4) {
        const elRect = b.el.getBoundingClientRect()
        b.inner.style.left = (r.left - elRect.left) + 'px'
        b.inner.style.top = (r.top - elRect.top) + 'px'
        b.inner.style.width = b.cfg.finalW + 'px'
        b.inner.style.height = b.cfg.finalH + 'px'
        b.inner.style.borderRadius = b.cfg.finalR + 'px'
      }
    }
  }

  rafId = requestAnimationFrame(tick)
}

// ======= 视口观察 =======
function observe() {
  if (typeof IntersectionObserver === 'undefined') {
    boxes.forEach(showBox); return
  }
  if (observer) observer.disconnect()
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const b = boxes.find((bb) => bb.el === entry.target)
      if (!b) continue
      if (entry.isIntersecting) { showBox(b); continue }
      if (b.state === 1) {
        const r = entry.boundingClientRect
        if (r.bottom < -props.autoResetDistance || r.top > window.innerHeight + props.autoResetDistance) resetBox(b)
      }
    }
  }, { rootMargin: '300px 0px 300px 0px', threshold: 0.01 })
  boxes.forEach((b) => observer.observe(b.el))
}

// ======= resize =======
function onResize() {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    initPointers()
    boxes.forEach((b) => {
      if (b.state === 3) {
        b.inner.style.width = b.cfg.finalW + 'px'
        b.inner.style.height = b.cfg.finalH + 'px'
        b.inner.style.borderRadius = b.cfg.finalR + 'px'
        const r = getNaturalRect(b)
        const elRect = b.el.getBoundingClientRect()
        b.inner.style.left = (r.left - elRect.left) + 'px'
        b.inner.style.top = (r.top - elRect.top) + 'px'
      }
    })
  }, 150)
}

function teardown() {
  timeouts.forEach((id) => clearTimeout(id))
  timeouts.clear()
  tweens.forEach((t) => { try { t.kill && t.kill() } catch (e) {} })
  tweens.length = 0
  boxes.forEach((b) => { b.dragLine && b.dragLine.remove() })
  boxes = []
  if (observer) { observer.disconnect(); observer = null }
}

function restart() {
  // 先复位旧盒子（清 show/done 类与残留文字），避免重播时样式与文本错乱
  boxes.forEach((b) => resetBox(b))
  teardown()
  setupBoxes()
  initPointers()
  observe()
}

onMounted(async () => {
  injectStyles()
  await nextTick()
  setupBoxes()
  initPointers()
  observe()
  window.addEventListener('resize', onResize)
  rafId = requestAnimationFrame(tick)
  emit('ready', { count: boxes.length })
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId); rafId = null
  window.removeEventListener('resize', onResize)
  clearTimeout(resizeTimer)
  timeouts.forEach((id) => clearTimeout(id)); timeouts.clear()
  tweens.forEach((t) => { try { t.kill && t.kill() } catch (e) {} })
  tweens.length = 0
  if (observer) { observer.disconnect(); observer = null }
  pointers.forEach((p) => { try { gsap.killTweensOf(p) } catch (e) {}; p.el.remove() })
  pointers = []
  boxes.forEach((b) => b.dragLine && b.dragLine.remove())
  boxes = []
})

defineExpose({ restart, resetAll: restart })
</script>
