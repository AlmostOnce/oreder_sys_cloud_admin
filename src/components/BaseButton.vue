<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'neutral' | 'danger' | 'quiet'
    type?: 'button' | 'submit' | 'reset'
    loading?: boolean
    disabled?: boolean
  }>(),
  {
    variant: 'primary',
    type: 'button',
    loading: false,
    disabled: false,
  },
)
</script>

<template>
  <button
    class="ops-button"
    :class="[`ops-button--${variant}`, { 'is-loading': loading }]"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading"
  >
    <span v-if="loading" class="ops-button__spinner" aria-hidden="true"></span>
    <slot />
  </button>
</template>
