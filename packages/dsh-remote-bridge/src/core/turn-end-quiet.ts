/**
 * When a finished turn may be announced: after the session it belongs to falls
 * quiet, not when the frame arrives.
 *
 * A `turn/end` increment is a fact about one turn and nothing more. The work the
 * user started with it may still be going: the child sessions it delegated to and
 * the background jobs the host still holds under those sessions outlive the turn
 * that started them. A phone told "turn finished" at the frame wakes on a session
 * the roster still badges as running, reads a card that says ended while the work
 * goes on, and is told again by a second turn end it never asked for. §28's
 * notification and §29's card answer the same question — "is this session working
 * right now" — and that question has one answer, the one the client already
 * computes in `SessionRun`: the host's own `agentRunning` for the session, any
 * descendant session still running, and any job the host attributes to either.
 *
 * So a turn end is registered here instead of sent, and sent once the host says
 * the session is quiet. Three rules hold that together:
 *
 * - the answer comes from the host and nowhere else: one `session/list` read for
 *   the running flag and the parent chain, and the host's job registry for the
 *   jobs it attributes to a session. This module invents no timer-based guess and
 *   reads no client state, because a guess that says "quiet" is a lock screen
 *   saying the work finished when it did not;
 * - nothing on the frame path waits: a registration stores five fields and arms a
 *   timer, so a follow stream still publishes its increment at the speed it did
 *   before;
 * - the wait is bounded. At {@link TURN_END_QUIET_MAX_MS} the announcement goes
 *   out anyway and the line it logs names what was still going, because a
 *   notification that never arrives is the failure this channel exists to prevent.
 * @module dsh-remote-bridge/core/turn-end-quiet
 */

import { failureText } from './gateway-errors.ts'
import type { JobRoster } from './jobs.ts'
import type { LiveActivityNotifier } from './liveactivity.ts'
import { pushEventOfTurnEnd, type PushEvent, type PushNotifier } from './push.ts'
import { wireArgs, type BridgeGateway, type GatewayPeer } from './wire.ts'

/** Longest a registered turn end waits for its session to fall quiet, in milliseconds. */
export const TURN_END_QUIET_MAX_MS = 600_000

/**
 * How long a held turn end waits before asking the host again, in milliseconds.
 *
 * A turn end usually finds its session already quiet — the host clears the flag
 * as the turn finishes — so the first question is the one that matters, and five
 * seconds is short enough that the notification a user waits for is not visibly
 * late. The interval is also what bounds how many questions one held turn end can
 * cost: at most one every five seconds, never more than one in flight.
 */
export const TURN_END_QUIET_INTERVAL_MS = 5_000

/** The host's answer about the work one session still holds. */
export interface QuietAnswer {
  /** Whether nothing under this session is still going. */
  readonly quiet: boolean
  /** What was still going when it was not, in one token for the log line. */
  readonly busy?: string
}

/** Whether one session is quiet right now, as the host answers it. */
export type QuietProbe = (sessionId: string) => Promise<QuietAnswer>

export interface TurnEndQuietOptions {
  /** The notification path of §28; absent is a bridge that sends no notification. */
  readonly push?: PushNotifier
  /** The card path of §29; absent for the same reason. */
  readonly liveActivity?: LiveActivityNotifier
  /**
   * The host's own answer, asked off the frame path.
   *
   * Absent is a bridge assembled without one, which cannot tell a quiet session
   * from a busy one and therefore reports at the frame rather than holding
   * anything back.
   */
  readonly probe?: QuietProbe
  readonly now?: () => number
  readonly log?: (message: string) => void
  /** The wait budget; the default is {@link TURN_END_QUIET_MAX_MS}, and a deployment moves it. */
  readonly maxWaitMs?: number
  /** The re-check interval; the default is {@link TURN_END_QUIET_INTERVAL_MS}. */
  readonly intervalMs?: number
}

