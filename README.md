# order_sys_admin

校园点餐系统的 Vue 3 管理端。当前阶段实现运营人员登录、身份恢复与管理工作台入口；商品、订单、人员等实际业务管理页面按项目计划逐步接入，不展示虚构数据。

## 技术组成

- Vue 3、TypeScript、Vite
- Vue Router：页面导航与前端路由门禁
- Pinia：页面使用的认证状态
- JWT Access Token / Refresh Token：由现有认证服务签发

## 本机开发

要求 Node.js `22.18+` 或 `24.12+`。

```bash
cd /home/user/GitProject/order_sys_admin
npm ci
cp .env.example .env.local
npm run dev
```

如果 Gateway 不在 `127.0.0.1:9090`，编辑本机的 `.env.local`，设置 `VITE_GATEWAY_URL`。该本机文件已被 Git 忽略，不要提交密码或 Token。

浏览器访问 Vite 输出的本机地址，默认 `http://127.0.0.1:5173/`。未登录访问工作台会转到登录页；验证码、登录、资料查询、续期和注销请求使用 `/api`，开发服务器会将它们代理到 Gateway。

```bash
# 类型检查并构建生产静态文件
npm run build
```

生产部署需由同源反向代理将 `/api` 转发给 Gateway，并把 Vue Router history 模式的未知页面路径回退到 `index.html`。

## 当前功能边界

- 图片验证码登录、密码显隐与服务端错误提示。
- 后端资料接口确认身份和角色；只有档口负责人、餐厅经理、总经理、系统管理员允许进入管理端。
- Access Token 与 Refresh Token 仅保存在当前标签页的 `sessionStorage`；并发续期合并为一次请求，刷新失败后清理会话。
- 注销需服务端确认成功后才清理本地会话。
- 未登录页、无权限页、未知路由页和仅展示当前身份的工作台外壳。
- 具体数据范围和每个业务操作的授权必须由后端再次检查；前端路由门禁不作为安全边界。

详细模块、请求链路、设计和后续边界见 [管理端结构说明](docs/ADMIN_STRUCTURE.md) 与 [设计约定](DESIGN.md)。
