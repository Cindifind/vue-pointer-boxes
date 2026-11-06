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
import { renderMarkdown } from './markdown.js'
import { wrapRichText } from './rich.js'

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

  // 内容模式：auto 自动识别 | text 纯文本 | html 富文本 DOM | markdown Markdown 源码
  mode: { type: String, default: 'auto' },
  // 自定义 Markdown 渲染器（不传则用内置轻量渲染），可传 markdown-it / marked
  markdown: { type: Function, default: null },
  // 逐字粒度：char 单字符 | word 整词（西文保留连字与字距）
  splitUnit: { type: String, default: 'char' },
  // 富文本超过该字符数时不再逐字拆分，整体淡入，避免上千 span 卡顿
  richCharLimit: { type: Number, default: 3000 },
  // 逐字数量超过该值时去掉 blur 滤镜：逐字模糊要逐个字符单独栅格化，开销随字符数线性增长
  blurCharLimit: { type: Number, default: 400 },
  // 富文本完成后允许选中文字 / 点击链接 / 滚动
  interactive: { type: Boolean, default: true },

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
let boxByEl = new Map() // element → box，避免每帧 / 每次观察回调都线性查找
let pointers = []
let rafId = null
let observer = null
let rootObserver = null
let resizeTimer = null
// 视口矩形缓存：tick 每帧要读几十个盒子的位置，改成「脏了才量一轮」，
// 读写分离，避免每帧 getBoundingClientRect 触发同步布局
let rectsDirty = true
// 整个组件滚出视口后停掉模拟（指针层一并隐藏），不再空转
let active = true
const timeouts = new Set()
const tweens = []
const later = (fn, ms) => {
  const id = setTimeout(() => { timeouts.delete(id); fn() }, ms)
  timeouts.add(id); return id
}

// ======= 内容模式：auto 时按子节点自动判断 =======
function resolveMode(el) {
  const raw = String(el.dataset.mode || props.mode || 'auto').toLowerCase()
  if (raw === 'text' || raw === 'html' || raw === 'markdown') return raw
  if (el.dataset.html !== undefined) return 'html'
  const hasRichChild = Array.from(el.childNodes).some((n) => {
    if (n.nodeType !== Node.ELEMENT_NODE) return false
    if (n.classList.contains('vpb-box') || n.classList.contains('vpb-inner')) return false
    return n.tagName.toUpperCase() !== 'BR'
  })
  return hasRichChild ? 'html' : 'text'
}

