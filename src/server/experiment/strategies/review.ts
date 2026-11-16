import { createLLMProvider } from "@/server/llm";
import type { LLMMessage, LLMProvider, LLMUsage } from "@/server/llm/types";
import { createMockProvider } from "@/server/llm/providers/mock";
import { parseLLMJson } from "@/server/evaluation/json-parser";
import { recalculateOverall } from "@/server/evaluation/calculate-score";
import { evaluationResponseSchema, type EvaluationResponse } from "@/server/evaluation/schemas";

import { appEvaluationResponseToEvaluationOutput } from "./adapters";
import { sumCostEstimates, usageToCostEstimate } from "./cost";
import type {
    EvaluationInput,
    EvaluationOutput,
    EvaluationStrategy,
    JsonValue,
    RawStrategyOutput,
    StrategyFailureResult,
    StrategyResult,
} from "./contracts";
import { runSingleStrategy, type SingleStrategyOptions } from "./single";

const REVIEW_RETRY_NUDGE_INVALID_JSON =
    "A resposta anterior da revisão não estava em JSON válido. Reenvie apenas o JSON no schema de avaliação, sem comentários adicionais.";
const REVIEW_RETRY_NUDGE_SCHEMA =
    "O JSON anterior da revisão não seguiu o schema exigido. Corrija os campos e retorne somente o JSON válido conforme descrito.";

export type ReviewStrategyOptions = SingleStrategyOptions;

type ReviewValidationResult =
    | {
          success: true;
          parsedOutput: unknown;
          evaluation: EvaluationResponse & { originalOverall?: number };
          canonicalOutput: EvaluationOutput;
      }
    | {
          success: false;
          status: "parse_error" | "schema_error";
          parsedOutput?: unknown;
          errorMessage: string;
      };

export function createReviewStrategy(options: ReviewStrategyOptions = {}): EvaluationStrategy {
    return {
        id: "review",
        execute(input) {
            return runReviewStrategy(input, options);
        },
    };
}

export const reviewStrategy = createReviewStrategy();

export async function runReviewStrategy(
    input: EvaluationInput,
    options: ReviewStrategyOptions = {}
): Promise<StrategyResult> {
    const startedAt = new Date();
    const initialResult = await runSingleStrategy(input, options);

    if (initialResult.status !== "success") {
        const finishedAt = new Date();
        return {
            ...initialResult,
            strategy: "review",
            startedAt: startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
            latencyMs: elapsedMs(startedAt, finishedAt),
        };
    }

    const provider = resolveReviewProvider(options);
    const timeoutMs = options.timeoutMs ?? parseInteger(process.env.LLM_TIMEOUT_MS, 25_000);
    const retryLimit = options.retryLimit ?? parseInteger(process.env.LLM_RETRY_ON_INVALID_JSON, 1);
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    let reviewCallCount = 0;
    let messages = buildReviewMessages(input, initialResult.parsedOutput);
    let lastFailure:
        | {
              status: "parse_error" | "schema_error";
              errorMessage: string;
              rawOutput?: string;
              rawStrategyOutput?: RawStrategyOutput;
              parsedOutput?: unknown;
              model?: string;
          }
        | undefined;
    let reviewCostEstimate = undefined as ReturnType<typeof usageToCostEstimate>;

    try {
        while (reviewCallCount <= retryLimit) {
            reviewCallCount += 1;
            const response = await provider.invoke(messages, {
                timeoutMs,
                signal: controller.signal,
            });
            reviewCostEstimate = sumCostEstimates([
                reviewCostEstimate,
                usageToCostEstimate(response.usage),
            ]);
            const reviewRawOutput = toRawStrategyOutput(
                response.output,
                response.model,
                2,
                response.usage
            );
            const validated = validateReviewOutput(response.output);

            if (!validated.success) {
                lastFailure = {
                    status: validated.status,
                    errorMessage: validated.errorMessage,
                    rawOutput: response.output,
                    rawStrategyOutput: reviewRawOutput,
                    parsedOutput: validated.parsedOutput,
                    model: response.model,
                };

                if (reviewCallCount > retryLimit) break;

                messages = [
                    ...messages,
                    { role: "assistant", content: response.output },
                    {
                        role: "user",
                        content:
                            validated.status === "parse_error"
                                ? REVIEW_RETRY_NUDGE_INVALID_JSON
                                : REVIEW_RETRY_NUDGE_SCHEMA,
                    },
                ];
                continue;
            }

            const finishedAt = new Date();
            return {
                strategy: "review",
                status: "success",
                model: response.model,
                promptVersion: input.promptVersion,
                questionSlug: getQuestionSlug(input),
                ...getReferenceAnswerId(input),
                startedAt: startedAt.toISOString(),
                finishedAt: finishedAt.toISOString(),
                latencyMs: elapsedMs(startedAt, finishedAt),
                callCount: initialResult.callCount + reviewCallCount,
                rawOutputs: [...initialResult.rawOutputs, reviewRawOutput],
                ...costEstimateField(initialResult.costEstimate, reviewCostEstimate),
                parsedOutput: validated.canonicalOutput,
                strategyMetadata: {
                    initialEvaluation: toJsonValue(initialResult.parsedOutput),
                    reviewerAttempts: reviewCallCount,
                },
            };
        }

        const finishedAt = new Date();
        return buildReviewFailureResult({
            input,
            initialResult,
            startedAt,
            finishedAt,
            status: lastFailure?.status ?? "parse_error",
            errorMessage:
                lastFailure?.errorMessage ?? "Não foi possível obter JSON válido do revisor",
            reviewCallCount,
            reviewRawOutput:
                lastFailure?.rawStrategyOutput ??
                (lastFailure?.rawOutput !== undefined
                    ? toRawStrategyOutput(lastFailure.rawOutput, lastFailure.model, 2)
                    : undefined),
            reviewParsedOutput: lastFailure?.parsedOutput,
            reviewCostEstimate,
        });
    } catch (error) {
        const finishedAt = new Date();
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        return buildReviewFailureResult({
            input,
            initialResult,
            startedAt,
            finishedAt,
            status: isTimeoutError(message) ? "timeout" : "llm_error",
            errorMessage: message,
            reviewCallCount,
            reviewCostEstimate,
        });
    } finally {
        clearTimeout(timeoutHandle);
    }
}

