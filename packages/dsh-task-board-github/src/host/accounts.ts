/** Shared GitHub configuration is unavailable while the host requires account isolation. */
import type { Context } from '@deepseek-ai/cordis'
import { GitHubSetupError } from './setup.ts'

/** Remember account mode after provider unload so absence never restores shared access. */
export class GitHubAccountAccess {
  private accountMode = false
  constructor(private readonly ctx: Pick<Context, 'get'>) {}

  /** Whether the deployment has enabled authenticated account services. */
  required(): boolean {
    this.accountMode ||= this.ctx.get('requestPrincipal', false) !== undefined || this.ctx.get('principalAccess', false) !== undefined
    return this.accountMode
  }

  /** Refuse shared credentials before a read, remote request or settings mutation. */
  assertSharedAccess(): void {
    if (this.required()) throw new GitHubSetupError(403, 'account-isolation-required', 'Shared GitHub configuration is unavailable in account-isolated deployments')
  }
}
