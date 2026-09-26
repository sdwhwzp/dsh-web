# Agent Note: Task-board execution account ownership

Status: implemented

## Problem

A Host scheduler outlives the browser request that created its task. Account-aware Session services require an authenticated principal for creation, prompting, roster reads and history streams; a background call without that identity cannot execute or observe the task.

## Decision

The administrator-only board authenticates each carrier through Connection authorization, with the existing signed-principal provider as the compatibility path when Connection does not expose authorization. A Host-only `taskPrincipals` map is persisted in the same atomic ledger write as a new task, explicit run or schedule binding. Browser imports and the audit-only initiator cannot establish ownership. An existing owner alone may mutate the task, and imports cannot overwrite owned tasks. Agent tools obtain the verified principal from each execution carrier before reading or changing the board. Subtask links reject another owner; cascade participants persist their execution owner atomically with the opened runs.

Every execution and background observation uses the saved owner and rechecks the active-account provider before gateway calls and permission commands. Session rosters and reuse evidence are associated with that owner. Invalid persisted ownership refuses startup while preserving the ledger. Standalone Hosts without deployment identity services retain local behavior; a bound identity never falls back to anonymous execution when its provider disappears.

## Alternatives considered

A fixed administrator principal would assign another person's work and model usage to a fabricated identity and survive account revocation. The Host therefore never chooses an administrator from configuration or the user table.

Request-local identity alone would authorize manual execution but lose attribution after the browser disconnects or the Host restarts. The scheduler requires durable ownership independent of transport tokens.

A separate ownership file would need a transaction across task state and ownership. The optional Host-only ledger field retains the existing single-writer and atomic-rename lifecycle without changing browser task records.

## Consequences

Legacy and imported cards remain unowned until an authenticated administrator explicitly runs them or sets their schedule. Unowned or revoked scheduled executions fail before Session creation, and revoked observers cannot continue receiving SSE updates. The shared board remains visible to administrators; this change does not enable ordinary-account access or create per-account boards.

Focused tests cover verified-carrier propagation, revoked identities between awaited operations, durable scheduled execution after restart, stream observation, cross-account mutation denial, rejected wire identity and preservation of malformed ownership data. The existing SDK gateway compatibility decision remains in [the task-board SDK note](2026-08-28-task-board-sdk-0.1.2-alpha.1.md).
