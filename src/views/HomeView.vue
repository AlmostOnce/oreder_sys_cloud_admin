<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { CATALOG_ALLOWED_ROLES, navigationForRole, roleCanAccess } from '../admin/permissions.ts'
import { roleLabel } from '../auth/policy.ts'
import { useAuthStore } from '../stores/auth.ts'

const auth = useAuthStore()
const roleName = computed(() => roleLabel(auth.profile?.roleCode ?? ''))
const navigation = computed(() => navigationForRole(auth.profile?.roleCode))
const canOpenCatalog = computed(() => roleCanAccess(auth.profile?.roleCode, CATALOG_ALLOWED_ROLES))
</script>

<template>
  <main class="ops-page ops-home" aria-labelledby="page-title">
    <section class="ops-page-heading ops-home__heading">
      <div>
        <p class="ops-kicker">CAMPUS DINING · OPERATIONS</p>
        <h1 id="page-title">你好，{{ auth.profile?.username }}</h1>
        <p class="ops-page-lead">以下是当前账号可访问的管理功能。</p>
      </div>
      <div class="ops-identity-chip">
        <span class="ops-identity-chip__dot" aria-hidden="true"></span>
        <span>{{ roleName }}</span>
      </div>
    </section>

    <section class="ops-home__section" aria-labelledby="available-tools-title">
      <div class="ops-section-heading">
        <div>
          <p class="ops-kicker">可用工作区</p>
          <h2 id="available-tools-title">从这里继续处理日常运营</h2>
        </div>
        <span class="ops-section-heading__count"
          >{{ navigation.length + (canOpenCatalog ? 1 : 0) }} 项</span
        >
      </div>

      <div v-if="navigation.length || canOpenCatalog" class="ops-feature-grid">
        <RouterLink
          v-for="item in navigation"
          :key="item.name"
          class="ops-feature-card"
          :to="{ name: item.name }"
        >
          <span class="ops-feature-card__eyebrow">管理模块</span>
          <span class="ops-feature-card__title">{{ item.label }}</span>
          <span class="ops-feature-card__description">{{ item.description }}</span>
          <span class="ops-feature-card__action">打开模块 <span aria-hidden="true">→</span></span>
        </RouterLink>
        <RouterLink
          v-if="canOpenCatalog"
          class="ops-feature-card ops-feature-card--catalog"
          :to="{ name: 'windows' }"
        >
          <span class="ops-feature-card__eyebrow">商品维护</span>
          <span class="ops-feature-card__title">分类与菜品</span>
          <span class="ops-feature-card__description">从档口进入菜单，维护分类、菜品和图片。</span>
          <span class="ops-feature-card__action">先选择档口 <span aria-hidden="true">→</span></span>
        </RouterLink>
      </div>

      <div v-else class="ops-panel ops-empty-capability" role="status">
        <span class="ops-state-rule" aria-hidden="true"></span>
        <h3>当前角色暂无可用的业务管理入口</h3>
        <p>可用功能由后端角色和数据范围决定；如果你认为这是配置问题，请联系系统管理员。</p>
      </div>
    </section>

    <section
      v-if="auth.profile?.roleCode === 'SYSTEM_ADMIN'"
      class="ops-honest-gap"
      aria-labelledby="gap-title"
    >
      <div class="ops-honest-gap__mark" aria-hidden="true">i</div>
      <div>
        <p class="ops-kicker">能力边界</p>
        <h2 id="gap-title">账号管理尚不可用</h2>
        <p>
          后端目前没有管理端用户列表或检索接口。为避免手填用户编号造成误操作，这里暂不提供改角色或停用账号的入口。
        </p>
      </div>
    </section>

    <section class="ops-home__footnote" aria-label="数据安全说明">
      <span class="ops-home__footnote-rule" aria-hidden="true"></span>
      <p>
        页面入口只用于导航。每条餐厅、档口和菜单数据的可见范围及操作权限，仍由对应业务服务实时校验。
      </p>
    </section>
  </main>
</template>
