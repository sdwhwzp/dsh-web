import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { PerfMeter } from './perf-meter.ts';
export declare const PERF_API_PREFIX = "/api/dsh-perf";
/** Loopback-fenced stats route: aggregate metrics only, no session content. */
export declare function makePerfStatsRoute(meter: PerfMeter): WebRoute;
