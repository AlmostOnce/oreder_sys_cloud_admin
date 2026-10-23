# 管理端 UX 契约

## 产品上下文

- 受众：校园食堂的档口负责人、餐厅经理、总经理、系统管理员。
- 主要任务：在后端已开放的数据范围内维护餐厅/档口/菜单；查看真实资源状态并处理停用、下架与图片更新。
- 市场与语言：中国大陆；界面与验证提示使用简体中文；金额使用人民币两位小数；本地时间以浏览器/服务端时间字符串为准，不对 `LocalDateTime` 擅自做 UTC 转换。
- 可访问性目标：WCAG 2.2 AA 基线。

## 业务依据

| 领域                         | 依据                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 微服务/网关边界              | 后端仓库 `order_system_cloud`：`docs/ARCHITECTURE.md`、`docs/API_DOCS.md`                                                                                                                                           |
| 角色                         | 后端仓库 `order_system_cloud`：`common-core/src/main/java/com/hbue/ordering/common/core/role/RoleCode.java`                                                                                                         |
| 餐厅权限与停用               | 后端仓库 `order_system_cloud`：`product-service/src/main/java/com/hbue/ordering/product/service/impl/RestaurantAdministrationServiceImpl.java`                                                                      |
| 档口/菜品权限与状态          | 后端仓库 `order_system_cloud`：`product-service/src/main/java/com/hbue/ordering/product/service/impl/ProductAdministrationServiceImpl.java`                                                                         |
| 图片绑定                     | 后端仓库 `order_system_cloud`：`product-service/src/main/java/com/hbue/ordering/product/controller/ProductImageController.java`、`file-service/src/main/java/com/hbue/ordering/file/controller/FileController.java` |
| 明确暂缓的用户/订单/销量能力 | 后端仓库 `order_system_cloud` 对应 Controller 与 `docs/SALES_RANKING.md`；具体缺口见本仓库 `docs/superpowers/specs/2026-10-23-admin-operations.md`                                                                  |

## 视觉与 Token

- 视觉权威：根目录 `DESIGN.md`。
- Token 所有者：现有 `src/assets/tokens.css`；`DESIGN.md` 镜像 CSS 变量，不生成 CSS。
- 登录页使用 `--color-*`；管理工作区使用作用域内 `--ops-*`，由 `.operations-theme` 设置。两者不得互相覆盖。
- 颜色、字体、间距、圆角的动机与映射只写在 `DESIGN.md`；这里记录操作行为。
- 滚动条由全局应用 CSS 定义，运营容器只使用适配背景/滚动几何的语义变量。

## Canonical UI Map

| Capability     | Canonical owner                                  | Source of truth                                                        | Allowed variants                                      | Verification                         |
| -------------- | ------------------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------ |
| Select/Listbox | 原生 `<select>`                                  | 本文件；`src/views/WindowsView.vue`、`src/views/WindowCatalogView.vue` | 固定有限选项；接受系统弹层尺寸与行为                  | 键盘选择、窄屏布局                   |
| Form           | `FormField.vue` + 语义原生字段                   | 本文件；各业务视图的字段与校验逻辑                                     | 创建/编辑；内联错误；`aria-describedby`；首错焦点     | 缺字段、字段错误、服务错误及输入保留 |
| Scrollbar      | `src/assets/base.css`                            | `DESIGN.md` 与本文件                                                   | 全局语义颜色；仅允许局部滚动几何差异                  | 桌面/窄屏滚动和系统滚动条可见性      |
| Toast          | 单一 `ToastHost.vue` / composable                | 本文件；`src/admin/feedback.ts`                                        | 成功/中性信息；关键错误仍显示在页面/对话框            | live region、重复反馈                |
| CRUD           | Vue Router + 业务视图                            | 本文件及各页面现有 Gateway API 契约                                    | 成功回到所属列表/当前上下文；失败保留输入             | 创建、编辑、停用/下架及错误恢复      |
| 按钮           | `BaseButton.vue`                                 | 本文件；`src/components/BaseButton.vue`                                | 主/中性/安静/危险 intent；Busy 不改变尺寸             | 键盘、禁用、加载                     |
| 表格           | 语义原生 `<table>` + `TableState.vue`            | 本文件；列表 API 的数组响应                                            | 不伪造服务端分页；关键词仅筛选已加载集合              | 空/无结果/失败/窄屏                  |
| Dialog         | `ConfirmDialog.vue`，原生 `<dialog>.showModal()` | 本文件；`src/components/ConfirmDialog.vue`                             | 浏览器提供 modal inert/focus 基础；文案说明对象和后果 | Escape、按钮、失败恢复、焦点归还     |
| 图片上传       | `ImageUpload.vue` + `src/api/files.ts`           | 本文件；现有文件上传与绑定 API                                         | 5 MB；JPG/PNG/GIF/WebP；文件选择始终可见，拖放可选    | 成功、服务失败、绑定失败和孤立清理   |

