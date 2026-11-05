<template>
  <div class="page">
    <PointerBoxes
      ref="stageRef"
      class="stage"
      :pointer-count="26"
      :normal-stagger="0.12"
      :big-text-stagger="0.014"
      :type-delay="320"
      :seek-speed="11"
      :hide-native-cursor="false"
      hint-text="整页内容都由模拟指针绘制 · 滚动继续生成"
      background="#f4f5fa"
    >
      <div class="flow">
        <!-- ============ Hero ============ -->
        <div class="vpb-box vpb-ink vpb-label" data-dir="right" data-growth-rate="4">
          {{ copy.label }}
        </div>

        <div class="vpb-box vpb-ink vpb-title" data-dir="br" data-growth-rate="5">
          {{ copy.title }}
        </div>

        <div class="vpb-box vpb-ink vpb-lead" data-dir="bl" data-growth-rate="4" data-big-text>
          {{ copy.lead }}
        </div>

        <div
          class="vpb-box vpb-ink vpb-install"
          data-dir="down"
          data-growth-rate="4"
          data-big-text
        >
          {{ copy.install }}
        </div>

        <div class="action-row">
          <button
            class="vpb-box vpb-action"
            type="button"
            data-dir="right"
            data-growth-rate="4"
            @click="restart"
          >
            ↻ 重播整页
          </button>
          <a
            class="vpb-box vpb-action"
            :href="github"
            target="_blank"
            rel="noreferrer"
            data-dir="left"
            data-growth-rate="4"
          >
            GitHub ↗
          </a>
        </div>

        <!-- ============ 01 现场演示 ============ -->
        <div class="vpb-box vpb-ink vpb-heading" data-dir="right" data-growth-rate="4">
          {{ copy.demoHeading }}
        </div>

        <div class="vpb-box vpb-ink vpb-body" data-dir="bl" data-growth-rate="4" data-big-text>
          {{ copy.demoIntro }}
        </div>

        <div class="tile-row">
          <div
            v-for="d in directions"
            :key="d.dir"
            class="vpb-box demo-tile"
            :data-dir="d.dir"
            data-growth-rate="3.4"
          >
            {{ d.arrow }} {{ d.dir }}
          </div>
        </div>

        <div class="nest-row">
          <div class="vpb-box nest-parent" data-dir="br" data-growth-rate="3">
            {{ copy.parent }}
            <div class="vpb-box nest-child" data-dir="down" data-growth-rate="3.4">
              {{ copy.child }}
            </div>
          </div>
          <div class="vpb-box nest-circle" data-dir="tl" data-growth-rate="3">
            {{ copy.circle }}
          </div>
        </div>

        <div class="vpb-box big-sample" data-dir="br" data-growth-rate="3.2" data-big-text>
          {{ copy.bigSample }}
        </div>

        <!-- ============ 02 安装 ============ -->
        <div class="vpb-box vpb-ink vpb-heading" data-dir="right" data-growth-rate="4">
          {{ copy.installHeading }}
        </div>

        <div class="vpb-box vpb-ink vpb-body" data-dir="tl" data-growth-rate="4" data-big-text>
          {{ copy.installNote }}
        </div>

        <div class="vpb-box vpb-code code-install" data-dir="br" data-growth-rate="4" data-big-text>
          {{ codeInstall }}
        </div>

        <div class="vpb-box vpb-code code-umd" data-dir="tr" data-growth-rate="4" data-big-text>
          {{ codeUmd }}
        </div>

        <!-- ============ 03 使用方法 ============ -->
        <div class="vpb-box vpb-ink vpb-heading" data-dir="right" data-growth-rate="4">
          {{ copy.usageHeading }}
        </div>

        <div class="vpb-box vpb-ink vpb-body" data-dir="br" data-growth-rate="4" data-big-text>
          {{ copy.usageNote }}
        </div>

        <div class="vpb-box vpb-code code-sfc" data-dir="bl" data-growth-rate="4" data-big-text>
          {{ codeSfc }}
        </div>

        <!-- ============ 04 API ============ -->
        <div class="vpb-box vpb-ink vpb-heading" data-dir="right" data-growth-rate="4">
          {{ copy.apiHeading }}
        </div>

        <div class="vpb-box vpb-code vpb-api" data-dir="tl" data-growth-rate="4" data-big-text>
          {{ apiText }}
        </div>

        <!-- ============ 页脚 ============ -->
        <div class="vpb-box vpb-ink vpb-foot" data-dir="right" data-growth-rate="4" data-big-text>
          {{ copy.footer }}
        </div>
      </div>
    </PointerBoxes>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import PointerBoxes from '../PointerBoxes.vue'

const github = 'https://github.com/Cindifind/vue-pointer-boxes'
const stageRef = ref(null)

function restart() {
  stageRef.value?.restart()
}

