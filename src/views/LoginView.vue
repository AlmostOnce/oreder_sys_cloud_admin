<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '../auth/errors.ts'
import type { Captcha } from '../auth/contracts.ts'
import { authSession } from '../auth/runtime.ts'
import { useAuthStore } from '../stores/auth.ts'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const account = ref('')
const password = ref('')
const captchaCode = ref('')
const captcha = ref<Captcha | null>(null)
const captchaLoading = ref(false)
const showPassword = ref(false)
const formError = ref('')
const captchaError = ref('')
const accountError = ref('')
const passwordError = ref('')
const captchaCodeError = ref('')
const accountInput = ref<HTMLInputElement | null>(null)
const passwordInput = ref<HTMLInputElement | null>(null)
const captchaInput = ref<HTMLInputElement | null>(null)
let captchaRequest: AbortController | null = null
const captchaImage = computed(() => captcha.value?.imageBase64 ?? '')

onMounted(() => {
  void loadCaptcha()
})

onUnmounted(() => {
  // 离开登录页后取消验证码请求，防止过期响应继续更新已经卸载的表单。
  captchaRequest?.abort()
})

/** 获取一次性图片验证码；失败时保留可操作的重试入口。 */
async function loadCaptcha(): Promise<void> {
  captchaRequest?.abort()
  const request = new AbortController()
  captchaRequest = request
  captchaLoading.value = true
  captchaError.value = ''
  // 旧验证码不可继续提交，加载失败时也不能留下旧图片和旧标识。
  captcha.value = null
  captchaCode.value = ''
  captchaCodeError.value = ''
  try {
    const nextCaptcha = await authSession.fetchCaptcha(request.signal)
    if (!request.signal.aborted) captcha.value = nextCaptcha
  } catch (error) {
    if (request.signal.aborted) return
    captchaError.value = error instanceof Error ? error.message : '验证码暂时无法加载。'
  } finally {
    if (captchaRequest === request) captchaLoading.value = false
  }
}

/** 先完成字段校验，再通过认证状态统一入口提交。 */
async function submitLogin(): Promise<void> {
  // 同一表单只允许一个登录请求，避免一次性验证码被连续消费。
  if (auth.busy || captchaLoading.value) return
  formError.value = ''
  accountError.value = ''
  passwordError.value = ''
  captchaCodeError.value = ''

  const normalizedAccount = account.value.trim().toLowerCase()
  if (!normalizedAccount) {
    accountError.value = '请输入用户号或邮箱。'
    accountInput.value?.focus()
    return
  }
  if (
    !/^\d{10}$/.test(normalizedAccount) &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedAccount)
  ) {
    accountError.value = '请输入十位用户号或有效邮箱，昵称不能用于登录。'
    accountInput.value?.focus()
    return
  }
  if (!password.value) {
    passwordError.value = '请输入密码。'
    passwordInput.value?.focus()
    return
  }
  if (!captcha.value) {
    formError.value = '请先获取图片验证码。'
    return
  }
  if (!captchaCode.value.trim()) {
    captchaCodeError.value = '请输入图片中的验证码。'
    captchaInput.value?.focus()
    return
  }

  try {
    await auth.signIn({
      account: normalizedAccount,
      password: password.value,
      captchaId: captcha.value.captchaId,
      captchaCode: captchaCode.value.trim(),
    })
    password.value = ''
    await router.replace(safeRedirect(route.query.redirect))
  } catch (error) {
    formError.value = messageFor(error)
    // 失败后保留账号便于纠正输入，但不保留密码；下一次必须重新填写验证码。
    password.value = ''
    showPassword.value = false
    // 后端每次登录尝试都会消费验证码，失败后必须重新获取。
    await loadCaptcha()
  }
}

/** 仅允许站内相对路径作为登录后的跳转地址。 */
function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/'
  try {
    const destination = new URL(value, window.location.origin)
    if (destination.origin !== window.location.origin || destination.pathname === '/login')
      return '/'
    return `${destination.pathname}${destination.search}${destination.hash}`
  } catch {
    return '/'
  }
}

/** 将认证、限流和网络错误转换成表单内的中文恢复提示。 */
function messageFor(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return '账号或密码不正确，请重新输入。'
  if (error instanceof ApiError && error.status === 429) return '尝试次数过多，请稍后再试。'
  return error instanceof Error ? error.message : '登录失败，请稍后重试。'
}
</script>

