# 管理端运营模块实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Each task below is a reviewable vertical slice.

**Goal:** 在不新增后端 API 的前提下，将现有登录壳扩展为角色感知的运营端，并完成现有 API 支撑的餐厅、档口、分类、菜品及图片管理。

**Architecture:** 管理端只经 Gateway `/api/**` 调用后端，业务请求通过现有 `AuthSession.request` 复用 JWT 刷新机制。共享角色策略、运营布局、请求契约、提示/确认/字段组件提供跨页面一致性；业务页面各自负责列表与表单，服务端继续执行最终角色和数据范围校验。

**Tech Stack:** Vue 3、TypeScript、Vite、Vue Router、Pinia、原生 HTML/CSS；不新增 UI 组件库或后端 API。

**Spec:** `docs/superpowers/specs/2026-10-23-admin-operations.md`

## Global Constraints

- Gateway URL 以 `/api` 为前缀；浏览器不得直连业务服务或 Nacos。
- 仅实现 spec 中可用且数据范围明确的现有接口，不造示例业务数据。
- 前端导航/路由权限仅为 UX；每个操作仍由后端鉴权和数据范围规则保护。
- `STALL_MANAGER`、`RESTAURANT_MANAGER`、`GENERAL_MANAGER`、`SYSTEM_ADMIN` 的入口按 spec 权限矩阵展示。
- 登录页、Token 保存/刷新/注销行为保持不变；运营端可以使用独立 `--ops-*` 主题。
- 页面中文文案自然、业务动作使用“停用/下架”而非错误的“删除”。
- 按用户明确要求，不新增或运行自动化测试；以类型检查、构建和实际浏览器核验作为本次验证。
- 图像类型 JPG/PNG/GIF/WebP，客户端不超过 5 MB；服务端限制仍是最终约束。
- 所有新控件满足语义化、键盘可达、可见焦点、稳定布局与 `prefers-reduced-motion`。

## Review Focus

- 角色或数据范围不匹配：菜单和页面不暴露跨餐厅/档口信息，服务端 403 保持在当前页且可恢复。
- 餐厅经理编辑时必须保留 `restaurantCode` 与 `sortOrder`，不能通过 UI 偶然改动受限字段。
- 上传与绑定是两个远端步骤；确定未绑定时清理孤立文件；网络/5xx 等不确定结果须重读实体核实，无法确认时保留文件，不能冒险删除。
- 餐厅停用不可由当前 API 恢复；确认文案、约束错误和成功反馈必须准确。
- 后端列表未分页；不能通过前端伪造分页总数或宣称只查当前页，筛选仅作用于已加载数据。

---

### Task 1: API 边界、视觉 token 与运营壳

**Files:**

- Modify: `DESIGN.md`
- Create: `UX-CONTRACT.md`
- Modify: `docs/ADMIN_STRUCTURE.md`
- Modify: `docs/LOGIN_IMPLEMENTATION_PLAN.md`（清除与当前交付相冲突的过期关机/推送项）
- Modify: `README.md`
- Create: `src/admin/permissions.ts`
- Create: `src/layouts/AdminLayout.vue`
- Modify: `src/router/index.ts`
- Modify: `src/views/HomeView.vue`
- Modify: `src/assets/tokens.css`
- Modify: `src/assets/main.css`
- Create as needed: reusable button, form field, notice, toast host, confirmation dialog, empty/loading primitives under `src/components/`

**Interfaces:**

- Consumes: `AdminProfile.roleCode`; `AuthSession.request`, `signOut`; existing `/users/me/profile` recovery.
- Produces: role permission helpers for restaurant/window/catalog routes; shared operations shell; semantic token ownership; global behavior contract for later tasks.

- [x] 更新结构文档，准确列出现有接口、角色、数据范围及不做的页面，并链接本 spec 与 plan。
- [x] 为运营端添加 `--ops-*` 主题，登录 `--color-*` 保持原样；新增设计说明和 UX 契约明确 token/行为所有者。
- [x] 以单一 permission map 管理菜单和路由权限；直接打开越权 URL 时进入 403 页面。
- [x] 用 `AdminLayout` 替换占位工作台结构：桌面侧栏、窄屏抽屉、账号菜单、可回首页的导航、当前路由标题和退出操作。
- [x] 首页只显示真实身份与可用功能入口；System Admin 显示“用户检索接口尚未提供”的诚实说明，不伪造统计数据。
- [x] 统一 API 失败、Toast、Busy、表单字段、ConfirmDialog、Empty/Loading 的复用组件和行为。
- [x] 类型检查、生产构建和 premium 静态审计通过；浏览器中的受保护路由/窄屏交互待可用浏览器与真实管理员会话后手工验收。
- [ ] 约 07:00 提交：`docs: define admin operations architecture` 与 `feat: add role-aware operations shell`（若 shell 是独立可构建切片）。

### Task 2: 餐厅维护

**Files:**

- Create: `src/api/restaurants.ts`
- Create: `src/views/RestaurantsView.vue`
- Modify: `src/router/index.ts`, `src/admin/permissions.ts`, `src/layouts/AdminLayout.vue`
- Create/extend shared form and status components only if Task 1 has not already provided them.

**Interfaces:**

- Consumes: Task 1 API/permission/shared interaction owners; GET/POST/PUT/DELETE `/products/admin/restaurants`.
- Produces: scope-filtered restaurant list and create/update/disable workflow.

