/** Administrator authorization for the shared Host squad ledger. */
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage } from 'node:http'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'

/** Identity authenticated by the deployment, never by a draft or browser header. */
interface Principal {
  source: string
  id: string
  username: string
  role: 'admin' | 'user'
}
interface PrincipalProvider {
  authenticate(request: IncomingMessage): Principal | undefined | Promise<Principal | undefined>
}
interface AccessProvider {
  assertAuthenticated(principal: Principal): void
}
interface ConnectionAuthorization {
  authorizeRequest(request: IncomingMessage): Promise<{ accepted: boolean; principal?: Principal }>
}

/** A removed provider must not restore anonymous access to an account deployment. */
export class AgentsAccounts {
  private accountMode = false
  constructor(private readonly ctx: Pick<Context, 'get'>) {}

  /** Wrap one shared-ledger tool with the current deployment administrator check. */
  protectTool(tool: ToolDefinition): ToolDefinition {
    return {
      ...tool,
      execute: async (args, execution) => {
        // Personal Harness dispatch carries its transport-verified principal;
        // the public SDK does not declare this deployment extension.
        const principal = (execution as ToolRunContext & { principal?: Principal }).principal
        if (!this.allowsTool(principal)) return { ok: false, code: 'forbidden', message: 'a currently authenticated administrator is required' }
        return tool.execute(args, execution)
      },
    }
  }

  private observesAccountMode(): boolean {
    this.accountMode ||= this.ctx.get('requestPrincipal', false) !== undefined || this.ctx.get('principalAccess', false) !== undefined
    return this.accountMode
  }

  private allowsTool(principal: Principal | undefined): boolean {
    if (!this.observesAccountMode()) return true
    try {
      const access = this.ctx.get('principalAccess', false) as AccessProvider | undefined
      if (principal?.role !== 'admin' || typeof access?.assertAuthenticated !== 'function') return false
      access.assertAuthenticated(principal)
      return true
    } catch {
      return false
    }
  }

  /** Resolve and validate the current administrator before any ledger access. */
  async allows(request: IncomingMessage): Promise<boolean> {
    if (!this.observesAccountMode()) return true
    try {
      const connection = this.ctx.get('connection', false) as ConnectionAuthorization | undefined
      let principal: Principal | undefined
      if (typeof connection?.authorizeRequest === 'function') {
        const authorization = await connection.authorizeRequest(request)
        if (!authorization.accepted) return false
        principal = authorization.principal
      } else {
        const provider = this.ctx.get('requestPrincipal', false) as PrincipalProvider | undefined
        principal = await provider?.authenticate(request)
      }
      const access = this.ctx.get('principalAccess', false) as AccessProvider | undefined
      if (principal?.role !== 'admin' || typeof access?.assertAuthenticated !== 'function') return false
      access.assertAuthenticated(principal)
      return true
    } catch {
      return false
    }
  }
}
