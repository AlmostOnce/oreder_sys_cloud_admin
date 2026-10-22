<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <main class="state-page">
    <span class="state-code">404</span>
    <h1>这个页面暂时不存在</h1>
    <p>请检查地址，或回到管理工作台继续。</p>
    <button
      class="submit-button state-action"
      type="button"
      @click="router.replace({ name: 'home' })"
    >
      返回工作台
    </button>
  </main>
</template>
