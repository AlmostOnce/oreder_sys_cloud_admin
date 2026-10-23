<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    currentUrl?: string | null
    currentAlt?: string
    modelValue?: File | null
    disabled?: boolean
  }>(),
  {
    currentUrl: null,
    currentAlt: '当前图片',
    modelValue: null,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [file: File | null]
}>()

const validationMessage = ref('')
const previewUrl = ref('')
const displayedUrl = computed(() => previewUrl.value || props.currentUrl || '')

/** 为本地选择文件创建预览地址，并释放上一个文件的对象 URL。 */
watch(
  () => props.modelValue,
  (file, previous) => {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = file ? URL.createObjectURL(file) : ''
    if (!file && previous) validationMessage.value = ''
  },
  { immediate: true },
)

/** 仅接受文件服务白名单中的图片格式和不超过 5 MB 的文件。 */
function chooseFile(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  validationMessage.value = ''
  if (!file) {
    emit('update:modelValue', null)
    return
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type.toLocaleLowerCase())) {
    validationMessage.value = '请选择 JPG、PNG、GIF 或 WebP 图片。'
    input.value = ''
    emit('update:modelValue', null)
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    validationMessage.value = '图片不能超过 5 MB。'
    input.value = ''
    emit('update:modelValue', null)
    return
  }
  emit('update:modelValue', file)
}

/** 清空待上传文件并同步重置原生文件输入控件。 */
function clearSelection(): void {
  const input = document.getElementById(props.id) as HTMLInputElement | null
  if (input) input.value = ''
  validationMessage.value = ''
  emit('update:modelValue', null)
}

/** 组件卸载时释放浏览器生成的本地预览地址。 */
onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <div class="ops-image-upload">
    <span class="ops-field__label" :id="id + '-label'">{{ label }}</span>
    <div class="ops-image-upload__row">
      <div class="ops-image-upload__preview" :class="{ 'is-empty': !displayedUrl }">
        <img v-if="displayedUrl" :src="displayedUrl" :alt="currentAlt" />
        <span v-else aria-hidden="true">暂无图片</span>
      </div>
      <div class="ops-image-upload__controls">
        <label class="ops-file-picker" :for="id">
          <span>{{ modelValue ? '重新选择图片' : '选择图片' }}</span>
          <input
            :id="id"
            class="ops-file-picker__input"
            type="file"
            accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp"
            :disabled="disabled"
            :aria-labelledby="id + '-label'"
            @change="chooseFile"
          />
        </label>
        <span class="ops-image-upload__hint">JPG / PNG / GIF / WebP，最大 5 MB</span>
        <span v-if="modelValue" class="ops-image-upload__filename">{{ modelValue.name }}</span>
        <button
          v-if="modelValue"
          class="ops-image-upload__clear"
          type="button"
          :disabled="disabled"
          @click="clearSelection"
        >
          清除所选文件
        </button>
        <span v-if="validationMessage" class="ops-field__error" role="alert">
          {{ validationMessage }}
        </span>
      </div>
    </div>
  </div>
</template>