// ======= 从 DOM element 读配置 =======
function readBoxConfig(el, knownText, mode) {
  const cs = getComputedStyle(el)
  const offW = el.offsetWidth || 0
  const offH = el.offsetHeight || 0
  // 从 data-text 属性读，否则用已知文本（setupBoxes 处理完 DOM 后传入）
  let text = el.dataset.text !== undefined ? el.dataset.text : (knownText ?? '')
  return {
    finalW: num(el.dataset.width, offW || 190),
    finalH: num(el.dataset.height, offH || 190),
    finalR: num(el.dataset.radius, parseFloat(cs.borderRadius) || 18),
    mode,
    text,
    dir: parseDir(el.dataset.dir),
    rate: num(el.dataset.growthRate, 2.8),
    bigText: el.hasAttribute('data-big-text') || el.classList.contains('big-text-box'),
    // data-placeholder 显式设置时以它为准（允许空字符串，拖拽中不显示占位符）
    placeholder: el.dataset.placeholder !== undefined ? el.dataset.placeholder : '·',
    // data-stagger 显式指定打字间隔（优先于 bigText 的间隔）
    stagger: el.dataset.stagger !== undefined ? num(el.dataset.stagger, props.normalStagger) : null,
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

// 批量刷新视口矩形：一帧只读一轮，后续全部走缓存
function refreshRects() {
  for (const b of boxes) {
    const r = b.el.getBoundingClientRect()
    b.rect.left = r.left
    b.rect.top = r.top
  }
  rectsDirty = false
}

function markRectsDirty() { rectsDirty = true }

// ======= Markdown 预渲染 + 代码块尺寸 =======
// Markdown 里的围栏代码块会被渲染成独立的 .vpb-box（pre.vpb-md-code），
// 所以必须在扫描之前先把 Markdown 结构落地，它才能作为子 box 参与扫描与拖拽。
// 代码块额外留白：.vpb-char 是 inline-block，逐字写完会比纯文本高出几像素
const CODE_BOX_PAD = 17

function prepareMarkdownBoxes(scanNode) {
  const els = Array.from(scanNode.querySelectorAll(props.selector))
  els.forEach((el) => {
    if (resolveMode(el) !== 'markdown') return

    // 首次挂载记下源码，之后重播都从源码重建，保证代码块等结构一致
    let src
    if (el.dataset.text !== undefined) src = el.dataset.text
    else if (el._vpbMdSource !== undefined) src = el._vpbMdSource
    else src = el.textContent
    el._vpbMdSource = src

    const render = typeof props.markdown === 'function'
        ? props.markdown
        : (md) => renderMarkdown(md, { codeBoxes: true })
    el.innerHTML = `<div class="vpb-md-body">${render(src || '')}</div>`

    // 代码块宽度跟随父级内容列；高度此刻就能量准（字号 / 行高由 .vpb-box.vpb-md-code 决定），
    // 先写死高度腾出排版位置，父级卡片量自然高度时才算得对
    el.querySelectorAll('.vpb-md-code').forEach((box) => {
      box.style.width = '100%'
      const h = box.offsetHeight || 0
      box.dataset.height = String(Math.max(1, Math.ceil(h + CODE_BOX_PAD * 2)))
      box.style.height = box.dataset.height + 'px'
    })
  })
}

// 量 inner 在最终宽度下的自然高度（内容 + 内边距 + 边框）
// 「内容多高盒子就多高」靠它：Markdown 卡片向下平铺，而不是内部滚动
function measureInnerHeight(inner, width) {
  const prevW = inner.style.width
  const prevH = inner.style.height
  inner.style.width = width + 'px'
  inner.style.height = 'auto'
  const h = Math.ceil(inner.getBoundingClientRect().height)
  inner.style.width = prevW
  inner.style.height = prevH
  return h
}

// ======= 扫描 + 注入 inner =======
function setupBoxes() {
  boxes = []
  boxByEl = new Map()
  const scanNode = props.scanRoot
      ? (typeof props.scanRoot === 'string' ? document.querySelector(props.scanRoot) : props.scanRoot)
      : rootEl.value
  if (!scanNode) return

  // 先把 Markdown 渲染成 DOM（含可拖拽的代码块），否则代码块进不了这次扫描
  prepareMarkdownBoxes(scanNode)

  const allBoxEls = Array.from(scanNode.querySelectorAll(props.selector))
  const rootIsBox = scanNode.matches && scanNode.matches(props.selector)
  const els = rootIsBox ? [scanNode, ...allBoxEls] : allBoxEls

  // 第一遍：给每个 box 注入 inner + text span，读配置，拿 naturalRect
  els.forEach((el, i) => {
    const cs = getComputedStyle(el)
    if (cs.position === 'static') el.style.position = 'relative'

    const mode = resolveMode(el)

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

      // 富文本：data-html 显式给出结构时以它为准
      if (mode === 'html' && el.dataset.html !== undefined) span.innerHTML = el.dataset.html

      el.appendChild(inner)
      childBoxes.forEach((cb) => el.appendChild(cb))
    } else {
      span = inner._span || inner.querySelector('span.vpb-text')
      if (!span) {
        span = document.createElement('span')
        span.className = 'vpb-text'
        inner.appendChild(span)
        inner._span = span
      }
      // 首次扫描时缓存原始文本，restart 清空 span 后依然能找回
      if (inner._originText === undefined) inner._originText = span.textContent.trim()
    }

    // 富文本容器：换成 div（可合法容纳 h1/p/ul/pre）+ 块级排版
    if (mode !== 'text') {
      if (span.tagName !== 'DIV') {
        const div = document.createElement('div')
        div.className = span.className
        while (span.firstChild) div.appendChild(span.firstChild)
        span.parentNode.replaceChild(div, span)
        span = div
        inner._span = span
      }
      inner.classList.add('vpb-rich-inner')
      span.classList.add('vpb-rich')
      if (props.interactive) el.classList.add('vpb-interactive')
    } else if (props.interactive && el.classList.contains('vpb-md-code')) {
      // Markdown 代码块也允许完成后选中复制
      el.classList.add('vpb-interactive')
    }

    // 富文本拖拽中不能覆写结构（里面可能嵌着可拖拽的代码块），改用独立占位符
    if (mode !== 'text' && !inner.querySelector(':scope > .vpb-placeholder')) {
      const ph = document.createElement('span')
      ph.className = 'vpb-placeholder'
      ph.setAttribute('aria-hidden', 'true')
      ph.textContent = el.dataset.placeholder !== undefined ? el.dataset.placeholder : '·'
      inner.appendChild(ph)
    }

    // inner 创建好、文本搬好之后再读配置（用缓存的原始文本，重播也不会丢）
    const cfg = readBoxConfig(el, inner._originText ?? '', mode)

    // data-big-text 需要配套的 big-text-box 类才能启用换行样式
    if (cfg.bigText && !el.classList.contains('big-text-box')) el.classList.add('big-text-box')

    // 高度自适应：Markdown 默认向下平铺（内容多高盒子就多高），
    // 其它模式写 data-height="auto" 同样生效；显式 data-height="480" 仍是固定高度
    const autoHeight = el.dataset.height === 'auto' ||
        (mode === 'markdown' && el.dataset.height === undefined)
    if (autoHeight) {
      // 此刻 inner 还没被 absolute 接管，自然高度就是内容 + 内边距
      const h = measureInnerHeight(inner, cfg.finalW)
      if (h > 0) {
        cfg.finalH = h
        el.style.height = h + 'px'
      }
      // 内容不会溢出：不做内部滚动容器，滚轮直接交给页面
      el.classList.add('vpb-auto-height')
    }

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
      cfg, autoHeight,
      rect: { left: 0, top: 0 },
      parentIdx: -1, children: [],
      state: 0, stretch: 0,
      maxStretch: Math.max(cfg.finalW - cfg.initW, cfg.finalH - cfg.initH, 1),
      dragPointerIdx: -1, dragLine: null,
      _signX: 1, _signY: 1,
    })
    boxByEl.set(el, boxes[boxes.length - 1])
  })

  // 第二遍：父子关系
  boxes.forEach((b) => {
    let parentEl = b.el.parentElement
    while (parentEl) {
      const p = boxByEl.get(parentEl)
      if (p) {
        b.parentIdx = p.i
        p.children.push(b.i)
        break
      }
      parentEl = parentEl.parentElement
    }
  })

  // 新的一批盒子，位置缓存全部作废
  markRectsDirty()
}