## 列表与 URL 状态

- 后端对应 list 接口返回数组，没有分页字段。本契约禁止前端假造服务端分页/总量；如数据规模增长，先补后端分页契约。
- 本地搜索仅过滤当前返回数组；URL 以 `q` 保存已提交关键词，清空即更新并给出重新聚焦的清除按钮。
- 加载、空数据、无匹配、403、服务失败均分开文案和恢复动作；列表框架不因状态切换跳动。
- 筛选与路由切换请求通过 AbortSignal 或递增请求序号屏蔽过期响应。

## 流程契约

| 操作                    | 触发                    | Pending                                   | 成功                              | 失败恢复                                                                                                  | 焦点                   |
| ----------------------- | ----------------------- | ----------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------- |
| 创建餐厅/档口/分类/菜品 | 明确动作名按钮          | 仅禁用当前提交按钮，显示忙碌状态          | 返回所属列表/当前窗口并提示已创建 | 保留输入，表单错误可修改重试                                                                              | 列表标题或新记录       |
| 编辑                    | “编辑”→“保存更改”       | 不允许重复保存                            | 刷新实体后回到原列表上下文        | 保留非敏感输入；403 表示权限/范围，其他错误解释重试方式                                                   | 更新记录/原触发控件    |
| 停用餐厅                | 行内“停用”              | 对话框保持打开，阻止重复确认              | 更新列表并提示已停用              | 409/403 留在对话框，保留对象名                                                                            | 对话框关闭后同一行附近 |
| 停用档口/分类/菜品      | 行内“停用/下架”         | 对话框保持打开，阻止重复确认              | 刷新列表，准确提示新状态          | 后端错误留在对话框，可取消或重试                                                                          | 剩余列表/原触发控件    |
| 更新图片                | 文件选择/上传           | 文件名和上传/绑定阶段独立显示             | 绑定成功并刷新图片 URL            | 确定未绑定时清理；网络/5xx 等结果不确定时重新读取实体，确认未绑定后才能清理；无法确认则保留文件并提示复核 | 上传控件               |
| 搜索                    | 搜索输入框              | 本地即时过滤，不请求服务                  | 同页列表反映命中数                | 无结果显示“清除筛选”                                                                                      | 输入框                 |
| 会话失效                | 现有 AuthSession 清令牌 | 取消/失败当前业务操作，不清掉普通表单文本 | 回登录页并带站内 redirect         | 重新认证后可回到当前路由；不自动重放非 GET 写操作                                                         | 登录标题/首字段        |

## 导航、错误与响应式

- 导航/路由严格按 spec 的角色矩阵显示；服务器 403 仍按“无权/超出数据范围”处理，不隐藏成 404。
- 路由标题格式 `{页面} — 校园点餐管理端`。404 提供返回概览；403 提供回到当前账号可访问首页。
- 桌面使用侧栏，窄屏用有焦点管理、Escape 关闭并归还焦点的抽屉；不得让抽屉遮住键盘焦点。
- 表格在小屏允许明确的水平滚动并保留名称/主标识，不静默丢弃字段或动作。
- 系统管理员没有目标用户发现 API：主页明确说明未开放账号管理，不提供手填 UUID 控件。
- 销量榜虽为现有接口，但返回全站数据且无数据范围过滤，不在本管理端调用。

## 提示、异步与安全

- 业务 API 统一复用 `AuthSession.request`，不在页面读取/拼接 token。
- 401 走现有刷新/过期机制；403 留在页面显示访问边界；4xx 字段错误保留输入；5xx/网络错误提供重试，不展示原始堆栈。
- 所有跨服务变更采用服务端确认后再刷新状态；对图片上传+绑定明确表示它们不是单一事务。
- 禁止浏览器 `alert/confirm/prompt`；状态不能只靠颜色；静态表格使用语义化表格，不造 ARIA grid。
- 动画只做短的状态变化并尊重 `prefers-reduced-motion`；滚动条可见且操作正常。

## 验证

- 不编写/运行自动化测试（按用户明确要求）。
- 静态：`npm run type-check`、`npm run build`、设计文件 lint、premium 静态审计。
- 手工浏览器：登录/会话回归、角色入口、列表真实数据/空态/失败、创建/编辑/停用、图片上传与绑定错误、403、窄屏导航与表格。
