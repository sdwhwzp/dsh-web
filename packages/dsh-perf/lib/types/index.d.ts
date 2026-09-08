import type { Context } from '@deepseek-ai/cordis';
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings';
import z from 'schemastery';
import { type PerfMode } from './host/perf-meter.ts';
export declare const name = "dsh-perf";
export declare const inject: string[];
export declare const PERF_SETTINGS_NAMESPACE: SettingsNamespace;
export interface Config {
    enabled?: boolean;
    mode?: string;
    meterIntervalMs?: number;
    statsWindowSeconds?: number;
    /** 告警阈值预设: light(减轻)/standard(标准)/strict(严格)。 */
    alertPreset?: string;
    /** HUD 检测面板(客户端消费, host schema 承载): 默认关闭。 */
    hudEnabled?: boolean;
    /** 客户端消息渲染降载(P1 shadow)开关, 由 client 消费, host 只做 schema 承载。 */
    renderDegrade?: boolean;
}
export declare const Config: z<Config>;
export interface ResolvedConfig {
    enabled: boolean;
    mode: PerfMode;
    meterIntervalMs: number;
    statsWindowSeconds: number;
    maxActiveSessions: number;
    maxEventsPerSec: number;
    hudEnabled: boolean;
    renderDegrade: boolean;
}
export declare function resolveConfig(config?: Config): ResolvedConfig;
/** 由 bundle patch 应用的持久化写批延迟: 覆盖整行时写死 500ms(balanced)。 */
export declare const BUNDLE_WRITE_BATCH_DELAY_MS = 500;
export declare const apply: (ctx: Context, config?: Config) => void;
