# Agent Note: Alpha Sidebar Version Pin

Status: implemented

## Problem

The aggregate's stable sidebar dependency targets the pre-alpha Harness client APIs. A deployment profile may also carry a direct sidebar dependency, which takes precedence over the aggregate's transitive request and can silently retain the incompatible release.

## Decision

The aggregate pins `dsh-better-sidebar` to `0.18.0-alpha.0`, the published alpha-track release whose peer range admits Harness `0.1.2-alpha.3`. A deployment profile using the aggregate pins the same exact version in both its direct dependency and `minimumReleaseAgeExclude`; the sidebar remains mounted only by the aggregate's `web-ui-better-sidebar` row and is not added to the profile bundle list.

## Alternatives considered

Using the npm `latest` tag was rejected because it resolves to the stable pre-alpha line. A caret dependency on the sidebar alpha line was rejected because a production reinstall could select an unverified prerelease without a repository change.

## Consequences

Alpha Harness deployments receive the matching sidebar build deterministically. Operators must update a profile-level direct dependency together with the aggregate pin, and each later alpha sidebar upgrade remains an explicit reviewed change.

## Testing

The aggregate generator, lockfile resolution, runtime dependency gate, package build, and package tarball inspection verify the exact dependency and retained `web-ui-better-sidebar` mount row.
