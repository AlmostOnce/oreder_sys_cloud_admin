<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import FormField from '../components/FormField.vue'
import TableState from '../components/TableState.vue'
import { notify } from '../admin/feedback.ts'
import {
  createRestaurant,
  disableRestaurant,
  listRestaurants,
  updateRestaurant,
  type RestaurantAdmin,
  type RestaurantSaveRequest,
} from '../api/restaurants.ts'
import { ApiError } from '../auth/errors.ts'
import { useAuthStore } from '../stores/auth.ts'

type FormValues = RestaurantSaveRequest

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const records = ref<RestaurantAdmin[]>([])
const loading = ref(true)
const loadError = ref('')
const searchText = ref(typeof route.query.q === 'string' ? route.query.q : '')
const formDialog = ref<HTMLDialogElement | null>(null)
const firstField = ref<HTMLInputElement | null>(null)
const formBusy = ref(false)
const formError = ref('')
const formErrors = reactive<Record<string, string>>({})
const editingRecord = ref<RestaurantAdmin | null>(null)
const confirmOpen = ref(false)
const confirmBusy = ref(false)
const confirmError = ref('')
const pendingDisable = ref<RestaurantAdmin | null>(null)
let loadSequence = 0

const form = reactive<FormValues>(emptyForm())
const isGeneralManager = computed(() => auth.profile?.roleCode === 'GENERAL_MANAGER')
const canCreate = computed(() => isGeneralManager.value)
const filteredRecords = computed(() => {
  const keyword = searchText.value.trim().toLocaleLowerCase()
  if (!keyword) return records.value
  return records.value.filter((restaurant) =>
    [
      restaurant.restaurantName,
      restaurant.restaurantCode,
      restaurant.location,
      restaurant.phone ?? '',
    ].some((value) => value.toLocaleLowerCase().includes(keyword)),
  )
})
const formTitle = computed(() => (editingRecord.value ? '编辑餐厅资料' : '新建餐厅'))
const disableDescription = computed(
  () =>
    '将停用“' +
    (pendingDisable.value?.restaurantName ?? '') +
    '”。仍有启用档口时，服务端会拒绝本次操作。当前管理接口没有重新启用餐厅的功能，请确认后再继续。',
)

/** 返回符合后端 DTO 的空表单；空值按接口要求以 null 表达。 */
function emptyForm(): FormValues {
  return {
    restaurantCode: '',
    restaurantName: '',
    location: '',
    phone: '',
    imageUrl: '',
    notice: '',
    sortOrder: 0,
  }
}

/** 读取服务端按当前角色和数据范围过滤后的餐厅列表。 */
async function loadRecords(): Promise<void> {
  const currentSequence = ++loadSequence
  loading.value = true
  loadError.value = ''
  try {
    records.value = await listRestaurants()
  } catch (error) {
    if (currentSequence !== loadSequence) return
    loadError.value = errorMessage(error, '餐厅列表加载失败，请重试。')
  } finally {
    if (currentSequence === loadSequence) loading.value = false
  }
}

/** 使用 URL 查询参数保存当前本地筛选，便于复制地址和浏览器前进后退。 */
watch(searchText, (value) => {
  const nextQuery = { ...route.query, q: value.trim() || undefined }
  if (route.query.q !== nextQuery.q) void router.replace({ query: nextQuery })
})

/** 浏览器历史变化时同步筛选框，不额外发起后端查询。 */
watch(
  () => route.query.q,
  (value) => {
    const nextValue = typeof value === 'string' ? value : ''
    if (searchText.value !== nextValue) searchText.value = nextValue
  },
)

/** 打开新建或编辑表单，并在模态对话框出现后将焦点放入首字段。 */
async function openForm(record?: RestaurantAdmin): Promise<void> {
  editingRecord.value = record ?? null
  Object.assign(
    form,
    record
      ? {
          restaurantCode: record.restaurantCode,
          restaurantName: record.restaurantName,
          location: record.location,
          phone: record.phone ?? '',
          imageUrl: record.imageUrl ?? '',
          notice: record.notice ?? '',
          sortOrder: record.sortOrder,
        }
      : emptyForm(),
  )
  clearFormErrors()
  formError.value = ''
  await nextTick()
  if (!formDialog.value?.open) formDialog.value?.showModal()
  firstField.value?.focus()
}

