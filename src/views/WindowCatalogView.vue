<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import FormField from '../components/FormField.vue'
import ImageUpload from '../components/ImageUpload.vue'
import TableState from '../components/TableState.vue'
import { notify } from '../admin/feedback.ts'
import {
  bindProductImage,
  bindWindowImage,
  createCategory,
  createProduct,
  disableCategory,
  listCategories,
  listProducts,
  listWindows,
  takeProductOffSale,
  updateCategory,
  updateProduct,
  type ProductAdmin,
  type ProductCategoryAdmin,
  type ProductSaveRequest,
  type CategorySaveRequest,
  type WindowAdmin,
} from '../api/catalog.ts'
import {
  deleteManagedFile,
  imageContentUrl,
  imageUrlUsesFileKey,
  uploadManagedImage,
} from '../api/files.ts'
import { ApiError } from '../auth/errors.ts'

const route = useRoute()
const routeWindowId = computed(() => {
  const value = Number(route.params.windowId)
  return Number.isSafeInteger(value) && value > 0 ? value : null
})

const windowInfo = ref<WindowAdmin | null>(null)
const categories = ref<ProductCategoryAdmin[]>([])
const products = ref<ProductAdmin[]>([])
const loading = ref(true)
const loadError = ref('')
const categoryDialog = ref<HTMLDialogElement | null>(null)
const productDialog = ref<HTMLDialogElement | null>(null)
const categoryFirstField = ref<HTMLInputElement | null>(null)
const productFirstField = ref<HTMLInputElement | null>(null)
const categoryBusy = ref(false)
const productBusy = ref(false)
const categoryError = ref('')
const productError = ref('')
const categoryErrors = reactive<Record<string, string>>({})
const productErrors = reactive<Record<string, string>>({})
const editingCategory = ref<ProductCategoryAdmin | null>(null)
const editingProduct = ref<ProductAdmin | null>(null)
const productImageFile = ref<File | null>(null)
const windowImageFile = ref<File | null>(null)
const windowImageBusy = ref(false)
const windowImageError = ref('')
const imageBusy = ref(false)
const confirmOpen = ref(false)
const confirmBusy = ref(false)
const confirmError = ref('')
const pendingAction = ref<
  | { kind: 'category'; id: number; name: string }
  | { kind: 'product'; id: number; name: string }
  | null
>(null)
let loadSequence = 0

const categoryForm = reactive({ categoryName: '', sortOrder: 0, status: 1 })
const productForm = reactive({
  categoryId: null as number | null,
  productCode: '',
  productName: '',
  description: '',
  price: 0,
  saleStatus: 1,
  sortOrder: 0,
})
const confirmTitle = computed(() =>
  pendingAction.value?.kind === 'product' ? '下架这道菜品？' : '停用这个分类？',
)
const confirmDescription = computed(() => {
  if (!pendingAction.value) return ''
  if (pendingAction.value.kind === 'product') {
    return '将下架“' + pendingAction.value.name + '”。记录不会被物理删除；之后仍可编辑并恢复在售。'
  }
  return (
    '将停用分类“' +
    pendingAction.value.name +
    '”。分类记录不会被物理删除，服务端会继续检查关联菜品约束。'
  )
})

/** 查询路由档口、分类和菜品，使用递增序号避免旧路由响应覆盖当前内容。 */
async function loadRecords(): Promise<void> {
  const currentSequence = ++loadSequence
  const currentWindowId = routeWindowId.value
  loading.value = true
  loadError.value = ''
  windowInfo.value = null
  categories.value = []
  products.value = []
  if (!currentWindowId) {
    loadError.value = '档口地址无效，请从档口列表重新进入。'
    loading.value = false
    return
  }

  try {
    const windows = await listWindows()
    if (currentSequence !== loadSequence) return
    const selectedWindow = windows.find((item) => item.windowId === currentWindowId)
    if (!selectedWindow) {
      throw new Error('未找到当前账号可管理的档口，或该档口已不在你的数据范围内。')
    }
    const [categoryRows, productRows] = await Promise.all([
      listCategories(currentWindowId),
      listProducts(currentWindowId),
    ])
    if (currentSequence !== loadSequence) return
    windowInfo.value = selectedWindow
    categories.value = categoryRows
    products.value = productRows
  } catch (error) {
    if (currentSequence !== loadSequence) return
    loadError.value = errorMessage(error, '菜单数据加载失败，请重试。')
  } finally {
    if (currentSequence === loadSequence) loading.value = false
  }
}

