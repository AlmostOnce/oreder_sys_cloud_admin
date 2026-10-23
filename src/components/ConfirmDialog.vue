<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import BaseButton from './BaseButton.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description: string
    confirmLabel?: string
    danger?: boolean
    loading?: boolean
    error?: string
  }>(),
  {
    confirmLabel: '确认操作',
    danger: false,
    loading: false,
    error: '',
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

const dialogElement = ref<HTMLDialogElement | null>(null)

/** 将 Vue 可见状态同步到原生模态对话框及其焦点管理。 */
watch(
  () => props.open,
  async (isOpen) => {
    await nextTick()
    const dialog = dialogElement.value
    if (!dialog) return
    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  },
  { immediate: true },
)

/** 取消操作时通知父组件关闭对话框；服务请求期间忽略取消。 */
function closeDialog(): void {
  if (props.loading) return
  emit('update:open', false)
}

/** 浏览器 Escape 事件不直接卸载内容，由父组件负责状态同步。 */
function onCancel(event: Event): void {
  event.preventDefault()
  closeDialog()
}

/** 处理原生关闭事件，保持 Vue 状态与 DOM 对话框一致。 */
function onClose(): void {
  if (props.open && !props.loading) emit('update:open', false)
}
</script>

<template>
  <dialog
    ref="dialogElement"
    class="ops-dialog ops-confirm-dialog"
    :aria-labelledby="'confirm-title'"
    :aria-describedby="'confirm-description'"
    @cancel="onCancel"
    @close="onClose"
  >
    <div class="ops-dialog__header">
      <span class="ops-dialog__eyebrow">请确认此操作</span>
      <h2 id="confirm-title">{{ title }}</h2>
      <p id="confirm-description">{{ description }}</p>
    </div>
    <p v-if="error" class="ops-alert ops-alert--error" role="alert">{{ error }}</p>
    <div class="ops-dialog__actions">
      <BaseButton variant="neutral" :disabled="loading" @click="closeDialog">取消</BaseButton>
      <BaseButton
        :variant="danger ? 'danger' : 'primary'"
        :loading="loading"
        @click="$emit('confirm')"
      >
        {{ confirmLabel }}
      </BaseButton>
    </div>
  </dialog>
</template>