/** 清除旧字段错误，避免编辑另一条记录时保留前一条的提示。 */
function clearFormErrors(): void {
  Object.keys(formErrors).forEach((key) => delete formErrors[key])
}

/** 校验字段长度、必填项与排序范围，提供可定位到输入框的中文提示。 */
function validateForm(): boolean {
  clearFormErrors()
  const values: Array<[keyof FormValues, string, number, boolean]> = [
    ['restaurantCode', form.restaurantCode.trim(), 32, true],
    ['restaurantName', form.restaurantName.trim(), 64, true],
    ['location', form.location.trim(), 64, true],
    ['phone', form.phone?.trim() ?? '', 20, false],
    ['imageUrl', form.imageUrl?.trim() ?? '', 255, false],
    ['notice', form.notice?.trim() ?? '', 255, false],
  ]

  values.forEach(([key, value, maxLength, required]) => {
    if (required && !value) formErrors[key] = '此项为必填项。'
    else if (value.length > maxLength) formErrors[key] = '最多输入 ' + maxLength + ' 个字符。'
  })
  if (
    form.sortOrder !== null &&
    (!Number.isInteger(form.sortOrder) || form.sortOrder < 0 || form.sortOrder > 9999)
  ) {
    formErrors.sortOrder = '排序值必须为 0 至 9999 的整数。'
  }

  const firstError = Object.keys(formErrors)[0]
  if (firstError) {
    formError.value = '请检查并修正表单中的字段。'
    document.getElementById('restaurant-' + firstError)?.focus()
    return false
  }
  return true
}

/** 提交餐厅新建或更新；失败时保留输入，不乐观修改列表。 */
async function saveForm(): Promise<void> {
  if (!validateForm()) return
  formBusy.value = true
  formError.value = ''

  const payload: FormValues = {
    restaurantCode: form.restaurantCode.trim(),
    restaurantName: form.restaurantName.trim(),
    location: form.location.trim(),
    phone: form.phone?.trim() || null,
    imageUrl: form.imageUrl?.trim() || null,
    notice: form.notice?.trim() || null,
    sortOrder: isGeneralManager.value ? form.sortOrder : (editingRecord.value?.sortOrder ?? null),
  }

  try {
    if (editingRecord.value) {
      await updateRestaurant(editingRecord.value.restaurantId, payload)
      notify('餐厅资料已保存。')
    } else {
      await createRestaurant(payload)
      notify('餐厅已创建。')
    }
    formDialog.value?.close()
    await loadRecords()
  } catch (error) {
    formError.value = errorMessage(error, '保存失败，请检查输入后重试。')
  } finally {
    formBusy.value = false
  }
}

/** 停止在提交过程中关闭原生对话框，避免丢失尚未确认的请求状态。 */
function onFormCancel(event: Event): void {
  if (formBusy.value) event.preventDefault()
}

/** 记录待停用餐厅，并要求用户确认不可由当前 API 撤销的影响。 */
function askDisable(record: RestaurantAdmin): void {
  pendingDisable.value = record
  confirmError.value = ''
  confirmOpen.value = true
}

/** 调用后端停用餐厅；409 冲突时保留确认窗口和原记录信息。 */
async function confirmDisable(): Promise<void> {
  if (!pendingDisable.value) return
  confirmBusy.value = true
  confirmError.value = ''
  try {
    await disableRestaurant(pendingDisable.value.restaurantId)
    notify('餐厅已停用。')
    confirmOpen.value = false
    pendingDisable.value = null
    await loadRecords()
  } catch (error) {
    confirmError.value = errorMessage(error, '停用失败，请稍后重试。')
  } finally {
    confirmBusy.value = false
  }
}