// ======= 状态控制 =======
function isParentReady(b) {
  if (b.parentIdx < 0) return true
  const p = boxes[b.parentIdx]
  return p && p.state === 3
}

// Markdown 代码块的宽度跟随父级内容列，激活 / 拖拽前按当前布局刷新一次
function refreshBoxWidth(b) {
  if (!b.el.classList.contains('vpb-md-code')) return
  const w = Math.round(b.el.offsetWidth)
  if (!w || Math.abs(w - b.cfg.finalW) <= 2) return
  b.cfg.finalW = w
  b.maxStretch = Math.max(w - b.cfg.initW, b.cfg.finalH - b.cfg.initH, 1)
}

// 自适应高度的 box：宽度变了内容高度也会变，重新平铺一次
function refreshAutoHeight(b) {
  if (!b.autoHeight) return
  const h = measureInnerHeight(b.inner, b.cfg.finalW)
  if (!h || Math.abs(h - b.cfg.finalH) <= 1) return
  b.cfg.finalH = h
  b.maxStretch = Math.max(b.cfg.finalW - b.cfg.initW, h - b.cfg.initH, 1)
  b.el.style.height = h + 'px'
  if (b.state === 3) b.inner.style.height = h + 'px'
  // 高度变了，后面所有盒子的位置都要重新量
  markRectsDirty()
}

