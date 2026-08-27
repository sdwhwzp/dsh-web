# Agent Note: Workshop settings bridge allowlist

Status: implemented

## Problem

The Workshop registers the `dsh-web-ui-market` settings namespace for its enable switch, but the rc.6 compatibility bridge did not include that namespace in its built-in dsh-web family allowlist or package-name aliases. When the official Host settings API refused third-party namespaces, the bridge also omitted the Workshop, so its first-level settings section rendered "Section not exposed" even though both the Workshop and settings bridge plugins were loaded.

## Decision

The settings bridge treats `dsh-web-ui-market` as a registered dsh-web family namespace. The built-in fallback list includes it, and explicit `web_settings_namespaces` configuration accepts `dsh-web-ui-market`, `dsh-client-ui-market`, `dsh-market`, and `ui-market` as names for the same namespace.

The existing allowlist rules remain authoritative: the bridge exposes the namespace only when the Workshop has registered it in the Host settings seam. An explicitly configured non-empty `web_settings_namespaces` list still limits the bridge to the entries the user selected; deployments using such a list must include one Workshop alias to expose its switch.

## Alternatives considered

- Add a Workshop-specific settings HTTP API: rejected because the compatibility bridge already owns third-party settings transport, revision fencing, schema validation, persistence, and authenticated-proxy access. A second transport would duplicate those guarantees for one boolean field.
- Make the Workshop card assume `enabled: true` whenever the namespace is unavailable: rejected because the switch would look usable without a durable or authoritative write path, and user configuration could not disable the card reliably.
- Expose every registered Host settings namespace through the bridge: rejected because the family allowlist is a security boundary. The bridge must not turn registration alone into remote configuration access for unrelated or privileged namespaces.

## Consequences

- With no `web_settings_namespaces` key, the Workshop card loads through the same fallback bridge as the other dsh-web family settings and no longer displays the missing-namespace message.
- Explicit allowlists retain least privilege and require a Workshop entry when the card should be configurable.
- No Workshop client, settings schema, persistence format, or install gateway changes are required.
- Tests cover the fallback list, bare namespace, package aliases, registered-set intersection, and the bridge describe response.
