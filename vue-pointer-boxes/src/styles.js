// 组件自带样式（运行时注入，使用方无需额外引入 CSS 文件）
// 全部规则位于 @layer vue-pointer-boxes 中：
// 外部（未分层）的普通样式在级联中优先级更高，可直接覆盖组件内部 DOM，
// 无需提高选择器权重或加 !important。
// 字体相关属性一律继承宿主元素（font: inherit），组件不写死字体族 / 字号 / 行高 / 字重。
const CSS = `
@layer vue-pointer-boxes {
/* ================= 根节点 ================= */
.vpb-root{position:relative;width:100%;overflow-x:clip;color:var(--vpb-color,inherit);font-family:var(--vpb-font-family,inherit);font-size:var(--vpb-root-font-size,inherit);line-height:var(--vpb-line-height,inherit);}
.vpb-root.vpb-hide-cursor{cursor:none;}

/* ================= 指针层 ================= */
.vpb-pointer-layer{position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;overflow:hidden;z-index:var(--vpb-pointer-z,9999);}
/* 静止态不加 filter：每个指针都是一个独立的合成层，高斯模糊会让它每帧重新栅格化，
   指针越多开销越大（20 个指针足以吃掉三分之一的主线程）。想要旧版的柔和光晕，
   宿主写 --vpb-idle-glow: drop-shadow(0 0 3px currentColor) 即可恢复 */
.vpb-cursor-mock{position:absolute;left:0;top:0;width:var(--vpb-pointer-size,26px);height:var(--vpb-pointer-size,26px);pointer-events:none;transform:translate(-50%,-50%);opacity:var(--vpb-idle-opacity,.35);filter:var(--vpb-idle-glow,none);will-change:transform,opacity;transition:opacity .25s ease,filter .25s ease,width .25s ease,height .25s ease;}
.vpb-cursor-mock svg{display:block;width:100%;height:100%;overflow:visible;}
.vpb-cursor-mock svg path{fill:currentColor;stroke:#e8eaf2;stroke-width:1;stroke-linejoin:round;stroke-opacity:.7;}
.vpb-cursor-mock.near{opacity:var(--vpb-near-opacity,.75);filter:drop-shadow(0 0 10px currentColor) brightness(1.4);}
.vpb-cursor-mock.dragging{width:var(--vpb-pointer-drag-size,38px);height:var(--vpb-pointer-drag-size,38px);opacity:1;filter:drop-shadow(0 0 16px currentColor) drop-shadow(0 0 32px currentColor) brightness(1.7);}
.vpb-cursor-mock.dragging svg path{stroke:#fff;stroke-opacity:.95;}
.vpb-cursor-mock.typing-cursor svg{display:none;}
.vpb-cursor-mock.typing-cursor{width:2px;height:1.3em;opacity:1;filter:none;background:var(--vpb-caret-color,#3a7a65);border-radius:1px;animation:vpb-type-blink .6s step-end infinite;transform:translate(-50%,-.65em);}
@keyframes vpb-type-blink{0%,100%{opacity:1}50%{opacity:0}}
.vpb-drag-line{position:absolute;pointer-events:none;height:2px;background:linear-gradient(90deg,rgba(100,160,255,0),rgba(100,160,255,.85));transform-origin:0 50%;opacity:0;}

/* ================= 元素容器 ================= */
.vpb-box{/* 用户自己写的元素：只做占位，不改它的排版 */}
.vpb-box.show{/* 父 box 被激活时给个整体标记 */}
.vpb-inner{position:absolute;left:0;top:0;background:var(--vpb-inner-bg,#fff);box-shadow:0 4px 14px rgba(40,50,80,.08);display:flex;align-items:center;justify-content:center;font-family:inherit;font-size:inherit;font-weight:var(--vpb-font-weight,inherit);font-style:inherit;line-height:inherit;letter-spacing:inherit;text-align:inherit;color:var(--vpb-text-color,#5a5e75);border:1px solid rgba(120,130,170,.15);overflow:hidden;opacity:0;transition:opacity .5s ease,box-shadow .3s ease;pointer-events:none;user-select:none;box-sizing:border-box;}
/* will-change 只在真正拖拽的那个盒子上开（同时几十个盒子都开 = 同数量的合成层） */
.vpb-box.dragging .vpb-inner{will-change:left,top,width,height,border-radius;}
.vpb-box.show .vpb-inner{opacity:1;}
.vpb-box.dragging .vpb-inner{box-shadow:0 10px 36px rgba(70,120,200,.28),0 0 0 2px rgba(100,160,255,.5);border-color:rgba(100,160,255,.4);}
.vpb-box.done .vpb-inner{box-shadow:0 14px 40px rgba(70,180,140,.3),0 0 0 2px rgba(100,200,160,.55);border-color:rgba(100,200,160,.45);color:var(--vpb-done-color,#3a7a65);}

/* ================= 文本：继承宿主字体 ================= */
.vpb-inner .vpb-text{display:block;pointer-events:none;user-select:none;font-family:inherit;font-size:var(--vpb-font-size,inherit);font-weight:inherit;font-style:inherit;line-height:var(--vpb-line-height,inherit);letter-spacing:inherit;color:inherit;text-align:inherit;white-space:nowrap;}
.vpb-inner .vpb-char{display:inline-block;white-space:pre;font:inherit;color:inherit;letter-spacing:inherit;vertical-align:baseline;}
.vpb-box.big-text-box .vpb-inner .vpb-text{white-space:normal;text-align:justify;line-height:var(--vpb-big-line-height,inherit);font-size:var(--vpb-big-font-size,inherit);letter-spacing:var(--vpb-big-letter-spacing,inherit);}
.vpb-box.dragging .vpb-inner .vpb-text{font-size:var(--vpb-drag-font-size,.9rem);}

/* ================= 富文本（HTML / Markdown） ================= */
.vpb-inner.vpb-rich-inner{display:block;text-align:left;padding:var(--vpb-rich-padding,0);}
.vpb-box.big-text-box .vpb-inner.vpb-rich-inner .vpb-text{text-align:left;line-height:var(--vpb-rich-line-height,inherit);font-size:var(--vpb-rich-font-size,inherit);letter-spacing:inherit;}
.vpb-inner.vpb-rich-inner .vpb-text{display:block;width:100%;height:100%;overflow:hidden;white-space:normal;overflow-wrap:break-word;word-break:break-word;text-align:left;scrollbar-width:none;-ms-overflow-style:none;}
/* 兜底：宿主给了固定高度、内容确实超出时仍可滚动，但不显示滚动条 */
.vpb-inner.vpb-rich-inner .vpb-text::-webkit-scrollbar{width:0;height:0;display:none;}
.vpb-box.done .vpb-inner.vpb-rich-inner .vpb-text{overflow:auto;}
/* 高度自适应的卡片内容不会溢出，保持 hidden：滚轮不被卡片吃掉，直接滚页面 */
.vpb-box.vpb-auto-height.done .vpb-inner.vpb-rich-inner .vpb-text{overflow:hidden;}
/* 拖拽中的盒子只显示占位符，正文用 display:none 摘出布局（见 PointerBoxes.vue startDrag）：
   富文本内容不再跟着每帧变化的宽高重排 */
.vpb-box.dragging .vpb-inner.vpb-rich-inner .vpb-text{display:none;}
.vpb-box.vpb-interactive.done .vpb-inner{pointer-events:auto;user-select:text;}
.vpb-box.vpb-interactive.done .vpb-inner .vpb-text,
.vpb-box.vpb-interactive.done .vpb-inner .vpb-char{pointer-events:auto;user-select:text;-webkit-user-select:text;}
/* 富文本拖拽中只显示占位符，结构本身不能动 */
.vpb-inner .vpb-placeholder{display:none;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:var(--vpb-drag-font-size,.9rem);opacity:.5;pointer-events:none;}
.vpb-box.dragging .vpb-inner .vpb-placeholder{display:block;}
.vpb-node{will-change:opacity;}

/* 富文本内部排版：字号全部用 em，跟随宿主字号缩放 */
.vpb-rich>*:first-child{margin-top:0;}
.vpb-rich>*:last-child{margin-bottom:0;}
.vpb-rich p{margin:0 0 .7em;}
.vpb-rich h1,.vpb-rich h2,.vpb-rich h3,.vpb-rich h4,.vpb-rich h5,.vpb-rich h6{margin:0 0 .5em;font-weight:700;line-height:1.3;letter-spacing:inherit;}
.vpb-rich h1{font-size:1.7em;}
.vpb-rich h2{font-size:1.4em;}
.vpb-rich h3{font-size:1.2em;}
.vpb-rich h4{font-size:1.05em;}
.vpb-rich h5,.vpb-rich h6{font-size:1em;}
.vpb-rich ul,.vpb-rich ol{margin:0 0 .7em;padding-left:1.4em;}
.vpb-rich li{margin:.15em 0;}
.vpb-rich blockquote{margin:.5em 0;padding:.1em 0 .1em .8em;border-left:3px solid var(--vpb-quote-border,rgba(120,130,170,.35));opacity:.85;}
.vpb-rich a{color:var(--vpb-link-color,inherit);text-decoration:underline;text-underline-offset:2px;}
.vpb-rich strong,.vpb-rich b{font-weight:700;}
.vpb-rich em,.vpb-rich i{font-style:italic;}
.vpb-rich del{text-decoration:line-through;opacity:.7;}
.vpb-rich code{font-family:var(--vpb-mono-font,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:.9em;background:var(--vpb-code-bg,rgba(120,130,170,.14));border-radius:4px;padding:.1em .35em;}
/* Markdown 内容包在 .vpb-md-body 里，方便子 box（代码块）跟着结构一起走 */
.vpb-rich .vpb-md-body>*:last-child{margin-bottom:0;}
.vpb-rich pre{margin:0 0 .7em;padding:.7em .9em;overflow:auto;background:var(--vpb-pre-bg,rgba(120,130,170,.12));border-radius:8px;line-height:1.6;}
.vpb-rich pre code{background:none;padding:0;font-size:.88em;white-space:pre;}
/* Markdown 围栏代码块：自身就是一个 .vpb-box，由指针单独拖开 */
/* 用 .vpb-box 前缀（而非 .vpb-rich 后代）保证它脱离富文本流时字号 / 行高也一致，
   这样代码块的高度能在预渲染阶段就量准，父级卡片据此平铺 */
.vpb-box.vpb-md-code{margin:0 0 .9em;padding:0;background:none;border:0;overflow:visible;box-sizing:border-box;font-family:var(--vpb-mono-font,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:var(--vpb-md-code-font-size,.78rem);line-height:var(--vpb-md-code-line-height,1.7);white-space:pre;}
.vpb-box.vpb-md-code .vpb-inner{padding:var(--vpb-md-code-padding,12px 14px);justify-content:flex-start;}
.vpb-box.vpb-md-code .vpb-inner .vpb-text{white-space:pre;overflow:auto;text-align:left;scrollbar-width:none;-ms-overflow-style:none;}
.vpb-box.vpb-md-code .vpb-inner .vpb-text::-webkit-scrollbar{width:0;height:0;display:none;}
.vpb-box.vpb-md-code.done .vpb-inner .vpb-text{overflow:auto;}
.vpb-rich img{display:block;max-width:100%;height:auto;margin:.4em 0;border-radius:6px;}
.vpb-rich hr{margin:.9em 0;border:0;border-top:1px solid var(--vpb-hr-color,rgba(120,130,170,.3));}
.vpb-rich table{width:100%;border-collapse:collapse;margin:0 0 .7em;font-size:.92em;}
.vpb-rich th,.vpb-rich td{border:1px solid var(--vpb-table-border,rgba(120,130,170,.3));padding:.35em .5em;text-align:left;}

/* ================= 提示 ================= */
.vpb-hint{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,.9);padding:10px 22px;border-radius:40px;font-size:.8rem;color:#6b6f85;border:1px solid rgba(120,130,170,.18);box-shadow:0 4px 16px rgba(40,50,80,.08);pointer-events:none;letter-spacing:1px;z-index:10000;}
@media(max-width:600px){.vpb-hint{font-size:.7rem;width:85%;text-align:center}}
}
`

const STYLE_ID = 'vpb-injected-styles'

export function injectStyles() {
  if (typeof document === 'undefined') return
  const existing = document.getElementById(STYLE_ID)
  if (existing) {
    // 开发态热更新：样式内容变化时同步刷新
    if (existing.textContent !== CSS) existing.textContent = CSS
    return
  }
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}