function showBox(b) {
  if (b.state !== 0) return
  if (!isParentReady(b)) return
  refreshBoxWidth(b)
  b.state = 1
  b.el.classList.add('show')
  // 清掉 inline opacity，让 CSS 类 .vpb-box.show .vpb-inner { opacity:1 } 生效
  b.inner.style.opacity = ''
  if (b.cfg.mode === 'text') {
    // 纯文本：文字等拖拽完成后再重建，这里先清空
    if (b.span) b.span.textContent = ''
  } else if (b.span) {
    // 富文本：结构必须保留（里面可能嵌着可拖拽的代码块），只把内容藏起来
    b.span.style.opacity = '0'
  }
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
  if (b.cfg.mode === 'text') {
    b.span.style.opacity = '1'
    b.span.innerHTML = ''
    b.span.textContent = b.cfg.placeholder
  } else {
    // 富文本保留结构（含子 box），只隐藏内容
    b.span.style.opacity = ''
  }
  if (b.dragLine) { b.dragLine.remove(); b.dragLine = null }
  b.children.forEach((ci) => resetBox(boxes[ci]))
}

// ======= 指针 =======
// 指针位置用 transform 提交（不动 left/top）：每帧只走合成，不触发排版
function setPointerPos(p) {
  const x = p.x.toFixed(1), y = p.y.toFixed(1)
  p.el.style.transform = p.typing
      ? 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-.65em)'
      : 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-50%)'
}

function markNear(p, on) {
  if (p.near === on) return
  p.near = on
  if (on) p.el.classList.add('near')
  else p.el.classList.remove('near')
}

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
    layer.appendChild(div)
    const p = {
      el: div, x, y,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      hue, near: false, lockedBox: -1, cooldown: 0, typing: false, chaseBox: -1,
    }
    setPointerPos(p)
    pointers.push(p)
  }
}

// 视口变化：只把指针收进新视口，不必重建 pointerCount 个 SVG
function repositionPointers() {
  const vw = Math.max(window.innerWidth - 20, 20)
  const vh = Math.max(window.innerHeight - 20, 20)
  pointers.forEach((p) => {
    if (p.lockedBox >= 0 || p.typing) return
    p.x = Math.min(Math.max(p.x, 20), vw)
    p.y = Math.min(Math.max(p.y, 20), vh)
    setPointerPos(p)
  })
}

// ======= 拖拽 =======
function startDrag(b, pointerIdx) {
  if (b.state !== 1) return
  const p = pointers[pointerIdx]
  if (!p || p.lockedBox >= 0 || p.typing) return
  for (const bb of boxes) if (bb !== b && bb.dragPointerIdx === pointerIdx) return

  refreshBoxWidth(b)
  b.state = 2; b.dragPointerIdx = pointerIdx; b.stretch = 0
  p.lockedBox = b.i
  p.chaseBox = -1
  p.el.classList.add('dragging')
  markNear(p, false)
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
  setPointerPos(p)
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
  if (b.cfg.mode === 'text') {
    b.span.innerHTML = ''
    b.span.textContent = ''
  }

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

  // 纯文本父 box：拖完立刻放子 box 出来；富文本等打字结束再激活（见 endTyping）
  if (b.cfg.mode === 'text') activateChildren(b)

  later(() => startTyping(b, typePIdx), 400)
}

// ======= 打字 =======
// 逐字动画的起止态：字符多时去掉 blur，只留位移 + 缩放 + 透明度
const charFrom = (n) => n > props.blurCharLimit
    ? { opacity: 0, y: 6, scale: 0.92 }
    : { opacity: 0, y: 8, scale: 0.7, filter: 'blur(3px)' }
const charTo = (n) => n > props.blurCharLimit
    ? { opacity: 1, y: 0, scale: 1 }
    : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
const charClear = (n) => n > props.blurCharLimit ? 'opacity,transform' : 'opacity,transform,filter'

