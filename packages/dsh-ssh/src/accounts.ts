/** Account-owned SSH stores and connection pools for authenticated gateway deployments. */
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage } from 'node:http'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { SshEngine } from './engine.ts'
import { HostStore, storePath } from './store.ts'
import type { HostPayload, SshHostEntry } from './protocol.ts'

/** Identity supplied by the Host transport or the logged tool execution. */
export interface SshPrincipal {
  source: string
  id: string
  username: string
  role: 'admin' | 'user'
}

/** Deployment authorization and ownership records for importing the legacy shared file. */
export interface SshAccountAccess {
  legacyAliases: string[]
  includeUnownedLegacy: boolean
  claimedLegacyAliases: string[]
}

interface PrincipalAdapter {
  authenticate(request: { headers: IncomingMessage['headers'] }): SshPrincipal | undefined
}
interface AccessProvider {
  sshAccess(principal: SshPrincipal): SshAccountAccess
}

/** Ordinary accounts provide credentials themselves; they cannot borrow Host key files or agents. */
class AccountHostStore extends HostStore {
  constructor(path: string, private readonly restricted: boolean) { super(path) }

  private checkAuth(auth: SshHostEntry['auth'] | undefined): void {
    if (!this.restricted || auth === undefined) return
    if (auth.kind === 'agent' || auth.keyPath !== undefined || auth.agentPath !== undefined) {
      throw new Error('Use a password or paste your private key; server key files and SSH agents are unavailable to this account')
    }
  }

  override find(alias: string): SshHostEntry | undefined {
    const entry = super.find(alias)
    this.checkAuth(entry?.auth)
    return entry
  }

  private checkPayload(payload: Partial<HostPayload>): void {
    this.checkAuth(payload.auth)
    if (payload.proxyJump !== undefined && (!Array.isArray(payload.proxyJump) ||
      payload.proxyJump.some(alias => typeof alias !== 'string' || super.find(alias) === undefined))) {
      throw new Error('Every jump host must be configured in your SSH account')
    }
  }

  override create(payload: HostPayload): SshHostEntry {
    this.checkPayload(payload)
    return super.create(payload)
  }

  override update(alias: string, payload: Partial<HostPayload>): SshHostEntry {
    this.checkPayload(payload)
    return super.update(alias, payload)
  }

  override importFromSshConfig() {
    if (this.restricted) throw new Error('Server SSH config import is available only to administrators')
    return super.importFromSshConfig()
  }
}

/** One scope retains its store and engine; aliases and tunnel ids never select another scope. */
export interface SshAccountScope {
  store: HostStore
  engine: SshEngine
  restricted: boolean
}

/** Resolve the authenticated account on every operation, including calls using a cached engine. */
export class SshAccounts {
  private readonly scopes = new Map<string, SshAccountScope>()
  private readonly principals = new Map<string, SshPrincipal>()
  private readonly permissionTimer: NodeJS.Timeout
  constructor(private readonly ctx: Pick<Context, 'get'>, private readonly legacyPath = storePath()) {
    // Pinned tunnels do not participate in idle eviction. Recheck permission even
    // when the account closes its browser without issuing another request.
    this.permissionTimer = setInterval(() => this.checkPermissions(), 30_000)
    this.permissionTimer.unref()
  }

  request(req: IncomingMessage): SshPrincipal {
    const adapter = this.ctx.get('requestPrincipal', false) as PrincipalAdapter | undefined
    const principal = adapter?.authenticate(req)
    if (principal === undefined) throw new Error('Authenticated SSH account required')
    return principal
  }

  resolve(principal: SshPrincipal | undefined): SshAccountScope {
    if (principal === undefined || principal.source !== 'dsh-passwords' || !/^[1-9][0-9]*$/.test(principal.id)) {
      throw new Error('Authenticated SSH account required')
    }
    const provider = this.ctx.get('principalAccess', false) as AccessProvider | undefined
    if (typeof provider?.sshAccess !== 'function') throw new Error('SSH account authorization is unavailable')
    const key = createHash('sha256').update(principal.source + ':' + principal.id).digest('hex')
    let access: SshAccountAccess
    try { access = provider.sshAccess(principal) } catch (error) {
      this.scopes.get(key)?.engine.dispose()
      this.scopes.delete(key)
      this.principals.delete(key)
      throw error
    }
    let scope = this.scopes.get(key)
    const restricted = principal.role !== 'admin'
    if (scope !== undefined && scope.restricted !== restricted) {
      scope.engine.dispose()
      this.scopes.delete(key)
      scope = undefined
    }
    if (scope === undefined) {
      const path = join(dirname(this.legacyPath), 'dsh-ssh-accounts', key, 'hosts.json')
      if (!existsSync(path)) {
        // A single Host owns this directory. Publish even an empty migration so deleted
        // connections cannot be resurrected from the preserved legacy backup.
        const legacy = existsSync(this.legacyPath)
          ? JSON.parse(readFileSync(this.legacyPath, 'utf8')) as { version: number; hosts: SshHostEntry[] }
          : { version: 1, hosts: [] }
        if (legacy.version !== 1 || !Array.isArray(legacy.hosts)) throw new Error('Invalid legacy SSH store')
        const owned = new Set(access.legacyAliases)
        const claimed = new Set(access.claimedLegacyAliases)
        const hosts = legacy.hosts.filter(host => owned.has(host.alias) || (access.includeUnownedLegacy && !claimed.has(host.alias)))
        mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
        writeFileSync(path + '.migrating', JSON.stringify({ version: 1, hosts }) + '\n', { mode: 0o600 })
        renameSync(path + '.migrating', path)
      }
      const store = new AccountHostStore(path, restricted)
      scope = { store, engine: new SshEngine(store), restricted }
      this.scopes.set(key, scope)
      this.principals.set(key, principal)
    }
    return scope
  }

  /** Close pooled connections and tunnels belonging to accounts whose access was revoked. */
  checkPermissions(): void {
    for (const [key, principal] of this.principals) {
      try { this.resolve(principal) } catch {
        // Failed authorization or an unavailable provider cannot retain a live tunnel.
        this.scopes.get(key)?.engine.dispose()
        this.scopes.delete(key)
        this.principals.delete(key)
      }
    }
  }

  /** Drop live account resources when the plugin or account mode is disabled. */
  clear(): void {
    for (const scope of this.scopes.values()) scope.engine.dispose()
    this.scopes.clear()
    this.principals.clear()
  }

  dispose(): void {
    clearInterval(this.permissionTimer)
    this.clear()
  }
}