/** One turn end held until its session is quiet. */
interface Waiting {
  readonly sessionId: string
  /** §28's event, decided when the turn end was registered. */
  event: PushEvent
  /** The host's own reason, kept because §29 decides ended versus failed from it. */
  reason: string
  readonly registeredAt: number
  readonly deadline: number
  /** The question to the host that is armed, if one is. */
  check: NodeJS.Timeout | undefined
  /** The timer that announces at the deadline whatever the answer is then. */
  expiry: NodeJS.Timeout | undefined
  /** Why the last question answered "not quiet". */
  busy: string | undefined
  /** Set while a question is in flight, so one entry never has two out at once. */
  asking: boolean
}

/**
 * The bridge's outbound turn-end path: registration now, announcement when quiet.
 *
 * Deliberately inert when neither channel can send: {@link enabled} is false, no
 * entry is stored and no timer is armed, so a bridge without an Apple signing key
 * behaves — byte for byte, frame for frame — exactly as it did before this module
 * existed, and no host call is ever made on its behalf.
 */
export class TurnEndQuietGate {
  readonly #options: TurnEndQuietOptions
  readonly #now: () => number
  readonly #log: (message: string) => void
  /** Held turn ends by session id; one session has one thing to announce. */
  readonly #waiting = new Map<string, Waiting>()
  #disposed = false

  constructor(options: TurnEndQuietOptions) {
    this.#options = options
    this.#now = options.now ?? (() => Date.now())
    this.#log = options.log ?? (() => undefined)
  }

