<script setup lang="ts">
defineProps<{
  id: string
  label: string
  description?: string
  error?: string
  required?: boolean
}>()
</script>

<template>
  <div class="ops-field" :class="{ 'ops-field--invalid': error }">
    <label class="ops-field__label" :for="id">
      {{ label }}<span v-if="required" aria-hidden="true"> *</span>
    </label>
    <p v-if="description" :id="`${id}-hint`" class="ops-field__hint">{{ description }}</p>
    <slot />
    <p v-if="error" :id="`${id}-error`" class="ops-field__error" role="alert">
      {{ error }}
    </p>
  </div>
</template>