/** 档口路由参数变化时重新读取新档口，不复用旧列表数据。 */
watch(routeWindowId, () => void loadRecords())

/** 在所选档口创建分类，并将键盘焦点放在分类名称字段。 */
async function openCategoryForm(record?: ProductCategoryAdmin): Promise<void> {
  editingCategory.value = record ?? null
  Object.assign(categoryForm, {
    categoryName: record?.categoryName ?? '',
    sortOrder: record?.sortOrder ?? 0,
    status: record?.status ?? 1,
  })
  categoryError.value = ''
  Object.keys(categoryErrors).forEach((key) => delete categoryErrors[key])
  await nextTick()
  if (!categoryDialog.value?.open) categoryDialog.value?.showModal()
  categoryFirstField.value?.focus()
}

/** 校验分类名称和排序值后提交到当前档口的分类管理接口。 */
async function saveCategory(): Promise<void> {
  Object.keys(categoryErrors).forEach((key) => delete categoryErrors[key])
  if (!categoryForm.categoryName.trim()) categoryErrors.categoryName = '请输入分类名称。'
  else if (categoryForm.categoryName.trim().length > 64)
    categoryErrors.categoryName = '分类名称最多 64 个字符。'
  if (!Number.isInteger(categoryForm.sortOrder) || categoryForm.sortOrder < 0) {
    categoryErrors.sortOrder = '排序值必须为大于或等于 0 的整数。'
  }
  const firstError = Object.keys(categoryErrors)[0]
  if (firstError) {
    categoryError.value = '请检查并修正表单中的字段。'
    document.getElementById('category-' + firstError)?.focus()
    return
  }
  const windowId = routeWindowId.value
  if (!windowId) return

  categoryBusy.value = true
  categoryError.value = ''
  const request: CategorySaveRequest = {
    categoryName: categoryForm.categoryName.trim(),
    sortOrder: categoryForm.sortOrder,
    status: categoryForm.status,
  }
  try {
    if (editingCategory.value) {
      await updateCategory(editingCategory.value.categoryId, request)
      notify('分类资料已保存。')
    } else {
      await createCategory(windowId, request)
      notify('分类已创建。')
    }
    categoryDialog.value?.close()
    await loadRecords()
  } catch (error) {
    categoryError.value = errorMessage(error, '保存分类失败，请稍后重试。')
  } finally {
    categoryBusy.value = false
  }
}

/** 在当前档口新建或编辑菜品，并为已存在的菜品准备受控图片替换。 */
async function openProductForm(record?: ProductAdmin): Promise<void> {
  editingProduct.value = record ?? null
  productImageFile.value = null
  Object.assign(productForm, {
    categoryId: record?.categoryId ?? null,
    productCode: record?.productCode ?? '',
    productName: record?.productName ?? '',
    description: record?.description ?? '',
    price: record?.price ?? 0,
    saleStatus: record?.saleStatus ?? 1,
    sortOrder: record?.sortOrder ?? 0,
  })
  productError.value = ''
  Object.keys(productErrors).forEach((key) => delete productErrors[key])
  await nextTick()
  if (!productDialog.value?.open) productDialog.value?.showModal()
  productFirstField.value?.focus()
}