- [x] 定义 `RestaurantAdmin` / `RestaurantSaveRequest` TypeScript 类型，严格匹配后端 VO/DTO。
- [x] 列表通过 `AuthSession.request` 读取，不引入本地假数据；搜索只筛选已返回项并持久化 URL query。
- [x] General Manager 可看到创建/平台级停用；Restaurant Manager 只编辑列表范围内餐厅，并提交原 `restaurantCode`/`sortOrder` 值不变。
- [x] 编辑/创建表单有字段标签、约束提示、内联错误、首错焦点与防重复提交；不提供未经后端支持的图片文件绑定流程。
- [x] 停用用应用内确认对话框，明确当前接口不能恢复；启用档口冲突时保留对话框内容并显示后端恢复提示。
- [x] 类型检查与生产构建通过；依赖真实管理员会话的列表/写操作浏览器验收待用户本机完成。
- [ ] 约 07:00 提交：`feat: add restaurant administration`。

### Task 3: 档口维护与营业状态

**Files:**

- Create: `src/api/catalog.ts`（档口/分类/菜品 API 类型和方法）
- Create: `src/views/WindowsView.vue`
- Modify: `src/router/index.ts`, `src/admin/permissions.ts`, `src/layouts/AdminLayout.vue`

**Interfaces:**

- Consumes: Task 1 shared API/request/status/form; GET/POST `/products/admin/windows`, PUT/DELETE `/products/admin/windows/{id}`。
- Produces: 当前范围内档口表格和档口目录入口，供 Task 4 使用。

- [x] 获取操作者范围内餐厅（沿用 restaurant API）并显示档口列表；档口创建/编辑只允许选择已加载且可见餐厅。
- [x] 将 `status`（启用/停用）与 `isOpen`（营业/休息）作为两个独立字段、两个独立状态标识。
- [x] 编辑请求完整包含 `restaurantId/windowCode/windowName/description/sortOrder/location/imageUrl/status/isOpen`；空值规则与 DTO 注释一致。
- [x] 档口停用需确认，成功后重取列表；冲突/403/重复编码保留表单并显示安全可读错误。
- [x] 每个档口提供明确的“管理菜单”导航，不让整行点击与行内按钮互相误触。
- [x] 类型检查与生产构建通过；不同角色和写操作的浏览器验收待真实会话。
- [ ] 约 07:00 提交：`feat: add window administration`。

### Task 4: 分类、菜品与图片

**Files:**

- Create: `src/views/WindowCatalogView.vue`
- Create: `src/api/files.ts`
- Create/modify: shared image upload component under `src/components/`
- Modify: `src/api/catalog.ts`, `src/router/index.ts`, `src/layouts/AdminLayout.vue`, `src/admin/permissions.ts`, `src/assets/main.css`

**Interfaces:**

- Consumes: Task 1 shared components; Task 3 `WindowAdmin`; existing category/product GET/POST/PUT/DELETE; file upload and product/window image bind endpoints.
- Produces: selected window’s category/product catalog with safe image replace flow.

- [x] 读取窗口分类与菜品；切换窗口时忽略过期响应，不允许旧列表覆盖新窗口。
- [x] 分类创建/编辑/停用严格匹配 DTO；菜品支持分类、编码、名称、描述、价格、在售状态、排序字段。
- [x] 菜品下架不是删除；表格显示售卖状态，编辑可通过受控 `saleStatus` 恢复在售（后端接受 PUT）。
- [x] 在已存在档口/菜品后才允许换图；使用 `FormData` 上传 `bizType=WINDOW_IMAGE/PRODUCT_IMAGE` 和 `bizRef`，随后 PUT `{fileKey}` 绑定。
- [x] 扩展 `ApiClient` 对 `FormData` 的处理（不手写 multipart Content-Type）；经 `AuthSession.request` 调用，保留刷新重试/401行为。
- [x] 上传失败保留选择；确定未绑定时 DELETE 新上传文件并显示清理结果；绑定结果不确定时重读实体，无法确认则保留文件并提示复核；成功时重取当前实体。图片预览用内容 URL，不接受外部输入作为上传结果。
- [x] 确认类别/菜品停用；表单验证金额两位小数、必填与长度；键盘与窄屏可达。
- [x] 类型检查与生产构建通过；菜单读写、图片上传和失败恢复的真实后端浏览器流程待用户会话验收。
- [ ] 约 07:00 提交：`feat: add menu and product administration`。

### Task 5: 文档收尾、全局核验与远端交付

**Files:**

- Modify: `README.md`, `docs/ADMIN_STRUCTURE.md`, `docs/LOGIN_IMPLEMENTATION_PLAN.md`, `UX-CONTRACT.md`, this plan’s execution checkboxes.

**Interfaces:**

- Consumes: all completed frontend modules and verified backend contract.
- Produces: maintained implementation status and one remote branch with coherent commits.

- [x] 更新当前实现矩阵、已完成模块、被后端契约阻塞的用户/订单/库存/支付/销量页，明确不新增后端接口。
- [x] `npm run type-check`、`npm run build-only` 与 premium 严格静态审计通过；仓库没有配置单独 DESIGN lint 命令；按要求未运行自动化测试。
- [ ] 浏览器复核登录回归、所有业务路由、角色入口、会话失效、关键表单/错误/空态、桌面与窄屏（当前无可用浏览器自动化实例，且未获取真实管理员凭据；不绕过认证）。
- [ ] 查 diff、确认分支和凭据安全；按前述阶段拆成多个提交，并在约 2026-10-23 07:00（Asia/Shanghai）执行 `git push -u origin codex/admin-operations`；禁止 force push、禁止关机。
