/** Ready-reader activation and disposal across asynchronous projection registration. */
import { describe, expect, it, vi } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { TeamService } from '../src/team/index.ts'
import { emptyTeamState } from '../src/team/projection.ts'
import type { TeamProjectionHandle } from '../src/team/registration.ts'
import { createTeamHarness } from './team-harness.ts'

function deferredRegistration() {
  let resolve!: (handle: TeamProjectionHandle) => void
  let reject!: (error: Error) => void
  const pending = new Promise<TeamProjectionHandle>((yes, no) => { resolve = yes; reject = no })
  const dispose = vi.fn(async () => undefined)
  const stateOf = vi.fn<TeamProjectionHandle['stateOf']>(session => emptyTeamState(session.header.id))
  const handle: TeamProjectionHandle = { stateOf, dispose }
  return { pending, resolve: () => { resolve(handle) }, reject, dispose, stateOf }
}

describe('Team projection activation', () => {
  it('operator waits for the ready reader before scanning live Agents, then releases it on unload', async () => {
    // Given a delayed Host registration, When it becomes ready and then unloads, Then Team reads use its retained reader and release it once.
    const registration = deferredRegistration()
    let scans = 0
    const harness = createTeamHarness(() => registration.pending, () => { scans += 1 })
    const agents = harness.ctx.get('agents')
    if (agents === undefined) throw new Error('test Host did not provide agents')
    harness.createAgent('async-lead')
    const lead = agents.get(brandString<SessionId>('async-lead'))
    if (lead === undefined) throw new Error('test Host did not publish the Lead')
    const runtime = new TeamService(harness.ctx)
    let ready = false
    void runtime.ready.then(value => { ready = value; return undefined })
    await Promise.resolve()
    expect(ready).toBe(false)
    expect(scans).toBe(0)

    registration.resolve()
    await runtime.ready
    expect(scans).toBe(1)
    expect(runtime.listTasks(lead)).toEqual([])
    expect(registration.stateOf).toHaveBeenCalled()
    expect(registration.dispose).not.toHaveBeenCalled()
    await harness.ctx.fiber.dispose()
    expect(registration.dispose).toHaveBeenCalledTimes(1)
  })

  it('operator unloads while registration is pending without activating the runtime', async () => {
    // Given a pending registration, When unloading starts before it resolves, Then the runtime stays inactive and releases its registration.
    const registration = deferredRegistration()
    const harness = createTeamHarness(() => registration.pending)
    const runtime = new TeamService(harness.ctx)
    const unloading = harness.ctx.fiber.dispose()
    registration.resolve()
    const [ready] = await Promise.all([runtime.ready, unloading])
    expect(ready).toBe(false)
    expect(registration.dispose).toHaveBeenCalledTimes(1)
  })

  it('operator sees registration failure before any Agent recovery', async () => {
    // Given an unavailable projection registry, When activation rejects, Then the caller receives that failure without an Agent scan.
    const registration = deferredRegistration()
    let scans = 0
    const harness = createTeamHarness(() => registration.pending, () => { scans += 1 })
    const agents = harness.ctx.get('agents')
    if (agents === undefined) throw new Error('test Host did not provide agents')
    const runtime = new TeamService(harness.ctx)
    const refused = expect(runtime.ready).rejects.toThrow('projection unavailable')
    registration.reject(new Error('projection unavailable'))
    await refused
    expect(scans).toBe(0)
    expect(registration.dispose).not.toHaveBeenCalled()
    await harness.ctx.fiber.dispose()
  })
})
