# Agent Note: 窄屏抽屉的命中落在抽屉上，而不是 frame

[English](2026-11-06-mobile-drawer-hit-testing.md) | 中文

Status: implemented

## Problem

<768px 且非 Windows 桌面标题栏时（[移动资格笔记](2026-11-16-compat-mobile-eligibility-mirrors-official-drawer.md)，#2054），聚合包 compat 层把侧栏列变成浮层抽屉：`RESPONSIVE_CSS` 里把侧栏面板绝对定位、给 `z-index: 1100`，并在 frame 上以 `::after` 画一层 `z-index: 1050` 的遮罩。抽屉与遮罩此前只按视觉验收过，从未按命中目标验收。

官方布局自己也有 drawer 模式：`.frame[data-sidebar-drawer] .sidebarCol` 声明 `position: absolute; z-index: 71`，`.drawerMask` 声明 `z-index: 70`，而 ui-layout 客户端模块是在运行时通过 `document.head.appendChild` 注入这份样式表的，也就是落在 compat 标签之后。compat 选择器 `[data-dsh-frame] [data-pane="sidebar"]:is([data-pane="sidebar"])` 与官方 `.frame[data-sidebar-drawer] .sidebarCol` 同为 0-3-0，于是层叠把同权重的平手交给了文档顺序：后注入的官方表赢下了这里每一条普通声明。`position` 因为带 `!important` 活了下来，`z-index: 1100` 没有，抽屉的 computed 值是 **71**；而 compat 遮罩以非 important 的 1050 声明、并且保持可命中，正好盖在它本来要压暗的抽屉之上。

伪元素的命中会归到其宿主元素，所以在打开的抽屉内调用 `document.elementFromPoint` 得到的是 frame。上报的现象正是这个形状：抽屉看得见、蒙着一层灰、里面的行全部无响应，第一次点击就被遮罩接收并让抽屉折起（#2013）。手机镜像通过 remote 包报的是同一形状（#2012/#2014）：那边同样有聚合遮罩，而 `mobile-adapt.ts` 的 `ADAPT_CSS` 根本没有声明抽屉层级，只是默默继承了官方表恰好压在顶上的结果。

## Decision

层级契约由拥有它的那条声明决定，而不是由两份被注入的样式表谁先谁后决定。

`packages/dsh-web-all/src/client/index.ts` 保留 0-3-0 选择器上限，用 `position: absolute !important` 防止皮肤样式把抽屉放回网格。兼容布局的抽屉用 `z-index: 1100 !important`，遮罩用 `z-index: 1050`。两条层级规则用零特异性选择器排除 `[data-sidebar-drawer]` 和 `[data-mobile-nav]`。原生抽屉与 `dsh-web-mobile` 各自保留原有层级，确保 Host 设置对话框位于抽屉上方并能接收点击。

同一套零特异性手法也承载桌面标题栏守卫：每条移动规则都带 `:where(html:not([data-windows-titlebar]))` 前缀，使整个移动契约在 Windows 桌面外壳下让位，而 0-3-0 上限不动（[资格笔记](2026-11-16-compat-mobile-eligibility-mirrors-official-drawer.md)）。

