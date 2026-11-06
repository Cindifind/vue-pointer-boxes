// 内置轻量 Markdown 渲染器：无依赖、默认转义 HTML（不解析裸 HTML，避免 XSS）
// 支持：标题、段落、换行、粗体 / 斜体 / 删除线、行内代码、围栏代码块、
//       链接、图片、有序 / 无序列表、引用、分隔线、表格
// 需要完整语法时，可通过组件的 markdown prop 传入 markdown-it / marked 的渲染函数。
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c])

const isBlank = (l) => !l.trim()
const isFence = (l) => /^\s{0,3}(`{3,}|~{3,})/.test(l)
const isHeading = (l) => /^\s{0,3}#{1,6}\s/.test(l)
const isQuote = (l) => /^\s{0,3}>/.test(l)
const isHr = (l) => /^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l)
const isListItem = (l) => /^\s{0,3}([-*+]|\d{1,9}[.)])\s+/.test(l)
const isBlockStart = (l) =>
  isFence(l) || isHeading(l) || isQuote(l) || isHr(l) || isListItem(l)

const splitRow = (line) =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
const isTableSep = (l) => /\|/.test(l) && splitRow(l).every((c) => /^:?-{1,}:?$/.test(c))

// 行内语法：先转义，再把代码 / 图片 / 链接替换成占位符，最后处理强调
export function inlineMarkdown(src) {
  const store = []
  const keep = (html) => {
    store.push(html)
    return `\u0000${store.length - 1}\u0000`
  }
  let out = escapeHtml(src)

  out = out.replace(/`([^`\n]+)`/g, (_, code) => keep(`<code>${code}</code>`))
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_, alt, url) => keep(`<img src="${url}" alt="${alt}" loading="lazy">`))
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, url) =>
    keep(`<a href="${url}"${/^(https?:)?\/\//i.test(url) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`))

  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
  out = out.replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  out = out.replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>')
  out = out.replace(/\n/g, '<br>')

  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => store[Number(i)])
}

// options.codeBoxes = true 时，围栏代码块会渲染成独立的 .vpb-box（pre.vpb-md-code），
// 由指针单独拖开、单独打字；否则输出普通的 <pre><code>，跟随父级一起逐字浮现。
const CODE_DIRS = ['br', 'tr', 'bl', 'tl']

export function renderMarkdown(source, options = {}) {
  const opts = options || {}
  const codeBoxes = !!opts.codeBoxes
  let codeSeq = 0

  const lines = String(source == null ? '' : source).replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let list = null
  let i = 0

  const closeList = () => {
    if (list) { out.push(`</${list}>`); list = null }
  }

  while (i < lines.length) {
    const line = lines[i]

    // 围栏代码块：原样保留缩进，只做转义
    if (isFence(line)) {
      const open = line.match(/^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/)
      const mark = open[1][0]
      const minLen = open[1].length
      const lang = open[2]
      const buf = []
      i++
      while (i < lines.length) {
        const close = lines[i].match(/^\s{0,3}(`{3,}|~{3,})\s*$/)
        if (close && close[1][0] === mark && close[1].length >= minLen) break
        buf.push(lines[i]); i++
      }
      i++
      closeList()
      const code = escapeHtml(buf.join('\n'))
      if (codeBoxes) {
        const dir = opts.codeDir || CODE_DIRS[codeSeq++ % CODE_DIRS.length]
        out.push(
          `<pre class="vpb-box vpb-md-code" data-dir="${dir}" data-radius="12"` +
          ` data-growth-rate="${opts.codeGrowthRate || 5}" data-stagger="${opts.codeStagger || 0.012}"` +
          `${lang ? ` data-lang="${lang}"` : ''}>${code}</pre>`
        )
      } else {
        out.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${code}</code></pre>`)
      }
      continue
    }

    if (isBlank(line)) { closeList(); i++; continue }
    if (isHr(line)) { closeList(); out.push('<hr>'); i++; continue }

    // 标题
    if (isHeading(line)) {
      const m = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/)
      closeList()
      const lv = m[1].length
      out.push(`<h${lv}>${inlineMarkdown(m[2])}</h${lv}>`)
      i++
      continue
    }

    // 表格（表头 + 分隔行 + 数据行）
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      closeList()
      const head = splitRow(line)
      const aligns = splitRow(lines[i + 1]).map((c) => {
        if (/^:-+:$/.test(c)) return 'center'
        if (/-:$/.test(c)) return 'right'
        if (/^:-+$/.test(c)) return 'left'
        return ''
      })
      i += 2
      const rows = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i])); i++
      }
      const align = (k) => (aligns[k] ? ` style="text-align:${aligns[k]}"` : '')
      const thead = `<thead><tr>${head.map((c, k) => `<th${align(k)}>${inlineMarkdown(c)}</th>`).join('')}</tr></thead>`
      const tbody = rows.length
        ? `<tbody>${rows.map((r) => `<tr>${r.map((c, k) => `<td${align(k)}>${inlineMarkdown(c)}</td>`).join('')}</tr>`).join('')}</tbody>`
        : ''
      out.push(`<table>${thead}${tbody}</table>`)
      continue
    }

    // 引用
    if (isQuote(line)) {
      closeList()
      const buf = []
      while (i < lines.length && isQuote(lines[i])) {
        buf.push(lines[i].replace(/^\s{0,3}>\s?/, '')); i++
      }
      out.push(`<blockquote>${inlineMarkdown(buf.join('\n'))}</blockquote>`)
      continue
    }

    // 列表
    if (isListItem(line)) {
      const m = line.match(/^\s{0,3}([-*+]|\d{1,9}[.)])\s+(.*)$/)
      const type = /\d/.test(m[1]) ? 'ol' : 'ul'
      if (list !== type) { closeList(); out.push(`<${type}>`); list = type }
      out.push(`<li>${inlineMarkdown(m[2])}</li>`)
      i++
      continue
    }

    // 段落：连续非空行合成一段，行内换行保留为 <br>
    closeList()
    const buf = [line.trim()]
    i++
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      buf.push(lines[i].trim()); i++
    }
    out.push(`<p>${buf.map((l) => inlineMarkdown(l)).join('<br>')}</p>`)
  }

  closeList()
  return out.join('\n')
}

export default renderMarkdown
