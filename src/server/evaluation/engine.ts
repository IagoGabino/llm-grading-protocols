import { createLLMProvider } from "@/server/llm";
import type { LLMMessage, LLMProvider, LLMUsage } from "@/server/llm/types";
import { createMockProvider } from "@/server/llm/providers/mock";
import { startTimer } from "@/server/observability/timer";

import { buildEvaluationPrompt, type PromptBuildResult } from "./build-prompt";
import { recalculateOverall } from "./calculate-score";
import { parseLLMJson } from "./json-parser";
import {
    evaluationResponseSchema,
    type EvaluationRequestInput,
    type EvaluationResponse,
} from "./schemas";

const RETRY_NUDGE_INVALID_JSON =
    "A resposta anterior não estava em JSON válido. Reenvie apenas o JSON no formato especificado anteriormente, sem comentários adicionais.";
const RETRY_NUDGE_SCHEMA =
    "O JSON anterior não seguiu o schema exigido. Corrija os campos e retorne somente o JSON válido conforme descrito antes.";

export type EvaluationEngineStatus =
    | "success"
    | "parse_error"
    | "schema_error"
    | "llm_error"
    | "timeout";

export type EvaluationEngineEvaluation = EvaluationResponse & { originalOverall?: number };

export type EvaluationEnginePromptMetadata = {
    questionSlug: string;
    templateName: string;
    templateAxis?: string;
};

type EvaluationEngineResultBase = {
    status: EvaluationEngineStatus;
    rawOutput?: string;
    parsedOutput?: unknown;
    model?: string;
    latencyMs: number;
    callCount: number;
    usage?: LLMUsage;
    errorMessage?: string;
    prompt?: EvaluationEnginePromptMetadata;
};

export type EvaluationEngineSuccessResult = EvaluationEngineResultBase & {
    status: "success";
    rawOutput: string;
    parsedOutput: unknown;
    model: string;
    evaluation: EvaluationEngineEvaluation;
};

export type EvaluationEngineFailureResult = EvaluationEngineResultBase & {
    status: Exclude<EvaluationEngineStatus, "success">;
    errorMessage: string;
};

export type EvaluationEngineResult = EvaluationEngineSuccessResult | EvaluationEngineFailureResult;

export type EvaluationEngineReadyContext = {
    prompt: PromptBuildResult;
    provider: LLMProvider;
    useMock: boolean;
};

export type EvaluationEngineOptions = {
    provider?: LLMProvider;
    createProvider?: () => LLMProvider;
    useMock?: boolean;
    timeoutMs?: number;
    retryLimit?: number;
    promptVariantInstruction?: string;
    onReady?: (context: EvaluationEngineReadyContext) => void | Promise<void>;
};

export class EvaluationPromptBuildError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "EvaluationPromptBuildError";
    }
}

export class EvaluationProviderSetupError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "EvaluationProviderSetupError";
    }
}

export async function runSingleEvaluation(
    input: EvaluationRequestInput,
    options: EvaluationEngineOptions = {}
): Promise<EvaluationEngineResult> {
    const config = resolveEvaluationEngineConfig(options);
    const prompt = await buildPrompt(input, config.promptVariantInstruction);
    const provider = resolveProvider(config);
    const promptMetadata = toPromptMetadata(prompt);

    await options.onReady?.({ prompt, provider, useMock: config.useMock });

    if (config.useMock) {
        return runMockEvaluation({
            provider,
            messages: prompt.messages,
            promptMetadata,
        });
    }

    return runLLMEvaluation({
        provider,
        messages: prompt.messages,
        promptMetadata,
        timeoutMs: config.timeoutMs,
        retryLimit: config.retryLimit,
    });
}

