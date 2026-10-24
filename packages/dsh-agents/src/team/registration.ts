/** Registration adapters for the rc.2 disposer and rc.3 ready-reader APIs. */

import type { Session } from '@deepseek-ai/dsh-session'
import { teamProjectionDefinition, type TeamProjectionState } from './projection.ts'
import type { TeamServiceFaces } from './services.ts'

/** The Team runtime retains its reader until all pending operations finish. */
export interface TeamProjectionHandle {
  /** Read the current Team state for one live Session. */
  stateOf(session: Session): TeamProjectionState
  /** Release this runtime's projection registration. */
  dispose(): void | Promise<void>
}

/**
 * Acquire the Team reader before publishing runtime consumers.
 * @param faces - the Host services selected for this mount.
 * @returns a ready reader whose disposal releases this registration.
 */
export async function registerTeamProjection(faces: TeamServiceFaces): Promise<TeamProjectionHandle> {
  // Await first: rc.3's transitional runtime value is both callable and
  // awaitable, whereas rc.2 resolves to the original synchronous disposer.
  const registration: (() => void) | TeamProjectionHandle = await faces.sessionProjections.register(teamProjectionDefinition)
  if (typeof registration !== 'function') return registration
  return {
    stateOf(session) {
      // Only the rc.2 registration path uses the registry's typed-key reader.
      // rc.3 removes that type map and always takes the ready handle above.
      const state = faces.sessionProjections.stateOf(session, 'agentTeam') as TeamProjectionState | undefined
      if (state === undefined) throw new Error('Agent Teams projection is not registered')
      return state
    },
    dispose: registration,
  }
}
