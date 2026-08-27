# Agent Note: Remove desktop footer actions

Status: implemented

## Problem

The remote-web-ui browser plugin contributed both a Check for updates action and a Remote access action to the desktop sidebar footer. These administrator controls occupied the lower-left navigation area on every desktop page, including deployments where pairing and updates are managed outside the sidebar.

## Decision

The browser plugin does not register contributions in `sidebar.remote` or `sidebar.footer.action`. The plugin settings card, pairing-link acceptance, mobile presence flow, paired remote desktop channel, existing paired-device sessions, and loopback-only pairing and update routes remain active. The unpaired-device notice directs users to an administrator instead of a sidebar action that is not present.

## Alternatives considered

- Hide the two buttons with CSS: rejected because the controls would still mount, run their probes, and remain in the accessibility tree.
- Disable the complete remote-web-ui plugin: rejected because it would also stop paired remote sessions and remove the host routes.
- Keep one of the two actions: rejected because the requested lower-left area contains neither administrator control.

## Consequences

- Desktop pages show neither Check for updates nor Remote access in the lower-left sidebar.
- Existing paired devices and the remote channel continue to work.
- Administrators issue pairing links and invoke updates through loopback-only control endpoints or other administrator tooling.
- Registration tests assert that settings changes never add either footer contribution.
