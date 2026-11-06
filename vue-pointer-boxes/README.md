# vue-pointer-boxes

模拟鼠标指针在页面上游走，从元素的边角拖拽放大并逐字打字的 Vue 3 动画组件。

## 特性

- **元素式引入**：给 DOM 元素加 `class="vpb-box"` 即可，组件自动识别
- **父子继承**：嵌套的子元素在父元素绘制完成后才会被指针发现并激活
- **边角拖拽**：指针从指定角落把元素拉开展开
- **逐字打字**：拖拽完成后文字逐个浮现
- **大文本支持**：长文本自动慢速 stagger 打字，指针变 I 形光标
- **富文本 / Markdown**：`mode="html"` 保留标签结构逐字浮现，`mode="markdown"` 直接渲染 Markdown 源码，围栏代码块会自动变成可拖拽的子 box
- **字体完全继承**：不写死字体族 / 字号 / 行高 / 字重，宿主 CSS 直接生效
- **自包含样式**：组件内部注入 CSS，无需额外引入样式文件（样式位于 `@layer`，外部样式可直接覆盖）
- **双格式分发**：ESM（构建环境）+ UMD（CDN / script 标签直引）

## 安装

```bash
npm install vue-pointer-boxes
```

依赖：`vue ^3.2.0`、`gsap ^3.12.5`

## 快速开始

### 方式一：Vue 单文件组件（推荐）

```vue
<template>
  <PointerBoxes
    :pointer-count="20"
    hint-text="滚动查看动画"
  >
    <!-- 给元素加 class="vpb-box" 即可被识别 -->
    <div
      class="vpb-box"
      style="width:220px;height:170px;border-radius:14px;background:#fff;"
      data-dir="br"
      data-growth-rate="3.0"
    >
      你好世界
    </div>

    <!-- 嵌套：子 box 会在父 box 完成后才激活 -->
    <div
      class="vpb-box"
      style="width:200px;height:200px;border-radius:100px;background:#fff;"
      data-dir="tr"
    >
      父元素
      <div
        class="vpb-box"
        style="width:90px;height:90px;border-radius:50%;background:#fff8e1;"
        data-dir="down"
      >
        子元素
      </div>
    </div>
  </PointerBoxes>
</template>

<script setup>
import PointerBoxes from 'vue-pointer-boxes'
</script>
```

### 方式二：UMD / CDN（无构建环境）

```html
<!DOCTYPE html>
<html>
<body>
  <div id="app">
    <div
      class="vpb-box"
      style="width:220px;height:170px;border-radius:14px;background:#fff;"
      data-dir="br"
    >
      你好世界
    </div>
  </div>

  <script src="./dist/vue-pointer-boxes.umd.js"></script>
  <script>
    VuePointerBoxes.mount('#app', {
      pointerCount: 20,
      hintText: '滚动查看动画',
    })
  </script>
</body>
</html>
```

> UMD 包内嵌了 Vue 3 与 GSAP，无需额外引入。

## 核心概念

### 标记元素

给任意 HTML 元素加 `class="vpb-box"`，组件会自动扫描并注入动画层（`.vpb-inner`）。

元素本身的 `width` / `height` / `border-radius` 即为最终状态的尺寸和圆角。

### 方向（data-dir）

决定指针从哪个角把元素拉开：

| 值 | 方向 | 锚点位置 |
|----|------|----------|
| `br` | 右下角 | 左上角 |
| `tr` | 右上角 | 左下角 |
| `bl` | 左下角 | 右上角 |
| `tl` | 左上角 | 右下角 |
| `right` | 正右方 | 左边缘中心 |
| `left` | 正左方 | 右边缘中心 |
| `down` | 正下方 | 上边缘中心 |
| `up` | 正上方 | 下边缘中心 |

### 父子继承

当一个 `.vpb-box` 嵌套在另一个 `.vpb-box` 内部时：

1. 父元素先进入等待状态，被指针拖拽展开并打字
2. 父元素完成（state=done）后，子元素才被激活进入等待状态
3. 支持任意层级嵌套

## 内容模式

组件按元素内容选择渲染方式，可用 `mode` 全局指定，或用 `data-mode` 单元素覆盖：