function endTyping(b, pointerIdx) {
  if (pointerIdx >= 0 && pointers[pointerIdx]) {
    const p = pointers[pointerIdx]
    p.el.classList.remove('typing-cursor')
    p.typing = false; p.cooldown = 0
    const ang = Math.random() * Math.PI * 2
    p.vx = Math.cos(ang) * 1.8; p.vy = Math.sin(ang) * 1.8
  }
  b.el.classList.remove('typing')
  // 逐字拆成 inline-block 后行高会涨几像素，自适应高度的盒子此时再校一次
  refreshAutoHeight(b)
  // 富文本父 box 打字完成后，才轮到子 box（比如 Markdown 代码块）
  activateChildren(b)
}

function activateChildren(b) {
  b.children.forEach((ci) => {
    const child = boxes[ci]
    if (child && child.state === 0) showBox(child)
  })
}

// 把打字指针移到内容中心，并切换成 I 形光标
function focusPointer(b, pointerIdx, span) {
  if (pointerIdx < 0 || !pointers[pointerIdx]) return
  const p = pointers[pointerIdx]
  p.vx = 0; p.vy = 0
  p.cooldown = span + 120
  p.el.classList.add('typing-cursor')
  const r = getNaturalRect(b)
  const targetX = r.left + r.width / 2
  const targetY = r.top + r.height / 2
  tweens.push(gsap.to(p, {
    x: targetX, y: targetY, duration: 0.6, ease: 'power2.out',
    onUpdate: () => setPointerPos(p),
  }))
}

function startTyping(b, pointerIdx) {
  if (b.cfg.mode === 'html' || b.cfg.mode === 'markdown') return startRichTyping(b, pointerIdx)

  const text = readText(b)
  if (!text) { endTyping(b, pointerIdx); return }

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
    b.span.appendChild(c)
  }
  const chars = Array.from(b.span.querySelectorAll('.vpb-char'))
  b.el.classList.add('typing')
  if (!chars.length) {
    endTyping(b, pointerIdx)
    emit('typed', { index: b.i, text })
    return
  }
  focusPointer(b, pointerIdx, chars.length)

  // 起始态交给 GSAP，结束时 clearProps —— 终态样式仍由外部 CSS 决定
  const n = chars.length
  gsap.set(chars, charFrom(n))

  const stagger = b.cfg.stagger ?? (b.cfg.bigText ? props.bigTextStagger : props.normalStagger)
  const tl = gsap.timeline({
    delay: props.typeDelay / 1000,
    onComplete: () => {
      endTyping(b, pointerIdx)
      emit('typed', { index: b.i, text })
    },
  })
  tweens.push(tl)
  tl.to(chars, {
    ...charTo(n),
    duration: 0.22, ease: 'back.out(1.5)', stagger,
  })
  tl.set(chars, { clearProps: charClear(n) })
}

