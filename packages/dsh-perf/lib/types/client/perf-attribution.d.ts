/**
 * Per-plugin activity attribution for the dsh-perf HUD.
 *
 * One merged MutationObserver resolves every mutated node to its nearest
 * `[data-dsh-plugin]` root (semantic attribute convention,
 * skins/skin-center contracts/semantic-attrs-v1.md) and counts added nodes
 * into fixed time-grid buckets. The HUD renders a top-N scoreboard so
 * steady-state cost of our own plugins becomes measurable instead of
 * anecdotal. Classification and bucket math live here as pure injectable
 * logic; index.ts only wires the DOM observer and the render line.
 *
 * Semantics kept deliberately humble: rates are wall-clock (idle time
 * dilutes them on purpose), per-callback work above the budget and nodes
 * without a `data-dsh-plugin` ancestor share one "unattributed" bucket -
 * plugins that do not emit semantic attributes show up there, which is the
 * honest signal that drives adoption of the convention; totals include that bucket so an
 * all-unattributed page still reads nonzero. Everything fails
 * open: no MutationObserver or no roots means an empty scoreboard, never an
 * error surface.
 * @module @linxin666/dsh-perf/client
 */
/** Selector used to resolve a mutated node to its owning plugin root. */
export declare const ATTR_ROOT_SELECTOR = "[data-dsh-plugin]";
/** Default aggregation window; aligned with the HUD poll cadence. */
export declare const ATTR_WINDOW_MS = 2000;
/** How many closed windows feed a snapshot (~16s at defaults). */
export declare const ATTR_HISTORY_WINDOWS = 8;
export interface AttributionSnapshot {
    /** Wall-clock seconds covered by the merged windows. */
    spanSeconds: number;
    /** All added-node rates merged, unattributed included. */
    totalNodesPerSec: number;
    unattributedPerSec: number;
    /** Added-node rate outside the top-N list. */
    otherNodesPerSec: number;
    topPlugins: {
        name: string;
        nodesPerSec: number;
    }[];
    recordsPerSec: number;
}
export interface AttributionAggregator {
    add(plugin: string | null, nodes: number, nowMs: number): void;
    addRecords(records: number, nowMs: number): void;
    snapshot(nowMs: number, topN?: number): AttributionSnapshot;
}
/**
 * Fixed-grid attribution buckets. Timestamps come from the caller so the
 * math stays deterministic in tests; `windowMs` keeps rates comparable no
 * matter how irregularly mutations arrive.
 */
export declare function createAttributionAggregator(options?: {
    windowMs?: number;
    history?: number;
}): AttributionAggregator;
/** Default lookback for long-task bookkeeping. */
export declare const LONGTASK_WINDOW_MS = 60000;
export interface LongtaskRecord {
    t: number;
    durationMs: number;
    /** Best-effort container name from the spec attribution, else 'unknown'. */
    source: string;
}
export interface LongtaskLog {
    push(record: LongtaskRecord): void;
    prune(nowMs: number): void;
    list(): readonly LongtaskRecord[];
    countSince(nowMs: number, windowMs: number): number;
    maxSince(nowMs: number, windowMs: number): number;
    /** Sources merged by summed duration, heaviest first. */
    topSources(nowMs: number, windowMs: number, n?: number): {
        source: string;
        count: number;
        durationMs: number;
    }[];
}
/**
 * Ring of recent long tasks with coarse origin labels. The spec-level
 * attribution often carries no container name, so the most useful stable
 * output is still aggregate: count, worst duration, and whichever sources
 * did label themselves. Counting iterates batched entries (one observer
 * callback can deliver several tasks).
 */
export declare function createLongtaskLog(options?: {
    windowMs?: number;
    capacity?: number;
}): LongtaskLog;
/** Extracts the best-effort source label from a raw long-task entry. */
export declare function readLongtaskSource(entry: PerformanceEntry): string;
export interface DomAttributionSamplerOptions {
    /** Max nodes classified per observer callback; overflow goes unattributed. */
    budget?: number;
    now?: () => number;
}
/**
 * Installs the merged body MutationObserver feeding the aggregator.
 * Returns a disposer, or `undefined` when the environment lacks the APIs -
 * callers treat that as an empty scoreboard, never a failure.
 */
export declare function startDomAttributionSampler(aggregator: AttributionAggregator, options?: DomAttributionSamplerOptions): (() => void) | undefined;
