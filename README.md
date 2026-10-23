# order_sys_admin

校园点餐系统运营管理端，基于 Vue 3、TypeScript、Pinia、Vue Router 和 Vite。前端只通过 Gateway 的同源 /api/** 调用现有服务，不直连 Nacos、业务微服务或数据库。

## 当前能力

- JWT 登录、图片验证码、身份恢复、Access/Refresh Token 续期、注销和角色路由门禁。
- 角色感知的运营导航、响应式侧栏、账号菜单及统一加载/错误/空状态。
- 按后端权限范围维护餐厅、档口、分类与菜品；停用/下架不会物理删除。
- 档口启停状态与营业状态分别维护；菜品可重新编辑并恢复在售。
- 档口和菜品图片通过文件服务上传并以 fileKey 绑定；确定未绑定时清理新文件，结果不确定时先重新读取并保留文件避免破坏已生效图片。
- 运营工作区使用独立石墨蓝、瓷青和麦芽金配色；登录页原橙色/深绿设计与认证流程不变。

## 角色入口

| 后端角色           | 当前入口                                        |
| ------------------ | ----------------------------------------------- |
| STALL_MANAGER      | 自己范围内的档口、分类和菜品                    |
| RESTAURANT_MANAGER | 自己范围内的餐厅资料、档口、分类和菜品          |
| GENERAL_MANAGER    | 餐厅管理；创建和停用由后端校验平台范围          |
| SYSTEM_ADMIN       | 运营概览；账号管理等待后端提供用户列表/检索接口 |

前端导航不替代后端鉴权；所有接口仍由 Gateway 后的服务校验角色和数据范围。

## 暂缓能力

用户管理暂缺用户列表/检索接口；订单管理暂缺商家数据范围的运营队列；库存、支付暂缺管理端接口；销量榜是没有数据范围过滤的全站累计结果，因此不展示给范围受限的经理。当前不新增后端 API，也不使用示例数据伪造功能。

## 本机开发

要求 Node.js 22.18+ 或 24.12+。

```bash
cd /home/user/GitProject/order_sys_admin
npm ci
cp .env.example .env.local
npm run dev
```

默认开发地址为 http://127.0.0.1:5173/。Vite 通过 .env.local 的 VITE_GATEWAY_URL 将 /api 转发到本机 Gateway，默认 http://127.0.0.1:9090。.env.local 已由 Git 忽略，请勿提交凭据或令牌。

npm run type-check 执行类型检查；npm run build 执行类型检查与生产构建。本阶段按协作约定不编写或运行自动化测试。

本次管理页面实现已通过类型检查、生产构建与 premium 静态 UI 审计。当前环境没有可用浏览器自动化实例，也未使用管理员凭据登录，因此真实账号下的角色入口、业务读写、图片上传和窄屏交互仍需在本机手工核验。

## 文档

- 管理端功能、目录与请求链路：docs/ADMIN_STRUCTURE.md
- 运营模块规格：docs/superpowers/specs/2026-10-23-admin-operations.md
- 运营模块计划：docs/superpowers/plans/2026-10-23-admin-operations.md
- UX 行为契约：UX-CONTRACT.md
- 设计约定：DESIGN.md
- 登录阶段实施记录：docs/LOGIN_IMPLEMENTATION_PLAN.md

生产反向代理需同源转发 /api 并为 Vue Router history 路由配置 index.html 回退；不属于本次前端实施范围。