function resolveEvaluationEngineConfig(options: EvaluationEngineOptions) {
    return {
        provider: options.provider,
        createProvider: options.createProvider,
        useMock: options.useMock ?? isTruthy(process.env.USE_MOCK),
        timeoutMs: options.timeoutMs ?? parseInteger(process.env.LLM_TIMEOUT_MS, 25_000),
        retryLimit: options.retryLimit ?? parseInteger(process.env.LLM_RETRY_ON_INVALID_JSON, 1),
        promptVariantInstruction: options.promptVariantInstruction,
    };
}

async function buildPrompt(
    input: EvaluationRequestInput,
    promptVariantInstruction: string | undefined
): Promise<PromptBuildResult> {
    try {
        return await buildEvaluationPrompt({
            slug: input.slug,
            input,
            promptVariantInstruction,
        });
    } catch (error) {
        throw new EvaluationPromptBuildError(
            error instanceof Error ? error.message : "Motivo desconhecido",
            error instanceof Error ? { cause: error } : undefined
        );
    }
}

function resolveProvider(config: ReturnType<typeof resolveEvaluationEngineConfig>): LLMProvider {
    if (config.provider) return config.provider;

    try {
        if (config.createProvider) return config.createProvider();
        return config.useMock ? createMockProvider() : createLLMProvider();
    } catch (error) {
        throw new EvaluationProviderSetupError(
            error instanceof Error ? error.message : "Motivo desconhecido",
            error instanceof Error ? { cause: error } : undefined
        );
    }
}

async function runMockEvaluation({
    provider,
    messages,
    promptMetadata,
}: {
    provider: LLMProvider;
    messages: LLMMessage[];
    promptMetadata: EvaluationEnginePromptMetadata;
}): Promise<EvaluationEngineResult> {
    const timer = startTimer();

    try {
        const response = await provider.invoke(messages);
        const validated = validateLLMOutput(response.output);
        const latencyMs = timer.stop();

        if (!validated.success) {
            return {
                status: validated.status,
                rawOutput: response.output,
                parsedOutput: validated.parsedOutput,
                model: response.model,
                latencyMs,
                callCount: 1,
                ...(response.usage && { usage: response.usage }),
                errorMessage: validated.errorMessage,
                prompt: promptMetadata,
            };
        }

        return {
            status: "success",
            rawOutput: response.output,
            parsedOutput: validated.parsedOutput,
            model: response.model,
            latencyMs,
            callCount: 1,
            ...(response.usage && { usage: response.usage }),
            evaluation: validated.evaluation,
            prompt: promptMetadata,
        };
    } catch (error) {
        const latencyMs = timer.stop();
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        return {
            status: isTimeoutError(message) ? "timeout" : "llm_error",
            latencyMs,
            callCount: 1,
            errorMessage: message,
            prompt: promptMetadata,
        };
    }
}

