/**
 * dsh-perf 会话列表 store 发布门控(#4)。
 *
 * 问题(官方 bundle 实锤): sessions projectList 每次 manager flush 都把
 * {ids, byId, current, phase, subagentsByParent, jobsBySession, currentAddress} 全部
 * 重建为新对象再 list.set —— 即使可见内容毫无变化, zustand 按 Object.is 必通知,
 * 侧栏 SessionTree/FlatList/SearchResults 的 useSessions((s) => s) 整树重渲染。
 * 流式期间 flush 的主体是 usage/token 投影帧: 只有 byId 条目的 projectionValues
 * 身份变化, 侧栏可见字段(标题/running/updatedAt/顺序/徽标)一个都没变。
 *
 * 设计: 包装 sessions.list.set(方法级补丁, 不换 store 对象, 官方内部 this.list.set
 * 调用点自动走门)。每次发布前与当前已发布快照做"可见字段"比对:
 * - 有可见变化 -> 立即发布(并带走最新投影);
 * - 仅 projectionValues 身份变化 -> 合并到尾部定时器, 最多每 coalesceMs 发布一次
 *   (最新值胜出)。唯一可感知代价: 子代理 lineage 头部的 token 实时计数刷新从
 *   每 usage 帧降为 ~1Hz, 其余消费方语义不变。
 * 纯逻辑可测: makeListSetGate 不依赖 DOM/cordis。
 */
export interface SessionListEntryLike {
    id?: string;
    displayTitle?: string;
    running?: boolean;
    blank?: boolean;
    completed?: boolean;
    updatedAt?: number;
    pendingInteraction?: unknown;
    projectionValues?: unknown;
    title?: string;
    cwd?: string;
    parentId?: string;
    origin?: string;
    agentPreset?: string;
    [k: string]: unknown;
}
export interface SessionListSnapshotLike {
    ids?: string[];
    byId?: Record<string, SessionListEntryLike | undefined>;
    current?: string;
    phase?: string;
    subagentsByParent?: Record<string, unknown>;
    jobsBySession?: Record<string, unknown>;
    currentAddress?: unknown;
    [k: string]: unknown;
}
/** 两个列表快照的可见内容是否一致(豁免 byId 条目的 projectionValues 身份)。 */
export declare function sameVisibleContent(a: SessionListSnapshotLike, b: SessionListSnapshotLike): boolean;
export interface ListSetGateCounts {
    /** 立即发布次数(可见变化)。 */
    published: number;
    /** 被合并的仅投影变化次数。 */
    coalesced: number;
    /** 尾部定时器补发次数。 */
    flushed: number;
}
export interface ListSetGate {
    set: (next: SessionListSnapshotLike) => void;
    readonly counts: ListSetGateCounts;
    /** 立即补发挂起的合并快照并停表(卸载/开关切换时调用, 不丢更新)。 */
    dispose: () => void;
}
export interface ListSetGateOptions {
    coalesceMs: number;
    /** 读当前已发布快照(用于比对)。 */
    getPublished: () => SessionListSnapshotLike;
    /** 真正发布。 */
    publish: (next: SessionListSnapshotLike) => void;
    now?: () => number;
    setTimeoutFn?: (fn: () => void, ms: number) => unknown;
    clearTimeoutFn?: (handle: unknown) => void;
}
export declare function makeListSetGate(options: ListSetGateOptions): ListSetGate;
