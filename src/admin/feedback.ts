import { readonly, ref } from 'vue'

/** 页面共享的轻量提示消息，不承载需要用户处理的关键错误。 */
export interface ToastMessage {
  id: number
  message: string
  kind: 'success' | 'info'
}

const messages = ref<ToastMessage[]>([])
let nextId = 1

/** 推送短暂的成功或信息提示，并在数秒后自动移除。 */
export function notify(message: string, kind: ToastMessage['kind'] = 'success'): void {
  const id = nextId++
  messages.value = [...messages.value, { id, message, kind }]
  window.setTimeout(() => {
    messages.value = messages.value.filter((item) => item.id !== id)
  }, 4200)
}

/** 以只读形式向 ToastHost 暴露所有可见提示。 */
export function useToasts() {
  return readonly(messages)
}
