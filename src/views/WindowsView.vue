<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import FormField from '../components/FormField.vue'
import TableState from '../components/TableState.vue'
import { notify } from '../admin/feedback.ts'
import {
  createWindow,
  disableWindow,
  listWindows,
  updateWindow,
  type WindowAdmin,
  type WindowSaveRequest,
} from '../api/catalog.ts'
import { listRestaurants, type RestaurantAdmin } from '../api/restaurants.ts'
import { ApiError } from '../auth/errors.ts'
import { useAuthStore } from '../stores/auth.ts'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const windows = ref<WindowAdmin[]>([])
const restaurants = ref<RestaurantAdmin[]>([])
const loading = ref(true)
const loadError = ref('')
const searchText = ref(typeof route.query.q === 'string' ? route.query.q : '')
const formDialog = ref<HTMLDialogElement | null>(null)
const firstField = ref<HTMLInputElement | null>(null)
const formBusy = ref(false)
const formError = ref('')
const fieldErrors = reactive<Record<string, string>>({})
const editingWindow = ref<WindowAdmin | null>(null)
const confirmOpen = ref(false)
const confirmBusy = ref(false)
const confirmError = ref('')
const pendingWindow = ref<WindowAdmin | null>(null)
let loadSequence = 0

const isRestaurantManager = computed(() => auth.profile?.roleCode === 'RESTAURANT_MANAGER')
const canCreate = computed(() => isRestaurantManager.value && restaurants.value.length > 0)
const form = reactive({
  restaurantId: null as number | null,
  windowCode: '',
  windowName: '',
  description: '',
  sortOrder: 0,
  location: '',
  status: 1,
  isOpen: 0,
})
const filteredWindows = computed(() => {
  const keyword = searchText.value.trim().toLocaleLowerCase()
  if (!keyword) return windows.value
  return windows.value.filter((item) =>
    [item.windowName, item.windowCode, item.location ?? ''].some((value) =>
      value.toLocaleLowerCase().includes(keyword),
    ),
  )
})
const disableDescription = computed(
  () =>
    '将停用“' +
    (pendingWindow.value?.windowName ?? '') +
    '”。这不会删除档口或菜单记录；如无法停用，请查看服务端返回的关联业务约束。',
)

/** 只读取对当前角色有意义的范围数据，档口负责人不调用餐厅列表接口。 */
async function loadRecords(): Promise<void> {
  const currentSequence = ++loadSequence
  loading.value = true
  loadError.value = ''
  const roleCode = auth.profile?.roleCode
  try {
    const [windowRows, restaurantRows] = await Promise.all([
      listWindows(),
      roleCode === 'RESTAURANT_MANAGER' ? listRestaurants() : Promise.resolve([]),
    ])
    if (currentSequence !== loadSequence) return
    windows.value = windowRows
    restaurants.value = restaurantRows
  } catch (error) {
    if (currentSequence !== loadSequence) return
    loadError.value = errorMessage(error, '档口列表加载失败，请重试。')
  } finally {
    if (currentSequence === loadSequence) loading.value = false
  }
}

/** 本地筛选仅作用于服务端已返回的可见档口，并同步到 URL。 */
watch(searchText, (value) => {
  const nextQuery = { ...route.query, q: value.trim() || undefined }
  if (route.query.q !== nextQuery.q) void router.replace({ query: nextQuery })
})

/** 浏览器前进/后退时恢复筛选框文本。 */
watch(
  () => route.query.q,
  (value) => {
    const nextValue = typeof value === 'string' ? value : ''
    if (searchText.value !== nextValue) searchText.value = nextValue
  },
)

/** 清除编辑错误并将表单初始化为新建或所选档口当前值。 */
async function openForm(record?: WindowAdmin): Promise<void> {
  editingWindow.value = record ?? null
  Object.assign(form, {
    restaurantId: record?.restaurantId ?? restaurants.value[0]?.restaurantId ?? null,
    windowCode: record?.windowCode ?? '',
    windowName: record?.windowName ?? '',
    description: record?.description ?? '',
    sortOrder: record?.sortOrder ?? 0,
    location: record?.location ?? '',
    status: record?.status ?? 1,
    isOpen: record?.isOpen ?? 0,
  })
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key])
  formError.value = ''
  await nextTick()
  if (!formDialog.value?.open) formDialog.value?.showModal()
  firstField.value?.focus()
}

