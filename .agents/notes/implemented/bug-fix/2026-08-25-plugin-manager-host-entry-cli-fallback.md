# Agent Note: Plugin Manager Host Entry CLI Fallback

Status: implemented

## Problem

The plugin-manager gateway requires the official `dsh plugin` command as its only profile writer. A source checkout can run the Web host directly through `node --import tsx/esm apps/cli/src/bin.ts` without installing a `dsh` shim on `PATH` or under `node_modules/.bin`. The gateway then reports that the CLI is unavailable even though the running process is already the official CLI entry and carries every loader flag needed to invoke it again.

## Decision

CLI discovery keeps external executables first: process `PATH`, project-local npm shims above the host entry, and standard Homebrew locations. When those probes fail, it accepts the current host entry only when its normalized path matches an official DSH source or built CLI location. Node entries run through `process.execPath` with the current `process.execArgv`, preserving loaders such as `tsx/esm`; arbitrary host scripts are never used as the profile writer.

## Alternatives considered

Requiring users to install a global `dsh` shim was rejected because source-checkout launches are supported development deployments and already contain an authoritative CLI entry.

Adding the checkout's `node_modules/.bin` directory to the supervisor `PATH` was rejected because this checkout does not necessarily contain a `dsh` shim, and service environment repair would make plugin-manager depend on one launcher's configuration.

Treating every `process.argv[1]` value as executable was rejected because unrelated wrappers or Electron entries are not evidence of the official profile writer.

## Consequences

Plugin mutations work from direct source launches without a global CLI installation. The fallback remains narrower than executable discovery and fails closed for unrecognized host entries. A running host must restart once to load this plugin-manager implementation.
