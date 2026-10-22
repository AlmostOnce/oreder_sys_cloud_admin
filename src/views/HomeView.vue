<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { roleLabel } from '../auth/policy.ts'
import { useAuthStore } from '../stores/auth.ts'

const auth = useAuthStore()
const router = useRouter()
const nameInitial = computed(() => auth.profile?.username.trim().charAt(0).toUpperCase() || '管')
const roleName = computed(() => roleLabel(auth.profile?.roleCode ?? ''))

/** 注销操作必须得到后端确认；失败时保留当前会话。 */
async function logout(): Promise<void> {
  try {
    await auth.signOut()
    await router.replace({ name: 'login' })
  } catch {
    // 页面通过 Pinia 的错误状态呈现失败原因，用户可再次尝试。
  }
}
</script>

<template>
  <main class="workspace-page">
    <header class="workspace-header">
      <RouterLink class="workspace-brand" to="/" aria-label="食堂运营平台工作台">
        <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
        <span>食堂运营平台<small>管理工作台</small></span>
      </RouterLink>
      <div class="workspace-user">
        <span class="user-avatar" aria-hidden="true">{{ nameInitial }}</span>
        <span class="user-name"
          >{{ auth.profile?.username }}<small>{{ roleName }}</small></span
        >
        <button class="logout-button" type="button" :disabled="auth.busy" @click="logout">
          {{ auth.busy ? '正在退出…' : '退出登录' }}
        </button>
      </div>
    </header>

    <section class="workspace-content" aria-labelledby="workspace-title">
      <p class="eyebrow">CAMPUS DINING OPERATIONS</p>
      <h1 id="workspace-title">你好，{{ auth.profile?.username }}</h1>
      <p class="workspace-lead">身份已通过服务端确认，可访问的业务能力将按角色逐步开放。</p>

      <div class="identity-card">
        <div class="identity-mark" aria-hidden="true">
          <span class="brand-mark"><span></span><span></span><span></span></span>
        </div>
        <div>
          <p class="identity-label">当前登录身份</p>
          <h2>{{ roleName }}</h2>
          <p class="identity-account">{{ auth.profile?.username }}</p>
        </div>
        <span class="identity-status"><i></i>已验证</span>
      </div>

      <p v-if="auth.errorMessage" class="form-alert workspace-alert" role="alert">
        {{ auth.errorMessage }}
      </p>

      <div class="workspace-note">
        <span class="note-line" aria-hidden="true"></span>
        <div>
          <h2>工作台已准备就绪</h2>
          <p>
            商品、订单与人员管理功能将按项目开发计划逐步接入。当前账号可访问的具体数据范围由服务端权限校验。
          </p>
        </div>
      </div>
    </section>

    <footer class="workspace-footer">校园点餐管理平台 <span>·</span> 安全运营入口</footer>
  </main>
</template>
