# Agent Note: Better-sidebar 通用文件下载

Status: implemented

## Problem

右侧文件编辑器原本只在特定预览器的回退页面提供下载。Markdown、表格等能够正常预览的文件因此可能只有查看能力，却没有一致的原文件保存入口。

## Decision

`dsh-web-all` 的浏览器兼容层会在每个带非空路径的 better-sidebar 编辑器控件旁增加一个下载操作。它在用户操作时读取当前会话，并调用 better-sidebar 已有的认证 `/sidebar/file` 路由。不带路径的“文件”主页保持不变。

兼容操作直接随聚合包自身的浏览器 bundle 发布，因此已发布的 npm 包、本地 workspace 链接，以及直接指向 `packages/dsh-web-all` 的 Git 安装具有相同行为。只指向仓库根目录的 Git 安装仍会解析根包声明的 npm 聚合依赖，不能携带尚未发布的 workspace 改动。它会识别 better-sidebar 已存在的同源下载链接；上游提供同类入口后会移除自己的入口。浏览器测试覆盖会话 URL、当前编辑器替换、清理、原生入口去重、语言切换和固定版本 better-sidebar 的 DOM 钩子。

## Alternatives considered

精确版本的 pnpm 补丁被放弃，因为根级 `patchedDependencies` 不会随发布后的 `dsh-web-all` 包传播。从个人 fork 发布会为了一个小型展示改动额外维护一条发布线。为每种预览器分别增加下载控件也会保留原来的不一致，并要求每个预览器重复实现同一操作。

## Consequences

只要打开真实文件路径，所有文件类型都会共享一个下载入口，不受预览器是否支持该文件影响。兼容选择器依赖 better-sidebar 的编辑器路径输入框和图标按钮类名，因此升级依赖时必须运行聚合包浏览器测试。上游包不会被修改。
