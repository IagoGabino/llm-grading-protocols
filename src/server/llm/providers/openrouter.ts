import axios, { isAxiosError } from "axios";
import fs from "node:fs/promises";
import path from "node:path";

import { evaluationResponseJsonSchema } from "@/server/evaluation/response-json-schema";
import { createContextLogger } from "@/server/observability/logger";

import type { LLMMessage, LLMProvider, LLMUsage } from "../types";

type OpenAIStyleMessage = {
    role: LLMMessage["role"];
    content: string;
};

type OpenRouterChoice = {
    message?: {
        content?: string | Array<{ type?: string; text?: string }>;
    };
    model?: string;
};

type OpenRouterUsage = {
    completion_tokens?: number;
    completion_tokens_details?: {
        reasoning_tokens?: number;
    };
    cost?: number;
    cost_details?: {
        upstream_inference_cost?: number;
    };
    prompt_tokens?: number;
    prompt_tokens_details?: {
        cached_tokens?: number;
        cache_write_tokens?: number;
    };
    total_tokens?: number;
};

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
let requestLogCounter = 0;

export function createOpenRouterProvider(): LLMProvider {
    const logger = createContextLogger("llm/openrouter");
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY não configurada.");
    }

    const model = process.env.LLM_MODEL ?? "openai/gpt-5-mini";
    const referer = process.env.OPENROUTER_SITE_URL;
    const title = process.env.OPENROUTER_SITE_NAME;

    const client = axios.create({
        baseURL: OPENROUTER_BASE_URL,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...(referer ? { "HTTP-Referer": referer } : {}),
            ...(title ? { "X-Title": title } : {}),
        },
    });

    return {
        name: "openrouter",
        async invoke(messages, options) {
            const requestBody = {
                model,
                messages: mapMessages(messages),
                temperature: 0,
                seed: 42,
                max_tokens: 3000,
                response_format: {
                    type: "json_schema",
                    json_schema: evaluationResponseJsonSchema,
                },
            };
            await maybeLogOpenRouterRequest(requestBody);

            try {
                const response = await client.post(
                    "/chat/completions",
                    {
                        model,
                        messages: mapMessages(messages),
                        temperature: 0, // Zero entropia = máxima consistência
                        seed: 42, // Reprodutibilidade total
                        max_tokens: 3000, // Limite realista para feedback técnico
                        response_format: {
                            type: "json_schema",
                            json_schema: evaluationResponseJsonSchema,
                        },
                    },
                    {
                        timeout: options?.timeoutMs,
                        signal: options?.signal,
                    }
                );

                const choice: OpenRouterChoice | undefined = response.data?.choices?.[0];
                const output = extractContent(choice?.message);
                if (!output) {
                    throw new Error("OpenRouter retornou conteúdo vazio ou incompatível.");
                }

                const resolvedModel = choice?.model ?? response.data?.model ?? model;
                return {
                    output,
                    model: resolvedModel,
                    usage: normalizeUsage(response.data?.usage),
                };
            } catch (error: unknown) {
                // Log detalhado do erro incluindo response data
                if (isAxiosError(error)) {
                    logger.error(
                        {
                            status: error.response?.status,
                            data: error.response?.data,
                            headers: error.response?.headers,
                            model,
                            messagesCount: messages.length,
                        },
                        "Erro ao chamar OpenRouter API"
                    );
                } else {
                    logger.error({ error, model }, "Erro desconhecido ao chamar OpenRouter");
                }
                throw normalizeAxiosError(error);
            }
        },
    };
}

function normalizeUsage(usage: unknown): LLMUsage | undefined {
    if (!usage || typeof usage !== "object") return undefined;

    const raw = usage as OpenRouterUsage;
    const normalized: LLMUsage = {
        ...(typeof raw.prompt_tokens === "number" && { promptTokens: raw.prompt_tokens }),
        ...(typeof raw.completion_tokens === "number" && {
            completionTokens: raw.completion_tokens,
        }),
        ...(typeof raw.total_tokens === "number" && { totalTokens: raw.total_tokens }),
        ...(typeof raw.completion_tokens_details?.reasoning_tokens === "number" && {
            reasoningTokens: raw.completion_tokens_details.reasoning_tokens,
        }),
        ...(typeof raw.prompt_tokens_details?.cached_tokens === "number" && {
            cachedTokens: raw.prompt_tokens_details.cached_tokens,
        }),
        ...(typeof raw.prompt_tokens_details?.cache_write_tokens === "number" && {
            cacheWriteTokens: raw.prompt_tokens_details.cache_write_tokens,
        }),
        ...(typeof raw.cost === "number" && { costCredits: raw.cost }),
        ...(typeof raw.cost_details?.upstream_inference_cost === "number" && {
            upstreamInferenceCost: raw.cost_details.upstream_inference_cost,
        }),
    };

    return Object.keys(normalized).length > 0 ? normalized : undefined;
}

async function maybeLogOpenRouterRequest(requestBody: unknown): Promise<void> {
    const logDir = process.env.OPENROUTER_LOG_REQUESTS_DIR;
    if (!logDir) return;

    requestLogCounter += 1;
    const absoluteDir = path.resolve(process.cwd(), logDir);
    await fs.mkdir(absoluteDir, { recursive: true });
    const fileName = `${requestLogCounter.toString().padStart(3, "0")}-openrouter-request.json`;
    await fs.writeFile(
        path.join(absoluteDir, fileName),
        `${JSON.stringify(
            {
                endpoint: `${OPENROUTER_BASE_URL}/chat/completions`,
                capturedAt: new Date().toISOString(),
                body: requestBody,
            },
            null,
            2
        )}\n`,
        "utf8"
    );
}

function mapMessages(messages: LLMMessage[]): OpenAIStyleMessage[] {
    return messages.map((message) => ({
        role: message.role,
        content: message.content,
    }));
}

function extractContent(message?: OpenRouterChoice["message"]): string {
    if (!message) return "";
    const { content } = message;
    if (typeof content === "string") {
        return content.trim();
    }
    if (Array.isArray(content)) {
        return content
            .map((part) => {
                if (typeof part === "string") return part;
                if (typeof part?.text === "string") return part.text;
                return "";
            })
            .join("\n")
            .trim();
    }
    return "";
}

function normalizeAxiosError(error: unknown): Error {
    if (isAxiosError(error)) {
        if (error.code === "ERR_CANCELED") {
            return new Error("Operação abortada");
        }
        const status = error.response?.status;
        const detail =
            (typeof error.response?.data?.error === "string" && error.response.data.error) ||
            (typeof error.response?.data?.message === "string" && error.response.data.message);
        const messageParts = ["Falha ao chamar OpenRouter"];
        if (status) {
            messageParts.push(`(status ${status})`);
        }
        if (detail) {
            messageParts.push(`- ${detail}`);
        }
        return new Error(messageParts.join(" "));
    }
    if (error instanceof Error) return error;
    return new Error("Erro desconhecido ao acessar OpenRouter");
}
