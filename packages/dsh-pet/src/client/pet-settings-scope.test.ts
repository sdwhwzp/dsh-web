import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PetAccountSettingsView, PetSettingsSection } from '../service.ts'
import { PetAccountSettingsScope } from './pet-settings-scope.ts'

const base: PetSettingsSection = {
  enabled: true,
  decorationEnabled: true,
  visible: true,
  size: 160,
  right: 24,
  bottom: 120,
  petId: 'whale-girl',
}

function view(
  revision: number,
  value: PetSettingsSection = base,
  user: Partial<PetSettingsSection> = {},
): PetAccountSettingsView {
  return { value, base, user, revision, writable: true }
}

function response(value: PetAccountSettingsView): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PetAccountSettingsScope', () => {
  it('loads and revision-fences writes through the account-aware endpoint', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (init?.method !== 'POST') return response(view(4))
      const body = JSON.parse(String(init.body)) as {
        expectedRevision?: number
        ops: Array<{ op: string; path: string[]; value?: unknown }>
      }
      expect(body).toEqual({
        expectedRevision: 4,
        ops: [{ op: 'set', path: ['enabled'], value: false }],
      })
      return response(view(5, { ...base, enabled: false }, { enabled: false }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = new PetAccountSettingsScope()
    await vi.waitFor(() => expect(scope.getSnapshot()).toMatchObject({ status: 'ready', revision: 4 }))
    const notified = vi.fn()
    const unsubscribe = scope.subscribe(notified)

    await scope.set('enabled', false)

    expect(scope.getSnapshot()).toMatchObject({
      status: 'ready',
      revision: 5,
      value: { enabled: false },
      user: { enabled: false },
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(notified).toHaveBeenCalledTimes(1)
    unsubscribe()
    scope.dispose()
  })

  it('batches resets and reports the account layer returned by the host', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (init?.method !== 'POST') {
        return response(view(1, { ...base, size: 220, petId: 'otter' }, { size: 220, petId: 'otter' }))
      }
      const body = JSON.parse(String(init.body)) as { ops: unknown[] }
      expect(body.ops).toEqual([
        { op: 'unset', path: ['size'] },
        { op: 'set', path: ['petId'], value: 'whale-girl' },
      ])
      return response(view(2, base, { petId: 'whale-girl' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = new PetAccountSettingsScope()
    await vi.waitFor(() => expect(scope.getSnapshot().revision).toBe(1))
    const result = await scope.mutate([
      { field: 'size', op: 'unset' },
      { field: 'petId', op: 'set', value: 'whale-girl' },
    ])

    expect(result).toEqual({
      ok: true,
      fields: [
        { field: 'size', landed: true },
        { field: 'petId', landed: true },
      ],
    })
    scope.dispose()
  })
})
