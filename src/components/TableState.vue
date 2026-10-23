<script setup lang="ts">
import BaseButton from './BaseButton.vue'

defineProps<{
  loading: boolean
  error: string
  empty: boolean
  emptyTitle?: string
  emptyDescription?: string
}>()

defineEmits<{
  retry: []
}>()
</script>

<template>
  <div v-if="loading" class="ops-table-state" role="status" aria-live="polite">
    <span class="ops-loading-mark" aria-hidden="true"></span>
    <span>正在读取数据…</span>
  </div>
  <div v-else-if="error" class="ops-table-state ops-table-state--error" role="alert">
    <h2>暂时无法读取</h2>
    <p>{{ error }}</p>
    <BaseButton variant="neutral" @click="$emit('retry')">重新加载</BaseButton>
  </div>
  <div v-else-if="empty" class="ops-table-state" role="status">
    <slot name="empty">
      <span class="ops-state-rule" aria-hidden="true"></span>
      <h2>{{ emptyTitle || '这里还没有记录' }}</h2>
      <p>{{ emptyDescription || '创建第一条记录后，它会显示在这里。' }}</p>
    </slot>
  </div>
  <slot v-else />
</template>