function buildReviewFailureResult({
    input,
    initialResult,
    startedAt,
    finishedAt,
    status,
    errorMessage,
    reviewCallCount,
    reviewRawOutput,
    reviewParsedOutput,
    reviewCostEstimate,
}: {
    input: EvaluationInput;
    initialResult: Extract<StrategyResult, { status: "success" }>;
    startedAt: Date;
    finishedAt: Date;
    status: StrategyFailureResult["status"];
    errorMessage: string;
    reviewCallCount: number;
    reviewRawOutput?: RawStrategyOutput;
    reviewParsedOutput?: unknown;
    reviewCostEstimate?: ReturnType<typeof usageToCostEstimate>;
}): StrategyFailureResult {
    return {
        strategy: "review",
        status,
        model: reviewRawOutput?.model ?? initialResult.model,
        promptVersion: input.promptVersion,
        questionSlug: getQuestionSlug(input),
        ...getReferenceAnswerId(input),
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        latencyMs: elapsedMs(startedAt, finishedAt),
        callCount: initialResult.callCount + reviewCallCount,
        rawOutputs: reviewRawOutput
            ? [...initialResult.rawOutputs, reviewRawOutput]
            : initialResult.rawOutputs,
        ...costEstimateField(initialResult.costEstimate, reviewCostEstimate),
        errorMessage,
        strategyMetadata: {
            initialEvaluation: toJsonValue(initialResult.parsedOutput),
            ...(reviewParsedOutput !== undefined && {
                reviewerParsedOutput: toJsonValue(reviewParsedOutput),
            }),
            reviewerAttempts: reviewCallCount,
        },
    };
}

