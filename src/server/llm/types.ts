export type LLMMessageRole = "system" | "user" | "assistant";

export type LLMMessage = {
    role: LLMMessageRole;
    content: string;
};

export type LLMInvokeOptions = {
    timeoutMs?: number;
    signal?: AbortSignal;
};

export type LLMUsage = {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
    cachedTokens?: number;
    cacheWriteTokens?: number;
    costCredits?: number;
    upstreamInferenceCost?: number;
};

export type LLMResponse = {
    output: string;
    model: string;
    usage?: LLMUsage;
};

export interface LLMProvider {
    name: string;
    invoke(messages: LLMMessage[], options?: LLMInvokeOptions): Promise<LLMResponse>;
}
