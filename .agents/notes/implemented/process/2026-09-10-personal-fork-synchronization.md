# Agent Note: Personal fork synchronization

Status: implemented

English | [中文](2026-09-10-personal-fork-synchronization.zh.md)

## Problem

The personal fork contains account isolation and deployment integrations alongside the original repository's development history. Instructions and a push guard tied to the original owner's repository can select the wrong branch or upload destination during synchronization.

## Decision

The [personal fork rules](../../../../AGENTS.md#branches-commits-and-prs) require fetching the original source, merging it into the current working branch, preferring its implementation, adapting required local behavior, validating, publishing all unpublished local branches to the owned fork under their existing names, and fetching again to check for missing source commits. The push guard accepts the owned fork over HTTPS or SSH and rejects other destinations regardless of remote name.

The fork uses the upstream 0.4.11 family and Harness 0.2.1-rc.3 SDK. Local deployment candidates use the unified version `0.4.11-dsh.20261027.3`; an accepted artifact is immutable. Workspace SDK ranges, Host peers, CI mount pins and desktop Host seeds track the same cohort. Package extensions restore runtime dependencies omitted from published client manifests.

The aggregate mounts family plugins by their real package names. Compatibility shell exports retain old profile addressing, including `clientOnly` for deployments whose gateway owns the task-board Host. Such deployments must register the task-board browser module separately and must not load another Host ledger. Satellite account adaptations remain owned by their individual repositories.

Task-board scheduling preserves persisted account bindings and the authenticated owner across execution inspection, manual settlement, model selection, session projections and verification-catalog reads. A run group freezes its verification catalog in that same account. The official owner peer supplies the Host invocation lifecycle while the gateway validates the attached deployment principal on every request.

SSH account isolation remains a profile setting that requires remounting. Ordinary accounts supply their own passwords or inline keys; Host key files, Host SSH agents, agent forwarding and local proxy commands are administrator-only. Persisted entries with forbidden capabilities remain editable but cannot connect until those capabilities are removed.

Browser-view owns one shared Chromium profile, tab registry and panel stream per Host. Session labels do not authorize tab access, and its loopback fence does not identify an account. Account deployments must disable both its Host row and client entry until a principal-scoped integration isolates browser profiles, tabs, frames, commands and tool calls; the Host connection's launch token must remain unavailable to ordinary accounts.

## Alternatives considered

Following the original owner's fixed dev/origin instructions would select an upload destination outside this fork and ignore the current deployment branch. Removing the push guard would allow an accidental upload to that original repository. The guard instead enforces the owned destination explicitly.

Replacing every conflicting file with the source copy would discard account isolation and its regression tests. The source implementation remains the default, with the necessary principal-specific behavior retained and checked.

## Consequences

Automatic market deployment runs only in the original upstream repository. This fork requires an explicitly requested `workflow_dispatch`; a synchronization push only publishes source. The workflow condition enforces this independently of whether deployment credentials exist.

The original repository is read-only. Branch histories remain intact; failed or non-fast-forward pushes require reconciliation. Source synchronization and artifact builds do not restart a running DSH host; rollout and live GUI validation require the updated host and profile to be loaded.
