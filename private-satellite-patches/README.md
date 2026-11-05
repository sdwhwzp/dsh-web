# Private satellite deployment pins

The 0.4 family mounts pet, skin center, the community index and preset center as external packages. Production uses the exact accepted artifacts in `manifest.json`; the aggregate's public dependency ranges are build inputs and do not authorize replacing these production pins.

The pet artifact keeps per-account settings, persistence, route authorization and gameplay isolation. `pet-account-isolation.patch` records the complete source delta against the `patchBase` commit. The complete reproducible source and package build configuration remain available at `sourceCommit` in this repository's history. Restore that commit into an isolated checkout to rebuild the pinned artifact; do not apply this patch directly to an independently versioned satellite without reconciling its paths and tests.

The public dependency floor is 0.3.25 because public 0.3.24 still requires the retired `settingsScope` service. The exact private 0.3.24 artifacts listed here already contain the RC1 migration; deployment overrides preserve those validated builds and the pet account-isolation patch. A public version number alone is not evidence that it includes the private adaptation.

Skin center and the community index retain their accepted RC1 artifacts. `skin-formatting.patch` records the whitespace-only asset delta; no skin behavior is added by that patch. New satellite releases need separate compatibility and account-isolation review before the production manifest changes.

The three external rows retain `web-ui-pet`, `web-ui-skin-center` and `web-ui-community-plugins`. Their old aggregate subpath exports remain available. Existing account data and settings keys need no migration. SSH, local-directory access and desktop behavior stay in the current family source.

Preset center uses the accepted `0.4.1-dsh.20260924.2` artifact after its source moves to `dsh-presets`. Its manifest entry records the source commit in this repository before relocation. The external `web-ui-preset-center` row loads that artifact directly; its settings keys and preset library paths are unchanged.

## Source synchronization candidate

`candidate-20261104.json` records the four upstream source commits for the `0.4.15-dsh.20261104.1` candidate on Harness `0.2.2-rc.1`. `candidate-20261104.patch` carries the private version changes and the Pet account adaptation against those exact commits. Apply it from an isolated directory containing the four repositories under their recorded names. The source overlay is published in this personal fork; upstream satellite repositories remain read-only, and their gitlinks continue to identify public source.

The Pet adaptation retains the previously deployed account-file hash and trusted identity provider. Skin selection and preset enablement remain shared Host state and require the gateway's administrator policy. Candidate tarball checksums, dependency overrides and validation evidence live with the deployment artifacts; this source record does not change any accepted production manifest or authorize rollout.