// 页面所有文案（全部由指针逐字打出）
const copy = {
  label: 'Vue 3 动画组件',
  title: 'vue-pointer-boxes',
  lead: '一群模拟指针正在接管这个页面：它们游走、锁定、从边角把内容拽开，再逐字写下每一行文字。你现在看到的一切，都是刚刚被绘制出来的。',
  install: '$ npm install vue-pointer-boxes',
  demoHeading: '01 · 现场演示',
  demoIntro: '每个方块都是一个 .vpb-box 元素，指针会自己找上门，按 data-dir 指定的方向把它拉开。',
  parent: '父',
  child: '子',
  circle: '圆',
  bigSample:
    '在数字时代的洪流里，每一次交互都在重新定义人与机器的边界。指针不再只是光标，它是意图的延伸、思维的投影、创意的起点。当静默的像素被唤醒，当冰冷的界面流淌出温度，我们看见的不只是代码的艺术，更是创造者与世界对话的方式。',
  installHeading: '02 · 安装',
  installNote:
    '组件在运行时注入自身样式，无需引入任何 CSS 文件；GSAP 会随依赖自动安装。没有构建环境时，可使用内嵌 Vue 3 与 GSAP 的 UMD 构建。',
  usageHeading: '03 · 使用方法',
  usageNote:
    '给元素加上 class="vpb-box"，其余交给组件：自动扫描、注入动画层、读取元素宽高作为最终形态。data-dir 支持 8 个方向，嵌套的子元素会等父元素完成后才被激活。',
  apiHeading: '04 · API 摘要',
  footer: 'vue-pointer-boxes · MIT License · github.com/Cindifind/vue-pointer-boxes',
}

const directions = [
  { dir: 'br', arrow: '↘' },
  { dir: 'tr', arrow: '↗' },
  { dir: 'bl', arrow: '↙' },
  { dir: 'tl', arrow: '↖' },
  { dir: 'right', arrow: '→' },
  { dir: 'left', arrow: '←' },
  { dir: 'down', arrow: '↓' },
  { dir: 'up', arrow: '↑' },
]

// 代码示例（保留换行与缩进，由库的 \n → <br> 支持渲染）
const codeInstall = `npm install vue-pointer-boxes

# 或 pnpm / yarn
pnpm add vue-pointer-boxes
yarn add vue-pointer-boxes`

const codeUmd = `<div id="app"></div>

<script src="./dist/vue-pointer-boxes.umd.js"><\/script>
<script>
  VuePointerBoxes.mount('#app', { pointerCount: 20 })
<\/script>`

const codeSfc = `<script setup>
import PointerBoxes from 'vue-pointer-boxes'
<\/script>

<template>
  <PointerBoxes hint-text="滚动查看动画">
    <div class="vpb-box" data-dir="br">
      你好，世界
    </div>
  </PointerBoxes>
</template>`

const apiText = `pointerCount      Number   20       模拟指针数量
nearRadius        Number   150      指针被吸引的半径
lockRadius        Number   90       触发拖拽的锁定半径
hideNativeCursor  Boolean  true     隐藏系统光标
normalStagger     Number   0.14     普通文本打字间隔
bigTextStagger    Number   0.045    大文本打字间隔
data-dir          8 方向：br tr bl tl / right left down up
data-width/height 覆盖元素最终尺寸
data-big-text     大文本：慢速打字 + I 形光标
data-text         强制指定打字内容
css               @layer vue-pointer-boxes，外部样式可直接覆盖
vars              --vpb-font-size · --vpb-big-font-size · --vpb-inner-bg

events  ready · dragstart · dragend · typed
method  restart() 重置并重播整段动画`
</script>

<style>
html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: #f4f5fa;
  color: #2c2e3a;
  font-family: system-ui, 'Segoe UI', Roboto, 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', sans-serif;
  -webkit-font-smoothing: antialiased;
}

.stage {
  padding: 0 0 12vh;
}