/** 从有限错误对象提取可供用户恢复操作的说明，不展示原始堆栈。 */
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 403) {
    return '当前账号无权执行此操作，或目标记录超出你的管理范围。'
  }
  if (error instanceof ApiError && error.status === 409) {
    return '餐厅仍有关联的启用档口，请先处理这些档口后再重试。'
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** 提供无搜索命中时的清空动作，不将本地筛选误报为空数据。 */
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
        <p class="ops-kicker">餐厅资料与状态</p>
        <h1 id="page-title">餐厅管理</h1>
        <p class="ops-page-lead">仅显示当前账号获准管理的餐厅；具体范围由服务端确定。</p>
      </div>
      <BaseButton v-if="canCreate" @click="openForm()">新建餐厅</BaseButton>
    </section>

    <section class="ops-panel ops-list-panel" aria-label="餐厅列表">
      <div class="ops-list-toolbar">
        <label class="ops-search">
          <span class="ops-visually-hidden">搜索餐厅</span>
          <span class="ops-search__mark" aria-hidden="true"></span>
          <input
            v-model="searchText"
            type="search"
            placeholder="按名称、编码、位置或电话筛选"
            autocomplete="off"
          />
          <button v-if="searchText" type="button" class="ops-search__clear" @click="clearSearch">
            清除
          </button>
        </label>
        <span class="ops-list-count">{{ records.length }} 个可见餐厅</span>
      </div>

      <TableState
        :loading="loading"
        :error="loadError"
        :empty="records.length === 0"
        @retry="loadRecords"
      >
        <template #empty>
          <span class="ops-state-rule" aria-hidden="true"></span>
          <h2>当前范围内还没有餐厅</h2>
          <p>
            {{
              canCreate ? '可以使用“新建餐厅”添加第一条记录。' : '如需调整管理范围，请联系总经理。'
            }}
          </p>
        </template>
        <div v-if="filteredRecords.length === 0" class="ops-table-state" role="status">
          <span class="ops-state-rule" aria-hidden="true"></span>
          <h2>没有匹配的餐厅</h2>
          <p>当前搜索只筛选已加载的餐厅数据。</p>
          <BaseButton variant="neutral" @click="clearSearch">清除筛选</BaseButton>
        </div>
        <div v-else class="ops-table-scroll" tabindex="0" aria-label="餐厅列表，可横向滚动">
          <table class="ops-table">
            <thead>
              <tr>
                <th scope="col">餐厅</th>
                <th scope="col">位置</th>
                <th scope="col">联系电话</th>
                <th scope="col">状态</th>
                <th scope="col" class="ops-table__actions-heading">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="restaurant in filteredRecords" :key="restaurant.restaurantId">
                <th scope="row">
                  <span class="ops-table__primary">{{ restaurant.restaurantName }}</span>
                  <span class="ops-table__secondary">{{ restaurant.restaurantCode }}</span>
                </th>
                <td>{{ restaurant.location }}</td>
                <td>{{ restaurant.phone || '—' }}</td>
                <td>
                  <span
                    class="ops-status"
                    :class="restaurant.status === 1 ? 'ops-status--active' : 'ops-status--inactive'"
                  >
                    <i aria-hidden="true"></i>{{ restaurant.status === 1 ? '启用' : '停用' }}
                  </span>
                </td>
                <td class="ops-table__actions">
                  <BaseButton variant="quiet" @click="openForm(restaurant)">编辑</BaseButton>
                  <BaseButton
                    v-if="isGeneralManager && restaurant.status === 1"
                    variant="danger"
                    @click="askDisable(restaurant)"
                  >
                    停用
                  </BaseButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </TableState>
    </section>

    <dialog ref="formDialog" class="ops-dialog" @cancel="onFormCancel">
      <form class="ops-dialog__form" novalidate @submit.prevent="saveForm">
        <div class="ops-dialog__header">
          <span class="ops-dialog__eyebrow">餐厅档案</span>
          <h2>{{ formTitle }}</h2>
          <p>保存后服务端会再次检查角色权限和餐厅数据范围。</p>
        </div>
        <p v-if="formError" class="ops-alert ops-alert--error" role="alert">{{ formError }}</p>

        <div class="ops-form-grid">
          <FormField
            id="restaurant-restaurantCode"
            label="餐厅编码"
            description="最长 32 个字符，用作系统内识别编码。"
            :error="formErrors.restaurantCode"
            required
          >
            <input
              id="restaurant-restaurantCode"
              ref="firstField"
              v-model="form.restaurantCode"
              class="ops-input"
              maxlength="32"
              :readonly="!!editingRecord && !isGeneralManager"
              :aria-invalid="!!formErrors.restaurantCode"
              :aria-describedby="
                formErrors.restaurantCode
                  ? 'restaurant-restaurantCode-hint restaurant-restaurantCode-error'
                  : 'restaurant-restaurantCode-hint'
              "
            />
          </FormField>
          <FormField
            id="restaurant-restaurantName"
            label="餐厅名称"
            :error="formErrors.restaurantName"
            required
          >
            <input
              id="restaurant-restaurantName"
              v-model="form.restaurantName"
              class="ops-input"
              maxlength="64"
              :aria-invalid="!!formErrors.restaurantName"
              :aria-describedby="
                formErrors.restaurantName ? 'restaurant-restaurantName-error' : undefined
              "
            />
          </FormField>
          <FormField
            id="restaurant-location"
            label="位置 / 楼层"
            :error="formErrors.location"
            required
          >
            <input
              id="restaurant-location"
              v-model="form.location"
              class="ops-input"
              maxlength="64"
              :aria-invalid="!!formErrors.location"
              :aria-describedby="formErrors.location ? 'restaurant-location-error' : undefined"
            />
          </FormField>
          <FormField id="restaurant-phone" label="联系电话" :error="formErrors.phone">
            <input
              id="restaurant-phone"
              v-model="form.phone"
              class="ops-input"
              type="tel"
              maxlength="20"
              :aria-invalid="!!formErrors.phone"
              :aria-describedby="formErrors.phone ? 'restaurant-phone-error' : undefined"
            />
          </FormField>
          <FormField
            id="restaurant-imageUrl"
            label="门面图片地址"
            description="当前后端没有餐厅图片绑定接口，本次不提供上传或修改入口。"
          >
            <p id="restaurant-imageUrl-hint" class="ops-readonly-value">
              {{ form.imageUrl ? '已有门面图片地址将原样保留。' : '当前未配置门面图片。' }}
            </p>
          </FormField>
          <FormField
            v-if="isGeneralManager"
            id="restaurant-sortOrder"
            label="展示排序"
            description="数值越小越靠前；仅总经理可调整。"
            :error="formErrors.sortOrder"
          >
            <input
              id="restaurant-sortOrder"
              v-model.number="form.sortOrder"
              class="ops-input"
              type="number"
              min="0"
              max="9999"
              step="1"
              :aria-invalid="!!formErrors.sortOrder"
              :aria-describedby="
                formErrors.sortOrder
                  ? 'restaurant-sortOrder-hint restaurant-sortOrder-error'
                  : 'restaurant-sortOrder-hint'
              "
            />
          </FormField>
          <FormField id="restaurant-notice" label="公告 / 简介" :error="formErrors.notice">
            <textarea
              id="restaurant-notice"
              v-model="form.notice"
              class="ops-input ops-textarea resize-none"
              maxlength="255"
              rows="3"
              :aria-invalid="!!formErrors.notice"
              :aria-describedby="formErrors.notice ? 'restaurant-notice-error' : undefined"
            ></textarea>
          </FormField>
        </div>

        <div class="ops-dialog__actions">
          <BaseButton variant="neutral" :disabled="formBusy" @click="formDialog?.close()"
            >取消</BaseButton
          >
          <BaseButton type="submit" :loading="formBusy">{{
            editingRecord ? '保存更改' : '创建餐厅'
          }}</BaseButton>
        </div>
      </form>
    </dialog>

    <ConfirmDialog
      v-model:open="confirmOpen"
      title="停用这家餐厅？"
      :description="disableDescription"
      confirm-label="确认停用餐厅"
      danger
      :loading="confirmBusy"
      :error="confirmError"
      @confirm="confirmDisable"
    />
  </main>
</template>