/** 按后端 DTO 约束校验菜品字段，包括金额最多两位小数。 */
function validateProductForm(): boolean {
  Object.keys(productErrors).forEach((key) => delete productErrors[key])
  if (!productForm.productCode.trim()) productErrors.productCode = '请输入菜品编码。'
  else if (productForm.productCode.trim().length > 64)
    productErrors.productCode = '菜品编码最多 64 个字符。'
  if (!productForm.productName.trim()) productErrors.productName = '请输入菜品名称。'
  else if (productForm.productName.trim().length > 128)
    productErrors.productName = '菜品名称最多 128 个字符。'
  if (productForm.description.length > 500) productErrors.description = '菜品描述最多 500 个字符。'
  if (
    !Number.isFinite(productForm.price) ||
    productForm.price < 0 ||
    productForm.price >= 100000000
  ) {
    productErrors.price = '请输入大于或等于 0 且小于 100000000 的售价。'
  } else if (hasMoreThanTwoDecimalPlaces(productForm.price)) {
    productErrors.price = '售价最多保留两位小数。'
  }
  if (!Number.isInteger(productForm.sortOrder) || productForm.sortOrder < 0) {
    productErrors.sortOrder = '排序值必须为大于或等于 0 的整数。'
  }

  const firstError = Object.keys(productErrors)[0]
  if (!firstError) return true
  productError.value = '请检查并修正表单中的字段。'
  document.getElementById('product-' + firstError)?.focus()
  return false
}

/** 按数字的十进制表示检查小数位，避免二进制浮点误差误拒绝 0.29 等金额。 */
function hasMoreThanTwoDecimalPlaces(value: number): boolean {
  const [mantissa = '0', exponentText = '0'] = value.toString().toLowerCase().split('e')
  const fractionalDigits = mantissa.split('.')[1]?.length ?? 0
  const exponent = Number(exponentText)
  return Math.max(0, fractionalDigits - exponent) > 2
}

/** 先保存菜品资料；若替换图片失败，会说明资料已保存但图片未更新。 */
async function saveProduct(): Promise<void> {
  if (!validateProductForm()) return
  const windowId = routeWindowId.value
  if (!windowId) return
  productBusy.value = true
  productError.value = ''
  const request: ProductSaveRequest = {
    categoryId: productForm.categoryId,
    productCode: productForm.productCode.trim(),
    productName: productForm.productName.trim(),
    description: productForm.description.trim() || null,
    imageUrl: editingProduct.value?.imageUrl ?? null,
    price: productForm.price,
    saleStatus: productForm.saleStatus,
    sortOrder: productForm.sortOrder,
  }

  try {
    const saved = editingProduct.value
      ? await updateProduct(editingProduct.value.productId, request)
      : await createProduct(windowId, request)

    if (editingProduct.value && productImageFile.value) {
      const imageResult = await replaceProductImage(
        saved.productId,
        windowId,
        productImageFile.value,
      )
      if (!imageResult.success) {
        productError.value = '菜品资料已保存，但图片未更换。' + imageResult.message
        await loadRecords()
        return
      }
    } else if (!editingProduct.value) {
      notify('菜品已创建；如需添加图片，请重新编辑这道菜品。')
    } else {
      notify('菜品资料已保存。')
    }

    productDialog.value?.close()
    await loadRecords()
  } catch (error) {
    productError.value = errorMessage(error, '保存菜品失败，请检查输入后重试。')
  } finally {
    productBusy.value = false
  }
}