| 模式 | 行为 |
|------|------|
| `auto`（默认） | 元素里只有文本 → `text`；含图片 / 标签等子元素 → `html` |
| `text` | 纯文本逐字打字，`\n` 转为换行 |
| `html` | 保留原有标签结构，只把文本节点拆成字符；`<h2>`、`<strong>`、`<a>`、`<pre>` 的排版与字体全部保留 |
| `markdown` | 元素内容或 `data-text` 作为 Markdown 源码，先用内置渲染器转换，再逐字写出；围栏代码块自动升级为独立的 `.vpb-box` |

```vue
<!-- Markdown：直接写源码 -->
<div class="vpb-box" data-mode="markdown" style="width:640px;height:360px">
  ## 标题
  这是 **加粗**、*斜体* 和 `行内代码`。
</div>

<!-- 富文本：已由 markdown-it / marked 渲染好的 HTML -->
<div class="vpb-box" data-mode="html" style="width:640px;height:360px">
  <h2>标题</h2>
  <p>正文 <strong>加粗</strong></p>
</div>

<!-- 或者直接给 HTML 字符串 -->
<div class="vpb-box" data-html="<h2>标题</h2><p>正文</p>" style="width:640px;height:200px"></div>
```

内置渲染器支持标题、段落、粗体 / 斜体 / 删除线、行内代码、围栏代码块、链接、图片、列表、引用、分隔线、表格，并且**默认转义 HTML**（不解析裸标签）。需要完整语法时传入自己的渲染函数：

```vue
<PointerBoxes :markdown="md.render"> ... </PointerBoxes>
```

富文本的几点说明：

- 图片 / 视频 / 分隔线等替换元素整体淡入，不参与拆字
- 超过 `richCharLimit`（默认 3000）字符时改为整体淡入，避免上千个 `span` 拖慢页面
- 超过 `blurCharLimit`（默认 400）字符时，逐字动画会去掉高斯模糊，只保留位移与透明度（模糊要逐个字符单独栅格化，字符越多越贵）
- 西文对字距 / 连字敏感时，用 `split-unit="word"` 以整词为动画单位
- 内容在首次挂载时快照，动态更新请改 `data-html` / `data-text` 或重新挂载

### Markdown 代码块也是可拖拽的盒子

