/**
 * Browser half for @linxin666/dsh-perf: a tiny performance HUD.
 *
 * One poll loop reads the host's loopback-fenced /api/dsh-perf/stats
 * (event/s, event-loop delay, memory, batch delay) and merges it with local
 * browser sampling (rAF FPS + per-plugin DOM-activity scoreboard + an
 * attributed long-task log). Everything degrades silently:
 * a missing host half hides the HUD, a hostile environment keeps the GUI
 * unaffected. apply() never throws.
 * @module @linxin666/dsh-perf/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { SettingsScope, SettingsScopeSpec } from '@deepseek-ai/dsh-client-ui-settings/client';
import { type PerfKey } from './perf-locales.ts';
/** Locale namespace owned by this plugin. */
export declare const NS = "dsh-perf";
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'dsh-perf': PerfKey;
    }
    interface SlotMap {
        'web-ui.plugin.item': {
            kind: 'list';
            scope: 'root';
            owner: {
                children?: never;
            };
        };
    }
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Optional binder provided by dsh-web-settings. */
        webUiSettings?: {
            bind<S>(spec: SettingsScopeSpec<S>): SettingsScope<S>;
        };
    }
}
/** Services required by the browser half. */
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
