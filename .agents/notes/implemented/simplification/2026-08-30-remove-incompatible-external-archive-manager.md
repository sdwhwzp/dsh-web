# Agent Note: remove the incompatible external archive manager from dsh-web-all

Status: implemented

Supersession check: no active Note owns the aggregate's archive implementation. The better-session integration Note mentioned the archive manager only as an external-package example and is updated with this decision.

## Problem

`@mlgbnb/dsh-archive-manager@1.0.7` depends on the removed `@deepseek-ai/dsh-client-runtime` client API and reads the legacy session and workspace disk layout directly. Its host implementation also mutates private persistence indexes and can physically delete session directories. Harness `0.1.2-alpha.1` does not expose those formats or private registries, so mounting the package can fail or delete only part of a session's current state.

## Decision

- Remove the archive-manager row from `packages/dsh-web-all/aggregate.yml`, then regenerate the aggregate patch and package manifest so fresh installs do not mount or install the external package. The generator now retains only non-workspace dependencies named by external rows, preventing a removed row from leaving an installed package behind.
- Keep archive and restore on the Harness native session UI. The aggregate does not add another component that reads persistence files directly.
- Keep `@morlay/better-session` in the aggregate with its existing inactive-by-default rows and overrides. This change does not enable it or change the stock jsonl default.

## Alternatives considered

- **Ship the archive manager disabled by default**: rejected because the incompatible and destructive implementation would remain installed and could be enabled accidentally.
- **Patch or vendor version 1.0.7**: rejected because it relies on private persistence data and physical deletion. Archive ownership belongs in the Harness session capability, whose events and storage implementation can evolve together.
- **Wait for a compatible upstream release**: rejected because the aggregate declares compatibility with Harness `0.1.2-alpha.1` now. A future version can be reviewed as a new integration.

## Consequences

- The aggregate no longer provides the external settings-page archive manager. Harness native archive and restore remain available.
- Fresh installs and regenerated profiles no longer pull `@mlgbnb/dsh-archive-manager`. Existing profile directories may retain unused package files until their dependency install is refreshed, but the generated patch no longer mounts them.
- `@morlay/better-session` remains installed but inactive by default, with no row or override changes.

## Testing

- Aggregate tests assert that neither the generated patch nor package manifest contains the external archive manager and that better-session remains inactive by default.
- Aggregate generation, runtime dependency checks, documentation checks, workspace tests, typechecking, and the production build cover the changed release artifacts.
