/** Ready-reader activation and disposal across asynchronous projection registration. */
import { describe, expect, it, vi } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { TeamService } from '../src/team/index.ts'
import { emptyTeamState } from '../src/team/projection.ts'
import type { ProjectionHandle } from '@deepseek-ai/dsh-session-projection'
import type { TeamProjectionState } from '../src/team/projection.ts'
import { createTeamHarness } from './team-harness.ts'

function deferredRegistration() {
  let resolve!: (handle: ProjectionHandle<TeamProjectionState>) => void
  let reject!: (error: Error) => void
  const pending = new Promise<ProjectionHandle<TeamProjectionState>>((yes, no) => { resolve = yes; reject = no })
  const stateOf = vi.fn<ProjectionHandle<TeamProjectionState>['stateOf']>(session => emptyTeamState(session.header.id))
  const handle: ProjectionHandle<TeamProjectionState> = {
    stateOf,
    readerFor: session => () => stateOf(session),
    dispose: async () => undefined,
  }
  return { pending, resolve: () => { resolve(handle) }, reject, stateOf }
}

describe('Team projection activation', () => {
  it('operator waits for the ready reader before scanning live Agents', async () => {
    // Given a delayed Host registration, When it becomes ready and then unloads, Then Team reads use its retained reader and release it once.
    const registration = deferredRegistration()
    let scans = 0
    const harness = createTeamHarness(() => registration.pending, () => { scans += 1 })
    const agents = harness.ctx.get('agents')
    if (agents === undefined) throw new Error('test Host did not provide agents')
    harness.createAgent('async-lead')
    const lead = agents.get(brandString<SessionId>('async-lead'))
    if (lead === undefined) throw new Error('test Host did not publish the Lead')
    const pending = TeamService.create(harness.ctx)
    let ready = false
    void pending.then(() => { ready = true })
    await Promise.resolve()
    expect(ready).toBe(false)
    expect(scans).toBe(0)

    registration.resolve()
    const runtime = await pending
    expect(scans).toBe(1)
    expect(runtime.listTasks(lead)).toEqual([])
    expect(registration.stateOf).toHaveBeenCalled()
    await harness.ctx.fiber.dispose()
  })

  it('operator unloads while registration is pending without activating the runtime', async () => {
    // Given a pending registration, When unloading starts before it resolves, Then the runtime stays inactive and releases its registration.
    const registration = deferredRegistration()
    const harness = createTeamHarness(() => registration.pending)
    const pending = TeamService.create(harness.ctx)
    const refused = expect(pending).rejects.toThrow()
    const unloading = harness.ctx.fiber.dispose()
    registration.resolve()
    await Promise.all([refused, unloading])
  })

  it('operator sees registration failure before any Agent recovery', async () => {
    // Given an unavailable projection registry, When activation rejects, Then the caller receives that failure without an Agent scan.
    const registration = deferredRegistration()
    let scans = 0
    const harness = createTeamHarness(() => registration.pending, () => { scans += 1 })
    const agents = harness.ctx.get('agents')
    if (agents === undefined) throw new Error('test Host did not provide agents')
    const pending = TeamService.create(harness.ctx)
    const refused = expect(pending).rejects.toThrow('projection unavailable')
    registration.reject(new Error('projection unavailable'))
    await refused
    expect(scans).toBe(0)
    await harness.ctx.fiber.dispose()
  })
})
