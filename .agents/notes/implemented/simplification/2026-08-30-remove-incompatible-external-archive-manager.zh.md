# Agent Note: 从 dsh-web-all 移除不兼容的外部归档管理器

Status: implemented

Supersession check：没有活跃 Note 拥有聚合包的归档实现决策。better-session 接入 Note 只把归档管理器作为外部包示例，本次随决策一并更新。

## Problem

`@mlgbnb/dsh-archive-manager@1.0.7` 依赖已移除的 `@deepseek-ai/dsh-client-runtime` 客户端 API，并直接读取旧会话与工作区磁盘布局。其宿主实现还会修改私有持久化索引，并能物理删除会话目录。Harness `0.1.2-alpha.1` 不再暴露这些格式和私有注册表，因此挂载该包可能直接失败，也可能只删除当前会话状态的一部分。

## Decision

- 从 `packages/dsh-web-all/aggregate.yml` 移除 archive-manager 行，再重新生成聚合 patch 与 package manifest，使全新安装不再挂载或安装该外部包。生成器现在只保留外部 rows 点名的非 workspace 依赖，避免删除行后继续遗留安装包。
- 归档与恢复继续由 Harness 原生会话界面负责。聚合包不再加入直接读取持久化文件的另一个组件。
- `@morlay/better-session` 保留在聚合包中，沿用现有的默认关闭行与覆盖配置。本次变更不会启用它，也不会改变官方 jsonl 默认值。

## Alternatives considered

- **默认关闭归档管理器后继续分发**：否，因为不兼容且具有破坏性的实现仍会安装，也可能被意外启用。
- **修补或内置 1.0.7**：否，因为它依赖私有持久化数据与物理删除。归档能力应由 Harness 会话能力负责，使事件与存储实现能够一同演进。
- **等待兼容的上游版本**：否，因为聚合包当前就声明兼容 Harness `0.1.2-alpha.1`。未来版本可作为一次新的接入重新评审。

## Consequences

- 聚合包不再提供外部设置页归档管理器。Harness 原生归档与恢复仍可使用。
- 全新安装和重新生成的 profile 不再引入 `@mlgbnb/dsh-archive-manager`。已有 profile 目录可能在刷新依赖安装前保留未使用的包文件，但生成的 patch 不会再挂载它们。
- `@morlay/better-session` 仍会安装但默认关闭，行与覆盖配置均未改变。

## Testing

- 聚合测试断言生成的 patch 与 package manifest 均不含外部归档管理器，并确认 better-session 继续默认关闭。
- 聚合生成、运行时依赖检查、文档检查、工作区测试、类型检查与生产构建覆盖本次变更涉及的发布产物。
