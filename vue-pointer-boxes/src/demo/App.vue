<template>
  <PointerBoxes
    :pointer-count="20"
    :near-radius="150"
    :lock-radius="90"
    hint-text="父绘制完 → 子才被激活"
    background="#f4f5fa"
  >
    <header class="demo-header">
      <h1>Class 引入 + 父子继承</h1>
      <p>元素加 class="vpb-box" 即可，父元素绘制成功后子元素才会被 pointer 发现。</p>
    </header>

    <section class="demo-grid">
      <!-- 顶级 box，br 角展开 -->
      <div
        class="vpb-box"
        style="width:220px;height:170px;border-radius:14px;background:#fff;"
        data-dir="br"
        data-growth-rate="3.0"
      >
        <!-- 父文本直接写在元素里 -->
        父 · 方

        <!-- 子 box（嵌套）—— 父 done 后才被激活 -->
        <div
          class="vpb-box"
          style="width:100px;height:100px;border-radius:50%;background:#f0f4ff;margin:30px auto;"
          data-dir="tl"
          data-growth-rate="3.2"
        >
          子 · 圆
        </div>
      </div>

      <!-- 顶级 box，tl 角展开 -->
      <div
        class="vpb-box"
        style="width:170px;height:220px;border-radius:18px;background:#fff;"
        data-dir="tl"
        data-growth-rate="3.4"
      >
        父 · 竖
      </div>

      <!-- 顶级 box，tr 角展开，再嵌套两层 -->
      <div
        class="vpb-box"
        style="width:200px;height:200px;border-radius:100px;background:#fff;"
        data-dir="tr"
        data-growth-rate="2.8"
      >
        父 · 大圆
        <div
          class="vpb-box"
          style="width:90px;height:90px;border-radius:50%;background:#fff8e1;margin:55px 0 0 55px;"
          data-dir="down"
          data-growth-rate="3.0"
        >
          <div
            class="vpb-box"
            style="width:40px;height:40px;border-radius:50%;background:#ffe0b2;margin:25px;"
            data-dir="right"
            data-growth-rate="3.5"
          >
            3级
          </div>
          2级
        </div>
      </div>
    </section>

    <section class="demo-big">
      <!-- 大文本 box -->
      <div
        class="vpb-box big-text-box"
        style="width:640px;height:280px;border-radius:16px;background:#fff;margin:60px auto;"
        data-dir="br"
        data-growth-rate="3.5"
        data-big-text
      >
        在数字时代的洪流中，每一次交互都在重新定义人与机器的边界。指针不再只是光标，
        它是意图的延伸、思维的投影、创意的起点。当静默的像素被唤醒，当冰冷的界面流淌出温度，
        我们看见的不只是代码的艺术，更是创造者与世界对话的方式。
      </div>
    </section>
  </PointerBoxes>
</template>

<script setup>
import PointerBoxes from '../PointerBoxes.vue'
</script>

<style>
.demo-header {
  max-width: 720px;
  padding: 18vh 24px 6vh;
  text-align: center;
}
.demo-header h1 {
  font-size: clamp(2rem, 5vw, 3.2rem);
  letter-spacing: 2px;
  margin-bottom: 18px;
  color: #2c2e3a;
}
.demo-header p {
  font-size: 0.95rem;
  line-height: 1.9;
  color: #6b6f85;
}
.demo-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 50px;
  padding: 40px;
}
.demo-big {
  padding: 40px;
}
body { margin: 0; }
</style>
