/** Real route and SSH operations stay in the authenticated account's store and pool. */
import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { SshAccounts, type SshPrincipal } from '../src/accounts.ts'
import { makeAccountRoutes } from '../src/account-routes.ts'
import { HostStore } from '../src/store.ts'
import { SshEngine } from '../src/engine.ts'
import { sshListTool } from '../src/tools.ts'
import { TestSshServer, TEST_USER, TEST_PASSWORD } from './helpers/ssh-server.ts'

const dir = mkdtempSync(join(tmpdir(), 'dsh-ssh-accounts-'))
const legacy = new HostStore(join(dir, 'dsh-ssh.json'))
const localEngine = new SshEngine(legacy)
const alice: SshPrincipal = { source: 'dsh-passwords', id: '2', username: 'alice', role: 'user' }
const bob: SshPrincipal = { ...alice, id: '3', username: 'bob' }
const admin: SshPrincipal = { ...alice, id: '1', username: 'admin', role: 'admin' }
const denied = new Set<string>()
const context = {
  get(name: string) {
    if (name === 'requestPrincipal') return { authenticate: (req: IncomingMessage) => {
      if (req.headers['test-user'] === 'alice') return alice
      if (req.headers['test-user'] === 'bob') return bob
      if (req.headers['test-user'] === 'admin') return admin
      return undefined
    } }
    if (name === 'principalAccess') return { sshAccess: (principal: SshPrincipal) => {
      if (denied.has(principal.id)) throw new Error('SSH permission revoked')
      return { legacyAliases: principal.id === alice.id ? ['legacy-alice'] : [],
        includeUnownedLegacy: principal.id === admin.id, claimedLegacyAliases: ['legacy-alice'] }
    } }
    return undefined
  },
}
const accounts = new SshAccounts(context as never, legacy.path)
let isolated = true
const routeSet = makeAccountRoutes(accounts, { store: legacy, engine: localEngine, stagingDir: join(dir, 'staging') }, () => isolated)
const server = createServer((req, res) => {
  const route = routeSet.routes.find(row => row.path === new URL(req.url!, 'http://localhost').pathname)
  if (route === undefined) { res.writeHead(404); res.end(); return }
  void route.handler(req, res)
})
let url: string
let ssh: TestSshServer

beforeAll(async () => {
  ssh = await TestSshServer.start()
  const payload = { host: '127.0.0.1', port: ssh.port, user: TEST_USER, auth: { kind: 'password' as const, password: TEST_PASSWORD } }
  legacy.create({ ...payload, alias: 'legacy-alice' })
  legacy.create({ ...payload, alias: 'legacy-admin' })
  await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve) })
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  accounts.dispose()
  localEngine.dispose()
  server.closeAllConnections()
  await new Promise<void>(resolve => { server.close(() => resolve()) })
  await ssh.stop()
  rmSync(dir, { recursive: true, force: true })
})