/** 校验档口编码、名称、餐厅归属及数字范围，并聚焦首个错误字段。 */
function validateForm(): boolean {
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key])
  if (!editingWindow.value && !form.restaurantId) fieldErrors.restaurantId = '请选择所属餐厅。'
  if (!form.windowCode.trim()) fieldErrors.windowCode = '请输入档口编码。'
  else if (form.windowCode.trim().length > 32) fieldErrors.windowCode = '档口编码最多 32 个字符。'
  if (!form.windowName.trim()) fieldErrors.windowName = '请输入档口名称。'
  else if (form.windowName.trim().length > 64) fieldErrors.windowName = '档口名称最多 64 个字符。'
  if (form.description.length > 500) fieldErrors.description = '简介最多 500 个字符。'
  if (form.location.length > 255) fieldErrors.location = '位置最多 255 个字符。'
  if (!Number.isInteger(form.sortOrder) || form.sortOrder < 0) {
    fieldErrors.sortOrder = '排序值必须为大于或等于 0 的整数。'
  }
  const firstError = Object.keys(fieldErrors)[0]
  if (!firstError) return true
  formError.value = '请检查并修正表单中的字段。'
  document.getElementById('window-' + firstError)?.focus()
  return false
}

/** 通过后端创建或更新档口；成功后重载列表确认服务端最终状态。 */
async function saveWindow(): Promise<void> {
  if (!validateForm() || !form.restaurantId) return
  formBusy.value = true
  formError.value = ''
  const request: WindowSaveRequest = {
    restaurantId: editingWindow.value?.restaurantId ?? form.restaurantId,
    windowCode: form.windowCode.trim(),
    windowName: form.windowName.trim(),
    // 更新 DTO 将 null 解释为保留旧值；编辑时必须传空字符串才能清空简介。
    description: form.description.trim() || (editingWindow.value ? '' : null),
    sortOrder: form.sortOrder,
    location: form.location.trim() || null,
    imageUrl: editingWindow.value?.imageUrl ?? null,
    status: form.status,
    isOpen: form.isOpen,
  }

  try {
    if (editingWindow.value) {
      await updateWindow(editingWindow.value.windowId, request)
      notify('档口资料已保存。')
    } else {
      await createWindow(request)
      notify('档口已创建。')
    }
    formDialog.value?.close()
    await loadRecords()
  } catch (error) {
    formError.value = errorMessage(error, '保存档口失败，请稍后重试。')
  } finally {
    formBusy.value = false
  }
}

/** 提交期间阻止 Escape 关闭窗口，避免用户误以为请求已取消。 */
function onFormCancel(event: Event): void {
  if (formBusy.value) event.preventDefault()
}

/** 选择停用对象并显示其明确影响。 */
function askDisable(record: WindowAdmin): void {
  pendingWindow.value = record
  confirmError.value = ''
  confirmOpen.value = true
}

/** 服务端确认停用后刷新列表；失败时保留确认窗口和错误说明。 */
async function confirmDisable(): Promise<void> {
  if (!pendingWindow.value) return
  confirmBusy.value = true
  confirmError.value = ''
  try {
    await disableWindow(pendingWindow.value.windowId)
    notify('档口已停用。')
    confirmOpen.value = false
    pendingWindow.value = null
    await loadRecords()
  } catch (error) {
    confirmError.value = errorMessage(error, '停用档口失败，请稍后重试。')
  } finally {
    confirmBusy.value = false
  }
}

