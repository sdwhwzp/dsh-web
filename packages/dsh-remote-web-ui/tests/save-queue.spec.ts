/**
 * Issue #1754: rapid saves of a settings field stopped taking effect after a
 * few rounds.
 *
 * A save is a Host round trip that also drives the profile reconcile, and
 * the Host runs settings writes inside one exclusive transaction. Two
 * overlapping saves therefore race each other: the Host refuses the loser
 * with "HMR transactions cannot be nested", and the card used to answer a
 * save pressed during a save by returning immediately, dropping the edit.
 *
 * The fix serializes: a save asked for during a save is queued and runs once
 * the first settles, so no two Host writes ever overlap.
 */
import { describe, expect, it } from 'vitest'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import { CardForm, textField } from '../src/client/settings-form.ts'

/**
 * A form double that records whether any two mutate calls were ever in
 * flight at the same time, holding the first call open until released.
 * @returns the form double plus its in-flight observations.
 */
function concurrencyProbe() {
  let snapshot: ConfigFormSnapshot<Record<string, unknown>> = { status: 'ready', value: { relay: 'initial' }, base: { relay: 'initial' }, user: {}, revision: 1, writable: true, mode: 'host' }
  let inFlight = 0
  let peak = 0
  let calls = 0
  /** Resolvers releasing each blocked mutate, in the order it started. */
  const releases: Array<() => void> = []
  const form: ConfigForm<Record<string, unknown>> = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    set: async () => true,
    unset: async () => true,
    mutate: async (ops) => {
      calls += 1
      inFlight += 1
      peak = Math.max(peak, inFlight)
      if (calls === 1) await new Promise<void>(resolve => { releases.push(resolve) })
      inFlight -= 1
      const value = { ...snapshot.value }
      for (const op of ops) {
        const key = String(op.path[0])
        if (op.op === 'set') value[key] = op.value
        else delete value[key]
      }
      snapshot = { ...snapshot, value, revision: snapshot.revision + 1 }
      return true
    },
  }
  return { form, releases, calls: () => calls, peak: () => peak }
}

describe('settings card save serialization (issue #1754)', () => {
  it('operator saving during a save never overlaps two Host writes', async () => {
    // Given a Host that holds its first write open until the test releases it
    const probe = concurrencyProbe()
    const card = new CardForm(probe.form, [textField('relay')])

    // When the operator edits and saves, then presses save again mid-flight
    card.actions().edit('relay', 'false')
    const first = card.requestSave()
    card.actions().edit('relay', 'true')
    const second = card.requestSave()
    probe.releases[0]?.()
    await Promise.all([first, second])

    // Then the two Host writes never ran concurrently, which is the whole point
    expect(probe.peak()).toBe(1)
    expect(probe.calls()).toBe(2)
    expect(probe.form.getSnapshot().value.relay).toBe('true')
    expect(card.shell().dirty).toBe(false)
  })

  it('operator pressing save with nothing staged spends no round trip', async () => {
    // Given a Host that answers immediately
    const probe = concurrencyProbe()
    const card = new CardForm(probe.form, [textField('relay')])

    // When the operator presses save on a clean form
    const idle = card.requestSave()
    await idle

    // Then an empty plan is not sent to the Host
    expect(probe.calls()).toBe(0)
  })

  it('operator pressing save twice on one edit writes it exactly once', async () => {
    // Given a Host that holds the first write open
    const probe = concurrencyProbe()
    const card = new CardForm(probe.form, [textField('relay')])

    // When the operator edits once and presses save twice
    card.actions().edit('relay', 'false')
    const first = card.requestSave()
    const second = card.requestSave()
    probe.releases[0]?.()
    await Promise.all([first, second])

    // Then the queued press finds nothing left to write
    expect(probe.calls()).toBe(1)
  })
})
