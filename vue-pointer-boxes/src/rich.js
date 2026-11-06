// 富文本逐字处理：保留原有标签结构，只把「文本节点」拆成 .vpb-char；
// 图片 / 视频 / 分隔线等替换元素整体标记为 .vpb-node，做淡入而不是拆字。
// unit = 'char' 逐字符（默认）；unit = 'word' 整词（西文保留 kerning 与连字）
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'])
const MEDIA_TAGS = new Set([
  'IMG', 'PICTURE', 'VIDEO', 'AUDIO', 'IFRAME', 'CANVAS', 'SVG',
  'HR', 'INPUT', 'SELECT', 'TEXTAREA', 'OBJECT', 'EMBED',
])

export function wrapRichText(root, unit = 'char') {
  const wordMode = unit === 'word'
  const chars = []
  const media = []
  let order = 0

  const addChar = (text) => {
    const s = document.createElement('span')
    s.className = 'vpb-char'
    s.textContent = text
    chars.push(s)
    order++
    return s
  }

  const emitText = (text, frag) => {
    if (wordMode) {
      const tokens = text.match(/\s+|[^\s]+/g) || []
      for (const tk of tokens) frag.appendChild(addChar(tk))
      return
    }
    for (const ch of text) {
      // 富文本容器是 white-space:normal，行内换行按空白处理；
      // 真正的换行由 <p> / <li> / <br> 这些结构负责
      frag.appendChild(addChar(ch === '\n' || ch === '\r' ? ' ' : ch))
    }
  }

  const walk = (parent) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue || ''
        if (!text) continue
        // 纯空白节点（块级标签之间的缩进 / 换行）保持原样：
        // 拆成 inline-block 字符会凭空多出行盒，让段落之间多出空白
        if (!text.trim()) continue
        const frag = document.createDocumentFragment()
        emitText(wordMode ? text.replace(/[\r\n]+/g, ' ') : text, frag)
        parent.replaceChild(frag, node)
        continue
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue

      const tag = node.tagName.toUpperCase()
      if (SKIP_TAGS.has(tag)) continue
      if (node.classList.contains('vpb-box')) continue // 嵌套的子 box 不参与拆字
      if (tag === 'BR') { order++; continue }
      if (MEDIA_TAGS.has(tag)) {
        node.classList.add('vpb-node')
        media.push({ el: node, at: order })
        order++
        continue
      }
      walk(node)
    }
  }

  walk(root)
  return { chars, media }
}

export default wrapRichText
