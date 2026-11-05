# vue-pointer-boxes

模拟鼠标指针在页面上游走，从元素的边角拖拽放大并逐字打字的 Vue 3 动画组件。

## 特性

- **元素式引入**：给 DOM 元素加 `class="vpb-box"` 即可，组件自动识别
- **父子继承**：嵌套的子元素在父元素绘制完成后才会被指针发现并激活
- **边角拖拽**：指针从指定角落把元素拉开展开
- **逐字打字**：拖拽完成后文字逐个浮现
- **大文本支持**：长文本自动慢速 stagger 打字，指针变 I 形光标
- **自包含样式**：组件内部注入 CSS，无需额外引入样式文件
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

## 完整 API

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `selector` | String | `'.vpb-box'` | 扫描的 CSS 选择器 |
| `scanRoot` | String / Element | `null` | 扫描根节点，默认组件自身 |
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
| `hideNativeCursor` | Boolean | `true` | 是否隐藏系统鼠标光标 |
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
| `data-height` | 最终高度（默认取元素自身 height） | `data-height="200"` |
| `data-radius` | 最终圆角（默认取元素 borderRadius） | `data-radius="20"` |
| `data-growth-rate` | 每帧拉伸增量，越大展开越快 | `data-growth-rate="3.5"` |
| `data-big-text` | 标记为大文本（慢 stagger + I 光标） | `data-big-text` |
| `data-placeholder` | 拖拽中占位符 | `data-placeholder="·"` |
| `data-initial-width` | 初始宽度 | `data-initial-width="60"` |
| `data-initial-height` | 初始高度 | `data-initial-height="60"` |
| `data-initial-radius` | 初始圆角 | `data-initial-radius="8"` |
| `data-text` | 强制指定文本（默认取元素文本内容） | `data-text="自定义文案"` |

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

## 自定义样式

组件注入的 CSS 类可通过更高优先级的选择器覆盖：

```css
/* 已完成元素的边框颜色 */
.vpb-box.done .vpb-inner {
  border-color: #4caf50 !important;
}

/* 拖拽中元素的阴影 */
.vpb-box.dragging .vpb-inner {
  box-shadow: 0 10px 40px rgba(76, 175, 80, .4) !important;
}
```

## 常见问题

**Q：元素没有动画？**
A：检查元素是否有 `class="vpb-box"`，以及是否设置了明确的 `width` / `height`（需要是固定 px 值）。

**Q：文字不显示？**
A：确保元素内有文本内容，或通过 `data-text` 指定文本。

**Q：子元素不动画？**
A：子元素需等父元素完成拖拽+打字后才会激活，这是设计行为。

**Q：滚动后指针飞向错误位置？**
A：已修复——元素位置实时计算，滚动后自动校正。

## License

MIT
