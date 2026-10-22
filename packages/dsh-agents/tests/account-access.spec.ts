/** Account fences for the administrator-owned squad ledger. */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import { AGENTS_TOOL_NAMES } from '../src/host/agent-tools.ts'
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

  it('admin cannot regain anonymous routes when providers disappear before the first request', async () => {
    // Given account services present when the route guard mounts.
    const values: Record<string, unknown> = { requestPrincipal: { authenticate: () => admin }, principalAccess: { assertAuthenticated: () => undefined } }
    const accounts = new AgentsAccounts(context(values))
    // When both services disappear before any request, Then the deployment still refuses access.
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

/** A tool double records whether authorization reached the ledger-owning body. */
function definition(name: string, execute: () => Promise<{ ok: boolean }>): ToolDefinition {
  return defineTool({ name, description: 'Account authorization fixture', parameters: {}, output: { schema: { type: 'json' }, render: () => [] }, execute })
}

/** The same registered definition must re-check identity on every execution. */
describe('squad tool deployment identities', () => {
  it('operator keeps the source tool behavior without account services', async () => {
    // Given a local Host with no account deployment.
    const execute = vi.fn(async () => ({ ok: true }))
    const tool = definition('squads_list', execute)
    const guarded = new AgentsAccounts(context({})).protectTool(tool)
    // When a local call carries no principal, Then it reaches its owning tool.
    expect(await guarded.execute({}, {} as never)).toEqual({ ok: true })
    expect(execute).toHaveBeenCalledOnce()
  })

  it.each(AGENTS_TOOL_NAMES)(
    'user invoking %s needs a current administrator before reaching the ledger', async name => {
      // Given a shared-ledger definition and a live account provider.
      let active = true
      const execute = vi.fn(async () => ({ ok: true }))
      const values: Record<string, unknown> = {
        requestPrincipal: {},
        principalAccess: { assertAuthenticated: (principal: typeof admin) => {
          if (!active || principal.id !== admin.id || principal.username !== admin.username) throw new Error('revoked or forged')
        } },
      }
      const guarded = new AgentsAccounts(context(values)).protectTool(definition(name, execute))
      const call = (principal?: typeof admin | { source: string; id: string; username: string; role: 'user' }) => guarded.execute({ principal: admin }, { principal } as never)
      // When the call has no identity, an ordinary account or forged identity, Then no owner runs.
      expect(await call()).toMatchObject({ ok: false, code: 'forbidden' })
      expect(await call({ ...admin, role: 'user' })).toMatchObject({ ok: false, code: 'forbidden' })
      expect(await call({ ...admin, username: 'forged' })).toMatchObject({ ok: false, code: 'forbidden' })
      expect(execute).not.toHaveBeenCalled()
      // When a live administrator calls, Then only that call reaches the ledger.
      expect(await call(admin)).toEqual({ ok: true })
      expect(execute).toHaveBeenCalledOnce()
      // When it is revoked and providers later disappear, Then neither state restores access.
      active = false
      expect(await call(admin)).toMatchObject({ ok: false, code: 'forbidden' })
      delete values.requestPrincipal
      delete values.principalAccess
      expect(await call(admin)).toMatchObject({ ok: false, code: 'forbidden' })
      expect(execute).toHaveBeenCalledOnce()
    },
  )
})
