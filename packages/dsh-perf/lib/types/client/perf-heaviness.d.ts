/**
 * dsh-perf 消息渲染负载加权评估(#2)。
 *
 * 实测依据(官方 bundle 锚点):
 * - 助手 data.blocks 只有 text / reasoning / tool-call 三种; 代码围栏是 text 块
 *   内的 markdown 源码, settled 时每个围栏在主线程同步 codeToHtml(shiki), 且聊天
 *   代码块无行数上限(对比官方 ReadBlock/DiffBlock/TerminalBlock 的 16 行封顶)。
 * - KaTeX 在 settled 时逐公式 renderToString + DOMParser, 无缓存; 流式期不解析。
 * - reasoning 终态是折叠纯文本(ReasoningRow), 无高亮无公式, 成本远低于正文。
 * - tool-call 的 argsRaw 终态默认折叠, 按低权重计入。
 *
 * 纯函数, 供单测直接引用; 不引 react。
 */
export interface HeavinessBlock {
    kind?: string;
    text?: string;
    argsRaw?: string;
}
/** 计算一组消息块的渲染负载分(等价字符数)。 */
export declare function scoreBlocks(blocks: readonly HeavinessBlock[]): number;
