# Agent Note: Client Session Navigation Compatibility

Status: implemented

## Problem

Harness 0.1.6-alpha.2 exposes Session navigation through `uiWorkspace`, while the family plugins compile against the published 0.1.5-rc.1 SDK cohort. Reading only `sessions.list.current` loses the displayed Session on alpha.2, and calling `sessions.open` fails there. The affected paths include task navigation, worktree creation, pet bubbles, archive protection, and current-session controls.

## Decision

Navigation consumers declare `dsh-client-ui-workspace` in their browser module dependencies and call `uiWorkspace.openSession`. The shared `currentSessionIdOf` reader accepts the older `current` field and the alpha.2 row with a positive `retainedBy.mainView` count. `sync-shared` owns the copies used by individual plugins and their aggregate build. The workspace SDK development dependency is pinned to 0.1.5-rc.1 so repository type checks and the cohort gate exercise the declared minimum host SDK.

The auto-isolation wrapper owns `uiWorkspace.startSession`; workspace registration stays on `workspaces.create/delete`. With no current selection, its target follows Session activity and Workspace creation order. Settings cards keep the [loaded-group preference](2026-09-17-family-plugin-card-seat-follows-the-loaded-group.md); without a group they use alpha.2 `plugins.row.config` keys for standalone and aggregate rows, or the older namespace-keyed slot. They wait for declaration and render their forms only in the page view.

## Alternatives considered

Keeping `sessions.open` and the `current` field exclusively leaves the alpha.2 deployment unable to navigate or identify the displayed Session.

Linking Harness source into plugin TypeScript programs avoids the installed SDK mismatch but violates the repository's independent-package requirement and stops checking the published minimum SDK.

Registering third-party forms as `plugins.item` was rejected because that list is owned by official configuration pages; bundle rows have their own keyed configuration surface.

## Consequences

One client bundle supports both Session list representations without adding Host writes or changing archive deletion rules. Selection is absent when no row is retained by the main view. Shared-reader tests cover both representations and empty selection; worktree tests check navigation through the workspace service and rollback on failure. A live alpha.2 GUI remains necessary to validate service injection and bundle loading in the deployed profile.
