# Agent Note: Plugin Manager 复用 Host CLI 入口

Status: implemented

## Problem

Plugin Manager 网关把官方 `dsh plugin` 命令作为 profile 的唯一写入器。源码 checkout 可以通过 `node --import tsx/esm apps/cli/src/bin.ts` 直接启动 Web Host，而不在 `PATH` 或 `node_modules/.bin` 安装 `dsh` shim。此时运行中的进程本身已经是官方 CLI 入口，也携带再次调用所需的全部 loader 参数，但网关仍会报告 CLI 不可用。

## Decision

CLI 发现保持外部可执行文件优先：依次检查进程 `PATH`、Host 入口上层项目的 npm shim 和标准 Homebrew 位置。所有探测均失败后，只在当前 Host 入口的规范化路径匹配官方 DSH 源码或构建后 CLI 位置时接受该入口。Node 入口通过 `process.execPath` 与当前 `process.execArgv` 执行，从而保留 `tsx/esm` 等 loader；任意 Host 脚本绝不作为 profile 写入器。

## Alternatives considered

要求用户全局安装 `dsh` shim 被否决，因为源码 checkout 启动是受支持的开发部署，且已经包含权威 CLI 入口。

向 supervisor 的 `PATH` 添加 checkout 的 `node_modules/.bin` 被否决，因为该 checkout 不一定存在 `dsh` shim，而且修复服务环境会让 Plugin Manager 依赖某一种启动器配置。

把任意 `process.argv[1]` 当作可执行入口被否决，因为无关包装器或 Electron 入口不能证明其为官方 profile 写入器。

## Consequences

直接源码启动无需全局 CLI 安装即可执行插件变更。该回退比可执行文件发现更严格，对无法识别的 Host 入口保持失败关闭。运行中的 Host 需要重启一次才能加载本次 Plugin Manager 实现。
