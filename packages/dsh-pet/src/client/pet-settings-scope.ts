/**
 * Account-scoped pet settings transport. The Host settings document remains
 * the direct desktop account's composition input; browser edits use the pet
 * API so a trusted gateway principal selects an independent account file.
 */

import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  PetAccountSettingsView,
  PetSettingsPathOp,
  PetSettingsSection,
} from '../service.ts'
import type { BatchResult, BatchedWrite } from './settings-form.ts'
import type { PetSettings } from './PetSettingsCard.tsx'

const SETTINGS_URL = '/api/pet/settings'
const SETTINGS_MUTATE_URL = '/api/pet/settings/mutate'

/** Convert one Host account view into the standard settings-scope snapshot. */
function scopeSnapshot(view: PetAccountSettingsView): SettingsScopeSnapshot<PetSettings> {
  return {
    status: 'ready',
    value: view.value,
    base: view.base,
    user: view.user,
    revision: view.revision,
    writable: view.writable,
    mode: 'host',
  }
}

/** Require the account settings response fields used by the client. */
function decodeView(value: unknown): PetAccountSettingsView {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid pet settings')
  const row = value as Record<string, unknown>
  if (
    row.value === null || typeof row.value !== 'object' || Array.isArray(row.value)
    || row.base === null || typeof row.base !== 'object' || Array.isArray(row.base)
    || row.user === null || typeof row.user !== 'object' || Array.isArray(row.user)
    || !Number.isSafeInteger(row.revision) || row.writable !== true
  ) {
    throw new Error('invalid pet settings')
  }
  return row as unknown as PetAccountSettingsView
}

/** Fetch one account settings view. */
async function fetchView(url: string = SETTINGS_URL, init?: RequestInit): Promise<PetAccountSettingsView> {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`pet settings failed: ${response.status}`)
  return decodeView(await response.json())
}

/** SettingsScope implementation backed by the principal-aware pet API. */
export class PetAccountSettingsScope implements SettingsScope<PetSettings> {
  private snapshot: SettingsScopeSnapshot<PetSettings> = {
    status: 'loading',
    value: undefined,
    base: undefined,
    user: undefined,
    revision: undefined,
    writable: false,
    mode: 'host',
  }
  private readonly listeners = new Set<() => void>()
  private queue: Promise<void> = Promise.resolve()
  private generation = 0
  private disposed = false

  constructor() {
    void this.refresh()
  }

  getSnapshot(): SettingsScopeSnapshot<PetSettings> {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Reload the current account after a direct pet interaction or failed write. */
  async refresh(): Promise<void> {
    const generation = ++this.generation
    try {
      const view = await fetchView()
      if (this.disposed || generation !== this.generation) return
      this.publish(scopeSnapshot(view))
    } catch {
      if (this.disposed || generation !== this.generation) return
      this.publish({ ...this.snapshot, status: this.snapshot.value === undefined ? 'unavailable' : 'ready' })
    }
  }

  async set(field: string, value: unknown): Promise<void> {
    await this.write([{ op: 'set', path: [field as keyof PetSettingsSection], value }])
  }

  async unset(field: string): Promise<void> {
    await this.write([{ op: 'unset', path: [field as keyof PetSettingsSection] }])
  }

  /** Batched surface consumed by the shared staged settings form. */
  async mutate(writes: BatchedWrite[]): Promise<BatchResult> {
    const ops: PetSettingsPathOp[] = writes.map(write => write.op === 'set'
      ? { op: 'set', path: [write.field as keyof PetSettingsSection], value: write.value }
      : { op: 'unset', path: [write.field as keyof PetSettingsSection] })
    const ok = await this.write(ops)
    if (!ok) return { ok: false, fields: [], message: 'pet settings write failed' }
    const user = this.snapshot.user as Record<string, unknown> | undefined
    return {
      ok: true,
      fields: writes.map(write => ({
        field: write.field,
        landed: write.op === 'unset'
          ? user === undefined || !Object.hasOwn(user, write.field)
          : user?.[write.field] === write.value,
      })),
    }
  }

  /** Stop publishing after the plugin fiber is disposed. */
  dispose(): void {
    this.disposed = true
    this.generation += 1
    this.listeners.clear()
  }

  private async write(ops: PetSettingsPathOp[]): Promise<boolean> {
    let landed = false
    const run = async (): Promise<void> => {
      const expectedRevision = this.snapshot.revision
      try {
        const view = await fetchView(SETTINGS_MUTATE_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ops,
            ...(expectedRevision === undefined ? {} : { expectedRevision }),
          }),
        })
        if (this.disposed) return
        this.generation += 1
        this.publish(scopeSnapshot(view))
        landed = true
      } catch {
        await this.refresh()
      }
    }
    this.queue = this.queue.then(run, run)
    await this.queue
    return landed
  }

  private publish(snapshot: SettingsScopeSnapshot<PetSettings>): void {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }
}
