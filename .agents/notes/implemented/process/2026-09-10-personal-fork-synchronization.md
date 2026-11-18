# Agent Note: Personal fork synchronization

Status: implemented

English | [中文](2026-09-10-personal-fork-synchronization.zh.md)

## Problem

The personal fork contains account isolation and deployment integrations alongside the original repository's development history. Instructions and a push guard tied to the original owner's repository can select the wrong branch or upload destination during synchronization.

## Decision

The [personal fork rules](../../../../AGENTS.md#branches-commits-and-prs) require fetching the original source, merging it into the current working branch, preferring its implementation, adapting required local behavior, validating, publishing all unpublished local branches to the owned fork under their existing names, and fetching again to check for missing source commits. The push guard accepts the owned fork over HTTPS or SSH and rejects other destinations regardless of remote name.

The fork uses the upstream 0.4.19 family and Harness 0.2.2-rc.3 SDK. The deployment candidate is `0.4.19-dsh.20261118.1`. Each accepted artifact has an immutable version. Workspace SDK ranges, Host peers and CI mount pins track the same cohort. Package extensions restore runtime dependencies omitted from published client manifests. The workspace resolves the root alias to its local aggregate.

Packages with a Host value import of Cordis declare `@deepseek-ai/cordis` as a runtime dependency at `~4.1.0`. Browser entry points use only the official shared platform module table for implicit external modules. Task-board declares its HTML entity decoder directly. Archive validation checks the actual packed entry points and dependency graph, including the Windows Bash payload checksums.

The aggregate mounts family plugins by their real package names. Compatibility shell exports retain old profile addressing, including `clientOnly` for deployments whose gateway owns the task-board Host. Such deployments must register the task-board browser module separately and must not load another Host ledger. Satellite account adaptations remain owned by their individual repositories.

The aggregate places the conversation in the first grid cell on its narrow layout. The Host owns desktop placement and the drawer mask when the frame has `data-sidebar-drawer` or `data-mobile-nav`. The compatibility mask skips both states.

Task-board scheduling preserves persisted account bindings and the authenticated owner across execution inspection, settlement, model selection, session projections and model catalog reads. A run group freezes its model catalog under that account. The official owner peer supplies the Host invocation lifecycle while the gateway validates the attached deployment principal on every request.

Task-board attachment actions retain the authenticated principal through storage verification and ledger mutation. Upload and image routes await authentication before accessing storage. The account is checked again after asynchronous verification, and event streams recheck the account before writing each frame or heartbeat. Upstream write-failure cleanup and credential projection remain active alongside these account checks. The ledger uses upstream schema 7 and preserves the fork's account bindings during migration. Git Graph is retired by upstream; existing profile rows require the upstream retirement migration during candidate integration.

SSH account isolation remains a profile setting that requires remounting. Ordinary accounts supply their own passwords or inline keys; Host key files, Host SSH agents, agent forwarding and local proxy commands are administrator-only. Persisted entries with forbidden capabilities remain editable but cannot connect until those capabilities are removed.

Browser-view owns one shared Chromium profile, tab registry and panel stream per Host. The fork aggregate disables its row by default. Account deployment profiles must keep both the Host row and client entry disabled until browser profiles, tabs, frames, commands and tool calls are isolated by verified principal. The Host launch token is reserved for the Host owner.

## Alternatives considered

Following the original owner's fixed dev/origin instructions would select an upload destination outside this fork and ignore the current deployment branch. Removing the push guard would allow an accidental upload to that original repository. The guard instead enforces the owned destination explicitly.

Replacing every conflicting file with the source copy would discard account isolation and its regression tests. The source implementation remains the default, with the necessary principal-specific behavior retained and checked.

## Consequences

Automatic market deployment runs only in the original upstream repository. This fork requires an explicitly requested `workflow_dispatch`; a synchronization push only publishes source. The workflow condition enforces this independently of whether deployment credentials exist.

The original repository is read-only. Branch histories remain intact; failed or non-fast-forward pushes require reconciliation. Source synchronization and artifact builds do not restart a running DSH host; rollout and live GUI validation require the updated host and profile to be loaded.
