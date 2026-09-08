/**
 * dsh-perf 会话尾部完整性观察探针(浏览器半区)。
 *
 * 目的: 现场取证"会话跑完但会话区没显示最后输出/输入框残留"一类客户端问题。
 * 机制(只读, 绝不干预渲染):
 * - 订阅 sessions.list, 跟踪每个会话 running 位; 在其 true→false 边沿(回合结束),
 *   对仍驻留的会话做三项检查:
 *   1. final-node-missing: 最后一个 assistant-step 已 settled 但没有 finalNode
 *      (定义只接受 surfaceOp=append 的 assistant/message, 该证据标记缺失);
 *   2. stale-tail: 服务端 history 尾部事件(assistant/message) seq 晚于客户端
 *      窗口最后一个可见节点 —— 窗口落后于主机尾部;
 *   3. draft-residue: 编辑框非空而会话已不再运行(忙碌态点击"停止"的签名:
 *      取消回合但草稿保留)。
 * - 发现写入 localStorage 环形缓冲(dsh-perf-integrity-ring)并 console.warn,
 *   供事后回溯; 观察器自身任何失败静默降级, 绝不影响插件宿主。
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
/** 完整性发现类别。 */
export type IntegrityKind = 'final-node-missing' | 'stale-tail' | 'draft-residue';
/** 一条完整性发现。 */
export interface IntegrityFinding {
    ts: number;
    sessionId: string;
    kind: IntegrityKind;
    detail: string;
}
/** 会话窗口最后一个节点的最小视图。 */
export interface TailNodeView {
    kind?: string;
    anchorSeq?: number;
    data?: {
        status?: string;
        finalNode?: unknown;
        turn?: unknown;
        step?: unknown;
        blocks?: unknown[];
    };
}
/**
 * 纯判定: 最后一个 assistant-step 已 settled 却缺少 finalNode。
 * @param node - 窗口尾部节点(取最后一个 assistant-step 传入)。
 * @returns 发现类别或 null。
 */
export declare function classifyStepTail(node: TailNodeView | undefined): IntegrityKind | null;
/**
 * 纯判定: 服务端 history 尾部是 assistant/message 且 seq 晚于窗口最后可见节点。
 * @param hostTail - history 返回的最后一个事件的 event 视图。
 * @param lastNode - 客户端窗口最后一个可见节点。
 * @returns 发现类别或 null。
 */
export declare function classifyStaleTail(hostTail: {
    seq?: number;
    type?: string;
} | undefined, lastNode: {
    anchorSeq?: number;
    kind?: string;
} | undefined): IntegrityKind | null;
/**
 * 启动观察器。
 * @param ctx - 插件客户端上下文(仅经 inject 服务访问)。
 * @param isEnabled - 总开关读取器; 观察器随 enabled 生命周期启停。
 * @returns 停止函数。
 */
export declare function startIntegrityObserver(ctx: ClientContext, isEnabled: () => boolean): () => void;
