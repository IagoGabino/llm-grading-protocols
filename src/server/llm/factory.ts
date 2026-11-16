import { createAnthropicProvider } from "./providers/anthropic";
import { createMockProvider } from "./providers/mock";
import { createOpenRouterProvider } from "./providers/openrouter";
import type { LLMProvider } from "./types";

export function createLLMProvider(): LLMProvider {
    const provider = (process.env.LLM_PROVIDER ?? "mock").toLowerCase();
    switch (provider) {
        case "mock":
            return createMockProvider();
        case "openrouter":
            return createOpenRouterProvider();
        case "anthropic":
        case "claude":
            return createAnthropicProvider();
        default:
            throw new Error(`LLM_PROVIDER "${provider}" não é suportado.`);
    }
}
