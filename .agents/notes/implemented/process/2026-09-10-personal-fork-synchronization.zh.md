# Agent Note: Personal fork synchronization

Status: implemented

[English](2026-09-10-personal-fork-synchronization.md) | 中文

## Problem

个人 fork 在原作者开发历史之外还包含账号隔离和部署集成。绑定原作者仓库的说明和推送钩子可能在同步时选错分支或上传目标。

## Decision

[个人 fork 约束](../../../../AGENTS.md#branches-commits-and-prs) 要求先获取原始来源，再合并到当前工作分支，优先采用源实现，适配必要的本地行为，通过验证后将全部未上传的本地分支按现有同名分支发布到自有 fork，并再次获取来源以检查遗漏提交。推送钩子接受自有 fork 的 HTTPS 或 SSH 地址，无论远程名称为何都会拒绝其他目标。

本 fork 使用上游 0.3.19 家族版本及 Harness 0.1.5-alpha.2 SDK。Pet 使用上游助手流投影，同时保留经过验证的身份存储、新账号默认关闭以及与宿主全局活动的隔离。已有账号、活动、销毁和奖励去重测试覆盖这些保留行为。

## Alternatives considered

遵循原作者固定的 dev/origin 说明会选择本 fork 以外的上传目标，并忽略当前部署分支。移除推送钩子会放任意外上传到原作者仓库，因此钩子明确限制自有目标。

将全部冲突文件直接替换成源副本会丢失账号隔离及其回归测试。默认采用源实现，并保留和验证必要的身份相关行为。

## Consequences

原作者仓库只读。分支历史完整保留；推送失败或非快进时必须先整合。源同步和产物构建不会重启运行中的 DSH 宿主；上线与真实 GUI 验证需要加载更新后的宿主及 profile。