async function runLLMEvaluation({
    provider,
    messages,
    promptMetadata,
    timeoutMs,
    retryLimit,
}: {
    provider: LLMProvider;
    messages: LLMMessage[];
    promptMetadata: EvaluationEnginePromptMetadata;
    timeoutMs: number;
    retryLimit: number;
}): Promise<EvaluationEngineResult> {
    const timer = startTimer();
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    let callCount = 0;
    let currentMessages = messages;
    let accumulatedUsage: LLMUsage | undefined;
    let lastFailure:
        | {
              status: "parse_error" | "schema_error";
              errorMessage: string;
              rawOutput?: string;
              parsedOutput?: unknown;
              model?: string;
          }
        | undefined;

    try {
        while (callCount <= retryLimit) {
            callCount += 1;
            const response = await provider.invoke(currentMessages, {
                timeoutMs,
                signal: controller.signal,
            });
            accumulatedUsage = mergeUsage(accumulatedUsage, response.usage);
            const validated = validateLLMOutput(response.output);

            if (!validated.success) {
                lastFailure = {
                    status: validated.status,
                    errorMessage: validated.errorMessage,
                    rawOutput: response.output,
                    parsedOutput: validated.parsedOutput,
                    model: response.model,
                };

                if (callCount > retryLimit) break;

                currentMessages = [
                    ...currentMessages,
                    { role: "assistant", content: response.output },
                    {
                        role: "user",
                        content:
                            validated.status === "parse_error"
                                ? RETRY_NUDGE_INVALID_JSON
                                : RETRY_NUDGE_SCHEMA,
                    },
                ];
                continue;
            }

            return {
                status: "success",
                rawOutput: response.output,
                parsedOutput: validated.parsedOutput,
                model: response.model,
                latencyMs: timer.stop(),
                callCount,
                ...(accumulatedUsage && { usage: accumulatedUsage }),
                evaluation: validated.evaluation,
                prompt: promptMetadata,
            };
        }

        return {
            status: lastFailure?.status ?? "parse_error",
            rawOutput: lastFailure?.rawOutput,
            parsedOutput: lastFailure?.parsedOutput,
            model: lastFailure?.model,
            latencyMs: timer.stop(),
            callCount,
            ...(accumulatedUsage && { usage: accumulatedUsage }),
            errorMessage: lastFailure?.errorMessage ?? "Não foi possível obter JSON válido do LLM",
            prompt: promptMetadata,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        return {
            status: isTimeoutError(message) ? "timeout" : "llm_error",
            latencyMs: timer.stop(),
            callCount,
            ...(accumulatedUsage && { usage: accumulatedUsage }),
            errorMessage: message,
            prompt: promptMetadata,
        };
    } finally {
        clearTimeout(timeoutHandle);
    }
}

function validateLLMOutput(output: string):
    | {
          success: true;
          parsedOutput: unknown;
          evaluation: EvaluationEngineEvaluation;
      }
    | {
          success: false;
          status: "parse_error" | "schema_error";
          parsedOutput?: unknown;
          errorMessage: string;
      } {
    const parsed = parseLLMJson<unknown>(output);
    if (!parsed.success) {
        return {
            success: false,
            status: "parse_error",
            errorMessage: parsed.error.message,
        };
    }

    const validated = evaluationResponseSchema.safeParse(parsed.data);
    if (!validated.success) {
        return {
            success: false,
            status: "schema_error",
            parsedOutput: parsed.data,
            errorMessage: validated.error.message,
        };
    }

    return {
        success: true,
        parsedOutput: parsed.data,
        evaluation: recalculateOverall(validated.data),
    };
}

function toPromptMetadata(prompt: PromptBuildResult): EvaluationEnginePromptMetadata {
    return {
        questionSlug: prompt.question.meta.slug ?? prompt.question.meta.id,
        templateName: prompt.template.name,
        ...(prompt.template.axis && { templateAxis: prompt.template.axis }),
    };
}

function mergeUsage(left: LLMUsage | undefined, right: LLMUsage | undefined): LLMUsage | undefined {
    if (!left) return right;
    if (!right) return left;

    const merged: LLMUsage = {
        ...sumUsageField(left, right, "promptTokens"),
        ...sumUsageField(left, right, "completionTokens"),
        ...sumUsageField(left, right, "totalTokens"),
        ...sumUsageField(left, right, "reasoningTokens"),
        ...sumUsageField(left, right, "cachedTokens"),
        ...sumUsageField(left, right, "cacheWriteTokens"),
        ...sumUsageField(left, right, "costCredits"),
        ...sumUsageField(left, right, "upstreamInferenceCost"),
    };

    return Object.keys(merged).length > 0 ? merged : undefined;
}

function sumUsageField(
    left: LLMUsage,
    right: LLMUsage,
    field: keyof LLMUsage
): Partial<LLMUsage> {
    const leftValue = left[field];
    const rightValue = right[field];
    if (typeof leftValue !== "number" && typeof rightValue !== "number") return {};
    return {
        [field]:
            (typeof leftValue === "number" ? leftValue : 0) +
            (typeof rightValue === "number" ? rightValue : 0),
    };
}

function parseInteger(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

function isTruthy(value: string | undefined): boolean {
    if (!value) return false;
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function isTimeoutError(message: string): boolean {
    return /abort/i.test(message);
}
