# Agent Note: Account-owned SSH connections

Status: implemented

## Problem

A shared SSH store and pool make aliases global. Gateway list filtering alone cannot isolate jump hosts, tunnels, credentials or Agent tools, and it prevents accounts from independently editing identically named connections.

## Decision

The opt-in account mode resolves a verified principal and current deployment permission before every HTTP, WebSocket or tool operation. Each account owns a file and engine keyed by the hash of its identity issuer and id. Routes retain their existing SSH behavior inside that engine. Credential changes and alias deletion invalidate only that engine's connections. Account roles are rechecked before reusing a cached engine. Account engines recheck authorization every 30 seconds and dispose revoked pools and pinned tunnels.

Ordinary accounts supply passwords or inline private keys. The server's key files, SSH agents, config import and arbitrary local-path Agent transfers remain administrator capabilities; browser file transfer stages only the uploaded or downloaded bytes. The gateway continues to own network-target policy, account permission changes and closing revoked WebSockets.

Legacy aliases are copied once according to durable gateway ownership records, and unclaimed aliases go only to the earliest administrator. The original file remains a backup. Persisting an empty account file prevents deletions from resurrecting old entries after restart.

## Alternatives considered

Prefixing aliases in the gateway would require rewriting every request, response, tunnel id, jump chain and tool call. Per-account engines reuse the SSH implementation and keep these identifiers local without a second translation protocol.

Enabling ordinary users to name Host key paths or agents would grant access to credentials belonging to the service account. Inline keys support key authentication without that access.

## Consequences

The gateway's `TENANT_SSH_ENABLED` and SSH plugin's `accountIsolation` must be enabled in the same deployment. Authenticated Host principals must reach Agent tool executions; missing identities fail closed. Per-account routes, duplicate aliases, legacy migration, private-key authentication, tunnel isolation and permission revocation have behavior tests. Ordinary Agent local-path transfers require the browser Transfer tab.
