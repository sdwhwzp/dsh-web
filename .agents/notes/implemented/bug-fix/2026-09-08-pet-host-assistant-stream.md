# Agent Note: Pet Host assistant streaming

Status: implemented

## Problem

Harness 0.1.3-alpha.1 separates live assistant publication from durable Session events. A Pet consumer of `assistant/chunk` cannot compile against that vocabulary, while consuming only completed messages loses thinking and writing activity during generation.

## Decision

Pet consumes nonempty reasoning/text chunks from the Host `agent/assistant-stream` event and attributes them to `agent.session`. The listener shares the enabled lifecycle and Context disposal with durable Session activity. Start/end frames do not award turns; durable `turn/end` remains the deduplicated reward owner.

The [principal-scoped account decision](../architecture/2026-08-25-principal-scoped-pet-accounts.md) remains authoritative: a frame has no verified principal, so account views stay idle with no Host session bubbles. Direct Host access keeps live thinking/review and per-session whispers.

## Alternatives considered

Consume `assistant/live-chunk` as a Session event: rejected because it is synthesized by the Client controller and is not a Host durable event.

Project only durable messages: rejected because the Pet would lose live thinking/writing. Replaying stored message streams would also repeat transient whispers without a new generation.

## Consequences

Pet and its aggregate require Harness `>=0.1.3-alpha.1`; Pet declares the Host API through a direct `dsh-agent` development dependency. Tests cover live-to-durable settlement, duplicate turn completion, account isolation, enablement, and listener disposal.