/** 为权限、冲突和网络错误提供不泄露堆栈的中文恢复提示。 */
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 403) {
    return '当前账号无权执行此操作，或目标记录超出你的管理范围。'
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** 清除本地筛选并将焦点留在搜索控件。 */
function clearSearch(): void {
  searchText.value = ''
}

onMounted(() => void loadRecords())
onBeforeUnmount(() => {
  loadSequence += 1
  formDialog.value?.close()
})
</script>

<template>
  <main class="ops-page" aria-labelledby="page-title">
    <section class="ops-page-heading">
      <div>
        <p class="ops-kicker">档口资料与营业状态</p>
        <h1 id="page-title">档口管理</h1>
        <p class="ops-page-lead">启停状态与营业状态分别维护；管理范围由后端按当前身份过滤。</p>
      </div>
      <BaseButton v-if="canCreate" @click="openForm()">新建档口</BaseButton>
    </section>

    <p
      v-if="isRestaurantManager && restaurants.length === 0 && !loading && !loadError"
      class="ops-inline-note"
    >
      当前账号没有可选择的新建餐厅范围；仍可维护已授权的档口。
    </p>

    <section class="ops-panel ops-list-panel" aria-label="档口列表">
      <div class="ops-list-toolbar">
        <label class="ops-search">
          <span class="ops-visually-hidden">筛选档口</span>
          <span class="ops-search__mark" aria-hidden="true"></span>
          <input
            v-model="searchText"
            type="search"
            placeholder="按档口名称、编码或位置筛选"
            autocomplete="off"
          />
          <button v-if="searchText" type="button" class="ops-search__clear" @click="clearSearch">
            清除
          </button>
        </label>
        <span class="ops-list-count">{{ windows.length }} 个可见档口</span>
      </div>

      <TableState
        :loading="loading"
        :error="loadError"
        :empty="windows.length === 0"
        @retry="loadRecords"
      >
        <template #empty>
          <span class="ops-state-rule" aria-hidden="true"></span>
          <h2>当前范围内还没有档口</h2>
          <p>
            {{
              canCreate
                ? '你可以在所属餐厅下创建一个档口。'
                : '档口负责人只能管理服务端分配给自己的档口。'
            }}
          </p>
        </template>
        <div
          v-if="filteredWindows.length === 0 && windows.length > 0"
          class="ops-table-state"
          role="status"
        >
          <span class="ops-state-rule" aria-hidden="true"></span>
          <h2>没有匹配的档口</h2>
          <p>搜索只筛选已加载的档口数据。</p>
          <BaseButton variant="neutral" @click="clearSearch">清除筛选</BaseButton>
        </div>
        <div v-else class="ops-table-scroll" tabindex="0" aria-label="档口列表，可横向滚动">
          <table class="ops-table">
            <thead>
              <tr>
                <th scope="col">档口</th>
                <th scope="col">所属餐厅</th>
                <th scope="col">启停状态</th>
                <th scope="col">营业状态</th>
                <th scope="col" class="ops-table__actions-heading">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredWindows" :key="item.windowId">
                <th scope="row">
                  <span class="ops-table__primary">{{ item.windowName }}</span>
                  <span class="ops-table__secondary">{{ item.windowCode }}</span>
                </th>
                <td>
                  <span class="ops-table__primary">{{
                    restaurants.find((restaurant) => restaurant.restaurantId === item.restaurantId)
                      ?.restaurantName || '所属餐厅'
                  }}</span>
                  <span class="ops-table__secondary">ID {{ item.restaurantId }}</span>
                </td>
                <td>
                  <span
                    class="ops-status"
                    :class="item.status === 1 ? 'ops-status--active' : 'ops-status--inactive'"
                  >
                    <i aria-hidden="true"></i>{{ item.status === 1 ? '启用' : '停用' }}
                  </span>
                </td>
                <td>
                  <span
                    class="ops-status"
                    :class="item.isOpen === 1 ? 'ops-status--open' : 'ops-status--closed'"
                  >
                    <i aria-hidden="true"></i>{{ item.isOpen === 1 ? '营业中' : '休息中' }}
                  </span>
                </td>
                <td class="ops-table__actions">
                  <RouterLink
                    class="ops-inline-link"
                    :to="{ name: 'window-catalog', params: { windowId: item.windowId } }"
                  >
                    管理菜单
                  </RouterLink>
                  <BaseButton variant="quiet" @click="openForm(item)">编辑</BaseButton>
                  <BaseButton v-if="item.status === 1" variant="danger" @click="askDisable(item)"
                    >停用</BaseButton
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </TableState>
    </section>

    <dialog ref="formDialog" class="ops-dialog" @cancel="onFormCancel">
      <form class="ops-dialog__form" novalidate @submit.prevent="saveWindow">
        <div class="ops-dialog__header">
          <span class="ops-dialog__eyebrow">档口档案</span>
          <h2>{{ editingWindow ? '编辑档口资料' : '新建档口' }}</h2>
          <p>“启停状态”决定档口是否启用，“营业状态”表示当前是否营业，两者互不替代。</p>
        </div>
        <p v-if="formError" class="ops-alert ops-alert--error" role="alert">{{ formError }}</p>
        <div class="ops-form-grid">
          <FormField
            v-if="!editingWindow"
            id="window-restaurantId"
            label="所属餐厅"
            description="只可选择当前账号可见的餐厅。"
            :error="fieldErrors.restaurantId"
            required
          >
            <select
              id="window-restaurantId"
              v-model.number="form.restaurantId"
              class="ops-input"
              :aria-invalid="!!fieldErrors.restaurantId"
              :aria-describedby="
                fieldErrors.restaurantId
                  ? 'window-restaurantId-hint window-restaurantId-error'
                  : 'window-restaurantId-hint'
              "
            >
              <option :value="null" disabled>请选择餐厅</option>
              <option
                v-for="restaurant in restaurants"
                :key="restaurant.restaurantId"
                :value="restaurant.restaurantId"
              >
                {{ restaurant.restaurantName }} · {{ restaurant.location }}
              </option>
            </select>
          </FormField>
          <FormField
            id="window-windowCode"
            label="档口编码"
            :error="fieldErrors.windowCode"
            required
          >
            <input
              id="window-windowCode"
              ref="firstField"
              v-model="form.windowCode"
              class="ops-input"
              maxlength="32"
              :aria-invalid="!!fieldErrors.windowCode"
              :aria-describedby="fieldErrors.windowCode ? 'window-windowCode-error' : undefined"
            />
          </FormField>
          <FormField
            id="window-windowName"
            label="档口名称"
            :error="fieldErrors.windowName"
            required
          >
            <input
              id="window-windowName"
              v-model="form.windowName"
              class="ops-input"
              maxlength="64"
              :aria-invalid="!!fieldErrors.windowName"
              :aria-describedby="fieldErrors.windowName ? 'window-windowName-error' : undefined"
            />
          </FormField>
          <FormField
            id="window-location"
            label="档口位置"
            description="可留空，最长 255 个字符。"
            :error="fieldErrors.location"
          >
            <input
              id="window-location"
              v-model="form.location"
              class="ops-input"
              maxlength="255"
              :aria-invalid="!!fieldErrors.location"
              :aria-describedby="
                fieldErrors.location
                  ? 'window-location-hint window-location-error'
                  : 'window-location-hint'
              "
            />
          </FormField>
          <FormField
            id="window-sortOrder"
            label="展示排序"
            description="数值越小越靠前。"
            :error="fieldErrors.sortOrder"
          >
            <input
              id="window-sortOrder"
              v-model.number="form.sortOrder"
              class="ops-input"
              type="number"
              min="0"
              step="1"
              :aria-invalid="!!fieldErrors.sortOrder"
              :aria-describedby="
                fieldErrors.sortOrder
                  ? 'window-sortOrder-hint window-sortOrder-error'
                  : 'window-sortOrder-hint'
              "
            />
          </FormField>
          <FormField id="window-status" label="启停状态" description="停用后不代表数据被删除。">
            <select id="window-status" v-model.number="form.status" class="ops-input">
              <option :value="1">启用</option>
              <option :value="0">停用</option>
            </select>
          </FormField>
          <FormField
            id="window-isOpen"
            label="营业状态"
            description="营业/休息与启停状态分别存储。"
          >
            <select id="window-isOpen" v-model.number="form.isOpen" class="ops-input">
              <option :value="1">营业中</option>
              <option :value="0">休息中</option>
            </select>
          </FormField>
          <FormField id="window-description" label="档口简介" :error="fieldErrors.description">
            <textarea
              id="window-description"
              v-model="form.description"
              class="ops-input ops-textarea resize-none"
              maxlength="500"
              rows="3"
              :aria-invalid="!!fieldErrors.description"
              :aria-describedby="fieldErrors.description ? 'window-description-error' : undefined"
            ></textarea>
          </FormField>
        </div>
        <p v-if="editingWindow" class="ops-form-note">
          所属餐厅保持为当前值；档口图片请在“管理菜单”页面使用受控图片绑定流程更换。
        </p>
        <div class="ops-dialog__actions">
          <BaseButton variant="neutral" :disabled="formBusy" @click="formDialog?.close()"
            >取消</BaseButton
          >
          <BaseButton type="submit" :loading="formBusy">{{
            editingWindow ? '保存更改' : '创建档口'
          }}</BaseButton>
        </div>
      </form>
    </dialog>

    <ConfirmDialog
      v-model:open="confirmOpen"
      title="停用这个档口？"
      :description="disableDescription"
      confirm-label="确认停用档口"
      danger
      :loading="confirmBusy"
      :error="confirmError"
      @confirm="confirmDisable"
    />
  </main>
</template>