function buildReviewMessages(
    input: EvaluationInput,
    initialOutput: EvaluationOutput
): LLMMessage[] {
    return [
        {
            role: "system",
            content: [
                "Você é um revisor técnico de avaliações de Engenharia de Software.",
                "Seu papel é revisar a avaliação inicial contra a rubrica, procurando inconsistências, omissões e desalinhamentos.",
                "Não faça uma avaliação independente do zero; preserve o que estiver correto e ajuste apenas o que a rubrica justificar.",
                "Responda estritamente com JSON válido no mesmo schema da avaliação normal: overall, criteria e feedback.",
                "Você deve comparar explicitamente: rubrica, resposta avaliada e avaliação inicial.",
                "Não altere notas apenas por preferência textual; qualquer ajuste deve ser justificado por evidência presente ou ausente na resposta.",
                "Se a avaliação inicial já estiver adequada, mantenha as notas e apenas melhore comentários/evidências quando necessário.",
                "Não premie informação que não aparece na resposta avaliada.",
                "Não penalize ausência de conteúdo que a rubrica não exige.",
            ].join(" "),
        },
        {
            role: "user",
            content: JSON.stringify(
                {
                    task: "Revise a avaliação inicial contra a rubrica e retorne a avaliação final.",
                    question: {
                        slug: getQuestionSlug(input),
                        title: input.question.meta.title,
                        axis: input.question.meta.axis,
                        difficulty: input.question.meta.difficulty,
                        statement: input.question.sections.statement ?? "",
                        rubric: input.question.meta.rubric,
                    },
                    answer: serializeAnswer(input),
                    initialEvaluation: initialOutput,
                    requirements: [
                        "Revise inconsistências entre notas, evidências, comentários e rubrica.",
                        "Corrija omissões relevantes se a avaliação inicial ignorou pontos da resposta.",
                        "Mantenha a escala 0-5.",
                        "Retorne somente JSON válido no schema exigido.",
                        "Para cada critério, verifique se a nota atribuída é compatível com a evidência disponível na resposta.",
                        "Preserve notas corretas da avaliação inicial; altere apenas quando houver inconsistência clara com a rubrica.",
                        "Não introduza novos critérios e não remova critérios da rubrica.",
                        "Garanta que todos os critérios da rubrica apareçam em criteria.",
                    ],
                },
                null,
                2
            ),
        },
    ];
}

function validateReviewOutput(output: string): ReviewValidationResult {
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

    const evaluation = recalculateOverall(validated.data);
    return {
        success: true,
        parsedOutput: parsed.data,
        evaluation,
        canonicalOutput: appEvaluationResponseToEvaluationOutput(evaluation),
    };
}

function resolveReviewProvider(options: ReviewStrategyOptions): LLMProvider {
    if (options.provider) return options.provider;
    if (options.createProvider) return options.createProvider();
    return isTruthy(process.env.USE_MOCK) || options.useMock
        ? createMockProvider()
        : createLLMProvider();
}

function serializeAnswer(input: EvaluationInput) {
    if (input.answer.kind === "student") {
        return {
            kind: "student",
            resposta: input.answer.resposta,
            raciocinio: input.answer.raciocinio,
            codigo: input.answer.codigo,
            language: input.answer.language,
        };
    }

    return {
        kind: "reference",
        id: input.answer.id,
        profile: input.answer.profile,
        answerText: input.answer.answerText,
        code: input.answer.code,
        justification: input.answer.justification,
        language: input.answer.language,
    };
}

function toRawStrategyOutput(
    output: string,
    model: string | undefined,
    callIndex: number,
    usage?: LLMUsage
): RawStrategyOutput {
    return {
        output,
        ...(model && { model }),
        callIndex,
        metadata: {
            phase: callIndex === 1 ? "initial" : "review",
            ...(usage && { usage: toJsonValue(usage) }),
        },
    };
}

function costEstimateField(
    initialCostEstimate: StrategyResult["costEstimate"],
    reviewCostEstimate: ReturnType<typeof usageToCostEstimate>
): { costEstimate?: NonNullable<StrategyResult["costEstimate"]> } {
    const costEstimate = sumCostEstimates([initialCostEstimate, reviewCostEstimate]);
    return costEstimate ? { costEstimate } : {};
}

function getQuestionSlug(input: EvaluationInput): string {
    return input.question.meta.slug ?? input.question.meta.id;
}

function getReferenceAnswerId(input: EvaluationInput): { referenceAnswerId?: string } {
    return input.answer.kind === "reference" ? { referenceAnswerId: input.answer.id } : {};
}

function elapsedMs(startedAt: Date, finishedAt: Date): number {
    return Math.max(0, finishedAt.getTime() - startedAt.getTime());
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

function toJsonValue(value: unknown): JsonValue {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
}
