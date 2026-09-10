# Agent Note: Browser-only family rows

Status: implemented

English | [中文](2026-09-10-client-only-family-rows.zh.md)

## Problem

A deployment can replace a family plugin’s shared Host with an account-scoped gateway implementation. Disabling the original row also removes its browser UI from the active-row ledger, leaving the replacement API without an entry point.

## Decision

An explicit boolean `clientOnly` in the shell row config retains the active-row registration and its disposer but skips importing and starting the real Host plugin. The deployment owns the replacement API and its authorization. Malformed values produce a degraded config record and do not activate the row.

## Alternatives considered

Enabling the shared Host would restore a global scheduler beside the private account schedulers. Ignoring disabled rows in the browser would violate ordinary plugin enablement. A separate client-only declaration preserves both requirements without special-casing a plugin name.

## Consequences

The existing disabled-row behavior remains intact. Browser-only rows require a compatible replacement API; the shell does not infer its readiness or provide account isolation. Row discovery and disposal are covered alongside rejection of invalid configuration.
