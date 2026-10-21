/** Account fences for the administrator-owned squad ledger. */
import type { Context } from '@deepseek-ai/cordis'
import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { AgentsAccounts } from '../src/host/access.ts'

const admin = { source: 'gateway', id: '1', username: 'admin', role: 'admin' as const }
const request = new IncomingMessage(new Socket())
request.headers['x-role'] = 'admin'
afterAll(() => { request.destroy() })
function context(values: Record<string, unknown>): Pick<Context, 'get'> {
  return { get: (key: string) => values[key] } as Pick<Context, 'get'>
}

describe('squad deployment identities', () => {
  it('admin retains local browser access only when no account provider has ever been present', async () => {
    // Given a local installation without accounts, When authorization runs, Then the loopback route fence remains authoritative.
    const accounts = new AgentsAccounts(context({}))
    expect(await accounts.allows(request)).toBe(true)
  })

  it('admin requires a live administrator and refuses users, missing identities and revocation', async () => {
    // Given a deployment provider and a live administrator.
    let principal: typeof admin | { source: string; id: string; username: string; role: 'user' } | undefined = admin
    let active = true
    const assertAuthenticated = vi.fn(() => { if (!active) throw new Error('revoked') })
    const accounts = new AgentsAccounts(context({
      requestPrincipal: { authenticate: async () => principal },
      principalAccess: { assertAuthenticated },
    }))
    // When identity or liveness changes, Then only the current administrator reaches the ledger.
    expect(await accounts.allows(request)).toBe(true)
    principal = { ...admin, id: '2', role: 'user' }
    expect(await accounts.allows(request)).toBe(false)
    principal = undefined
    expect(await accounts.allows(request)).toBe(false)
    principal = admin
    active = false
    expect(await accounts.allows(request)).toBe(false)
    expect(assertAuthenticated).toHaveBeenCalledTimes(2)
  })

  it('admin never regains anonymous access after provider disposal', async () => {
    // Given a mounted account provider that has already authenticated the administrator.
    const values: Record<string, unknown> = { requestPrincipal: { authenticate: () => admin }, principalAccess: { assertAuthenticated: () => undefined } }
    const accounts = new AgentsAccounts(context(values))
    expect(await accounts.allows(request)).toBe(true)
    // When both services are disposed, Then the remembered account deployment refuses access.
    delete values.requestPrincipal
    delete values.principalAccess
    expect(await accounts.allows(request)).toBe(false)
  })

  it('admin honors native connection refusal without falling back to a second authenticator', async () => {
    // Given a denied native carrier and a legacy provider that would accept it.
    const authenticate = vi.fn(() => admin)
    const authorizeRequest = vi.fn(async () => ({ accepted: false, principal: admin }))
    const accounts = new AgentsAccounts(context({ connection: { authorizeRequest }, requestPrincipal: { authenticate }, principalAccess: { assertAuthenticated: () => undefined } }))
    // When authorization runs, Then the native refusal cannot be bypassed.
    expect(await accounts.allows(request)).toBe(false)
    expect(authenticate).not.toHaveBeenCalled()
  })
})
