<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '../auth/errors.ts'
import type { Captcha } from '../auth/contracts.ts'
import { authSession } from '../auth/runtime.ts'
import { useAuthStore } from '../stores/auth.ts'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const username = ref('')
const password = ref('')
const captchaCode = ref('')
const captcha = ref<Captcha | null>(null)
const captchaLoading = ref(false)
const showPassword = ref(false)
const formError = ref('')
const captchaError = ref('')
const captchaImage = computed(() => captcha.value?.imageBase64 ?? '')

onMounted(() => {
  void loadCaptcha()
})

/** 获取一次性图片验证码；失败时保留可操作的重试入口。 */
async function loadCaptcha(): Promise<void> {
  captchaLoading.value = true
  captchaError.value = ''
  try {
    captcha.value = await authSession.fetchCaptcha()
    captchaCode.value = ''
  } catch (error) {
    captchaError.value = error instanceof Error ? error.message : '验证码暂时无法加载。'
  } finally {
    captchaLoading.value = false
  }
}

/** 先完成字段校验，再通过认证状态统一入口提交。 */
async function submitLogin(): Promise<void> {
  formError.value = ''
  captchaError.value = ''

  if (!username.value.trim()) {
    formError.value = '请输入用户名。'
    return
  }
  if (!password.value) {
    formError.value = '请输入密码。'
    return
  }
  if (!captcha.value) {
    formError.value = '请先获取图片验证码。'
    return
  }
  if (!captchaCode.value.trim()) {
    formError.value = '请输入图片中的验证码。'
    return
  }

  try {
    await auth.signIn({
      username: username.value.trim(),
      password: password.value,
      captchaId: captcha.value.captchaId,
      captchaCode: captchaCode.value.trim(),
    })
    password.value = ''
    await router.replace(safeRedirect(route.query.redirect))
  } catch (error) {
    formError.value = messageFor(error)
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
  if (error instanceof ApiError && error.status === 401) return '用户名或密码不正确，请重新输入。'
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

        <form class="login-form" novalidate @submit.prevent="submitLogin">
          <div class="field-group">
            <label for="username">用户名</label>
            <div class="input-wrap">
              <span class="field-icon user-icon" aria-hidden="true"></span>
              <input
                id="username"
                v-model="username"
                name="username"
                type="text"
                autocomplete="username"
                maxlength="64"
                placeholder="请输入用户名"
                :disabled="auth.busy"
                aria-describedby="username-hint"
              />
            </div>
            <span id="username-hint" class="field-hint">请使用管理员或运营人员账号</span>
          </div>

          <div class="field-group">
            <div class="label-row"><label for="password">密码</label></div>
            <div class="input-wrap">
              <span class="field-icon lock-icon" aria-hidden="true"></span>
              <input
                id="password"
                v-model="password"
                name="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                maxlength="64"
                placeholder="请输入密码"
                :disabled="auth.busy"
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
                  v-model="captchaCode"
                  name="captcha"
                  type="text"
                  autocomplete="off"
                  inputmode="text"
                  maxlength="8"
                  placeholder="输入验证码"
                  :disabled="auth.busy"
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
            <span v-if="captchaError" class="inline-hint error-text" role="status">{{
              captchaError
            }}</span>
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
