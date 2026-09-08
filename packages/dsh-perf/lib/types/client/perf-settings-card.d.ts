/**
 * The dsh-perf settings card: HUD/meter toggles and alert thresholds.
 * Registers into the web-ui.plugin.item slot the Web plugins group renders,
 * bound to the dsh-perf settings namespace.
 */
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store';
import { type CardActions, type CardShell, type FieldState as CardFieldState } from './settings-form.ts';
/** The dsh-perf settings namespace shape (mirrors the host Config schema). */
export interface PerfSettings {
    enabled?: boolean;
    mode?: string;
    meterIntervalMs?: number;
    statsWindowSeconds?: number;
    alertPreset?: string;
    hudEnabled?: boolean;
    renderDegrade?: boolean;
}
/** What the card renders. */
export interface PerfSettingsCardState extends CardShell {
    enabled: CardFieldState;
    mode: CardFieldState;
    meterIntervalMs: CardFieldState;
    statsWindowSeconds: CardFieldState;
    alertPreset: CardFieldState;
    hudEnabled: CardFieldState;
    renderDegrade: CardFieldState;
}
/** Registration-side face injected by the slot entry. */
export interface PerfSettingsCardFace extends CardActions {
    hooks: {
        perfSettingsCard: SnapshotStore<PerfSettingsCardState>;
    };
}
/** Bridges the dsh-perf scope onto the card's staged form. */
export declare class PerfSettingsCardController {
    private readonly form;
    private readonly store;
    constructor(scope: SettingsScope<PerfSettings>);
    private projection;
    inject(): PerfSettingsCardFace;
    dispose(): void;
}
/** Props the renderer binds for the dsh-perf card. */
export type PerfSettingsCardProps = PropsRuntime<'web-ui.plugin.item'> & PropsLocale<'dsh-perf'> & InjectFace<PerfSettingsCardFace>;
/** Render the dsh-perf card. */
export declare function PerfSettingsCard(props: PerfSettingsCardProps): import("react").JSX.Element;
