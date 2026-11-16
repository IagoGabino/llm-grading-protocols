import {
    runSingleEvaluation,
    type EvaluationEngineOptions,
    type EvaluationEngineResult,
} from "@/server/evaluation/engine";
import type { EvaluationRequestInput } from "@/server/evaluation/schemas";

import { appEvaluationResponseToEvaluationOutput } from "./adapters";
import { usageToCostEstimate } from "./cost";
import type {
    EvaluationInput,
    EvaluationStrategy,
    JsonValue,
    ReferenceAnswer,
    RawStrategyOutput,
    StrategyResult,
    StudentAnswer,
} from "./contracts";

export type SingleStrategyOptions = Pick<
    EvaluationEngineOptions,
    | "provider"
    | "createProvider"
    | "useMock"
    | "timeoutMs"
    | "retryLimit"
    | "promptVariantInstruction"
>;

export function createSingleStrategy(options: SingleStrategyOptions = {}): EvaluationStrategy {
    return {
        id: "single",
        execute(input) {
            return runSingleStrategy(input, options);
        },
    };
}

export const singleStrategy = createSingleStrategy();

export async function runSingleStrategy(
    input: EvaluationInput,
    options: SingleStrategyOptions = {}
): Promise<StrategyResult> {
    const startedAt = new Date();
    const engineInput = evaluationInputToEngineInput(input);
    const engineResult = await runSingleEvaluation(engineInput, options);
    const finishedAt = new Date();

    return engineResultToStrategyResult({
        input,
        engineResult,
        startedAt,
        finishedAt,
    });
}

export function evaluationInputToEngineInput(input: EvaluationInput): EvaluationRequestInput {
    const questionSlug = input.question.meta.slug ?? input.question.meta.id;

    if (input.answer.kind === "student") {
        return studentAnswerToEngineInput(questionSlug, input.answer);
    }

    return referenceAnswerToEngineInput(questionSlug, input.answer);
}

function studentAnswerToEngineInput(slug: string, answer: StudentAnswer): EvaluationRequestInput {
    return {
        slug,
        resposta: answer.resposta,
        raciocinio: answer.raciocinio ?? "",
        codigo: answer.codigo,
        language: answer.language,
    };
}

function referenceAnswerToEngineInput(
    slug: string,
    answer: ReferenceAnswer
): EvaluationRequestInput {
    return {
        slug,
        resposta: answer.answerText ?? "",
        raciocinio: answer.justification ?? "",
        codigo: answer.code,
        language: toEngineLanguage(answer.language),
    };
}

function engineResultToStrategyResult({
    input,
    engineResult,
    startedAt,
    finishedAt,
}: {
    input: EvaluationInput;
    engineResult: EvaluationEngineResult;
    startedAt: Date;
    finishedAt: Date;
}): StrategyResult {
    const referenceAnswerId = input.answer.kind === "reference" ? input.answer.id : undefined;
    const base = {
        strategy: "single" as const,
        status: engineResult.status,
        model: engineResult.model ?? input.model,
        promptVersion: input.promptVersion,
        questionSlug: input.question.meta.slug ?? input.question.meta.id,
        ...(referenceAnswerId && { referenceAnswerId }),
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        latencyMs: engineResult.latencyMs,
        callCount: engineResult.callCount,
        ...usageToCostEstimateField(engineResult),
        rawOutputs: buildRawOutputs(engineResult),
    };

    if (engineResult.status === "success") {
        return {
            ...base,
            status: "success",
            parsedOutput: appEvaluationResponseToEvaluationOutput(engineResult.evaluation),
        };
    }

    return {
        ...base,
        status: engineResult.status,
        ...(engineResult.parsedOutput !== undefined && {
            strategyMetadata: {
                engineParsedOutput: toJsonValue(engineResult.parsedOutput),
            },
        }),
        errorMessage: engineResult.errorMessage,
    };
}

function buildRawOutputs(engineResult: EvaluationEngineResult): RawStrategyOutput[] {
    if (!engineResult.rawOutput) return [];

    return [
        {
            output: engineResult.rawOutput,
            ...(engineResult.model && { model: engineResult.model }),
            callIndex: 1,
            metadata: {
                engineStatus: engineResult.status,
                ...(engineResult.usage && { usage: toJsonValue(engineResult.usage) }),
            },
        },
    ];
}

function usageToCostEstimateField(
    engineResult: EvaluationEngineResult
): { costEstimate?: NonNullable<StrategyResult["costEstimate"]> } {
    const costEstimate = usageToCostEstimate(engineResult.usage);
    return costEstimate ? { costEstimate } : {};
}

function toEngineLanguage(language: string | undefined): EvaluationRequestInput["language"] {
    if (language === "javascript" || language === "python" || language === "java") {
        return language;
    }

    return undefined;
}

function toJsonValue(value: unknown): JsonValue {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
}
