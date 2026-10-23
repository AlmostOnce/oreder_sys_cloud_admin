---
version: alpha
name: 校园点餐管理端
description: 以食堂运营工作台为参照的中文桌面管理系统
colors:
  primary: '#C2410C'
  brand: '#E4572E'
  ink: '#252B29'
  muted: '#64716B'
  surface: '#FFFFFF'
  background: '#F5F7F5'
  border: '#D6DDD7'
  danger: '#B42318'
  success: '#23704D'
  panel: '#243E35'
typography:
  sans:
    fontFamily: 'system-ui, -apple-system, "Noto Sans CJK SC", "Microsoft YaHei", sans-serif'
  mono:
    fontFamily: 'ui-monospace, "SFMono-Regular", Consolas, monospace'
rounded:
  DEFAULT: '10px'
  lg: '20px'
spacing:
  page-max: '1200px'
  section-gap: '32px'
components:
  button: {}
  field: {}
  notice: {}
---

# 校园点餐管理端设计约定

## Overview

面向国内校园食堂的档口负责人、餐厅经理、总经理和系统管理员。中文产品型界面，以桌面日常运营为主，窄屏可用；非营销页、不做大屏炫技。登录页唯一视觉重点是“食堂运营公告板”式深绿面板与橙色餐盘线形标志。表单保持熟悉、清晰。

避免 Vue 模板、渐变玻璃卡、虚假统计、未实现菜单和伪造在线状态。与用户端共用橙色品牌，但使用更收敛的操作色。

## Colors

运行时 `src/assets/tokens.css` 为唯一 CSS 值所有者，本文件镜像已接受的值。primary 映射 `--color-primary`（按钮、链接），brand 映射 `--color-brand`（装饰标识），其余 colors 依同名映射 `--color-*`。所有页面与共享组件只消费语义变量。白字主要按钮用深橙保障对比，品牌亮橙不作白底小字。

第一版仅浅色；强制高对比模式保留系统焦点和边框。滚动条使用 muted/border，hover 使用 ink，不隐藏。

## Typography

sans 映射 `--font-body`，mono 映射 `--font-mono`。不下载网络字体。正文 15px/1.65，字段 16px，标题 28–40px；数字与公开用户编号用等宽字。长中文允许换行。

## Layout

登录页桌面双栏：品牌信息与表单各自有明确区域；860px 以下切换单列表单与紧凑页头。工作台最大 1200px，页面留白 24–40px，窄屏 20px。表单宽 400px；控件至少 44px 高；验证码预留固定尺寸。错误区域与按钮忙碌状态保持布局稳定。

## Elevation & Depth

层级以白色表面、深绿信息面板和浅边框表达。登录容器可用轻微阴影；无悬浮动画、无大面积模糊。

## Shapes

DEFAULT 映射 `--radius-control: 10px`，用于控件；lg 映射 `--radius-panel: 20px`，用于主容器。section-gap 映射 `--space-section: 32px`，page-max 映射 `--page-max: 1200px`。

## Components

- 表单：登录表单继续使用原生 label、输入框和关联帮助文案；运营端重复字段统一使用共享 `FormField.vue`，字段错误通过 `aria-describedby` 关联，表单禁用浏览器默认校验并在提交失败时聚焦首个错误。密码默认隐藏，可访问按钮切换；保留粘贴与密码管理器。
- 按钮：实心为主要动作，描边为次要动作；hover、focus-visible、active、disabled、busy 都有状态。忙碌不改变宽高。
- Notice：共享内联状态块，错误用文本解释，不只依靠颜色；不使用原生 alert/confirm。
- 路由：登录与工作台标题明确，403/404 提供返回入口；菜单只展示实际已实现页面。
- 图标：以小型 CSS 形状和内联 SVG 表达必要线形图标，不用 Unicode 符号冒充控件图标。
- 动效：只保留 140ms 色彩反馈与忙碌指示器；减少动态偏好下禁用动画。
- 文案：按钮使用“登录管理端”“退出登录”“更换验证码”，不展示内部异常栈或 Token。

## Do's and Don'ts

- 保持品牌橙、中文标签、可见焦点和真实接口状态一致。
- 权限展示依据服务端资料，最终授权仍在后端。
- 不用硬编码凭据、模拟成功、假统计或不存在的业务菜单填满页面。
- 不保存密码，不将 Token 放入 URL、日志或 localStorage。

## Operations workspace

登录与运营工作区是同一产品的两种有意区分的表面。登录入口继续使用本文件前述橙色品牌和深绿色信息区；身份确认后，管理工作区采用更安静的石墨蓝、瓷青和麦芽金，不将高密度运营表格放进橙色品牌面板。

运营端主语义色的唯一运行时所有者仍是 `src/assets/tokens.css` 中的 `.operations-theme` 变量；工作区主体、文字、边框、主/危险/成功操作必须消费这些变量。`operations.css` 可在具体组件内保留少量透明度、弱分隔线和装饰色，不得重复定义主语义色；当此类细节成为跨组件重复规则或表达业务状态时，应提升为主题变量并在本表登记：

| 语义       | 变量             | 色值    | 用途                   |
| ---------- | ---------------- | ------- | ---------------------- |
| 深色导航   | --ops-nav        | #142B35 | 左侧导航底色           |
| 导航层级   | --ops-nav-raised | #1D3A45 | 当前导航项底色         |
| 主要操作   | --ops-primary    | #087A78 | 主按钮、链接、焦点     |
| 当前项标记 | --ops-accent     | #D3A447 | 侧栏窗口挂牌、少量强调 |
| 页面底色   | --ops-background | #EEF3F1 | 管理区域底色           |
| 内容表面   | --ops-surface    | #FCFDFC | 表格、表单、卡片       |
| 主文字     | --ops-ink        | #203239 | 标题与主要数据         |
| 次级文字   | --ops-muted      | #64777A | 辅助说明               |
| 危险操作   | --ops-danger     | #AA4039 | 停用、下架和错误       |
| 成功状态   | --ops-success    | #2C7358 | 已启用状态与成功反馈   |

桌面端使用 250px 深色侧栏和宽内容区；窄屏侧栏变为有键盘焦点管理的抽屉。唯一视觉签名是当前导航入口左侧短麦芽金“窗口挂牌”。不用虚构 KPI、全站销量或未实现菜单填充首页。

运营控件、表格、表单、状态和对话框行为见 UX-CONTRACT.md；页面结构、角色边界和现有后端接口见 docs/ADMIN_STRUCTURE.md。