/** 上传并绑定菜品图片；明确未绑定时清理文件，不确定时先重新读取菜品状态。 */
async function replaceProductImage(
  productId: number,
  windowId: number,
  file: File,
): Promise<{ success: boolean; message: string }> {
  imageBusy.value = true
  let fileKey: string | null = null
  try {
    const upload = await uploadManagedImage(file, 'PRODUCT_IMAGE', productId)
    fileKey = upload.fileKey
    const updated = await bindProductImage(productId, upload.fileKey)
    if (routeWindowId.value === windowId) {
      products.value = products.value.map((item) => (item.productId === productId ? updated : item))
    }
    productImageFile.value = null
    notify('菜品图片已更新。')
    return { success: true, message: '' }
  } catch (error) {
    // 网络中断或服务端错误不能证明绑定失败；先重新读菜品，避免误删已被绑定的图片。
    if (fileKey && isAmbiguousBindFailure(error)) {
      const bindingState = await reconcileProductImageBinding(productId, windowId, fileKey)
      if (bindingState === 'bound') {
        productImageFile.value = null
        notify('菜品图片已更新，已通过重新读取确认。')
        return { success: true, message: '' }
      }
      if (bindingState === 'unknown') {
        // 避免用户再次提交时重复上传；原文件保留，避免破坏可能已完成的绑定。
        productImageFile.value = null
        return {
          success: false,
          message:
            '图片绑定结果暂时无法确认，本次上传文件已保留以避免误删。请关闭编辑窗口并刷新列表确认图片状态后再操作。',
        }
      }
    }

    let cleanupMessage = ''
    if (fileKey) {
      try {
        await deleteManagedFile(fileKey)
        cleanupMessage = '本次未绑定的上传文件已清理。'
      } catch {
        cleanupMessage = '自动清理未成功，请联系管理员检查文件记录。'
      }
    }
    return {
      success: false,
      message:
        errorMessage(error, '图片上传或绑定失败。') + (cleanupMessage ? ' ' + cleanupMessage : ''),
    }
  } finally {
    imageBusy.value = false
  }
}

/** 上传并绑定档口图片，绑定失败时清理新上传文件并保留当前图片。 */
async function saveWindowImage(): Promise<void> {
  const file = windowImageFile.value
  const windowId = routeWindowId.value
  if (!file || !windowId) return
  windowImageBusy.value = true
  windowImageError.value = ''
  let fileKey: string | null = null
  try {
    const upload = await uploadManagedImage(file, 'WINDOW_IMAGE', windowId)
    fileKey = upload.fileKey
    windowInfo.value = await bindWindowImage(windowId, upload.fileKey)
    windowImageFile.value = null
    notify('档口图片已更新。')
  } catch (error) {
    // 写请求超时或服务端异常时，重新读取档口判断绑定是否已经提交。
    if (fileKey && isAmbiguousBindFailure(error)) {
      const bindingState = await reconcileWindowImageBinding(windowId, fileKey)
      if (bindingState === 'bound') {
        windowImageFile.value = null
        notify('档口图片已更新，已通过重新读取确认。')
        return
      }
      if (bindingState === 'unknown') {
        // 不确定是否已绑定时不删除文件，也清空本地选择以免再次重复上传。
        windowImageFile.value = null
        windowImageError.value =
          '图片绑定结果暂时无法确认，本次上传文件已保留以避免误删。请刷新页面确认图片状态后再操作。'
        return
      }
    }

    let cleanupMessage = ''
    if (fileKey) {
      try {
        await deleteManagedFile(fileKey)
        cleanupMessage = ' 未绑定的上传文件已清理。'
      } catch {
        cleanupMessage = ' 自动清理上传文件失败，请联系管理员检查。'
      }
    }
    windowImageError.value = errorMessage(error, '档口图片上传或绑定失败。') + cleanupMessage
  } finally {
    windowImageBusy.value = false
  }
}

/** 判断绑定失败是否可能发生在服务端提交之后，避免把超时误当成确定失败。 */
function isAmbiguousBindFailure(error: unknown): boolean {
  return (
    !(error instanceof ApiError) ||
    error.status === 0 ||
    error.status === 408 ||
    error.status >= 500
  )
}

/** 重新读取当前档口的菜品列表，确认本次文件键是否已经写入图片地址。 */
async function reconcileProductImageBinding(
  productId: number,
  windowId: number,
  fileKey: string,
): Promise<'bound' | 'not-bound' | 'unknown'> {
  try {
    const refreshedProducts = await listProducts(windowId)
    if (routeWindowId.value === windowId) products.value = refreshedProducts
    const product = refreshedProducts.find((item) => item.productId === productId)
    if (!product) return 'not-bound'
    return imageUrlUsesFileKey(product.imageUrl, fileKey) ? 'bound' : 'not-bound'
  } catch {
    return 'unknown'
  }
}

