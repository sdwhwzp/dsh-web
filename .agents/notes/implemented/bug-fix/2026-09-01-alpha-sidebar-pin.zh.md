# Agent Note: Alpha 侧栏版本锁定

Status: implemented

## Problem

聚合包原有的稳定版侧栏依赖面向 Alpha 之前的 Harness 客户端 API。部署 profile 还可能直接声明侧栏依赖；该声明会优先于聚合包的传递依赖，并可能在没有明显提示的情况下继续保留不兼容版本。

## Decision

聚合包将 `dsh-better-sidebar` 精确锁定为 `0.18.0-alpha.0`；这是已发布的 Alpha 版本，其 peer 范围接受 Harness `0.1.2-alpha.3`。使用聚合包的部署 profile 在直接依赖与 `minimumReleaseAgeExclude` 中锁定同一版本；侧栏仍仅由聚合包的 `web-ui-better-sidebar` 行挂载，不加入 profile 的 bundle 列表。

## Alternatives considered

未采用 npm `latest` 标签，因为它解析到 Alpha 之前的稳定版本。未采用侧栏 Alpha 版本的 caret 范围，因为生产环境重新安装时可能在没有仓库变更的情况下选中未经验证的预发布版本。

## Consequences

Alpha Harness 部署会确定性获得匹配的侧栏构建。运维人员必须同时更新 profile 顶层直接依赖与聚合包锁定值，后续每次 Alpha 侧栏升级仍需作为明确变更进行审核。

## Testing

聚合生成器、锁文件解析、运行时依赖门禁、包构建与 tarball 内容检查会验证精确依赖以及保留的 `web-ui-better-sidebar` 挂载行。