// 富文本：保留标签结构，只让文字逐个浮现，图片 / 分割线等整体淡入
// 注意：内容原地拆分而不是重建，否则内嵌的子 box（如 Markdown 代码块）会被销毁
function startRichTyping(b, pointerIdx) {
  const span = b.span

  // 上一次的字符 span 还原成文本（重播 / 滚回再进入时），子 box 内部的字符不动
  span.querySelectorAll('.vpb-char').forEach((c) => {
    if (c.closest('.vpb-box') !== b.el) return
    c.replaceWith(document.createTextNode(c.textContent))
  })
  span.style.opacity = '1'

  const plain = span.textContent || ''
  const hasNode = !!span.querySelector('img,picture,video,audio,iframe,canvas,svg,hr,table')
  if (!plain.trim() && !hasNode) { endTyping(b, pointerIdx); return }

  b.el.classList.add('typing')

  // 超长内容：逐字拆分代价过高，改为整体淡入
  if (plain.length > props.richCharLimit) {
    focusPointer(b, pointerIdx, 30)
    const tl = gsap.timeline({
      delay: props.typeDelay / 1000,
      onComplete: () => {
        endTyping(b, pointerIdx)
        emit('typed', { index: b.i, text: plain })
      },
    })
    tweens.push(tl)
    tl.from(span, { opacity: 0, duration: 0.8, ease: 'power2.out' })
    return
  }

  const { chars, media } = wrapRichText(span, props.splitUnit)
  const stagger = b.cfg.stagger ?? (b.cfg.bigText ? props.bigTextStagger : props.normalStagger)
  focusPointer(b, pointerIdx, chars.length)

  const tl = gsap.timeline({
    delay: props.typeDelay / 1000,
    onComplete: () => {
      endTyping(b, pointerIdx)
      emit('typed', { index: b.i, text: plain })
    },
  })
  tweens.push(tl)

  if (chars.length) {
    const n = chars.length
    gsap.set(chars, charFrom(n))
    tl.to(chars, {
      ...charTo(n),
      duration: 0.22, ease: 'back.out(1.5)', stagger,
    })
    tl.set(chars, { clearProps: charClear(n) })
  }

  media.forEach((m) => {
    gsap.set(m.el, { opacity: 0 })
    tl.to(m.el, { opacity: 1, duration: 0.35, ease: 'power2.out' }, Math.max(0, m.at - 1) * stagger)
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

// 盒子是否在视口内（读缓存矩形，零布局开销）
function isOnScreen(b, vw, vh) {
  const r = b.rect
  return r.top < vh && r.top + b.cfg.finalH > 0 && r.left < vw && r.left + b.cfg.finalW > 0
}

function tick() {
  // 组件整块滚出视口：指针层已隐藏，不再计算
  if (!active) { rafId = requestAnimationFrame(tick); return }

  const vw = window.innerWidth, vh = window.innerHeight
  // 一帧只量一轮位置，后面全部读缓存（读写分离，避免 layout thrash）
  if (rectsDirty) refreshRects()
  const nearRadius = props.nearRadius, lockRadius = props.lockRadius, seekSpeed = props.seekSpeed

  // 1. 指针游走
  for (const p of pointers) {
    // 被等待中的 box 召唤：直线加速飞过去，不再靠随机游走碰运气
    if (p.chaseBox >= 0) {
      const b = boxes[p.chaseBox]
      // 目标消失或已滚出视口：停止追击，不再为一个看不见的盒子空转
      if (!b || b.state !== 1 || !isOnScreen(b, vw, vh)) {
        p.chaseBox = -1
      } else {
        const dx = b.rect.left + b.cfg.finalW / 2 - p.x
        const dy = b.rect.top + b.cfg.finalH / 2 - p.y
        const d = Math.sqrt(dx * dx + dy * dy) || 1
        const speed = Math.min(seekSpeed, Math.max(2, d * 0.06))
        p.x += (dx / d) * speed
        p.y += (dy / d) * speed
        markNear(p, true)
        setPointerPos(p)
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
    markNear(p, false)
    setPointerPos(p)
  }

  // 2. 等待中的 box 吸引自由指针
  for (const b of boxes) {
    if (b.state !== 1) continue
    // 视口外的盒子直接跳过：没人看得见，也不必再量位置
    if (!isOnScreen(b, vw, vh)) continue
    const bw = b.cfg.finalW, bh = b.cfg.finalH
    const cx = b.rect.left + bw / 2
    const cy = b.rect.top + bh / 2

    let bestIdx = -1, bestDist = Infinity
    for (let i = 0; i < pointers.length; i++) {
      const pp = pointers[i]
      if (pp.lockedBox >= 0 || pp.cooldown > 0 || pp.typing) continue
      // 已被其他 box 召唤的指针不再参与竞争
      if (pp.chaseBox >= 0 && pp.chaseBox !== b.i) continue
      const ddx = pp.x - cx, ddy = pp.y - cy
      const d = Math.sqrt(ddx * ddx + ddy * ddy)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }
    if (bestIdx < 0) continue

    const np = pointers[bestIdx]
    if (bestDist < nearRadius) {
      markNear(np, true)
      const dx = cx - np.x, dy = cy - np.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const pull = 0.08 * (1 - bestDist / nearRadius)
      np.vx += (dx / d) * pull; np.vy += (dy / d) * pull
    }
    if (bestDist < lockRadius) {
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
    // 位置取本帧的矩形缓存，不再每帧强制同步布局
    const elLeft = b.rect.left, elTop = b.rect.top
    const scx = elLeft + b.cfg.finalW / 2
    const scy = elTop + b.cfg.finalH / 2
    const ax = scx - sx * b.cfg.finalW / 2
    const ay = scy - sy * b.cfg.finalH / 2

    dp.x = sx !== 0 ? ax + sx * w : scx
    dp.y = sy !== 0 ? ay + sy * h : scy

    let innerLeft = sx >= 0 ? ax : ax - w
    let innerTop = sy >= 0 ? ay : ay - h
    if (sx === 0) innerLeft = scx - w / 2
    if (sy === 0) innerTop = scy - h / 2

    innerLeft -= elLeft; innerTop -= elTop

    b.inner.style.width = w.toFixed(1) + 'px'
    b.inner.style.height = h.toFixed(1) + 'px'
    b.inner.style.borderRadius = rad.toFixed(1) + 'px'
    b.inner.style.left = innerLeft.toFixed(1) + 'px'
    b.inner.style.top = innerTop.toFixed(1) + 'px'

    // 放大过程中只显示占位符（字号由 CSS 控制，方便外部覆盖）
    // 富文本用独立的 .vpb-placeholder，不能覆写结构
    if (b.cfg.mode === 'text' && b.span.textContent !== b.cfg.placeholder) {
      b.span.textContent = b.cfg.placeholder
    }

    setPointerPos(dp)

    if (b.dragLine) {
      const lx = dp.x - ax, ly = dp.y - ay
      const L = Math.sqrt(lx * lx + ly * ly)
      const ang = Math.atan2(ly, lx)
      b.dragLine.style.left = ax + 'px'
      b.dragLine.style.top = ay + 'px'
      b.dragLine.style.width = L.toFixed(1) + 'px'
      b.dragLine.style.transform = `rotate(${ang}rad)`
      b.dragLine.style.opacity = '1'
    }

    if (b.stretch >= b.maxStretch - 0.5) finishDrag(b)
  }

  // 4. 位置安全网：外部布局变化（字体、图片加载）后把位置拉回来
  // 降频到 1s 一次，只检查视口内的盒子，顺便把矩形缓存刷新一遍
  geomTick++
  if (geomTick >= 60) {
    geomTick = 0
    refreshRects()
    for (const b of boxes) {
      if (b.state !== 3) continue
      if (!isOnScreen(b, vw, vh)) continue
      const ir = b.inner.getBoundingClientRect()
      const err = Math.abs(ir.left - b.rect.left) + Math.abs(ir.top - b.rect.top) +
          Math.abs(ir.width - b.cfg.finalW) + Math.abs(ir.height - b.cfg.finalH)
      if (err > 4) {
        // inner 就贴在 el 的左上角（原来的 r.left - elRect.left 恒为 0）
        b.inner.style.left = '0px'
        b.inner.style.top = '0px'
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
      // Map 直查，不用在 boxes 里线性找
      const b = boxByEl.get(entry.target)
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
    // 视口变了，所有缓存位置作废
    markRectsDirty()
    boxes.forEach((b) => {
      refreshBoxWidth(b)
      refreshAutoHeight(b)
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
  // 滚动只让缓存失效，真正的读取集中在 tick 里做
  window.addEventListener('scroll', markRectsDirty, { passive: true })
  // 组件整块离开视口：隐藏指针层并停止模拟，省下整块 CPU
  if (typeof IntersectionObserver !== 'undefined' && rootEl.value) {
    rootObserver = new IntersectionObserver((entries) => {
      const on = entries[0].isIntersecting
      if (on === active) return
      active = on
      const layer = layerEl.value
      if (layer) layer.style.display = on ? '' : 'none'
      if (on) markRectsDirty()
    }, { rootMargin: '120px' })
    rootObserver.observe(rootEl.value)
  }
  rafId = requestAnimationFrame(tick)
  emit('ready', { count: boxes.length })
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId); rafId = null
  window.removeEventListener('resize', onResize)
  window.removeEventListener('scroll', markRectsDirty)
  if (rootObserver) { rootObserver.disconnect(); rootObserver = null }
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
