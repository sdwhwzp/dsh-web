/**
 * dsh-perf 保持观感的助手消息 shadow。
 *
 * 设计: 不替换官方渲染的任何视觉 —— 所有 assistant-step 节点都经官方渲染器输出
 * (样式、推理行、代码块、图片、操作按钮完全同款)。干预只有两处时机, 不改任何像素:
 *
 * 1. 超重消息(settled 且加权负载分 > 阈值)首次渲染强制以 "running"(流式) 形态
 *    转交官方 —— 官方流式分支本来就不打 shiki/KaTeX(源码: streaming ? void 0 :
 *    高亮), 节点外观与官方流式期间的普通样式完全一致; 随后经全局串行翻转队列
 *    (perf-flip-queue) 把状态逐条翻回 settled —— 会话打开/多步回合时 N 条 heavy
 *    消息不再同帧集体翻转(单帧 N x 全量解析+高亮突发), 而是按间隔摊开。
 * 2. 负载评估从纯字符数升级为加权分(perf-heaviness): 代码围栏字符双倍计、
 *    每个数学公式按固定成本计、reasoning/tool-call 按低权重计 —— 覆盖
 *    "12 围栏 x 400 行约 15k 字符"这类不触发旧阈值但 settle 突发同样重的消息。
 *
 * 实验项(默认关闭, localStorage dsh-perf-stream-cooldown=毫秒): 流式期间对
 * 超重节点做转发冷却 —— 每帧仍然重渲染本 shadow, 但只在冷却窗口外才把最新
 * node 引用转交官方 memo 渲染器(窗口内转交上一次引用, 官方 memo 直接跳过),
 * 尾部由定时器保底追平。文本以更粗粒度跳动出现, 属可见差异, 故默认关。
 *
 * 官方捕获: 注册时序上本插件 inject 回调先于官方回调执行, 因此捕获放在首次渲染
 * (全部插件已 apply) 时进行, 且必须排除自身(entries 按 priority 排序, 自身在前)。
 * 捕获失败时仍走官方失败面(渲染 JsonBlock 兜底), 绝不出现降载视图。
 */
import { type ComponentType } from 'react';
import { type HeavinessBlock } from './perf-heaviness';
interface ShadowBlock extends HeavinessBlock {
    lang?: string;
}
interface ShadowData {
    status?: string;
    blocks?: ShadowBlock[];
}
export interface ShadowOwner {
    node?: {
        key?: string;
        kind?: string;
        data?: ShadowData;
    };
    useTurnData?: (key: string) => unknown;
    openFile?: unknown;
    renderMessageImages?: unknown;
    fileMentions?: unknown;
    t?: (key: string) => string;
    [k: string]: unknown;
}
/** Build the shadow component around the official assistant-step renderer.
 * @param official - 注册期捕获的官方渲染器(可能尚未注册, 直接传 undefined)。
 * @param enabled - renderDegrade 开关读取器; 关闭时直接转交官方, 零干预。
 * @param captureOfficial - 渲染期懒捕获器(须排除影子自身)。
 */
export declare function makePerfAssistantShadow(official: ComponentType<ShadowOwner> | undefined, enabled?: () => boolean, captureOfficial?: () => ComponentType<ShadowOwner> | undefined): ComponentType<ShadowOwner>;
export {};