/** 重新读取当前档口，确认图片绑定是否已经提交。 */
async function reconcileWindowImageBinding(
  windowId: number,
  fileKey: string,
): Promise<'bound' | 'not-bound' | 'unknown'> {
  try {
    const refreshedWindows = await listWindows()
    const window = refreshedWindows.find((item) => item.windowId === windowId)
    if (routeWindowId.value === windowId && window) windowInfo.value = window
    if (!window) return 'not-bound'
    return imageUrlUsesFileKey(window.imageUrl, fileKey) ? 'bound' : 'not-bound'
  } catch {
    return 'unknown'
  }
}

/** 为当前分类或菜品设置待确认的停用/下架动作。 */
function askDeactivate(action: NonNullable<typeof pendingAction.value>): void {
  pendingAction.value = action
  confirmError.value = ''
  confirmOpen.value = true
}

/** 调用对应停用接口，成功后刷新当前档口的分类与菜品列表。 */
async function confirmDeactivate(): Promise<void> {
  const action = pendingAction.value
  if (!action) return
  confirmBusy.value = true
  confirmError.value = ''
  try {
    if (action.kind === 'category') {
      await disableCategory(action.id)
      notify('分类已停用。')
    } else {
      await takeProductOffSale(action.id)
      notify('菜品已下架。')
    }
    confirmOpen.value = false
    pendingAction.value = null
    await loadRecords()
  } catch (error) {
    confirmError.value = errorMessage(error, '操作失败，请稍后重试。')
  } finally {
    confirmBusy.value = false
  }
}