`mode="markdown"` 时，围栏代码块（```` ``` ```` / `~~~`）不会跟随正文一起打字，而是被渲染成 `<pre class="vpb-box vpb-md-code">`——一个真正的子 box：

1. 父级 Markdown 卡片先被指针拖开、逐字写完（代码块位置已留空）
2. 父级打字结束后，指针再单独把代码块从边角拖开，并逐字打出代码
3. 高度在布局阶段量好并固定，代码块出现前后正文不会跳动；宽度始终跟随父级内容列

Markdown 卡片默认**高度自适应**：卡片高度等于「内容 + 内边距」，内容多高就向下铺多长，不会出现内部滚动条；窗口宽度变化后会自动重新量一次。想固定高度就写 `data-height="480"`（超出部分改为静默可滚，不显示滚动条）。

可用的样式钩子：

```css
/* 代码块本体（占位 + 尺寸）与展开后的卡片 */
.vpb-md-code { margin-bottom: 12px; }
.vpb-md-code .vpb-inner { background: #1e2130; padding: 12px 14px; }
.vpb-md-code .vpb-text { color: #d7dbee; }

/* 或直接用样式变量 */
.vpb-md-code {
  --vpb-md-code-font-size: 0.78rem;
  --vpb-md-code-line-height: 1.7;
  --vpb-md-code-padding: 12px 14px;
}
```

代码块默认使用 `data-stagger="0.012"`（快速打字）与 `data-growth-rate="5"`，可通过 `renderMarkdown(src, { codeBoxes: false })` 关掉升级、退回普通 `<pre><code>`；自定义 `markdown` 渲染器返回的 HTML 不会被自动升级。

```vue
<!-- 需要跟正文一起打字的普通代码块：自己渲染好 HTML 后用 html 模式 -->
<div class="vpb-box" data-mode="html" style="width:640px;height:360px">
  <pre><code>const a = 1</code></pre>
</div>
```

## 完整 API

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `selector` | String | `'.vpb-box'` | 扫描的 CSS 选择器 |
| `scanRoot` | String / Element | `null` | 扫描根节点，默认组件自身 |
| `mode` | String | `'auto'` | 内容模式：`auto` / `text` / `html` / `markdown` |
| `markdown` | Function | `null` | 自定义 Markdown 渲染器，如 `markdown-it` 的 `render` |
| `splitUnit` | String | `'char'` | 逐字粒度：`char` 单字符 / `word` 整词 |
| `richCharLimit` | Number | `3000` | 富文本超过该字符数改为整体淡入 |
| `blurCharLimit` | Number | `400` | 逐字数量超过该值时不使用 blur 滤镜 |
| `interactive` | Boolean | `true` | 富文本完成后可选中文字 / 点链接 / 滚动 |
| `initialWidth` | Number | `48` | 元素初始宽度（px），可被 `data-initial-width` 覆盖 |
| `initialHeight` | Number | `48` | 元素初始高度（px） |
| `initialRadius` | Number | `10` | 元素初始圆角（px） |
| `pointerCount` | Number | `20` | 模拟指针数量 |
| `pointerSize` | Number | `26` | 指针空闲尺寸（px） |
| `pointerDragSize` | Number | `38` | 指针拖拽时尺寸（px） |
| `minSpeed` | Number | `0.3` | 指针最小速度 |
| `maxSpeed` | Number | `1.1` | 指针最大速度 |
| `nearRadius` | Number | `150` | 指针靠近元素的吸引半径（px） |
| `lockRadius` | Number | `90` | 指针触发拖拽的锁定半径（px） |
| `idleOpacity` | Number | `0.35` | 指针空闲透明度 |
| `nearOpacity` | Number | `0.75` | 指针靠近元素时透明度 |
| `pointerZIndex` | Number | `9999` | 指针层层级 |
| `hideNativeCursor` | Boolean | `true` | 是否隐藏系统光标（通过 `.vpb-hide-cursor` 类控制，外部样式可覆盖） |
| `normalStagger` | Number | `0.14` | 普通文本打字间隔（秒） |
| `bigTextStagger` | Number | `0.045` | 大文本打字间隔（秒） |
| `typeDelay` | Number | `700` | 拖拽完成后打字延迟（毫秒） |
| `autoResetDistance` | Number | `500` | 元素离开视口多远后重置（px） |
| `background` | String | `'#f4f5fa'` | 根容器背景色 |
| `darkSaturation` | Number | `15` | 指针暗色饱和度（%） |
| `darkLightness` | Number | `28` | 指针暗色亮度（%） |
| `brightSaturation` | Number | `75` | 指针亮色饱和度（%） |
| `brightLightness` | Number | `62` | 指针亮色亮度（%） |
| `hintText` | String | `''` | 底部提示文字 |

### data-* 属性（单元素覆盖）

每个 `.vpb-box` 可通过 `data-*` 属性覆盖全局默认值：

| 属性 | 说明 | 示例 |
|------|------|------|
| `data-dir` | 展开方向 | `data-dir="br"` |
| `data-width` | 最终宽度（默认取元素自身 width） | `data-width="300"` |
| `data-height` | 最终高度（默认取元素自身 height；`auto` 表示由内容决定，Markdown 模式默认 `auto`） | `data-height="auto"` |
| `data-radius` | 最终圆角（默认取元素 borderRadius） | `data-radius="20"` |
| `data-growth-rate` | 每帧拉伸增量，越大展开越快 | `data-growth-rate="3.5"` |
| `data-big-text` | 标记为大文本（慢 stagger + I 光标） | `data-big-text` |
| `data-placeholder` | 拖拽中占位符 | `data-placeholder="·"` |
| `data-initial-width` | 初始宽度 | `data-initial-width="60"` |
| `data-initial-height` | 初始高度 | `data-initial-height="60"` |
| `data-initial-radius` | 初始圆角 | `data-initial-radius="8"` |
| `data-text` | 强制指定文本（默认取元素文本内容） | `data-text="自定义文案"` |
| `data-stagger` | 覆盖该元素的逐字间隔（秒） | `data-stagger="0.02"` |
| `data-mode` | 单元素覆盖内容模式 | `data-mode="markdown"` |
| `data-html` | 直接提供 HTML 字符串（按 html 模式渲染） | `data-html="<h2>标题</h2>"` |

### Events

| 事件 | 参数 | 说明 |
|------|------|------|
| `ready` | `{ count }` | 组件就绪，返回识别到的元素数量 |
| `dragstart` | `{ index }` | 某个元素开始被拖拽 |
| `dragend` | `{ index }` | 某个元素拖拽完成 |
| `typed` | `{ index, text }` | 某个元素打字完成 |

### 暴露的方法

通过 `ref` 调用：

```js
const pboxes = ref()
pboxes.value.restart()   // 重置所有元素，重新播放动画
```

## 事件示例

```vue
<template>
  <PointerBoxes
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @typed="onTyped"
  >
    ...
  </PointerBoxes>
</template>

<script setup>
function onDragStart({ index }) {
  console.log('开始拖拽第', index, '个元素')
}
function onDragEnd({ index }) {
  console.log('第', index, '个元素拖拽完成')
}
function onTyped({ index, text }) {
  console.log('第', index, '个元素打字完成:', text)
}
</script>
```

## 样式定制

组件注入的样式全部位于 `@layer vue-pointer-boxes` 中。按照 CSS 级联层规则，宿主页面里未分层的普通样式优先级更高，直接写选择器即可覆盖组件内部 DOM，无需提高权重或加 `!important`：

```css
/* 元素底色 */
.vpb-inner {
  background: #fffdf5;
}

/* 已完成元素的边框颜色 */
.vpb-box.done .vpb-inner {
  border-color: #4caf50;
}
```

常用样式变量（定义在 `.vpb-root` 或任意祖先上即可）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `--vpb-font-family` | `inherit` | 字体族 |
| `--vpb-font-size` | `inherit` | 普通文本字号 |
| `--vpb-line-height` | `inherit` | 行高 |
| `--vpb-font-weight` | `inherit` | 字重 |
| `--vpb-big-font-size` | `inherit` | 大文本字号 |
| `--vpb-big-line-height` | `inherit` | 大文本行高 |
| `--vpb-rich-font-size` | `inherit` | 富文本字号 |
| `--vpb-rich-line-height` | `inherit` | 富文本行高 |
| `--vpb-inner-bg` | `#fff` | 元素底色 |
| `--vpb-text-color` | `#5a5e75` | 文本颜色 |
| `--vpb-done-color` | `#3a7a65` | 完成态文本颜色 |
| `--vpb-mono-font` | 系统等宽字体 | 代码字体 |
| `--vpb-md-code-font-size` | `0.78rem` | Markdown 代码块字号 |
| `--vpb-md-code-line-height` | `1.7` | Markdown 代码块行高 |
| `--vpb-md-code-padding` | `12px 14px` | Markdown 代码块内边距 |
| `--vpb-link-color` | `inherit` | 富文本链接颜色 |
| `--vpb-idle-glow` | `none` | 指针静止时的光晕，如 `drop-shadow(0 0 3px currentColor)` |

### 字体样式

组件不写死任何字体属性：`.vpb-root` / `.vpb-inner` / `.vpb-text` / `.vpb-char` 全部使用继承，宿主写在 `.vpb-box` 或页面上的 `font-family`、`font-size`、`line-height`、`font-weight`、`letter-spacing`、`font-style` 会直接生效：

```css
.my-card {
  font-family: Georgia, 'Songti SC', serif;
  font-size: 17px;
  line-height: 1.9;
}
```

富文本内部的标题 / 代码等字号使用 `em`，会跟随宿主字号整体缩放，不会出现「改了字号标题不变」的情况。

## 性能说明

组件的主循环是一帧一次 rAF，默认已经按「只算看得见的部分」组织：

- **位置缓存**：所有盒子的屏幕坐标每帧只量一轮（滚动 / 尺寸变化时标脏），循环里不再穿插 `getBoundingClientRect`，避免同步布局
- **只看视口**：滚出视口的等待中盒子不参与指针竞争，指针也不会为一个看不见的盒子空转
- **组件不可见即停**：整块离开视口后指针层隐藏、模拟暂停，滚回来再继续
- **拖拽期间正文摘出布局**：富文本盒子拉伸时只显示占位符，上千个节点不会跟着每帧变化的宽高重排
- **静止态指针不加滤镜**：每个指针都是独立合成层，`filter: blur/drop-shadow` 会让它每帧重新栅格化；光晕只在靠近 / 拖拽时出现
- **逐字模糊有上限**：字符数超过 `blurCharLimit` 时自动降级（见上文）

指针数量和字号是最大的两个变量：`pointer-count` 每增加一倍，每帧的样式写入与合成层也翻一倍；长文本建议配 `data-stagger` 控制节奏，而不是单纯堆字符。

## 常见问题

**Q：元素没有动画？**
A：检查元素是否有 `class="vpb-box"`，以及是否设置了明确的 `width` / `height`（需要是固定 px 值）。

**Q：文字不显示？**
A：确保元素内有文本内容，或通过 `data-text` 指定文本。

**Q：子元素不动画？**
A：子元素需等父元素完成拖拽+打字后才会激活，这是设计行为。

**Q：富文本的标签结构在打字时丢了？**
A：检查是否指定了 `data-mode="html"` 或 `data-mode="markdown"`；`text` 模式只输出纯文本。

**Q：Markdown 内容不显示？**
A：`mode="markdown"` 时内容会被当作源码解析，裸 HTML 会被转义；需要直接输出 HTML 时用 `mode="html"`。

**Q：Markdown 里的代码块没有单独拖拽？**
A：代码块仅在 `data-mode="markdown"` + 内置渲染器（未传 `markdown` prop）时升级为子 box；若样式被父级 `overflow:hidden` 裁切，把代码块的 `overflow` 设为可见，或给父级留出足够高度。

**Q：代码块高度和代码不对齐？**
A：高度在布局阶段测量后固定，改了 `--vpb-md-code-font-size` / `line-height` / `padding` 后需要重新挂载（`restart()` 或重新渲染），高度会重新测量。

**Q：富文本卡片里出现滚动条 / 最后一行被裁掉？**
A：卡片默认按「初始高度」定死。Markdown 模式已默认高度自适应；html / text 模式想跟着内容长，加 `data-height="auto"` 即可。组件内部的滚动条已经隐藏，宿主自己写了固定高度时内容仍可滚动，只是不显示滚动条；高度自适应的卡片不构成滚动容器，滚轮直接交给页面，不会“卡”在卡片上。

**Q：滚动后指针飞向错误位置？**
A：已修复——元素位置实时计算，滚动后自动校正。

**Q：指针看不清 / 想要旧版的柔和光晕？**
A：静止态默认不加滤镜（这是全页最大的绘制开销）。需要光晕时写 `--vpb-idle-glow: drop-shadow(0 0 3px currentColor)` 即可恢复，代价是指针数量多时帧率下降。

**Q：渐变文字淡入到一半整段看不见？**
A：`background-clip: text` 的渐变如果只写在 `.vpb-text` 上，字符一旦因为 `opacity < 1` 独立成合成层，父层被字形裁切的渐变就失去了字形，淡入途中会整段消失。渐变要落到每个 `.vpb-char` 上，并用 `sibling-index()` / `sibling-count()` 按字符均分（Demo 主标题就是这种写法）：

```css
@supports (background-size: calc(100% * sibling-count()) 100%) {
  .my-title .vpb-char {
    background-image: linear-gradient(90deg, #3d5afe, #7c4dff 50%, #18b6c9);
    background-size: calc(100% * sibling-count()) 100%;
    background-position: calc(100% * (sibling-index() - 1) / max(1, sibling-count() - 1)) 0;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    -webkit-text-fill-color: transparent;
  }
}
```

`background-position` 的百分比是相对「元素宽 − 图片宽」算的，图片被撑到「字符数 × 自身宽」后为负值，正好把第 i 个字符推进它自己那一段。不支持这两个函数的内核会退回普通纯色，不会出现彩色断层。

## License

MIT