async function request(user: string, path: string, method = 'GET', body?: unknown) {
  const res = await fetch(url + '/api/dsh-ssh/' + path, { method,
    headers: { 'test-user': user, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { status: res.status, body: await res.json() }
}

it('migrates only owned legacy entries, retains the backup, and requires identity', async () => {
  expect((await request('alice', 'hosts')).body.hosts.map((x: { alias: string }) => x.alias)).toEqual(['legacy-alice'])
  expect((await request('bob', 'hosts')).body.hosts).toEqual([])
  expect((await request('admin', 'hosts')).body.hosts.map((x: { alias: string }) => x.alias)).toEqual(['legacy-admin'])
  expect(legacy.list()).toHaveLength(2)
  expect((await request('unknown', 'hosts')).status).toBe(403)
  expect(() => accounts.resolve(undefined)).toThrow('Authenticated')
})

it('allows duplicate aliases, edit and delete without changing another account', async () => {
  for (const user of ['alice', 'bob']) {
    expect((await request(user, 'hosts', 'POST', { alias: 'prod', host: '127.0.0.1', port: ssh.port,
      user: TEST_USER, auth: { kind: 'password', password: TEST_PASSWORD } })).status).toBe(201)
  }
  expect((await request('alice', 'hosts?alias=prod', 'PATCH', { description: 'Alice only' })).status).toBe(200)
  expect(accounts.resolve(bob).store.find('prod')?.description).toBeUndefined()
  expect((await request('alice', 'hosts?alias=prod', 'DELETE')).status).toBe(200)
  expect(accounts.resolve(bob).store.find('prod')).toBeDefined()
  const foreign = await request('bob', 'exec', 'POST', { alias: 'legacy-alice', command: 'echo hello' })
  expect(foreign.status).toBe(500)
  expect(foreign.body.error).toContain('legacy-alice')
})

it('rejects Host credentials and foreign jump hosts even through direct mutations', async () => {
  const store = accounts.resolve(bob).store
  for (const auth of [{ kind: 'agent' }, { kind: 'key', keyPath: '/home/admin/.ssh/id_ed25519' }]) {
    expect((await request('bob', 'hosts', 'POST', { alias: 'unsafe', host: 'example.com', user: 'root', auth })).status).toBe(400)
  }
  expect(() => store.update('prod', { proxyJump: ['legacy-alice'] })).toThrow('your SSH account')
  expect(() => store.update('prod', { proxyCommand: 'sh -c whoami' })).toThrow('only to administrators')
  expect((await request('bob', 'hosts', 'POST', { alias: 'unsafe-proxy', host: 'example.com', user: 'root',
    auth: { kind: 'password', password: 'owned' }, proxyCommand: 'sh -c whoami' })).status).toBe(400)
  expect((await request('bob', 'hosts/import-ssh-config', 'POST', {})).status).toBe(500)
  expect((await request('bob', 'hosts')).body.capabilities).toEqual({ accountScoped: true, serverCredentials: false })
})

it('authenticates a supplied private key without exposing it in list or create responses', async () => {
  const privateKey = readFileSync(ssh.keyPair.privateKey, 'utf8')
  const created = await request('bob', 'hosts', 'POST', { alias: 'key-host', host: '127.0.0.1', port: ssh.port,
    user: TEST_USER, auth: { kind: 'key', privateKey } })
  expect(created.status).toBe(201)
  expect(JSON.stringify(created.body)).not.toContain('PRIVATE KEY')
  const result = await request('bob', 'exec', 'POST', { alias: 'key-host', command: 'echo hello' })
  expect(result.body.result.stdout).toBe('hello\n')
  expect((statSync(accounts.resolve(bob).store.path).mode & 0o777)).toBe(0o600)
})

it('rejects persisted local commands and missing jumps before opening an account connection', async () => {
  const store = accounts.resolve(bob).store
  const payload = { host: '127.0.0.1', port: ssh.port, user: TEST_USER,
    auth: { kind: 'password' as const, password: TEST_PASSWORD } }
  const raw = new HostStore(store.path)
  raw.create({ ...payload, alias: 'blocked-proxy', proxyCommand: 'sh -c whoami' })
  store.create({ ...payload, alias: 'temporary-jump' })
  store.create({ ...payload, alias: 'dependent-host', proxyJump: ['temporary-jump'] })
  try {
    expect(store.list().some(host => host.alias === 'blocked-proxy')).toBe(true)
    expect(() => store.find('blocked-proxy')).toThrow('only to administrators')
    store.update('blocked-proxy', { proxyCommand: '' })
    expect(store.find('blocked-proxy')?.proxyCommand).toBeUndefined()
    store.delete('temporary-jump')
    expect(() => store.find('dependent-host')).toThrow('your SSH account')
    const result = await request('bob', 'exec', 'POST', { alias: 'dependent-host', command: 'echo hello' })
    expect(result.body.error).toContain('your SSH account')
  } finally {
    store.delete('blocked-proxy')
    store.delete('dependent-host')
  }
  const adminStore = accounts.resolve(admin).store
  adminStore.create({ ...payload, alias: 'admin-proxy', proxyCommand: 'sh -c whoami' })
  adminStore.create({ ...payload, alias: 'admin-jump', proxyJump: ['root@example.com:2222'] })
  try {
    expect(adminStore.find('admin-proxy')?.proxyCommand).toBe('sh -c whoami')
    expect(adminStore.find('admin-jump')?.proxyJump).toEqual(['root@example.com:2222'])
  } finally {
    adminStore.delete('admin-proxy')
    adminStore.delete('admin-jump')
  }
})

it('keeps tunnels and cluster selectors within one engine', async () => {
  const opened = await request('alice', 'tunnel', 'POST', { action: 'start', alias: 'legacy-alice', remotePort: ssh.echoPort })
  expect(opened.status).toBe(200)
  const id = opened.body.tunnel.id
  expect((await request('bob', 'tunnel', 'POST', { action: 'list' })).body.tunnels).toEqual([])
  expect((await request('bob', 'tunnel', 'POST', { action: 'stop', tunnelId: id })).body.ok).toBe(false)
  expect(accounts.resolve(alice).engine.listTunnels()).toHaveLength(1)
  const result = await request('bob', 'cluster', 'POST', { environment: 'missing', command: 'echo hello' })
  expect(result.body.results).toEqual([])
  const aliceEngine = accounts.resolve(alice).engine
  denied.add(alice.id)
  accounts.checkPermissions()
  expect(aliceEngine.listTunnels()).toEqual([])
  denied.delete(alice.id)
})

it('rechecks permissions for cached routes and tool engines and preserves deleted hosts after restart', async () => {
  const tool = sshListTool(exec => accounts.resolve((exec as unknown as { principal?: SshPrincipal }).principal).engine)
  const listed = await tool.execute({}, { principal: bob } as never) as { hosts: { alias: string }[] }
  expect(listed.hosts.map(x => x.alias)).toEqual(['prod', 'key-host'])
  denied.add(bob.id)
  expect((await request('bob', 'hosts')).status).toBe(403)
  await expect(tool.execute({}, { principal: bob } as never)).rejects.toThrow('revoked')
  await expect(tool.execute({}, {} as never)).rejects.toThrow('Authenticated')
  denied.delete(bob.id)
  accounts.resolve(alice).store.delete('legacy-alice')
  const restarted = new SshAccounts(context as never, legacy.path)
  try { expect(restarted.resolve(alice).store.list()).toEqual([]) } finally { restarted.dispose() }
})

it('rejects gateway identity assertions when account isolation is disabled', async () => {
  isolated = false
  try {
    const res = await fetch(url + '/api/dsh-ssh/hosts', { headers: { 'x-dsh-principal': 'claimed' } })
    expect(res.status).toBe(403)
    expect(await res.text()).not.toContain('legacy-admin')
  } finally { isolated = true }
})
