# Harness alpha.1 internal Web deployment

The fork applies the Pet Host streaming migration and the task-board test assertion correction to Web baseline `cec0cde4ca890c94e5d803690fbd4b747b5e2a43`. Pet and the aggregate use internal version `0.3.18-dsh.20260908.1`; unchanged family packages remain `0.3.17`. The private root references the internal aggregate exactly. There is no npm publication or public release tag. The public version verifier requires one stable version across the family and is not the version gate for this internal deployment.

## SDK and lock ownership

Harness source `593ee89aa6ec8496e26dd2f4d3fbaab76b41c65a` supplies 259 immutable runtime tarballs: 249 DSH packages at `0.1.3-alpha.1`, nine vendor packages, and one native entry package. Pet directly declares `dsh-agent`; Pet and the aggregate require Harness `>=0.1.3-alpha.1`.

The committed public development lock remains on the earlier SDK cohort. Public alpha.1 resolution is incomplete, so that lock is not evidence for compiling this fork and must not be described as alpha.1-ready. The deployment tree separately supplies all runtime tarballs as root development dependencies and overrides, preserves the original non-DSH dependencies, and uses a pnpm-generated deployment lock with relative tarball references. That tree requires the matching `runtime/tarballs.json` inventory. No fabricated registry resolution, integrity, or local home-directory path belongs in the deployment lock.

The validation-only pnpm settings retain `autoInstallPeers: false`, disable `dedupePeerDependents`, and set `verifyDepsBeforeRun: warn`; this avoids pnpm 11.24 treating a tarball peer as a directory and automatically replacing the verified cohort. Native build decisions follow the audited runtime installation. The deployed tree contains source, assets, built JavaScript, manifests, and its deployment lock; Linux installs dependencies afresh. macOS node_modules, credentials, and user state are excluded.

## Validation

Node 22.21.1 with the actual alpha.1 SDK passed full workspace typecheck and build. Twenty workspace test suites passed 3,634 tests and skipped the opt-in native power smoke; Pet passed 478 tests. The separately corrected task-board model-selection test passed all 15 cases. Documentation, bilingual pairing, Agent Note links, and aggregate checks passed. The internal package version changes require rebuilding Pet and aggregate because client telemetry embeds the package version. Deployment artifacts carry the resulting source and library hashes and exact command logs.

The public CI/release smoke remains pinned to rc.1 and does not validate this internal fork. Production readiness requires the separate Linux deployment-lock installation and Profile startup checks; local source compatibility does not substitute for those checks.
