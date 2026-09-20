# Agent Note: Client Session Navigation Compatibility

Status: implemented

## Problem

Harness 0.1.6-alpha.2 通过 `uiWorkspace` 提供会话跳转，家族插件则基于已发布的 0.1.5-rc.1 SDK 版本组编译。仅读取 `sessions.list.current` 会在 alpha.2 上丢失当前显示的会话，调用 `sessions.open` 也会失败。受影响的路径包括任务跳转、工作树创建、宠物气泡、归档保护和当前会话控件。

## Decision

会话跳转的调用方在浏览器模块依赖中声明 `dsh-client-ui-workspace`，并调用 `uiWorkspace.openSession`。共享读取函数 `currentSessionIdOf` 支持旧版 `current` 字段及 alpha.2 中 `retainedBy.mainView` 计数为正的会话行。各插件和聚合构建使用的副本由 `sync-shared` 管理。workspace SDK 开发依赖锁定为 0.1.5-rc.1，使仓库类型检查和版本组门禁覆盖声明的最低宿主 SDK。

自动隔离包装 `uiWorkspace.startSession`，工作区注册继续使用 `workspaces.create/delete`。没有当前选择时，目标按会话活跃时间和工作区创建顺序确定。设置卡保留[已加载分组优先](2026-09-17-family-plugin-card-seat-follows-the-loaded-group.md)规则；没有分组时，使用 alpha.2 的 `plugins.row.config` 独立包及聚合行键，或旧版按命名空间索引的槽位。卡片等待槽位声明，完整表单仅在 page 视图挂载。

## Alternatives considered

仅保留 `sessions.open` 与 `current` 字段会使 alpha.2 部署无法跳转或识别当前显示的会话。

将 Harness 源码链接进插件 TypeScript 程序可以避开已安装 SDK 的差异，但违反仓库的独立包要求，也无法继续检查已发布的最低 SDK。

不将第三方表单注册进 `plugins.item`，因为该列表由官方配置页拥有；bundle 行有自己的 keyed 配置入口。

## Consequences

同一客户端 bundle 支持两种会话列表表示，不增加 Host 写入，也不改变归档删除规则。主视图未保留任何会话行时，当前会话为空。共享读取函数测试覆盖两种表示及空选择；工作树测试检查 workspace 服务跳转及失败回滚。实际 alpha.2 GUI 仍需验证部署 profile 的服务注入和 bundle 加载。