/** 显示权限拒绝、服务端验证及网络错误，不暴露原始异常堆栈。 */
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 403) {
    return '当前账号无权执行此操作，或档口已超出你的管理范围。'
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** 提交期间拦截 Escape，避免请求仍在处理时对话框被意外关闭。 */
function preventCloseWhileBusy(event: Event, busy: boolean): void {
  if (busy) event.preventDefault()
}

/** 将后端返回的图片相对地址转换为浏览器可访问的同源内容地址。 */
function contentUrl(url: string | null): string {
  return imageContentUrl(url)
}

onMounted(() => void loadRecords())
onBeforeUnmount(() => {
  loadSequence += 1
  categoryDialog.value?.close()
  productDialog.value?.close()
})
</script>

<template>
  <main class="ops-page" aria-labelledby="page-title">
    <nav class="ops-breadcrumb" aria-label="面包屑导航">
      <RouterLink :to="{ name: 'windows' }">档口管理</RouterLink>
      <span aria-hidden="true">/</span>
      <span>{{ windowInfo?.windowName || '菜单管理' }}</span>
    </nav>

    <section class="ops-page-heading ops-catalog-heading">
      <div>
        <p class="ops-kicker">档口菜单与图片</p>
        <h1 id="page-title">{{ windowInfo?.windowName || '菜单管理' }}</h1>
        <p class="ops-page-lead">
          <span v-if="windowInfo"
            >档口编码 {{ windowInfo.windowCode }} · 所属餐厅 ID {{ windowInfo.restaurantId }}</span
          >
          <span v-else>先读取当前账号可管理的档口信息。</span>
        </p>
      </div>
      <BaseButton variant="neutral" @click="$router.push({ name: 'windows' })">返回档口</BaseButton>
    </section>

    <TableState
      v-if="loading || loadError"
      :loading="loading"
      :error="loadError"
      :empty="false"
      @retry="loadRecords"
    />

    <template v-else-if="windowInfo">
      <section class="ops-panel ops-image-panel" aria-labelledby="window-image-title">
        <div class="ops-subsection-heading">
          <div>
            <p class="ops-kicker">档口展示</p>
            <h2 id="window-image-title">档口图片</h2>
          </div>
          <BaseButton v-if="windowImageFile" :loading="windowImageBusy" @click="saveWindowImage">
            上传并应用
          </BaseButton>
        </div>
        <ImageUpload
          id="window-image-file"
          v-model="windowImageFile"
          label="选择档口图片"
          :current-url="contentUrl(windowInfo.imageUrl)"
          current-alt="当前档口图片"
          :disabled="windowImageBusy"
        />
        <p v-if="windowImageError" class="ops-alert ops-alert--error" role="alert">
          {{ windowImageError }}
        </p>
      </section>

      <section class="ops-panel ops-list-panel ops-menu-section" aria-labelledby="categories-title">
        <div class="ops-subsection-heading ops-subsection-heading--panel">
          <div>
            <p class="ops-kicker">菜单结构</p>
            <h2 id="categories-title">
              菜品分类 <span class="ops-count-mark">{{ categories.length }}</span>
            </h2>
          </div>
          <BaseButton @click="openCategoryForm()">新建分类</BaseButton>
        </div>
        <TableState
          :loading="false"
          error=""
          :empty="categories.length === 0"
          empty-title="还没有菜品分类"
          empty-description="创建分类后，可以在菜品表单中选择归属分类。"
        >
          <div class="ops-table-scroll" tabindex="0" aria-label="分类列表，可横向滚动">
            <table class="ops-table">
              <thead>
                <tr>
                  <th scope="col">分类</th>
                  <th scope="col">排序</th>
                  <th scope="col">状态</th>
                  <th scope="col" class="ops-table__actions-heading">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="category in categories" :key="category.categoryId">
                  <th scope="row">
                    <span class="ops-table__primary">{{ category.categoryName }}</span>
                  </th>
                  <td>{{ category.sortOrder }}</td>
                  <td>
                    <span
                      class="ops-status"
                      :class="category.status === 1 ? 'ops-status--active' : 'ops-status--inactive'"
                    >
                      <i aria-hidden="true"></i>{{ category.status === 1 ? '启用' : '停用' }}
                    </span>
                  </td>
                  <td class="ops-table__actions">
                    <BaseButton variant="quiet" @click="openCategoryForm(category)"
                      >编辑</BaseButton
                    >
                    <BaseButton
                      v-if="category.status === 1"
                      variant="danger"
                      @click="
                        askDeactivate({
                          kind: 'category',
                          id: category.categoryId,
                          name: category.categoryName,
                        })
                      "
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

      <section class="ops-panel ops-list-panel ops-menu-section" aria-labelledby="products-title">
        <div class="ops-subsection-heading ops-subsection-heading--panel">
          <div>
            <p class="ops-kicker">菜单内容</p>
            <h2 id="products-title">
              菜品 <span class="ops-count-mark">{{ products.length }}</span>
            </h2>
          </div>
          <BaseButton @click="openProductForm()">新建菜品</BaseButton>
        </div>
        <TableState
          :loading="false"
          error=""
          :empty="products.length === 0"
          empty-title="这个档口还没有菜品"
          empty-description="创建菜品后，可继续设置价格、分类和售卖状态。"
        >
          <div class="ops-table-scroll" tabindex="0" aria-label="菜品列表，可横向滚动">
            <table class="ops-table">
              <thead>
                <tr>
                  <th scope="col">菜品</th>
                  <th scope="col">分类</th>
                  <th scope="col">售价</th>
                  <th scope="col">售卖状态</th>
                  <th scope="col" class="ops-table__actions-heading">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="product in products" :key="product.productId">
                  <th scope="row">
                    <span class="ops-product-cell">
                      <img
                        v-if="product.imageUrl"
                        :src="contentUrl(product.imageUrl)"
                        alt=""
                        loading="lazy"
                      />
                      <span v-else class="ops-product-cell__placeholder" aria-hidden="true"
                        >菜</span
                      >
                      <span>
                        <span class="ops-table__primary">{{ product.productName }}</span>
                        <span class="ops-table__secondary">{{ product.productCode }}</span>
                      </span>
                    </span>
                  </th>
                  <td>
                    {{
                      categories.find((item) => item.categoryId === product.categoryId)
                        ?.categoryName || '未分类'
                    }}
                  </td>
                  <td>¥ {{ Number(product.price).toFixed(2) }}</td>
                  <td>
                    <span
                      class="ops-status"
                      :class="
                        product.saleStatus === 1 ? 'ops-status--active' : 'ops-status--inactive'
                      "
                    >
                      <i aria-hidden="true"></i>{{ product.saleStatus === 1 ? '在售' : '已下架' }}
                    </span>
                  </td>
                  <td class="ops-table__actions">
                    <BaseButton variant="quiet" @click="openProductForm(product)">编辑</BaseButton>
                    <BaseButton
                      v-if="product.saleStatus === 1"
                      variant="danger"
                      @click="
                        askDeactivate({
                          kind: 'product',
                          id: product.productId,
                          name: product.productName,
                        })
                      "
                    >
                      下架
                    </BaseButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </TableState>
      </section>
    </template>

    <dialog
      ref="categoryDialog"
      class="ops-dialog"
      @cancel="preventCloseWhileBusy($event, categoryBusy)"
    >
      <form class="ops-dialog__form" novalidate @submit.prevent="saveCategory">
        <div class="ops-dialog__header">
          <span class="ops-dialog__eyebrow">菜单结构</span>
          <h2>{{ editingCategory ? '编辑分类' : '新建分类' }}</h2>
          <p>分类停用不会删除记录，服务端会检查相关业务约束。</p>
        </div>
        <p v-if="categoryError" class="ops-alert ops-alert--error" role="alert">
          {{ categoryError }}
        </p>
        <FormField
          id="category-categoryName"
          label="分类名称"
          :error="categoryErrors.categoryName"
          required
        >
          <input
            id="category-categoryName"
            ref="categoryFirstField"
            v-model="categoryForm.categoryName"
            class="ops-input"
            maxlength="64"
            :aria-invalid="!!categoryErrors.categoryName"
            :aria-describedby="
              categoryErrors.categoryName ? 'category-categoryName-error' : undefined
            "
          />
        </FormField>
        <div class="ops-form-grid">
          <FormField id="category-sortOrder" label="展示排序" :error="categoryErrors.sortOrder">
            <input
              id="category-sortOrder"
              v-model.number="categoryForm.sortOrder"
              class="ops-input"
              type="number"
              min="0"
              step="1"
              :aria-invalid="!!categoryErrors.sortOrder"
              :aria-describedby="categoryErrors.sortOrder ? 'category-sortOrder-error' : undefined"
            />
          </FormField>
          <FormField id="category-status" label="分类状态">
            <select id="category-status" v-model.number="categoryForm.status" class="ops-input">
              <option :value="1">启用</option>
              <option :value="0">停用</option>
            </select>
          </FormField>
        </div>
        <div class="ops-dialog__actions">
          <BaseButton variant="neutral" :disabled="categoryBusy" @click="categoryDialog?.close()"
            >取消</BaseButton
          >
          <BaseButton type="submit" :loading="categoryBusy">{{
            editingCategory ? '保存更改' : '创建分类'
          }}</BaseButton>
        </div>
      </form>
    </dialog>

    <dialog
      ref="productDialog"
      class="ops-dialog"
      @cancel="preventCloseWhileBusy($event, productBusy)"
    >
      <form class="ops-dialog__form" novalidate @submit.prevent="saveProduct">
        <div class="ops-dialog__header">
          <span class="ops-dialog__eyebrow">菜单内容</span>
          <h2>{{ editingProduct ? '编辑菜品' : '新建菜品' }}</h2>
          <p>菜品下架与物理删除不同；编辑时可以重新设置为在售。</p>
        </div>
        <p v-if="productError" class="ops-alert ops-alert--error" role="alert">
          {{ productError }}
        </p>
        <div class="ops-form-grid">
          <FormField
            id="product-productCode"
            label="菜品编码"
            :error="productErrors.productCode"
            required
          >
            <input
              id="product-productCode"
              ref="productFirstField"
              v-model="productForm.productCode"
              class="ops-input"
              maxlength="64"
              :aria-invalid="!!productErrors.productCode"
              :aria-describedby="
                productErrors.productCode ? 'product-productCode-error' : undefined
              "
            />
          </FormField>
          <FormField
            id="product-productName"
            label="菜品名称"
            :error="productErrors.productName"
            required
          >
            <input
              id="product-productName"
              v-model="productForm.productName"
              class="ops-input"
              maxlength="128"
              :aria-invalid="!!productErrors.productName"
              :aria-describedby="
                productErrors.productName ? 'product-productName-error' : undefined
              "
            />
          </FormField>
          <FormField id="product-categoryId" label="所属分类">
            <select
              id="product-categoryId"
              v-model.number="productForm.categoryId"
              class="ops-input"
            >
              <option :value="null">未分类</option>
              <option
                v-for="category in categories"
                :key="category.categoryId"
                :value="category.categoryId"
              >
                {{ category.categoryName }}{{ category.status === 0 ? '（已停用）' : '' }}
              </option>
            </select>
          </FormField>
          <FormField
            id="product-price"
            label="售价（人民币）"
            description="最多保留两位小数。"
            :error="productErrors.price"
            required
          >
            <input
              id="product-price"
              v-model.number="productForm.price"
              class="ops-input"
              type="number"
              min="0"
              max="99999999.99"
              step="0.01"
              :aria-invalid="!!productErrors.price"
              :aria-describedby="productErrors.price ? 'product-price-error' : 'product-price-hint'"
            />
          </FormField>
          <FormField id="product-saleStatus" label="售卖状态">
            <select
              id="product-saleStatus"
              v-model.number="productForm.saleStatus"
              class="ops-input"
            >
              <option :value="1">在售</option>
              <option :value="0">下架</option>
            </select>
          </FormField>
          <FormField id="product-sortOrder" label="展示排序" :error="productErrors.sortOrder">
            <input
              id="product-sortOrder"
              v-model.number="productForm.sortOrder"
              class="ops-input"
              type="number"
              min="0"
              step="1"
              :aria-invalid="!!productErrors.sortOrder"
              :aria-describedby="productErrors.sortOrder ? 'product-sortOrder-error' : undefined"
            />
          </FormField>
          <FormField id="product-description" label="菜品描述" :error="productErrors.description">
            <textarea
              id="product-description"
              v-model="productForm.description"
              class="ops-input ops-textarea resize-none"
              maxlength="500"
              rows="3"
              :aria-invalid="!!productErrors.description"
              :aria-describedby="
                productErrors.description ? 'product-description-error' : undefined
              "
            ></textarea>
          </FormField>
        </div>
        <div v-if="editingProduct" class="ops-dialog-image">
          <ImageUpload
            id="product-image-file"
            v-model="productImageFile"
            label="更换菜品图片"
            :current-url="contentUrl(editingProduct.imageUrl)"
            :current-alt="editingProduct.productName + '当前图片'"
            :disabled="productBusy || imageBusy"
          />
          <p class="ops-form-note">
            图片将在菜品资料保存后上传并绑定。若图片绑定失败，资料更改仍会保留，但当前图片不变。
          </p>
        </div>
        <p v-else class="ops-form-note">新建菜品后，可重新编辑该菜品并上传图片。</p>
        <div class="ops-dialog__actions">
          <BaseButton variant="neutral" :disabled="productBusy" @click="productDialog?.close()"
            >取消</BaseButton
          >
          <BaseButton type="submit" :loading="productBusy">{{
            editingProduct ? '保存更改' : '创建菜品'
          }}</BaseButton>
        </div>
      </form>
    </dialog>

    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="confirmTitle"
      :description="confirmDescription"
      :confirm-label="pendingAction?.kind === 'product' ? '确认下架' : '确认停用'"
      danger
      :loading="confirmBusy"
      :error="confirmError"
      @confirm="confirmDeactivate"
    />
  </main>
</template>
