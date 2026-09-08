# Agent Note: 宠物宿主助手流式事件

Status: implemented

## Problem

Harness 0.1.3-alpha.1 将实时助手发布与持久化 Session 事件分开。消费 `assistant/chunk` 的宠物无法按这套词表编译，而只消费完整消息会丢失生成过程中的思考与书写活动。

## Decision

宠物消费宿主 `agent/assistant-stream` 事件中的非空推理/文本 chunk，并归属到 `agent.session`。该监听器与持久化 Session 活动共用启用周期及 Context 销毁清理。start/end 帧不奖励回合，持久化的 `turn/end` 仍负责去重结算。

[按身份隔离账号的决策](../architecture/2026-08-25-principal-scoped-pet-accounts.md) 继续适用：帧没有经过验证的身份，账号视图因此保持空闲且不返回宿主会话气泡。直接访问宿主时保留实时 thinking/review 与按会话归属的碎碎念。

## Alternatives considered

把 `assistant/live-chunk` 当作 Session 事件消费：拒绝，因为它由 Client controller 合成，不属于宿主持久化事件。

只投影持久化消息：拒绝，因为宠物会失去实时思考/书写。重播消息保存的流也会在没有新生成过程时重复触发临时碎碎念。

## Consequences

宠物与其聚合包要求 Harness `>=0.1.3-alpha.1`；宠物通过直接的 `dsh-agent` 开发依赖声明宿主 API。测试覆盖实时到持久化的结算、重复回合完成、账号隔离、启用开关与监听器销毁。
