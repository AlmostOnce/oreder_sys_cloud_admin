<script setup lang="ts">
import { useToasts } from '../admin/feedback.ts'

const messages = useToasts()
</script>

<template>
  <div class="ops-toast-host" aria-live="polite" aria-atomic="false">
    <TransitionGroup name="ops-toast">
      <div
        v-for="item in messages"
        :key="item.id"
        class="ops-toast"
        :class="`ops-toast--${item.kind}`"
        role="status"
      >
        <span class="ops-toast__mark" aria-hidden="true"></span>
        <span>{{ item.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>
