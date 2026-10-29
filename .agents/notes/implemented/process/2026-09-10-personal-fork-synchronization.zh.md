# Agent Note: Personal fork synchronization

Status: implemented

[English](2026-09-10-personal-fork-synchronization.md) | 中文

## Problem

个人 fork 在原作者开发历史之外还包含账号隔离和部署集成。绑定原作者仓库的说明和推送钩子可能在同步时选错分支或上传目标。

## Decision

[个人 fork 约束](../../../../AGENTS.md#branches-commits-and-prs) 要求先获取原始来源，再合并到当前工作分支，优先采用源实现，适配必要的本地行为，通过验证后将全部未上传的本地分支按现有同名分支发布到自有 fork，并再次获取来源以检查遗漏提交。推送钩子接受自有 fork 的 HTTPS 或 SSH 地址，无论远程名称为何都会拒绝其他目标。

本 fork 使用上游 0.4.12 家族版本及 Harness 0.2.2-alpha.2 SDK。本地部署候选统一使用 `0.4.12-dsh.20261029.1`；已验收构件不可替换。工作区 SDK 区间、Host peer、CI 挂载版本和桌面 Host 种子采用相同版本。packageExtensions 补齐已发布客户端清单遗漏的运行时依赖。当本地聚合包与更新的 registry 稳定版都满足根别名的 caret 区间时，工作区优先使用本地聚合包，使 SDK 依赖图跟随本候选。

Browser-view 的可选 CDP 设置新增的 settings、store、remotes 和 plugin-manager SDK 依赖同样采用 0.2.2-alpha.2 版本。外部浏览器仍由整个 Host 共享，因此启用 CDP 不会放宽下文的账号部署限制。

聚合包通过各家族插件的真实包名挂载。兼容 shell 出口保留旧 profile 地址，包括供网关持有任务看板 Host 的部署使用的 `clientOnly`。这些部署必须单独注册任务看板浏览器模块，不能加载第二个 Host 账本。卫星插件的账号适配仍由各自仓库维护。

任务看板调度保留已持久化的账号绑定，并在执行检查、手动结算、模型选择、会话投影和验证模型目录读取中传递已认证所属账号。运行组在同一账号中冻结验证模型目录。官方 owner peer 提供 Host 调用生命周期，网关在每次请求中校验附带的部署账号身份。

SSH 账号隔离仍是需要重新挂载的 profile 配置。普通账号提供自己的密码或内联私钥；Host 私钥文件、Host SSH agent、agent 转发和本机代理命令仅供管理员使用。含禁用能力的持久化连接仍可编辑，但移除这些能力前不能连接。

Browser-view 在每个 Host 中共享一个 Chromium 配置、标签页注册表和面板流。会话标签不授予标签页访问权限，loopback 限制也不识别账号。账号部署必须同时禁用其 Host 行和客户端入口，直到按账号身份隔离浏览器配置、标签页、画面、命令和工具调用的集成通过验收；Host connection 的启动令牌不得暴露给普通账号。

## Alternatives considered

遵循原作者固定的 dev/origin 说明会选择本 fork 以外的上传目标，并忽略当前部署分支。移除推送钩子会放任意外上传到原作者仓库，因此钩子明确限制自有目标。

将全部冲突文件直接替换成源副本会丢失账号隔离及其回归测试。默认采用源实现，并保留和验证必要的身份相关行为。

## Consequences

市场自动部署仅在原作者仓库运行。本 fork 需要明确请求的 `workflow_dispatch`；同步推送只发布源码。工作流条件独立于部署凭据是否存在来执行此限制。

原作者仓库只读。分支历史完整保留；推送失败或非快进时必须先整合。源同步和产物构建不会重启运行中的 DSH 宿主；上线与真实 GUI 验证需要加载更新后的宿主及 profile。
