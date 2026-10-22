# order_sys_admin

使用 Vue 官方 create-vue 创建的管理端基础项目，保留默认示例，尚未接入业务接口。

技术组成：Vue 3、TypeScript、Vite、Vue Router、Pinia，以及 ESLint / Oxlint / Prettier。

## 本机启动

```bash
cd /home/user/GitProject/order_sys_admin
npm install
npm run dev
```

访问终端显示的 Local 地址，通常为 http://localhost:5173/。开发服务会持续运行并支持热更新；
关闭终端或按 Ctrl+C 会停止服务。若端口已被占用，以 Vite 实际输出的端口为准。
本项目不依赖 HBuilderX，不是 uni-app x 项目。

构建使用 `npm run build`（含类型检查），代码检查使用 `npm run lint`（会自动修复可修复的问题）。
目前未创建或关联 GitHub 仓库；后续保留 package-lock.json，不提交 node_modules、dist 或含密码的文件。

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