  /** @returns whether either channel can send, which is the only case a turn end is held at all. */
  get enabled(): boolean {
    if (this.#disposed) return false
    return this.#options.push?.enabled === true || this.#options.liveActivity?.enabled === true
  }

  /** @returns how many turn ends are held right now. */
  get held(): number {
    return this.#waiting.size
  }

  /**
   * Hold one finished turn until its session is quiet, then announce it.
   *
   * Returns at once and never awaits a host read: the caller is a follow stream
   * that has already published its increment.
   * @param sessionId - the session the turn belonged to.
   * @param reason - the host's own reason for ending it.
   */
  noteTurnEnd(sessionId: string, reason: string): void {
    if (!this.enabled) return
    try {
      this.#register(sessionId, reason)
    } catch (error) {
      this.#log(`turn-end for ${sessionId} could not be held: ${failureText(error)}`)
    }
  }

  /**
   * Drop a held turn end because another turn is on.
   *
   * A caller reports this from the evidence it actually has — an increment for the
   * session that is not a turn end — so a turn the bridge cannot see costs the user
   * nothing: the held end is still announced, and the turn that is really running
   * ends with its own report.
   * @param sessionId - the session that started working again.
   */
  noteTurnStarted(sessionId: string): void {
    if (this.#waiting.size === 0) return
    const waiting = this.#waiting.get(sessionId)
    if (waiting === undefined) return
    this.#forget(waiting)
    this.#log(`turn-end dropped session=${sessionId} reason=new-turn`)
  }

  /** Drop every held turn end and every timer. Idempotent. */
  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    for (const waiting of [...this.#waiting.values()]) this.#forget(waiting)
    this.#waiting.clear()
  }

  /** Store one registration, or fold it into the one already held for that session. */
  #register(sessionId: string, reason: string): void {
    const held = this.#waiting.get(sessionId)
    if (held !== undefined) {
      // One session has one thing to announce, so a second turn end replaces what
      // will be said and keeps the deadline the first one registered: a session
      // that keeps ending turns cannot postpone its own announcement for ever.
      held.event = pushEventOfTurnEnd(reason)
      held.reason = reason
      this.#log(`turn-end registered session=${sessionId} event=${held.event} replaces=held`)
      return
    }
    const now = this.#now()
    const waiting: Waiting = {
      sessionId,
      event: pushEventOfTurnEnd(reason),
      reason,
      registeredAt: now,
      deadline: now + Math.max(0, this.#options.maxWaitMs ?? TURN_END_QUIET_MAX_MS),
      check: undefined,
      expiry: undefined,
      busy: undefined,
      asking: false,
    }
    this.#waiting.set(sessionId, waiting)
    if (this.#options.probe === undefined) {
      this.#deliver(waiting)
      return
    }
    this.#log(`turn-end registered session=${sessionId} event=${waiting.event}`)
    const expiry = setTimeout(() => {
      waiting.expiry = undefined
      this.#deliver(waiting, waiting.busy ?? 'unanswered')
    }, Math.max(0, waiting.deadline - now))
    // A notification waiting on work it did not start must never keep the host
    // process alive.
    expiry.unref?.()
    waiting.expiry = expiry
    this.#arm(waiting)
  }

  /** Arm the next question to the host, unless the budget runs out first. */
  #arm(waiting: Waiting): void {
    if (this.#disposed || this.#waiting.get(waiting.sessionId) !== waiting) return
    const remaining = waiting.deadline - this.#now()
    // The expiry timer is what answers a budget that has run out, so no question
    // is armed past it: two timers due in the same millisecond would otherwise
    // turn into a zero-delay loop on a session that never falls quiet.
    if (remaining <= 0) return
    const interval = this.#options.intervalMs ?? TURN_END_QUIET_INTERVAL_MS
    const timer = setTimeout(() => {
      waiting.check = undefined
      this.#check(waiting)
    }, Math.max(0, Math.min(interval, remaining)))
    timer.unref?.()
    waiting.check = timer
  }

  /** Ask the host once whether a held entry's session is quiet. */
  #check(waiting: Waiting): void {
    if (this.#disposed || this.#waiting.get(waiting.sessionId) !== waiting) return
    const probe = this.#options.probe
    if (probe === undefined || waiting.asking) return
    waiting.asking = true
    void Promise.resolve()
      .then(async () => await probe(waiting.sessionId))
      .then((answer) => {
        waiting.asking = false
        if (this.#disposed || this.#waiting.get(waiting.sessionId) !== waiting) return
        if (answer.quiet) {
          this.#deliver(waiting)
          return
        }
        // The reason is kept rather than logged here: a session that is busy for a
        // minute would otherwise write twelve lines saying the same thing, and the
        // one line worth reading is the one the announcement carries.
        waiting.busy = answer.busy ?? 'unstated'
        this.#arm(waiting)
      })
      .catch((error: unknown) => {
        waiting.asking = false
        if (this.#disposed || this.#waiting.get(waiting.sessionId) !== waiting) return
        // An unreadable answer is one line and another try: the host may answer the
        // next one, and the expiry timer bounds how long that can go on.
        waiting.busy = 'unreadable'
        this.#log(`turn-end quiet check failed session=${waiting.sessionId}: ${failureText(error)}`)
        this.#arm(waiting)
      })
  }

  /**
   * Announce one held turn end and forget it.
   *
   * The rate windows are booked inside the two calls below, at this instant: what
   * the channels admit is what they really send, never what was once registered.
   * @param waiting - the entry to announce.
   * @param stillBusy - what kept it waiting, when the budget ran out first.
   */
  #deliver(waiting: Waiting, stillBusy?: string): void {
    this.#forget(waiting)
    const sessionId = waiting.sessionId
    const waited = this.#now() - waiting.registeredAt
    this.#log(stillBusy === undefined
      ? `turn-end quiet session=${sessionId} waited=${waited}ms event=${waiting.event}`
      : `turn-end session=${sessionId} still-busy(${stillBusy}) waited=${waited}ms, announcing anyway`)
    try {
      this.#options.push?.notify(waiting.event, sessionId)
    } catch (error) {
      this.#log(`turn-end ${waiting.event} for ${sessionId} could not be sent: ${failureText(error)}`)
    }
    try {
      // The reason comes from the registration, not from anything read now: §29's
      // ended-versus-failed is a fact about how that turn ended.
      this.#options.liveActivity?.noteTurnEnd(sessionId, waiting.reason)
    } catch (error) {
      this.#log(`turn-end card for ${sessionId} could not be ended: ${failureText(error)}`)
    }
  }

  /** Drop one entry and both of its timers. */
  #forget(waiting: Waiting): void {
    if (waiting.check !== undefined) clearTimeout(waiting.check)
    if (waiting.expiry !== undefined) clearTimeout(waiting.expiry)
    waiting.check = undefined
    waiting.expiry = undefined
    if (this.#waiting.get(waiting.sessionId) === waiting) this.#waiting.delete(waiting.sessionId)
  }
}

/** What {@link sessionQuietProbe} reads the host through. */
export interface SessionQuietProbeOptions {
  /** The host's gateway, the same one every connection speaks through. */
  readonly gateway: BridgeGateway
  /** The in-process owner peer every call of this bridge speaks for. */
  readonly peer: GatewayPeer
  /** The host's job registry, read for the jobs it attributes to a session. */
  readonly jobs: JobRoster
}

/**
 * The host's answer to "is this session quiet", built from its own two facts.
 *
 * The session list is where the running flag and the parent chain come from, and
 * the job registry is where a job's owner and status come from; neither is
 * captured once, because both move while a held turn end waits. A read that cannot
 * be made is thrown rather than answered as quiet: "the host did not answer" and
 * "nothing is running" are different facts, and the caller retries the one and
 * announces the other.
 * @param options - the faces the answer is read through.
 * @returns the probe the gate asks.
 */
export function sessionQuietProbe(options: SessionQuietProbeOptions): QuietProbe {
  return async (sessionId: string): Promise<QuietAnswer> => {
    const value = await options.gateway.invoke({
      namespace: 'session',
      method: 'list',
      args: wireArgs('session', 'list', {}),
      peer: options.peer,
    })
    const items = typeof value === 'object' && value !== null ? (value as { items?: unknown }).items : undefined
    if (!Array.isArray(items)) throw new Error('session/list returned no item table')
    const running = new Set<string>()
    const parents = new Map<string, string>()
    for (const item of items) {
      if (typeof item !== 'object' || item === null) continue
      const row = item as { sessionId?: unknown; running?: unknown; parentSessionId?: unknown }
      if (typeof row.sessionId !== 'string' || row.sessionId === '') continue
      if (row.running === true) running.add(row.sessionId)
      if (typeof row.parentSessionId === 'string' && row.parentSessionId !== '') parents.set(row.sessionId, row.parentSessionId)
    }
    // The host answers `running` for a session's own agent, so a parent reads idle
    // while the work it started goes on: the parent chain is walked here, to any
    // depth, and stops at an id it has already walked so a looping chain ends.
    if (running.has(sessionId)) return { quiet: false, busy: 'session-running' }
    for (const id of running) {
      if (descendsFrom(id, sessionId, parents)) return { quiet: false, busy: `descendant-running(${id})` }
    }
    const family = new Set<string>([sessionId])
    for (const id of parents.keys()) if (descendsFrom(id, sessionId, parents)) family.add(id)
    for (const id of family) {
      const roster = options.jobs.read(id)
      // A host that composes no job registry holds no job this bridge can name,
      // and a scope that cannot be read is not evidence of work either.
      if (roster === undefined) continue
      for (const job of roster.jobs) {
        // Only the jobs the host names an owner for count: an unowned job is not a
        // fact about this session, and spreading it over the roster would be a
        // claim the payload does not support.
        if (job.ownerSessionId === undefined || !family.has(job.ownerSessionId)) continue
        // The host's own projection omits `finishedAt` while a job is live, which
        // is what makes `stopping` count as work in progress and keeps a status
        // this bridge has never heard of from being read as a finished one.
        if (job.finishedAt === undefined) return { quiet: false, busy: `job-live(${job.id})` }
      }
    }
    return { quiet: true }
  }
}

/** @returns whether one session sits under another in the host's own parent chain. */
function descendsFrom(sessionId: string, ancestorId: string, parents: ReadonlyMap<string, string>): boolean {
  const walked = new Set<string>([sessionId])
  let cursor = parents.get(sessionId)
  while (cursor !== undefined && !walked.has(cursor)) {
    if (cursor === ancestorId) return true
    walked.add(cursor)
    cursor = parents.get(cursor)
  }
  return false
}