<template>
  <main class="login-page">
    <section class="login-story" aria-labelledby="brand-title">
      <div class="story-topline">
        <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
        <span>ORDERING SYSTEM</span>
      </div>

      <div class="story-copy">
        <p class="eyebrow">CAMPUS DINING · OPERATIONS</p>
        <h1 id="brand-title">让每一餐，<br />都有序抵达。</h1>
        <p class="story-description">
          统一管理档口、菜单与订单。登录后根据你的岗位权限进入运营工作台。
        </p>
      </div>

      <div class="story-board" aria-label="运营平台工作流">
        <div class="board-heading">
          <span>运营工作流</span><span class="board-status"><i></i>安全入口</span>
        </div>
        <div class="board-flow">
          <div class="flow-node">
            <span class="flow-icon flow-menu" aria-hidden="true"></span><span>菜单</span>
          </div>
          <span class="flow-line" aria-hidden="true"></span>
          <div class="flow-node">
            <span class="flow-icon flow-order" aria-hidden="true"></span><span>订单</span>
          </div>
          <span class="flow-line" aria-hidden="true"></span>
          <div class="flow-node">
            <span class="flow-icon flow-service" aria-hidden="true"></span><span>履约</span>
          </div>
        </div>
        <p class="board-note">食堂运营 · 从容协作</p>
      </div>

      <p class="story-footer">校园点餐管理平台 <span>·</span> 内部运营入口</p>
    </section>

    <section class="login-panel" aria-labelledby="login-title">
      <div class="panel-inner">
        <div class="mobile-brand">
          <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
          食堂运营平台
        </div>
        <div class="form-heading">
          <p class="eyebrow">STAFF ACCESS</p>
          <h2 id="login-title">登录管理端</h2>
          <p>使用你的运营账号继续</p>
        </div>

        <form
          class="login-form"
          novalidate
          @submit.prevent="submitLogin"
          @keydown.enter="
            (event) => {
              if (event.isComposing) event.preventDefault()
            }
          "
        >
          <div class="field-group">
            <label for="account">用户号或邮箱</label>
            <div class="input-wrap">
              <span class="field-icon user-icon" aria-hidden="true"></span>
              <input
                id="account"
                ref="accountInput"
                v-model="account"
                name="account"
                type="text"
                autocomplete="username"
                autocapitalize="none"
                :spellcheck="false"
                maxlength="254"
                placeholder="请输入十位用户号或邮箱"
                :disabled="auth.busy"
                :aria-invalid="!!accountError"
                aria-describedby="account-hint"
                @input="accountError = ''"
              />
            </div>
            <span
              id="account-hint"
              class="field-hint"
              :class="{ 'error-text': accountError }"
              aria-live="polite"
              >{{ accountError || '使用十位用户号或邮箱登录，昵称仅用于展示' }}</span
            >
          </div>

          <div class="field-group">
            <div class="label-row"><label for="password">密码</label></div>
            <div class="input-wrap">
              <span class="field-icon lock-icon" aria-hidden="true"></span>
              <input
                id="password"
                ref="passwordInput"
                v-model="password"
                name="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                maxlength="64"
                placeholder="请输入密码"
                :disabled="auth.busy"
                :aria-invalid="!!passwordError"
                aria-describedby="password-hint"
                @input="passwordError = ''"
              />
              <button
                class="visibility-button"
                type="button"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                :aria-pressed="showPassword"
                :disabled="auth.busy"
                @click="showPassword = !showPassword"
              >
                <svg v-if="showPassword" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.7 10.7 0 0112 5c5 0 8.5 4.2 9.5 7-.4 1.1-1.3 2.5-2.6 3.7M6.2 6.3C3.8 7.8 2.7 10 2.5 12c.5 1.4 2.2 4 5.7 5.8A10.3 10.3 0 0012 19c.7 0 1.4-.1 2-.2"
                  />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
            <span
              v-if="passwordError"
              id="password-hint"
              class="field-hint error-text"
              role="status"
              >{{ passwordError }}</span
            >
          </div>

          <div class="field-group captcha-group">
            <div class="label-row">
              <label for="captcha">图片验证码</label
              ><span class="field-hint">看不清？点击图片更换</span>
            </div>
            <div class="captcha-row">
              <div class="input-wrap captcha-input-wrap">
                <span class="field-icon captcha-icon" aria-hidden="true"></span>
                <input
                  id="captcha"
                  ref="captchaInput"
                  v-model="captchaCode"
                  name="captcha"
                  type="text"
                  autocomplete="off"
                  inputmode="text"
                  maxlength="8"
                  placeholder="输入验证码"
                  :disabled="auth.busy"
                  :aria-invalid="!!captchaCodeError"
                  aria-describedby="captcha-hint"
                  @input="captchaCodeError = ''"
                />
              </div>
              <button
                class="captcha-image-button"
                type="button"
                :disabled="captchaLoading || auth.busy"
                aria-label="更换图片验证码"
                @click="loadCaptcha"
              >
                <img v-if="captchaImage" :src="captchaImage" alt="图片验证码，点击更换" />
                <span v-else class="captcha-placeholder">{{
                  captchaLoading ? '正在加载' : '点击重试'
                }}</span>
              </button>
            </div>
            <span
              v-if="captchaError || captchaCodeError"
              id="captcha-hint"
              class="inline-hint error-text"
              role="status"
              >{{ captchaError || captchaCodeError }}</span
            >
          </div>

          <p v-if="formError" class="form-alert" role="alert">
            <span aria-hidden="true">!</span>{{ formError }}
          </p>

          <button class="submit-button" type="submit" :disabled="auth.busy || captchaLoading">
            <span v-if="auth.busy" class="button-spinner" aria-hidden="true"></span>
            {{ auth.busy ? '正在验证…' : '登录管理端' }}
            <svg v-if="!auth.busy" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 10h11M10 5l5 5-5 5" />
            </svg>
          </button>
        </form>

        <div class="security-note">
          <span class="security-shield" aria-hidden="true"></span
          ><span>身份由服务端校验<br /><small>仅授权运营账号可以进入管理端</small></span>
        </div>
        <p class="panel-footer">遇到登录问题？请联系系统管理员</p>
      </div>
    </section>
  </main>
</template>