.flow {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

/* ================= 无卡片文本（由指针直接书写） ================= */
.vpb-box.vpb-ink .vpb-inner {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}

.vpb-box.vpb-ink.done .vpb-inner {
  border-color: transparent;
  box-shadow: none;
}

.vpb-box.vpb-ink.dragging .vpb-inner {
  box-shadow: 0 10px 36px rgba(70, 120, 200, 0.18), 0 0 0 2px rgba(100, 160, 255, 0.35);
}

.vpb-box.vpb-ink .vpb-text {
  color: #4a4f66;
}

/* 顶部标签 */
.vpb-label {
  width: min(230px, 70vw);
  height: 40px;
  margin-top: 14vh;
}

.vpb-box.vpb-label .vpb-text {
  color: #2f8f6b;
  font-size: 0.72rem;
  letter-spacing: 4px;
}

/* 主标题 */
.vpb-title {
  width: min(860px, 92vw);
  height: 132px;
  margin-top: 24px;
}

.vpb-box.vpb-title .vpb-text {
  color: #23252f;
  font-size: clamp(2rem, 5.6vw, 3rem);
  font-weight: 800;
  letter-spacing: 1px;
}

/* 引导语 */
.vpb-lead {
  width: min(720px, 90vw);
  height: 140px;
  margin-top: 26px;
}

.vpb-box.vpb-lead .vpb-text {
  color: #5c6178;
  font-size: 1.02rem;
  line-height: 1.9;
  text-align: center;
}

/* 安装命令 */
.vpb-install {
  width: min(600px, 90vw);
  height: 64px;
  margin-top: 30px;
}

.vpb-box.vpb-install .vpb-text {
  color: #3b5bd0;
  font-family: Consolas, 'JetBrains Mono', monospace;
  font-size: 0.88rem;
  text-align: center;
}

/* 操作按钮（按钮外观也由 inner 展开生成） */
.vpb-action {
  width: 132px;
  height: 46px;
  padding: 0;
  border: 0;
  background: transparent;
  font-family: inherit;
  text-decoration: none;
  cursor: pointer;
}

.vpb-box.vpb-action .vpb-inner {
  background: #fff;
  border: 1px solid #d7dbea;
  border-radius: 999px !important;
}

.vpb-box.vpb-action.done .vpb-inner {
  border-color: #d7dbea;
  box-shadow: 0 8px 18px rgba(40, 50, 80, 0.07);
}

.vpb-box.vpb-action:hover .vpb-inner {
  border-color: #2f8f6b;
  box-shadow: 0 10px 24px rgba(47, 143, 107, 0.18);
}

.vpb-box.vpb-action .vpb-text {
  color: #2c2e3a;
  font-size: 0.82rem;
}

/* 章节标题 */
.vpb-heading {
  width: min(520px, 86vw);
  height: 46px;
  margin-top: 13vh;
}

.vpb-box.vpb-heading .vpb-text {
  color: #23252f;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 2px;
}

/* 正文 */
.vpb-body {
  width: min(720px, 90vw);
  height: 130px;
  margin-top: 22px;
}

.vpb-box.vpb-body .vpb-inner {
  justify-content: flex-start;
}

.vpb-box.vpb-body .vpb-text {
  color: #5c6178;
  font-size: 0.92rem;
  line-height: 1.85;
  text-align: left;
}

/* 代码 / API 深色卡片 */
.vpb-box.vpb-code .vpb-inner {
  justify-content: flex-start;
  padding: 20px 24px;
  background: #1e2130;
  border-color: #2a2e42;
}

.vpb-box.vpb-code.done .vpb-inner {
  background: #1e2130;
  border-color: #2a2e42;
  box-shadow: 0 18px 44px rgba(30, 33, 48, 0.16);
}

.vpb-box.vpb-code .vpb-text {
  /* 库内置样式位于 @layer 中，外部未分层样式直接覆盖即可 */
  color: #d7dbee;
  font-family: Consolas, 'JetBrains Mono', Menlo, monospace;
  font-size: 0.74rem;
  line-height: 1.7;
  letter-spacing: 0;
  white-space: pre-wrap;
  text-align: left;
}

.vpb-code {
  margin-top: 18px;
}

.code-install {
  width: min(620px, 92vw);
  height: 160px;
}

.code-umd {
  width: min(760px, 92vw);
  height: 190px;
}

.code-sfc {
  width: min(760px, 92vw);
  height: 260px;
}

.vpb-api {
  width: min(760px, 92vw);
  height: 330px;
  margin-top: 18px;
}

/* 页脚 */
.vpb-foot {
  width: min(560px, 92vw);
  height: 40px;
  margin-top: 14vh;
  margin-bottom: 8vh;
}

.vpb-box.vpb-foot .vpb-text {
  color: #8f93a8;
  font-size: 0.74rem;
  letter-spacing: 0.6px;
  text-align: center;
}

/* ================= 布局行 ================= */
.action-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
  margin-top: 26px;
}

.tile-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 26px 22px;
  width: min(700px, 92vw);
  margin-top: 40px;
}

.demo-tile {
  width: 148px;
  height: 104px;
  border-radius: 14px;
  background: #fff;
}

.nest-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: center;
  gap: 54px;
  margin-top: 52px;
}

.nest-parent {
  width: 260px;
  height: 220px;
  border-radius: 20px;
  background: #fff;
}

.nest-child {
  width: 96px;
  height: 96px;
  border-radius: 48px;
  background: #f0f4ff;
  margin: 26px auto 0;
}

.nest-circle {
  width: 168px;
  height: 168px;
  border-radius: 84px;
  background: #fff;
}

.big-sample {
  width: min(640px, 88vw);
  height: 230px;
  border-radius: 18px;
  background: #fff;
  margin-top: 60px;
}

/* ================= 响应式 ================= */
@media (max-width: 640px) {
  .vpb-label {
    margin-top: 11vh;
  }
  .vpb-title {
    height: 110px;
  }
  .vpb-lead {
    height: 180px;
  }
  .vpb-body {
    height: 160px;
  }
  .demo-tile {
    width: 132px;
    height: 96px;
  }
  .nest-parent {
    width: 240px;
    height: 210px;
  }
  .big-sample {
    height: 300px;
  }
  .code-sfc {
    height: 300px;
  }
  .vpb-api {
    height: 520px;
  }
  .vpb-foot {
    height: 60px;
  }
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
</style>
