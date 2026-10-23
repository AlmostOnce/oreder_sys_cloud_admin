# 管理端功能与设计结构

## 1. 项目职责

order_sys_admin 是校园点餐微服务的运营管理端。浏览器只访问 Gateway 的 /api/**，由 Gateway 路由到认证、用户、商品和文件服务。前端不直接访问 Nacos、MySQL 或各业务服务。

```text
Vue 管理端
  └─ Gateway /api/**
       ├─ auth-service：登录、刷新、注销
       ├─ user-service：当前登录人资料
       ├─ product-service：餐厅、档口、分类、菜品管理
       └─ file-service：图片上传、读取和未绑定文件清理
```

本仓库只消费现有后端契约，不新增后端 API。角色菜单改善操作体验，真实授权、餐厅/档口数据范围和字段约束始终以服务端为准。

## 2. 当前功能

| 区域     | 能力                                               | 规则                                                                                                       |
| -------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 登录     | 用户名/密码、图片验证码、服务端身份确认            | 仅允许四种管理角色；顾客不能进入                                                                           |
| 会话     | 双令牌存储、资料恢复、并发刷新合并、401 重试、注销 | Token 只在当前标签页 sessionStorage；Pinia 不保存 JWT                                                      |
| 运营外壳 | 角色导航、当前身份、移动端导航抽屉、账号菜单       | 无权页面进入 403；服务端仍执行最终授权                                                                     |
| 餐厅     | 查询、创建、更新、停用                             | 总经理界面可创建/停用；餐厅经理只维护授权范围内展示资料                                                    |
| 档口     | 查询、创建、更新、停用                             | 餐厅经理在可见餐厅内创建；档口负责人不调用餐厅列表接口，只维护已返回的档口                                 |
| 分类     | 查询、创建、更新、停用                             | 在选定档口中操作；停用不是删除                                                                             |
| 菜品     | 查询、创建、更新、下架                             | 支持分类、售价、排序和售卖状态；下架商品可重新编辑为在售                                                   |
| 图片     | 档口和菜品受控上传/绑定                            | 先上传 WINDOW_IMAGE / PRODUCT_IMAGE，再以 fileKey 绑定；仅在确认未绑定后清理新文件，结果不确定时先重读实体 |

## 3. 角色与入口

| 角色               | 可见入口             | UI 中的限制                                                            |
| ------------------ | -------------------- | ---------------------------------------------------------------------- |
| STALL_MANAGER      | 档口、档口菜单       | 没有餐厅列表接口，不能创建需要选择餐厅的新档口                         |
| RESTAURANT_MANAGER | 餐厅、档口、档口菜单 | 餐厅编码和排序保持原值；仅编辑可见餐厅                                 |
| GENERAL_MANAGER    | 餐厅                 | 餐厅创建/停用受后端平台范围检查；后端档口/菜单 Controller 不允许该角色 |
| SYSTEM_ADMIN       | 运营概览             | 后端缺用户列表/检索，明确说明账号管理暂缓                              |

前端不会提供手填 UUID 的用户管理表单。表单与危险操作仍可能收到服务端 403/409，错误保留在原上下文供用户恢复。

## 4. 接口映射

下列路径均为浏览器经 Gateway 访问的服务路径，外部统一加 /api 前缀。

| UI 能力            | 当前接口                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 读取餐厅           | GET /products/admin/restaurants                                                                                  |
| 创建/更新/停用餐厅 | POST /products/admin/restaurants、PUT/DELETE /products/admin/restaurants/{restaurantId}                          |
| 读取/创建档口      | GET/POST /products/admin/windows                                                                                 |
| 更新/停用档口      | PUT/DELETE /products/admin/windows/{windowId}                                                                    |
| 读取/创建分类      | GET/POST /products/admin/windows/{windowId}/categories                                                           |
| 更新/停用分类      | PUT/DELETE /products/admin/categories/{categoryId}                                                               |
| 读取/创建菜品      | GET/POST /products/admin/windows/{windowId}/products                                                             |
| 更新/下架菜品      | GET/PUT/DELETE /products/admin/products/{productId}                                                              |
| 上传图片           | POST /files/upload，multipart 字段为 file、bizType、bizRef                                                       |
| 绑定档口/菜品图片  | PUT /products/admin/windows/{windowId}/image、PUT /products/admin/products/{productId}/image，请求体包含 fileKey |
| 清理未绑定上传文件 | DELETE /files/{fileKey}                                                                                          |
| 读取图片           | 文件上传 VO 返回的网关内容地址，通常为 /api/files/{fileKey}/content                                              |

管理列表没有分页契约。关键词只筛选已返回数据，界面不伪造总页数或全量统计。

## 5. 明确暂缓的能力

- 用户管理：后端已有按 UUID 改角色、状态、范围的操作，但没有管理端用户列表/搜索，无法安全定位目标用户。
- 订单管理：顾客订单查询只返回当前顾客订单；缺少按商家范围过滤的运营队列。
- 库存管理：暂无管理端查询/调整接口。
- 支付管理：暂无管理端支付记录查询接口。
- 销量榜：接口返回全站累计销量，缺少餐厅/档口数据范围过滤，不向受限角色暴露。
- 餐厅图片上传：没有餐厅图片专用绑定接口，当前不提供任意 URL 上传替代。
- Nginx、容器化和生产反向代理部署不在本次前端实施范围。

## 6. 目录职责

```text
src/
├── admin/permissions.ts   # 角色、路由和导航策略
├── admin/feedback.ts      # 页面级成功/信息提示
├── api/                   # 餐厅、商品目录与文件请求契约
├── auth/                  # 认证、请求、错误、令牌存储
├── components/            # 按钮、字段、确认框、图片选择、表格状态、Toast
├── layouts/AdminLayout.vue
├── router/index.ts        # 路由、身份恢复和角色门禁
├── stores/auth.ts         # 不含 JWT 的认证视图状态
├── views/                 # 登录、概览、餐厅、档口、档口菜单、403、404
└── assets/
    ├── tokens.css         # 登录及运营 token 唯一值来源
    ├── base.css           # 全局焦点、基础样式和减少动态偏好
    ├── main.css           # 既有登录页样式
    └── operations.css     # 仅作用于 .operations-theme 的运营样式
```

## 7. 图片更换链路

```text
选择并校验图片
  → POST /api/files/upload（file + bizType + bizRef）
  → 获得 fileKey
  → PUT /api/products/admin/.../image（请求体包含 fileKey）
       ├─ 成功：使用服务端返回的新 imageUrl 刷新页面
       ├─ 明确失败且重读确认未绑定：DELETE /api/files/{fileKey}，保留原图并说明清理结果
       └─ 网络/5xx 结果不确定：重读实体核实；仍无法确认时保留文件，避免删除可能已生效的图片
```

文件白名单为 JPG/JPEG、PNG、GIF、WebP，客户端提示上限 5 MB；文件服务仍是最终校验方。上传和绑定是两个请求，不声称为单一事务。餐厅当前没有受控图片绑定接口。

## 8. 视觉与交互约定

- 登录页继续使用品牌橙和深绿；登录后工作区单独使用石墨蓝导航、瓷青操作色和少量麦芽金标记。
- 桌面端固定侧栏与宽表格；窄屏使用键盘可达的侧栏抽屉，表格显式允许横向滚动。
- 表单字段、忙碌按钮、加载/错误/空态、确认对话框和 Toast 有共享实现。
- 表单客户端校验只改善交互；后端 Bean Validation 和数据范围校验最终生效。
- 写操作采用服务端成功后刷新列表；失败时保留表单或确认框，不乐观谎报结果。
- 表格使用语义化表格，停用/下架使用确认对话框，状态同时用文案和颜色表达。

设计 token 所有者是 src/assets/tokens.css；行为所有者见 UX-CONTRACT.md，色彩和排版解释见 DESIGN.md。

## 9. 登录安全链路

验证码 → 登录 → 服务端身份资料 → 路由/视图；401 时由 AuthSession 合并并发刷新请求，再最多重放原请求一次。

Access/Refresh Token 仅在当前标签页 sessionStorage；Pinia 只存用户资料和界面状态。令牌不放 URL、日志或 localStorage，密码不持久化。运营页面只经 AuthSession.request 发起登录后请求。

## 10. 验证状态与交付

- 已运行 `npm run type-check`、`npm run build-only` 和 premium 严格静态 UI 审计，均成功；仓库当前没有独立 DESIGN lint 命令。
- 按当前协作约定不编写/运行自动化测试。
- 当前执行环境没有可用浏览器自动化实例，且没有使用/索取管理员凭据；尚未进行真实会话下的角色入口、管理读写、图片上传失败恢复、403、桌面与窄屏手工验收。请在本机管理员账号下完成此项核验。
- 生产反向代理仍需同源转发 `/api` 并为 Vue Router history 路由配置 `index.html` 回退；不属于本次前端实施范围。
