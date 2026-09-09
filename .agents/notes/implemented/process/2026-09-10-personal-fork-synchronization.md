# Agent Note: Personal fork synchronization

Status: implemented

English | [中文](2026-09-10-personal-fork-synchronization.zh.md)

## Problem

The personal fork contains account isolation and deployment integrations alongside the original repository's development history. Instructions and a push guard tied to the original owner's repository can select the wrong branch or upload destination during synchronization.

## Decision

The [personal fork rules](../../../../AGENTS.md#branches-commits-and-prs) require fetching the original source, merging it into the current working branch, preferring its implementation, adapting required local behavior, validating, publishing all unpublished local branches to the owned fork under their existing names, and fetching again to check for missing source commits. The push guard accepts the owned fork over HTTPS or SSH and rejects other destinations regardless of remote name.

The fork uses the upstream 0.3.19 family and Harness 0.1.5-alpha.2 SDK. Pet consumes the upstream assistant stream projection while preserving verified-principal storage, disabled defaults for new accounts, and isolation from host-global activity. Existing account, activity, disposal, and reward-deduplication tests cover these retained behaviors.

## Alternatives considered

Following the original owner's fixed dev/origin instructions would select an upload destination outside this fork and ignore the current deployment branch. Removing the push guard would allow an accidental upload to that original repository. The guard instead enforces the owned destination explicitly.

Replacing every conflicting file with the source copy would discard account isolation and its regression tests. The source implementation remains the default, with the necessary principal-specific behavior retained and checked.

## Consequences

The original repository is read-only. Branch histories remain intact; failed or non-fast-forward pushes require reconciliation. Source synchronization and artifact builds do not restart a running DSH host; rollout and live GUI validation require the updated host and profile to be loaded.
