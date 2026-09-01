# Agent Note: Better-sidebar universal file download

Status: implemented

## Problem

The right-side file editor offered downloads only through viewer-specific fallback panes. Files with a supported preview, including Markdown and spreadsheets, could therefore be viewed without a consistent way to save the original file.

## Decision

The `dsh-web-all` browser compat layer adds one download action beside the controls of every better-sidebar editor with a non-empty path. It builds the URL from the active session at interaction time and uses better-sidebar's existing authenticated `/sidebar/file` route. The path-less Files home remains unchanged.

The compat action is part of the aggregate's own browser bundle, so a published npm package, a local workspace link, and a Git install targeting `packages/dsh-web-all` receive the same behavior. A Git install targeting only the repository root still resolves the aggregate from that root package's npm dependency and does not carry unpublished workspace changes. It recognizes an existing same-origin better-sidebar download link and removes its own action when upstream supplies one. Browser tests cover URL scope, current-editor replacement, cleanup, native-action deduplication, localization changes, and the pinned better-sidebar DOM hooks.

## Alternatives considered

An exact-version pnpm patch was rejected because root `patchedDependencies` does not travel inside the published `dsh-web-all` package. Publishing a personal fork would add a separate release stream for a small presentation change. Viewer-specific controls would preserve the original inconsistency and require each viewer to implement the same action.

## Consequences

All file types share one download entry whenever a real path is open, regardless of whether a previewer handles that file. The compatibility selector depends on better-sidebar's editor path-input and icon-button class tokens, so dependency upgrades must run the aggregate browser test. The upstream package remains unmodified.
