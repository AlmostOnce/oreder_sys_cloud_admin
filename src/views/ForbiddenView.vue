<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <main class="state-page">
    <span class="state-code">403</span>
    <h1>当前账号没有管理端权限</h1>
    <p>管理端仅对档口负责人、餐厅经理、总经理和系统管理员开放。</p>
    <button
      class="submit-button state-action"
      type="button"
      @click="router.replace({ name: 'home' })"
    >
      返回工作台
    </button>
  </main>
</template>
