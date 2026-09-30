import type { Context } from '@deepseek-ai/cordis'
import type { TypertGateway } from '@deepseek-ai/dsh-api-gateway'
import { createServer, type IncomingMessage } from 'node:http'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TaskBoardAccounts, type TaskBoardPrincipal } from '../src/host-accounts.ts'
import { HostTaskLedger } from '../src/host-ledger.ts'
import { HostExecutionRunner } from '../src/host-runner.ts'
import { TaskBoardHostService } from '../src/host-service.ts'
import { GitHubApiClient } from '../src/host/github/client.ts'
import { createTask } from '../src/core/tasks.ts'
import { PowerInhibitor } from '../src/power-inhibitor.ts'
import { parseActionEnvelope } from '../src/protocol.ts'
import { makeTaskBoardRoutes } from '../src/host-routes.ts'

const alice: TaskBoardPrincipal = { source: 'test', id: 'alice', username: 'Alice', role: 'admin' }
const bob: TaskBoardPrincipal = { source: 'test', id: 'bob', username: 'Bob', role: 'admin' }
const roots: string[] = []
const disposers: Array<() => void> = []
function root(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-task-board-accounts-'))
  roots.push(dir)
  return dir
}
function context(values: Record<string, unknown>): Pick<Context, 'get'> {
  return { get: (key: string) => values[key] } as Pick<Context, 'get'>
}
function accountFixture(principal: TaskBoardPrincipal = alice) {
  let active = true
  const assertAuthenticated = vi.fn((candidate: TaskBoardPrincipal) => {
    if (!active || candidate.source !== 'test') throw new Error('account revoked')
  })
  const authorizeRequest = vi.fn(async () => ({ accepted: true, principal }))
  const values: Record<string, unknown> = { principalAccess: { assertAuthenticated }, connection: { authorizeRequest } }
  return { accounts: new TaskBoardAccounts(context(values)), authorizeRequest, values, revoke: () => { active = false } }
}
function ledger(dir = root(), now: () => number = Date.now) {
  const value = new HostTaskLedger(dir, now)
  disposers.push(() => value.dispose())
  return value
}
function input(title = 'Scheduled') { return { title, description: '', prompt: 'keyless fixture' } }
const req = { headers: {} } as IncomingMessage

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('task-board deployment identities', () => {
  it('admin account mode hides shared GitHub credentials and refuses GitHub actions', async () => {
    // Given an authenticated deployment configured with a Host-wide GitHub credential.
    const fixture = accountFixture()
    const fetch = vi.fn(async () => new Response('[]'))
    const host = new TaskBoardHostService({} as TypertGateway, {
      ledger: ledger(), accounts: fixture.accounts,
      githubClient: new GitHubApiClient({ token: 'fixture-token', fetch }),
      githubRepositories: [],
    })
    disposers.push(() => host.dispose())
    // When an administrator reads or refreshes the shared integration.
    expect(host.github).toBeUndefined()
    await expect(host.apply('refresh', { kind: 'github-refresh' }, undefined, alice)).rejects.toThrow('not configured')
    // Then no request uses the server credential, and missing identities still fail first.
    expect(fetch).not.toHaveBeenCalled()
    expect(() => host.apply('anonymous', { kind: 'github-refresh' })).toThrow('administrator')
  })

  it('admin receives task-board access only through current carrier authorization', async () => {
    // Given carrier authorization, when ordinary, absent, revoked or rejected identities request access, then only the active administrator is accepted.
    const fixture = accountFixture()
    expect(await fixture.accounts.request(req)).toEqual(alice)
    expect(fixture.authorizeRequest).toHaveBeenCalledWith(req)
    fixture.revoke()
    await expect(fixture.accounts.request(req)).rejects.toThrow('revoked')
    await expect(accountFixture({ ...alice, role: 'user' }).accounts.request(req)).rejects.toThrow('administrator')
    const noIdentity = new TaskBoardAccounts(context({ principalAccess: { assertAuthenticated: vi.fn() } }))
    await expect(noIdentity.request(req)).rejects.toThrow('administrator')
    fixture.values.connection = { authorizeRequest: async () => ({ accepted: false, principal: alice }) }
    await expect(fixture.accounts.request(req)).rejects.toThrow('administrator')
  })

  it('admin uses signed principals while standalone access remains explicit', async () => {
    // Given Hosts with and without identity providers, when requesting access, then signed principals are accepted and standalone mode refuses asserted identities.
    const authenticate = vi.fn(() => alice)
    const fixture = accountFixture()
    delete fixture.values.connection
    fixture.values.requestPrincipal = { authenticate }
    expect(await fixture.accounts.request(req)).toEqual(alice)
    expect(authenticate).toHaveBeenCalledWith(req)
    const standalone = new TaskBoardAccounts(context({}))
    expect(await standalone.request(req)).toBeUndefined()
    expect(() => standalone.assert(undefined)).not.toThrow()
    expect(() => standalone.assert(alice)).toThrow('administrator')
    await expect(standalone.request(req)).rejects.toThrow('administrator')
    delete fixture.values.principalAccess
    delete fixture.values.requestPrincipal
    await expect(fixture.accounts.request(req)).rejects.toThrow('administrator')
  })

  it('admin retains task ownership across restart without trusting imported identities', () => {
    // Given an account-owned task, when reopening the ledger and importing tasks, then ownership persists privately and foreign mutations or forged identities fail.
    const dir = root()
    const first = ledger(dir)
    first.applyRequest('create-a', { kind: 'create', id: 'a', input: input() }, 'client-asserted-bob', alice)
    expect(JSON.stringify(first.state())).not.toContain('taskPrincipals')
    expect(JSON.parse(readFileSync(first.file, 'utf8')).taskPrincipals.a).toEqual(alice)
    first.dispose()
    const reopened = ledger(dir)
    expect(reopened.taskPrincipal('a')).toEqual(alice)
    expect(() => reopened.applyRequest('bob-run', { kind: 'run', taskId: 'a' }, undefined, bob)).toThrow('another account')
    expect(() => reopened.applyRequest('bob-edit', { kind: 'update', taskId: 'a', patch: { prompt: 'changed' } }, undefined, bob)).toThrow('another account')
    expect(() => reopened.applyRequest('import-owned', { kind: 'import', sourceId: 'wire', tasks: reopened.state().tasks }, undefined, alice)).toThrow('account-owned')
    expect(parseActionEnvelope({ requestId: 'forged', principal: bob, action: { kind: 'run', taskId: 'a' } })).toBeUndefined()
    const imported = parseActionEnvelope({ requestId: 'import', action: { kind: 'import', sourceId: 'legacy', tasks: [{ ...createTask(input(), 1, 'legacy'), principal: bob }] } })!
    reopened.applyRequest(imported.requestId, imported.action, undefined, alice)
    expect(reopened.taskPrincipal('legacy')).toBeUndefined()
    reopened.applyRequest('adopt-schedule', { kind: 'set-schedule', taskId: 'legacy', patch: { enabled: true, cron: '* * * * *' } }, undefined, alice)
    expect(reopened.taskPrincipal('legacy')).toEqual(alice)
  })

  it('admin retains the original ledger when account bindings are malformed', () => {
    // Given a malformed persisted account binding, when loading the ledger, then loading fails and the file remains unchanged.
    const dir = root()
    const first = ledger(dir)
    const file = first.file
    const document = JSON.parse(readFileSync(file, 'utf8'))
    first.dispose()
    document.taskPrincipals = { a: { ...alice, role: 'user' } }
    const bytes = JSON.stringify(document)
    writeFileSync(file, bytes)
    expect(() => new HostTaskLedger(dir)).toThrow('invalid task account binding')
    expect(readFileSync(file, 'utf8')).toBe(bytes)
  })

  it('admin keeps schedule ownership and trigger instants when a v3 ledger gains rule zones', () => {
    // Given a v3 account-owned schedule with a recorded next occurrence.
    const now = Date.UTC(2026, 8, 29, 12)
    const dir = root()
    const first = ledger(dir, () => now)
    first.applyRequest('create', { kind: 'create', id: 'scheduled', input: { ...input(), schedule: { enabled: true, cron: '* * * * *' } } }, undefined, alice)
    const document = JSON.parse(readFileSync(first.file, 'utf8'))
    const nextRunAt = document.tasks[0].schedule.nextRunAt
    document.schemaVersion = 3
    delete document.tasks[0].schedule.timeZone
    first.dispose()
    writeFileSync(first.file, JSON.stringify(document))

    // When the Host migrates the document and a foreign account changes its rule.
    const migrated = ledger(dir, () => now)
    expect(() => migrated.applyRequest('foreign-zone', { kind: 'set-schedule', taskId: 'scheduled', patch: { timeZone: 'UTC' } }, undefined, bob)).toThrow('another account')

    // Then the owner and occurrence survive, and the persisted rule has the Host zone.
    expect(migrated.taskPrincipal('scheduled')).toEqual(alice)
    expect(migrated.state().tasks[0].schedule).toMatchObject({ nextRunAt, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
    expect(JSON.parse(readFileSync(migrated.file, 'utf8')).schemaVersion).toBe(4)
  })

  it('admin uses the same identity throughout task execution and inspection', async () => {
    // Given an authenticated task owner, when launching and inspecting execution, then every gateway request carries that identity and revocation blocks another launch.
    const fixture = accountFixture()
    const calls: Array<{ method: string; principal?: TaskBoardPrincipal }> = []
    const gateway = {
      invoke: vi.fn(async (request: { method: string; principal?: TaskBoardPrincipal }) => {
        expect(request.principal).toEqual(alice)
        calls.push(request)
        if (request.method === 'create') return { sessionId: 'session-a' }
        if (request.method === 'list') return { items: [{ sessionId: 'session-a', running: false }] }
        if (request.method === 'page') return { records: [{ type: 'event', event: { type: 'turn/end', seq: 3, time: 2, data: { reason: { kind: 'completed' } } } }], hasMore: false }
        if (request.method === 'selectModel') return {}
        return {}
      }),
      stream: vi.fn(async (request: { method: string; principal?: TaskBoardPrincipal }) => {
        expect(request.principal).toEqual(alice)
        calls.push(request)
        return { async *[Symbol.asyncIterator]() { yield { type: 'snapshot', cursor: 4, records: [{ type: 'event', event: { type: 'session/title', seq: 4, time: 3, data: {} } }], hasMore: true } } }
      }),
    }
    const execute = vi.fn(async () => ({ kind: 'success' as const }))
    const runner = new HostExecutionRunner(gateway, { execute }, undefined, undefined, p => fixture.accounts.assert(p))
    const task = { ...createTask(input(), 1, 'a'), permission: 'read-only' as const, model: 'fake/model' }
    await expect(runner.launch(task, { principal: alice })).resolves.toBe('session-a')
    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute).toHaveBeenNthCalledWith(1, 'session-a', '/permission read-only', expect.any(AbortSignal))
    expect(execute).toHaveBeenNthCalledWith(2, 'session-a', '/goal ' + task.prompt, expect.any(AbortSignal))
    expect((await runner.listRunning(alice)).known).toBe(true)
    expect(await runner.inspect('session-a', 1, undefined, {}, alice)).toEqual({ outcome: 'succeeded' })
    expect(calls.map(call => call.method)).toEqual(['create', 'rename', 'selectModel', 'prompt', 'list', 'list', 'follow', 'page', 'projections'])
    await expect(runner.launch(task, { principal: alice, reuseSessionId: 'session-a' })).resolves.toBe('session-a')
    expect(calls.slice(-2).map(call => call.method)).toEqual(['selectModel', 'prompt'])
    fixture.revoke()
    await expect(runner.launch(task, { principal: alice })).rejects.toThrow('revoked')
    expect(gateway.invoke).toHaveBeenCalledTimes(10)
  })

  it('admin uses authenticated task routes and loses streams on revocation', async () => {
    // Given account-aware task routes, when actions forge identity or a live stream loses authorization, then forgery fails and the stream closes.
    const fixture = accountFixture()
    const service = new TaskBoardHostService({ invoke: async () => ({ items: [] }) } as unknown as TypertGateway, { ledger: ledger(), accounts: fixture.accounts, power: new PowerInhibitor({ platform: 'linux' }) })
    disposers.push(() => service.dispose())
    const routes = makeTaskBoardRoutes(service, { authenticate: req => fixture.accounts.request(req), assertPrincipal: principal => fixture.accounts.assert(principal) })
    const server = createServer((req, res) => { void routes.find(route => route.path === req.url)?.handler(req, res) })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('test listener unavailable')
    const base = `http://127.0.0.1:${address.port}/api/task-board`
    const headers = { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }
    try {
      const action = { requestId: 'http-create', action: { kind: 'create', id: 'http', input: input() } }
      expect((await fetch(base + '/action', { method: 'POST', headers, body: JSON.stringify({ ...action, principal: bob }) })).status).toBe(400)
      expect((await fetch(base + '/action', { method: 'POST', headers, body: JSON.stringify(action) })).status).toBe(200)
      expect(service.ledger.taskPrincipal('http')).toEqual(alice)
      expect((await fetch(base + '/state', { headers })).status).toBe(200)
      const events = await fetch(base + '/events', { headers })
      expect(events.status).toBe(200)
      const reader = events.body!.getReader()
      expect((await reader.read()).done).toBe(false)
      fixture.revoke()
      // A normal board event rechecks the account before writing another SSE frame.
      service.setConfiguration(true, false)
      expect((await reader.read()).done).toBe(true)
      for (const endpoint of ['state', 'events']) expect((await fetch(base + '/' + endpoint, { headers })).status).toBe(403)
      expect((await fetch(base + '/action', { method: 'POST', headers, body: JSON.stringify(action) })).status).toBe(403)
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  })

  it('admin loses execution access when revoked during session creation', async () => {
    // Given a pending session creation, when authorization is revoked before it resolves, then later rename, permission and prompt operations are refused.
    const fixture = accountFixture()
    const invoke = vi.fn(async () => { fixture.revoke(); return { sessionId: 'session-a' } })
    const execute = vi.fn(async () => ({ kind: 'success' as const }))
    const runner = new HostExecutionRunner({ invoke }, { execute }, undefined, undefined, p => fixture.accounts.assert(p))
    await expect(runner.launch({ ...createTask(input(), 1, 'a'), permission: 'read-only' }, { principal: alice })).rejects.toThrow('revoked')
    expect(invoke).toHaveBeenCalledOnce()
    expect(execute).not.toHaveBeenCalled()
  })

  it('admin runs restored schedules only while their owner remains authorized', async () => {
    // Given persisted owned and unowned schedules, when a due tick runs before and after revocation, then only the authorized owner can execute.
    let now = new Date(2026, 8, 13, 10, 0, 0).getTime()
    const dir = root()
    const first = ledger(dir, () => now)
    first.applyRequest('create', { kind: 'create', id: 'scheduled', input: { ...input(), schedule: { enabled: true, cron: '* * * * *' } } }, undefined, alice)
    first.applyRequest('create-unowned', { kind: 'create', id: 'unowned', input: { ...input(), schedule: { enabled: true, cron: '* * * * *' } } })
    first.dispose()
    const fixture = accountFixture()
    const invoke = vi.fn(async (request: { method: string; principal?: TaskBoardPrincipal }) => {
      expect(request.principal).toEqual(alice)
      if (request.method === 'create') return { sessionId: 'owned-session' }
      if (request.method === 'list') return { items: [{ sessionId: 'owned-session', running: true }] }
      return {}
    })
    let fire: (() => void) | undefined
    const timers = { timeout: (callback: () => void) => { fire = callback; return () => { fire = undefined } }, interval: () => () => {} }
    const service = new TaskBoardHostService({ invoke } as unknown as TypertGateway, { ledger: ledger(dir, () => now), accounts: fixture.accounts, now: () => now, timers, power: new PowerInhibitor({ platform: 'linux' }) })
    disposers.push(() => service.dispose())
    const runtime = service as unknown as { pollSessions(): Promise<void> }
    service.refreshSchedule()
    now += 60_000
    if (fire === undefined) throw new Error('schedule was not armed')
    fire()
    await vi.waitFor(() => expect(service.snapshot().tasks.find(task => task.id === 'scheduled')?.executions[0].sessionId).toBe('owned-session'))
    expect(service.snapshot().tasks.find(task => task.id === 'unowned')?.executions[0].result).toBe('failed')
    expect(invoke.mock.calls.map(([call]) => call.method)).toEqual(['create', 'rename', 'prompt'])
    await runtime.pollSessions()
    expect(service.snapshot().power.sessionStateKnown).toBe(true)
    service.ledger.settle('scheduled', service.snapshot().tasks.find(task => task.id === 'scheduled')!.executions[0].id, 'succeeded')
    fixture.revoke()
    invoke.mockClear()
    now += 60_000
    if (fire === undefined) throw new Error('next occurrence was not armed')
    fire()
    await vi.waitFor(() => expect(service.snapshot().tasks.find(task => task.id === 'scheduled')?.executions.at(-1)?.result).toBe('failed'))
    expect(invoke).not.toHaveBeenCalled()
  })
})


describe('account-owned task cascades', () => {
  it('admin retains the owner on every cascade participant after restart', () => {
    // Given an owned task tree, when the administrator opens a run and reopens the ledger, then every child execution retains the same account.
    const dir = root()
    const first = ledger(dir)
    first.applyRequest('parent', { kind: 'create', id: 'parent', input: input() }, undefined, alice)
    first.applyRequest('child', { kind: 'create', id: 'child', input: { ...input(), parentId: 'parent' } }, undefined, alice)
    expect(() => first.applyRequest('foreign-child', { kind: 'create', id: 'foreign', input: { ...input(), parentId: 'parent' } }, undefined, bob)).toThrow('another account')
    const opened = first.applyRequest('run-tree', { kind: 'run', taskId: 'parent' }, undefined, alice)
    expect(opened.runs?.map(run => run.principal)).toEqual([alice, alice])
    for (const run of opened.runs ?? []) first.attachSession(run.task.id, run.execution.id, 'session-' + run.task.id)
    first.dispose()
    const reopened = ledger(dir)
    expect(reopened.runtimeView().openExecutions.map(run => run.principal)).toEqual([alice, alice])
    expect(reopened.taskPrincipal('child')).toEqual(alice)
    expect(() => reopened.applyRequest('detach-other', { kind: 'set-parent', taskId: 'child', parentId: null }, undefined, bob)).toThrow('another account')
    expect(() => reopened.applyRequest('settle-other', { kind: 'settle', taskId: 'parent' }, undefined, bob)).toThrow('another account')
    reopened.applyRequest('settle-own', { kind: 'settle', taskId: 'parent' }, 'Alice', alice)
    expect(reopened.state().tasks.map(task => task.executions[0].result)).toEqual(['cancelled', 'cancelled'])
  })
})
