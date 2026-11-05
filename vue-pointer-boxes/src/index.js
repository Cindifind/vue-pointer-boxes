import { createApp } from 'vue'
import PointerBoxes from './PointerBoxes.vue'

PointerBoxes.install = (app) => {
  app.component('PointerBoxes', PointerBoxes)
  app.component('VuePointerBoxes', PointerBoxes)
}

/**
 * 无构建环境下的一行式挂载：
 *   VuePointerBoxes.mount('#app', { pointerCount: 20 })
 * 目标元素里的 HTML（含 .vpb-box 元素）会被保留作为组件 slot 内容。
 * @param {string|Element} target 选择器或 DOM 元素
 * @param {object} options 组件 props（或 { props }）
 */
export function mount(target, options = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target
  if (!el) throw new Error(`[vue-pointer-boxes] 挂载目标不存在: ${target}`)

  // 在 Vue mount 之前，先把用户写的 HTML 保存下来（含 .vpb-box 等元素）
  const userHTML = el.innerHTML

  const props = options.props || options
  const app = createApp(PointerBoxes, props)
  app.mount(el)

  // Vue mount 会清空 target innerHTML 作为 slot，所以 mount 完之后手动插回去
  if (userHTML && userHTML.trim()) {
    // PointerBoxes 根是 .vpb-root，里面结构：pointer-layer → <slot> → hint
    // 我们把用户 HTML 插到 vpb-root 的末尾（slot 位置）、hint 之前
    const root = el.querySelector('.vpb-root')
    if (root) {
      const wrapper = document.createElement('div')
      wrapper.className = 'vpb-user-slot'
      wrapper.innerHTML = userHTML
      const hint = root.querySelector('.vpb-hint')
      if (hint) root.insertBefore(wrapper, hint)
      else root.appendChild(wrapper)
    }
  }

  return app
}

export { PointerBoxes }
export default PointerBoxes
