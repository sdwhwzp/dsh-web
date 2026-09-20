/**
 * The Session the GUI currently displays, read from the Client sessions list
 * across harness lines. Harness 0.1.5-rc.1 through 0.1.6-alpha.1 publish it as
 * `SessionListState.current`; 0.1.6-alpha.2 removed that field and the
 * navigation owner (`uiWorkspace`) instead retains the displayed Session with
 * the `mainView` reference source, which the list mirrors per row in
 * `SessionSummary.retainedBy`. Both readings are taken at runtime so a
 * package's type program compiles against either SDK cohort — the two row
 * types share no declared property, which a typed `byId` would reject.
 */

/** The list-snapshot fields the current-selection lookup reads. */
export interface CurrentSessionListSnapshot {
  /** Pre-alpha.2 selection field; absent on 0.1.6-alpha.2 and later. */
  readonly current?: string | undefined
  /** Catalog rows; `retainedBy.mainView` marks the displayed Session on 0.1.6-alpha.2 and later. */
  readonly byId?: unknown
}

/** Narrow one value to an index-readable object, or undefined for anything else. */
function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined
}

/**
 * Resolve the displayed Session id from one sessions-list snapshot.
 * @param list - the `ctx.sessions.list` snapshot, or undefined when the service is unavailable.
 * @returns the displayed Session id, or undefined when no Session is displayed.
 */
export function currentSessionIdOf(list: CurrentSessionListSnapshot | undefined): string | undefined {
  if (list === undefined) return undefined
  if (list.current !== undefined) return String(list.current)
  const rows = recordOf(list.byId)
  if (rows === undefined) return undefined
  for (const id of Object.keys(rows)) {
    const mainView = recordOf(recordOf(rows[id])?.retainedBy)?.mainView
    if (typeof mainView === 'number' && mainView > 0) return id
  }
  return undefined
}
