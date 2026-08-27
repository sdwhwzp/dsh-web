# Agent Note: Serial Workspace Test Gate

Status: implemented

## Problem

The root `pnpm test` command starts several workspace test scripts concurrently, while each Vitest package also parallelizes its own files. Large browser-oriented suites can therefore compete for CPU and memory until otherwise deterministic 5-second UI tests or a 30-second HTTP stress test time out. The same tests pass when their package runs with normal resource availability, so increasing individual timeouts would hide workspace-level oversubscription instead of fixing it.

## Decision

The root test gate runs workspace test scripts with `--workspace-concurrency=1`. Vitest remains free to parallelize test files inside each package, and direct filtered package test commands retain their existing behavior. The gate favors a deterministic complete result over the shorter but unreliable wall time of cross-package parallel execution.

## Alternatives considered

Increasing individual test timeouts was rejected because different suites become the slowest one under contention, and longer limits would make genuine hangs slower to detect.

Workspace concurrency two was rejected because it removed the short UI timeouts but still pushed the Skin Center scene-probe cache stress test past its explicit 30-second budget.

Disabling or reducing package-internal Vitest parallelism was rejected because the contention originates between independently launched workspace processes and each package benefits from its own bounded parallelism.

## Consequences

`pnpm test` takes longer but has a stable resource ceiling across developer machines and CI runners. Focused package tests remain fast, all existing timeout budgets keep their diagnostic value, and no runtime or published package behavior changes.
