// 组件自带样式（运行时注入，使用方无需额外引入 CSS 文件）
const CSS = `
.vpb-root{position:relative;width:100%;overflow-x:clip;color:#2c2e3a;font-family:system-ui,'Segoe UI',Roboto,sans-serif;}
.vpb-pointer-layer{position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;overflow:hidden;z-index:var(--vpb-pointer-z,9999);}
.vpb-box{/* 用户写的元素：占位容器，不动 */}
.vpb-box.show{/* 父 box 被激活时给个整体标记 */}
.vpb-inner{position:absolute;left:0;top:0;background:#fff;box-shadow:0 4px 14px rgba(40,50,80,.08);display:flex;align-items:center;justify-content:center;font-weight:500;color:#5a5e75;border:1px solid rgba(120,130,170,.15);overflow:hidden;opacity:0;transition:opacity .5s ease,box-shadow .3s ease;will-change:left,top,width,height,border-radius;pointer-events:none;user-select:none;box-sizing:border-box;}
.vpb-box.show .vpb-inner{opacity:1;}
.vpb-box.dragging .vpb-inner{box-shadow:0 10px 36px rgba(70,120,200,.28),0 0 0 2px rgba(100,160,255,.5);border-color:rgba(100,160,255,.4);}
.vpb-box.done .vpb-inner{box-shadow:0 14px 40px rgba(70,180,140,.3),0 0 0 2px rgba(100,200,160,.55);border-color:rgba(100,200,160,.45);color:#3a7a65;}
.vpb-inner .vpb-text{white-space:nowrap;pointer-events:none;user-select:none;}
.vpb-box.big-text-box .vpb-inner .vpb-text{white-space:normal;text-align:justify;line-height:1.65;font-size:.82rem;letter-spacing:.3px;}
.vpb-cursor-mock{position:absolute;width:var(--vpb-pointer-size,26px);height:var(--vpb-pointer-size,26px);pointer-events:none;transform:translate(-50%,-50%);opacity:var(--vpb-idle-opacity,.35);filter:drop-shadow(0 0 3px currentColor);will-change:left,top,opacity,filter;transition:opacity .25s ease,filter .25s ease,width .25s ease,height .25s ease;}
.vpb-cursor-mock svg{display:block;width:100%;height:100%;overflow:visible;}
.vpb-cursor-mock svg path{fill:currentColor;stroke:#e8eaf2;stroke-width:1;stroke-linejoin:round;stroke-opacity:.7;}
.vpb-cursor-mock.near{opacity:var(--vpb-near-opacity,.75);filter:drop-shadow(0 0 10px currentColor) brightness(1.4);}
.vpb-cursor-mock.dragging{width:var(--vpb-pointer-drag-size,38px);height:var(--vpb-pointer-drag-size,38px);opacity:1;filter:drop-shadow(0 0 16px currentColor) drop-shadow(0 0 32px currentColor) brightness(1.7);}
.vpb-cursor-mock.dragging svg path{stroke:#fff;stroke-opacity:.95;}
.vpb-cursor-mock.typing-cursor svg{display:none;}
.vpb-cursor-mock.typing-cursor{width:2px;height:1.3em;opacity:1;filter:none;background:#3a7a65;border-radius:1px;animation:vpb-type-blink .6s step-end infinite;transform:translate(-50%,-.65em);}
@keyframes vpb-type-blink{0%,100%{opacity:1}50%{opacity:0}}
.vpb-drag-line{position:absolute;pointer-events:none;height:2px;background:linear-gradient(90deg,rgba(100,160,255,0),rgba(100,160,255,.85));transform-origin:0 50%;opacity:0;}
.vpb-hint{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,.9);padding:10px 22px;border-radius:40px;font-size:.8rem;color:#6b6f85;border:1px solid rgba(120,130,170,.18);box-shadow:0 4px 16px rgba(40,50,80,.08);pointer-events:none;letter-spacing:1px;z-index:10000;}
@media(max-width:600px){.vpb-hint{font-size:.7rem;width:85%;text-align:center}}
`

const STYLE_ID = 'vpb-injected-styles'

export function injectStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}
