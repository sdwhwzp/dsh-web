# Agent Note: Principal-scoped pet accounts

Status: implemented

## Problem

The pet service stored one host-global companion in `$DSH_HOME/pet.json`, and its browser settings used the Host-global `pet` settings namespace. Every browser therefore addressed the same selection, name, layout, switches, affinity, and treats. An authenticated account gateway could hide the global settings namespace, but that also left the account without a pet; exposing it would let one account modify every other account's companion. Account selection must not trust a username, request body, cookie, or unsigned browser header.

## Decision

`@linxin666/dsh-pet` owns account separation and resolves it at each pet API request:

- A request with no authenticated principal is the direct desktop account and keeps the established `$DSH_HOME/pet.json` file, Host settings composition, and host-global session activity.
- A request carrying a principal verified by the optional Host `requestPrincipal` service selects an account by the pair `(principal.source, principal.id)`. The pair is hashed with SHA-256 into an opaque `$DSH_HOME/pet-accounts/<digest>/pet.json` directory; usernames and browser-provided paths do not participate.
- Principal or signature headers fail closed when the verifier is absent or rejects them. The pet service never parses gateway credentials itself and never accepts identity fields from a JSON body.
- The browser settings card reads `/api/pet/settings` and writes `/api/pet/settings/mutate`, so selection, display, visibility, account enablement, and decoration enablement use the same principal-scoped file as interactions and naming. Revision-fenced writes prevent concurrent tabs from silently replacing a newer value.
- Pet API routes remain registered while the plugin is loaded. Disabling one account unmounts only that account's browser companion and cannot make the routes unavailable to another account.
- Principal-scoped companions do not consume host-global session activity or bubbles. The current session event stream has no verified principal attribution; returning an idle view prevents cross-account activity disclosure. Direct interactions, affinity, treats, names, selection, layout, and switches remain account-specific.

The persisted pet document records the two account switches and the fields explicitly overridden through the account settings API. Older `$DSH_HOME/pet.json` files remain readable with defaults for these additions.

## Alternatives considered

- Store pet state in `dsh-passwords`: rejected because the pet plugin owns the companion data and API. Moving storage into one gateway would couple the pet to a specific account provider and leave other verified principal providers without the same behavior.
- Use username, gateway cookie, query parameters, or browser local storage as the account key: rejected because usernames change, cookies are gateway credentials rather than durable identities, and browser-controlled values can select another account without Host verification.
- Keep one global pet and expose the Host `pet` settings namespace to every account: rejected because selection, position, enablement, naming, affinity, and treats would remain shared mutable data.
- Forward host-global session animation to every account while separating only persisted preferences: rejected because bubbles and activity phases can reveal that another account is working. Per-account activity requires a session event identity supplied by an authoritative producer.
- Run one DSH Host process per account: rejected because process isolation is disproportionate to this state-isolation requirement and duplicates the plugin registry, model connections, and lifecycle management.

## Consequences

- Direct access on the Host port preserves the established pet and its full session-reactive behavior. Each authenticated gateway account starts with defaults and persists independently across browser reloads and service restarts; account renames retain the same pet because the immutable id remains stable.
- Deleting or revoking an external account stops access but does not delete its opaque pet directory. Storage retention follows the same conservative rule as other user-owned data and avoids destructive coupling to an account provider.
- A gateway deployment must install a compatible Host `requestPrincipal` verifier for account separation. Signed identity headers without that verifier return 403 rather than falling back to the desktop account.
- Gateway companions remain idle until the Host session stream carries verified principal attribution. This is an explicit isolation guarantee, not a best-effort activity filter.
- Coverage exercises persistence across reload, two-account independence, forged and tampered identity rejection, trusted-principal HTTP routing, revision-fenced settings writes, and the direct-account path.