compat 遮罩继续只做抽屉的压暗，永不成为命中面：同一条 `::after` 上写 `pointer-events: none`。关闭动作保持它既有的两个归属者不变：布局在我方抽屉之下绘制的官方 `.drawerMask`，以及 `installMobileSidebarDismiss` 里捕获阶段对「点击落在侧栏之外」折起抽屉的处理器（见[#1716 关闭行为笔记](2026-09-25-issue-batch-1716-1719-and-ci-unblock.md)），同时在 `sidebar.closest('[data-mobile-nav]') !== null` 时立即返回让位给 `dsh-web-mobile`。

`packages/dsh-remote-web-ui/src/client/mobile-adapt.ts` 在 `ADAPT_CSS` 里声明同一套阶梯：`[class*="_sidebarCol"]{z-index:1100 !important}` 与 `[class*="_drawerMask"]{z-index:1050 !important}`。竖屏面因此不依赖聚合 compat 层（本包也会被单独安装），官方的压暗层留在它所压暗的抽屉之下、它所要变暗的内容之上。没有任何节点被 portal：两层的宿主仍归 React 所有。

## Verification

`packages/dsh-web-all/tests/responsive-contract.spec.ts` 检查兼容层级、遮罩不接收点击，以及原生和移动导航的守卫。`tests/e2e/settings-width.e2e.ts` 在真实 Host 上挂载打包后的聚合包，分别以 390px 和 1440px 打开设置。`packages/dsh-remote-web-ui/tests/mobile-adapt.spec.ts` 检查独立远程适配的层级规则。

最初的命中测试在 Chromium 的 390x844 视口中检查五个抽屉行的中心点。测试按投递顺序加载兼容样式和官方布局样式，并在启用远程适配的情况下追加其样式。

| 已安装的样式表 | 抽屉 `z-index` | compat 遮罩 | `elementFromPoint` 命中的行 |
| --- | --- | --- | --- |
| 原始 compat + remote | 71 | 1050，可命中 | 0/5 |
| 原始 compat | 71 | 1050，可命中 | 0/5 |
| 原始 remote | 71 | 无 | 5/5 |
| 抬高层级并关闭遮罩命中，compat + remote | 1100 | 1050，不可命中 | 5/5 |
| 抬高层级并关闭遮罩命中，compat | 1100 | 1050，不可命中 | 5/5 |
| 抬高层级并关闭遮罩命中，remote | 1100 | 无（官方 1050） | 5/5 |

上述三次遮罩不接收点击的测试中，点击背景都命中官方 `.drawerMask`。

## Alternatives considered

把抽屉与遮罩 portal 到 `body`（issue 的建议之一）。否决：compat 层只写属性，不得移动 React 拥有的节点——重新挂载侧栏列会破坏布局的 `insertBefore`/`removeChild` 锚点，`inset` 与动画契约也是按 frame 作为包含块写的。

抽屉打开时让 frame 退出命中路径（给 `[data-dsh-frame]` 加 `pointer-events: none`），也是 issue 的建议。否决：抽屉是 frame 的后代，frame 的命中抑制会连抽屉一起冻住，并且会改掉 frame 内所有插件的命中面。

给 frame 加 `z-index: 0` / `isolation: isolate` 让它不再压过抽屉。否决：这仍然把结论留在与顺序相关的平手里，任何后加载的样式表重新声明层级就能重开同一个故障，而 compat 层必须与它无法控制的样式表共存。

改用上报者调试时的数字（`2147483001` / `2147483000`）。否决：那是定位问题时的探针数字，不是边界。聚合已经拥有一个刻意的上限（0-3-0）以及「未来皮肤越过它就是皮肤的 bug」的说明；再加一套临时数字标尺只会把军备竞赛从特异性搬到数值膨胀。

只修抽屉层级、保留可命中的遮罩。否决：行命中会通过，但压暗层依旧吞掉本应落到下方会话区的每一次点击（与 #1829 在 composer 内修掉的是同一形状），而且在官方 drawer 未挂载的 profile 上，一层残留的遮罩会变成唯一的关闭入口。

## Consequences

兼容抽屉绘制在自己的遮罩之上。原生抽屉遵循官方层级，位于 Host 对话框下方。兼容遮罩将指针输入交给 frame 内容和既有的关闭处理器。

聚合包提交了自己的构建产物 `lib/`，所以 compat 这一半只有在 `pnpm build` 刷新之后才会到达页面：在 `pnpm libs:write` 重新记录指纹之前，`pnpm libs:check` 会把已提交的产物判为陈旧。那次重建是交付本改动的组成部分，不是可选项。

剩余上限不变：特异性高于 0-3-0 的皮肤规则仍然赢，正确的修法仍然是那皮肤，而不是这条规则。
