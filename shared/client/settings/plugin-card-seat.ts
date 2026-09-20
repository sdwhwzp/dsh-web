/**
 * Family settings cards follow the loaded Web UI group. Without that group,
 * alpha.2 hosts expose bundle-row configuration and older hosts expose the
 * namespace-keyed settings card. Registration waits for the selected slot.
 */
import { createElement, type ComponentType } from 'react'

/** The family list seat key. */
export const FAMILY_PLUGIN_CARD_SEAT = 'web-ui.plugin.item'

/** The official keyed plugin-card seat key. */
export const OFFICIAL_PLUGIN_CARD_SEAT = 'settings.plugin.item'

/** Bundle-row configuration slot on alpha.2 hosts. */
export const PLUGIN_ROW_CONFIG_SEAT = 'plugins.row.config'

/** The service dsh-web-settings publishes while it is loaded. */
export const FAMILY_GROUP_SERVICE = 'webUiSettings'

/** The slot-registry member this helper uses (structurally satisfied by ctx.slots). */
export interface PluginCardSlots {
  /** Contribution of one card entry. */
  register(options: never, component: never): unknown
  /** Slot declaration lookup; older lightweight contexts may omit it. */
  spec?(name: never): unknown
}

/** The slice of the client context a card contribution needs. */
export interface PluginCardContext {
  slots: PluginCardSlots
  /** Service lookup; absent on a context double that only models the slots. */
  get?(name: string): unknown
  /** Event subscription seat; absent on an event-less test double. */
  on?(event: string, listener: (...args: never[]) => void): unknown
}

/** Owner share of a plugin card (both seats supply nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}

/** One family plugin's card contribution. */
export interface PluginCardSeat {
  /** Settings namespace the card edits (the official seat's dispatch key). */
  namespace: string
  /** Bundle package and row keys for standalone and aggregate installations. */
  configKeys: readonly string[]
  /** Family list-seat entry id. */
  id: string
  /** Family list-seat sort order. */
  order?: number
  /** Family list-seat display label; the official keyed seat carries none. */
  label?: () => string
  /** Locale namespace the card renders with. */
  locale: string
  /** Business-face factory of the registration. */
  inject?: () => object
  /**
   * The card component. Its props type is the seat's composed shape, which is
   * chosen at runtime, so the helper takes it erased; the registrant keeps its
   * own precise typing at the call site.
   */
  component: unknown
}

/**
 * Whether the family group (dsh-web-settings) is loaded in this page. The
 * service is the group package's own contract, so the probe cannot be fooled
 * by a harness release that starts declaring the official seat differently.
 */
export function familyGroupLoaded(ctx: PluginCardContext): boolean {
  const get = ctx.get
  if (typeof get !== 'function') return false
  try {
    return get.call(ctx, FAMILY_GROUP_SERVICE) !== undefined
  } catch {
    // A context that refuses the lookup: treat the group as absent, which
    // falls back to the official seat the harness declares.
    return false
  }
}

/** Report a refused registration instead of leaving the user with no card. */
function warnRefusedSeat(seat: string, error: unknown): void {
  try {
    console.warn(`[dsh-web] plugin card registration into "${seat}" was refused; the card will not render`, error)
  } catch {
    // Best-effort console write; a failed warning must not break the plugin.
  }
}

/**
 * Contribute one family plugin card to the seat this host renders, following
 * the group if it loads later. The entry is disposed and re-registered on a
 * seat change, never duplicated.
 * @param ctx - client context (its slot registry decides the seat).
 * @param seat - the card contribution.
 */
export function installPluginCard(ctx: PluginCardContext, seat: PluginCardSeat): void {
  const slots = ctx.slots
  const component = seat.component as never
  const inject = seat.inject as never
  const pageComponent = (props: Record<string, unknown>) => props.view === 'summary'
    ? null
    : createElement(seat.component as ComponentType<Record<string, unknown>>, props)
  const declared = (name: string): boolean => slots.spec === undefined || slots.spec(name as never) !== undefined
  const targetSeat = (): string | undefined => {
    if (familyGroupLoaded(ctx)) return declared(FAMILY_PLUGIN_CARD_SEAT) ? FAMILY_PLUGIN_CARD_SEAT : undefined
    if (slots.spec !== undefined && declared(PLUGIN_ROW_CONFIG_SEAT)) return PLUGIN_ROW_CONFIG_SEAT
    return declared(OFFICIAL_PLUGIN_CARD_SEAT) ? OFFICIAL_PLUGIN_CARD_SEAT : undefined
  }

  let dispose: (() => void) | undefined
  let current: string | undefined
  /**
   * Re-entrancy latch. The registry emits a change event synchronously from
   * inside both `register` and the previous entry's disposer, so an unguarded
   * reconcile would re-enter itself mid-move and register the card twice into
   * the seat it is leaving ("already has an entry for key ...").
   */
  let reconciling = false

  /** Reconcile the contribution with the currently live seat (no-op when unchanged). */
  const reconcile = (): void => {
    if (reconciling) return
    const target = targetSeat()
    if (current === target) return
    reconciling = true
    const previous = dispose
    dispose = undefined
    current = undefined
    const nextDisposers: Array<() => void> = []
    try {
      previous?.()
      if (target === undefined) return
      if (target === PLUGIN_ROW_CONFIG_SEAT) {
        for (const key of seat.configKeys) {
          nextDisposers.push(slots.register({
            name: PLUGIN_ROW_CONFIG_SEAT,
            key,
            locale: seat.locale,
            ...(seat.inject === undefined ? {} : { inject }),
          } as never, pageComponent as never) as () => void)
        }
        dispose = () => { for (const off of nextDisposers) off() }
      } else dispose = slots.register((target === FAMILY_PLUGIN_CARD_SEAT
        ? {
          name: FAMILY_PLUGIN_CARD_SEAT,
          id: seat.id,
          ...(seat.order === undefined ? {} : { order: seat.order }),
          ...(seat.label === undefined ? {} : { label: seat.label }),
          locale: seat.locale,
          ...(seat.inject === undefined ? {} : { inject }),
        }
        : {
          name: OFFICIAL_PLUGIN_CARD_SEAT,
          key: seat.namespace,
          locale: seat.locale,
          ...(seat.inject === undefined ? {} : { inject }),
        }) as never, component) as () => void
      current = target
    } catch (error) {
      for (const off of nextDisposers) off()
      if (target !== undefined) warnRefusedSeat(target, error)
    } finally {
      reconciling = false
    }
  }

  if (typeof ctx.on === 'function') {
    try {
      ctx.on('slots/changed', () => { reconcile() })
    } catch {
      // An event seat that refuses the subscription leaves the initial
      // decision in place; the card still renders in the seat chosen below.
    }
  }
  // A later slot declaration or group activation retries an unavailable seat.
  reconcile()
}
