import type { Context } from '@deepseek-ai/cordis';
export type PerfMode = 'off' | 'balanced' | 'aggressive';
export interface PerfMeterOptions {
    /** HUD 与服务端观测开关: off 时仅保留路由占位, 不订阅事件、不采样。 */
    mode: PerfMode;
    /** 采样周期(毫秒), 也是 bucket 粒度。 */
    meterIntervalMs: number;
    /** 环形窗口保留时间(秒), 用于 events/s 与类型分布。 */
    statsWindowSeconds: number;
    /** bundle patch 应用的写批延迟(毫秒), 展示用。 */
    batchDelayMs: number;
    /** 活跃会话告警阈值(≥ 时亮警): 默认 5 个并发 subagent/会话即提示。 */
    maxActiveSessions: number;
    /** 全局事件速率告警阈值(events/s, ≥ 时亮警)。 */
    maxEventsPerSec: number;
}
export interface PerfSessionStat {
    id: string;
    eventsPerSec: number;
    lastType: string;
    /** agent 状态(idle/running/…, 有 agent/status 迁移事件时) */
    status?: string;
}
export interface PerfAlert {
    kind: 'sessions' | 'events' | 'both';
    activeSessions: number;
    eventsPerSec: number;
    maxSessions: number;
    maxEventsPerSec: number;
}
export interface PerfStats {
    ok: true;
    ts: number;
    uptimeMs: number;
    mode: PerfMode;
    meterIntervalMs: number;
    batchDelayMs: number;
    elDelay: {
        meanMs: number;
        p99Ms: number;
        maxMs: number;
    };
    mem: {
        rssMB: number;
        heapUsedMB: number;
    };
    events: {
        perSec: number;
        window: number;
        activeSessions: number;
        idleSessions?: number;
    };
    topSessions: PerfSessionStat[];
    eventTypes: Record<string, number>;
    alert: PerfAlert | null;
}
export declare class PerfMeter {
    private readonly ctx;
    private options;
    private readonly buckets;
    private readonly el;
    private timer;
    private disposed;
    private started;
    private windowMs;
    private readonly lastTypeBySession;
    private pendingSessions;
    private pendingTypes;
    private lastDelay;
    private readonly agentStatus;
    constructor(ctx: Context, options: PerfMeterOptions);
    /** (Re)apply host-side options; cheap, safe to call on settings change. */
    applyOptions(options: PerfMeterOptions): void;
    start(): void;
    stop(): void;
    private attached;
    private readonly disposers;
    private attach;
    private detach;
    private noteEvent;
    /** 每 tick 归档 pending 到 per-session bucket; 读取 EL 延迟并清零。 */
    private tick;
    private compactBuckets;
    /** 窗口内聚合: 总速率 / 每会话速率 / 事件类型分布。 */
    private windowAggregate;
    snapshot(): PerfStats;
}
