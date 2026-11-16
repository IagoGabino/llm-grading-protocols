import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { parseLLMJson } from "@/server/evaluation/json-parser";
import { recalculateOverall } from "@/server/evaluation/calculate-score";
import { evaluationResponseSchema, type EvaluationResponse } from "@/server/evaluation/schemas";
import { createLLMProvider } from "@/server/llm";
import type { LLMMessage, LLMProvider, LLMUsage } from "@/server/llm/types";

import { loadProtocolSnapshot, loadRuns } from "./metrics/artifacts";
import { appEvaluationResponseToEvaluationOutput } from "./strategies/adapters";
import {
    evaluationOutputSchema,
    type EvaluationInput,
    type EvaluationOutput,
    type JsonValue,
    type RawStrategyOutput,
    type StrategyCostEstimate,
    type StrategyStatus,
} from "./strategies/contracts";
import { sumCostEstimates, usageToCostEstimate } from "./strategies/cost";
import type { ExperimentRun } from "./runner/contracts";
import { loadValidatedReferenceInputs, type ValidatedReferenceInput } from "./runner/reference-inputs";

const REVIEW_V2_STRATEGY = "review_v2_conservative";
const REVIEW_V2_PROMPT_VERSION_SUFFIX = "review-v2-conservative-audit";
const REVIEW_V2_RETRY_NUDGE_INVALID_JSON =
    "A resposta anterior da revisão não estava em JSON válido. Reenvie apenas o JSON no schema de avaliação, sem comentários adicionais.";
const REVIEW_V2_RETRY_NUDGE_SCHEMA =
    "O JSON anterior da revisão não seguiu o schema exigido. Corrija os campos e retorne somente o JSON válido conforme descrito.";

type ReviewV2ValidationResult =
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

export type ReviewV2SensitivityOptions = {
    experimentDir: string;
    outputDir?: string;
    execute: boolean;
    overwrite?: boolean;
    limit?: number;
};

export type ReviewV2SensitivityPlan = {
    sourceExperimentId: string;
    sourceExperimentDir: string;
    outputDir: string;
    configuredModel: string;
    promptVersion: string;
    plannedRuns: number;
    referenceAnswersPath: string;
    reviewRuns: Array<{
        sourceReviewRunId: string;
        questionSlug: string;
        referenceAnswerId: string;
        profile: string;
        variant: string;
    }>;
};

export type ReviewV2SensitivityRun = {
    id: string;
    sourceExperimentId: string;
    sourceReviewRunId: string;
    strategy: typeof REVIEW_V2_STRATEGY;
    status: StrategyStatus;
    model: string;
    configuredModel: string;
    promptVersion: string;
    questionSlug: string;
    referenceAnswerId: string;
    profile: string;
    variant: string;
    startedAt: string;
    finishedAt: string;
    latencyMs: number;
    callCount: number;
    requestPath?: string;
    rawOutputPath?: string;
    parsedOutput?: EvaluationOutput;
    errorMessage?: string;
    costEstimate?: StrategyCostEstimate;
    expectedOverall: number;
    expectedCriteria: ExperimentRun["reference"]["expectedCriteria"];
    initialOverall: number;
    reviewV1Overall?: number;
    reviewV2Overall?: number;
    initialAbsoluteError: number;
    reviewV1AbsoluteError?: number;
    reviewV2AbsoluteError?: number;
    reviewV2SignedError?: number;
    reviewV2ScoreShiftFromInitial?: number;
    reviewV2DeltaVsReviewV1?: number;
    strategyMetadata: {
        sourceStrategy: "review";
        sourcePromptVersion: string;
        sourceModel: string;
        initialEvaluation: JsonValue;
        reviewV1Output?: JsonValue;
        reviewerAttempts: number;
        promptVariant: typeof REVIEW_V2_PROMPT_VERSION_SUFFIX;
    };
};

export type ReviewV2StrategyComparison = {
    strategy: string;
    source: "official" | "sensitivity";
    plannedRuns: number;
    successRuns: number;
    successRate: number;
    overallMAE: number | "";
    meanSignedError: number | "";
    totalCallCount: number;
    totalCostCredits: number | "";
    avgLatencyMs: number | "";
};

export type ReviewV2SensitivityResult = {
    experimentId: string;
    sourceExperimentId: string;
    generatedAt: string;
    promptVariant: typeof REVIEW_V2_PROMPT_VERSION_SUFFIX;
    plannedRuns: number;
    successRuns: number;
    failedRuns: number;
    runs: ReviewV2SensitivityRun[];
    comparison: ReviewV2StrategyComparison[];
};

export type ReviewV2SensitivityPaths = {
    outputDir: string;
    rawDir: string;
    requestDir: string;
    runsJsonlPath: string;
    runsJsonPath: string;
    runsCsvPath: string;
    comparisonJsonPath: string;
    comparisonCsvPath: string;
    summaryMdPath: string;
};

export async function planReviewV2Sensitivity(
    options: Omit<ReviewV2SensitivityOptions, "execute" | "overwrite">
): Promise<ReviewV2SensitivityPlan> {
    const context = await loadReviewV2Context(options);
    return context.plan;
}

export async function runReviewV2Sensitivity(
    options: ReviewV2SensitivityOptions
): Promise<{
    plan: ReviewV2SensitivityPlan;
    result?: ReviewV2SensitivityResult;
    paths?: ReviewV2SensitivityPaths;
}> {
    const context = await loadReviewV2Context(options);
    if (!options.execute) {
        return { plan: context.plan };
    }

    validateRealProviderConfiguration();
    process.env.LLM_MODEL = context.plan.configuredModel;

    const paths = getReviewV2OutputPaths(context.plan.outputDir);
    await initializeOutput(paths, Boolean(options.overwrite));
    await writeJson(path.join(paths.outputDir, "plan.json"), context.plan);

    const provider = createLLMProvider();
    const runs: ReviewV2SensitivityRun[] = [];

    for (const [index, item] of context.items.entries()) {
        const run = await executeReviewV2Item({
            provider,
            item,
            index: index + 1,
            total: context.items.length,
            paths,
            timeoutMs: context.timeoutMs,
            retryLimit: context.retryLimit,
        });
        runs.push(run);
        await fs.appendFile(paths.runsJsonlPath, `${JSON.stringify(run)}\n`, "utf8");
    }

    const result = buildReviewV2Result({
        sourceExperimentId: context.plan.sourceExperimentId,
        officialRuns: context.officialRuns,
        reviewV2Runs: runs,
    });

    await writeJson(paths.runsJsonPath, { runs });
    await writeCsv(paths.runsCsvPath, runs, reviewV2RunColumns);
    await writeJson(paths.comparisonJsonPath, result.comparison);
    await writeCsv(paths.comparisonCsvPath, result.comparison, reviewV2ComparisonColumns);
    await fs.writeFile(paths.summaryMdPath, buildReviewV2SummaryMarkdown(result, paths), "utf8");

    return { plan: context.plan, result, paths };
}

type ReviewV2Context = {
    plan: ReviewV2SensitivityPlan;
    items: ReviewV2Item[];
    officialRuns: ExperimentRun[];
    timeoutMs: number;
    retryLimit: number;
};

type ReviewV2Item = {
    id: string;
    sourceReviewRun: ExperimentRun;
    input: EvaluationInput;
    initialEvaluation: EvaluationOutput;
    promptVersion: string;
    configuredModel: string;
};

async function loadReviewV2Context(
    options: Omit<ReviewV2SensitivityOptions, "execute">
): Promise<ReviewV2Context> {
    const experimentDir = path.resolve(process.cwd(), options.experimentDir);
    const protocol = await loadProtocolSnapshot(path.join(experimentDir, "config.json"));
    const config = protocol.config;
    const officialRuns = await loadRuns(path.join(experimentDir, "runs.json"));
    const reviewRuns = officialRuns
        .filter((run) => run.strategy === "review")
        .sort((left, right) =>
            `${left.questionSlug}:${left.referenceAnswerId}`.localeCompare(
                `${right.questionSlug}:${right.referenceAnswerId}`
            )
        )
        .slice(0, options.limit);

    const { inputs } = await loadValidatedReferenceInputs(config.referenceAnswersPath ?? "");
    const inputByReferenceAnswerId = new Map(
        inputs.map((input) => [input.referenceAnswer.id, input])
    );
    const promptVersion = `${config.promptVersion}+${REVIEW_V2_PROMPT_VERSION_SUFFIX}`;
    const configuredModel = config.model;
    const outputDir =
        options.outputDir ??
        path.join(experimentDir, "metrics", "review-v2-sensitivity");

    const items = reviewRuns.map((sourceReviewRun) =>
        toReviewV2Item({
            sourceReviewRun,
            validatedInput: requireInput(inputByReferenceAnswerId, sourceReviewRun),
            promptVersion,
            configuredModel,
            sourceExperimentId: config.experimentId,
        })
    );

    const runtimeConfig = config as typeof config & { execution?: unknown };

    return {
        plan: {
            sourceExperimentId: config.experimentId,
            sourceExperimentDir: experimentDir,
            outputDir: path.resolve(process.cwd(), outputDir),
            configuredModel,
            promptVersion,
            plannedRuns: items.length,
            referenceAnswersPath: config.referenceAnswersPath ?? "",
            reviewRuns: items.map((item) => ({
                sourceReviewRunId: item.sourceReviewRun.id,
                questionSlug: item.sourceReviewRun.questionSlug,
                referenceAnswerId: item.sourceReviewRun.referenceAnswerId,
                profile: item.sourceReviewRun.reference.profile,
                variant: item.sourceReviewRun.reference.variant ?? "",
            })),
        },
        items,
        officialRuns,
        timeoutMs: getExecutionNumber(runtimeConfig, "timeoutMs", 60_000),
        retryLimit: getExecutionNumber(runtimeConfig, "retryLimit", 0),
    };
}

function toReviewV2Item({
    sourceReviewRun,
    validatedInput,
    promptVersion,
    configuredModel,
    sourceExperimentId,
}: {
    sourceReviewRun: ExperimentRun;
    validatedInput: ValidatedReferenceInput;
    promptVersion: string;
    configuredModel: string;
    sourceExperimentId: string;
}): ReviewV2Item {
    if (sourceReviewRun.status !== "success" || !sourceReviewRun.parsedOutput) {
        throw new Error(
            `Review v2 sensitivity requires successful review_v1 runs. ${sourceReviewRun.id} has status ${sourceReviewRun.status}.`
        );
    }

    const initialEvaluation = parseInitialEvaluation(sourceReviewRun);
    const input: EvaluationInput = {
        question: validatedInput.question,
        answer: validatedInput.candidateAnswer,
        model: configuredModel,
        promptVersion,
    };

    return {
        id: createReviewV2RunId({
            sourceExperimentId,
            questionSlug: sourceReviewRun.questionSlug,
            referenceAnswerId: sourceReviewRun.referenceAnswerId,
            model: configuredModel,
            promptVersion,
        }),
        sourceReviewRun,
        input,
        initialEvaluation,
        promptVersion,
        configuredModel,
    };
}

function requireInput(
    inputByReferenceAnswerId: Map<string, ValidatedReferenceInput>,
    run: ExperimentRun
): ValidatedReferenceInput {
    const input = inputByReferenceAnswerId.get(run.referenceAnswerId);
    if (!input) {
        throw new Error(
            `Could not reconstruct EvaluationInput for reference answer ${run.referenceAnswerId}.`
        );
    }
    return input;
}

async function executeReviewV2Item({
    provider,
    item,
    index,
    total,
    paths,
    timeoutMs,
    retryLimit,
}: {
    provider: LLMProvider;
    item: ReviewV2Item;
    index: number;
    total: number;
    paths: ReviewV2SensitivityPaths;
    timeoutMs: number;
    retryLimit: number;
}): Promise<ReviewV2SensitivityRun> {
    const startedAt = new Date();
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    const rawOutputs: RawStrategyOutput[] = [];
    let messages = buildReviewV2Messages(item.input, item.initialEvaluation);
    let callCount = 0;
    let costEstimate: StrategyCostEstimate | undefined;
    let requestPath: string | undefined;
    let lastFailure:
        | {
              status: "parse_error" | "schema_error";
              errorMessage: string;
              parsedOutput?: unknown;
          }
        | undefined;

    try {
        while (callCount <= retryLimit) {
            callCount += 1;
            requestPath = await writeReviewV2Request({
                paths,
                item,
                messages,
                callIndex: callCount,
                index,
                total,
            });

            const response = await provider.invoke(messages, {
                timeoutMs,
                signal: controller.signal,
            });
            costEstimate = sumCostEstimates([
                costEstimate,
                usageToCostEstimate(response.usage),
            ]);
            rawOutputs.push(toRawStrategyOutput(response.output, response.model, callCount, response.usage));

            const validated = validateReviewV2Output(response.output);
            if (!validated.success) {
                lastFailure = {
                    status: validated.status,
                    errorMessage: validated.errorMessage,
                    parsedOutput: validated.parsedOutput,
                };

                if (callCount > retryLimit) break;

                messages = [
                    ...messages,
                    { role: "assistant", content: response.output },
                    {
                        role: "user",
                        content:
                            validated.status === "parse_error"
                                ? REVIEW_V2_RETRY_NUDGE_INVALID_JSON
                                : REVIEW_V2_RETRY_NUDGE_SCHEMA,
                    },
                ];
                continue;
            }

            const rawOutputPath = await writeRawOutputs(paths, item.id, rawOutputs);
            const finishedAt = new Date();
            return buildReviewV2Run({
                item,
                status: "success",
                model: response.model,
                startedAt,
                finishedAt,
                callCount,
                requestPath,
                rawOutputPath,
                costEstimate,
                parsedOutput: validated.canonicalOutput,
            });
        }

        const rawOutputPath = await writeRawOutputs(paths, item.id, rawOutputs);
        const finishedAt = new Date();
        return buildReviewV2Run({
            item,
            status: lastFailure?.status ?? "parse_error",
            model: rawOutputs.at(-1)?.model ?? item.configuredModel,
            startedAt,
            finishedAt,
            callCount,
            requestPath,
            rawOutputPath,
            costEstimate,
            errorMessage:
                lastFailure?.errorMessage ?? "Não foi possível obter JSON válido do revisor v2",
        });
    } catch (error) {
        const rawOutputPath = await writeRawOutputs(paths, item.id, rawOutputs);
        const finishedAt = new Date();
        const message = error instanceof Error ? error.message : String(error);
        return buildReviewV2Run({
            item,
            status: isTimeoutError(message) ? "timeout" : "llm_error",
            model: rawOutputs.at(-1)?.model ?? item.configuredModel,
            startedAt,
            finishedAt,
            callCount,
            requestPath,
            rawOutputPath,
            costEstimate,
            errorMessage: message,
        });
    } finally {
        clearTimeout(timeoutHandle);
    }
}

function buildReviewV2Run({
    item,
    status,
    model,
    startedAt,
    finishedAt,
    callCount,
    requestPath,
    rawOutputPath,
    costEstimate,
    parsedOutput,
    errorMessage,
}: {
    item: ReviewV2Item;
    status: StrategyStatus;
    model: string;
    startedAt: Date;
    finishedAt: Date;
    callCount: number;
    requestPath?: string;
    rawOutputPath?: string;
    costEstimate?: StrategyCostEstimate;
    parsedOutput?: EvaluationOutput;
    errorMessage?: string;
}): ReviewV2SensitivityRun {
    const sourceRun = item.sourceReviewRun;
    const expectedOverall = sourceRun.reference.expectedOverall;
    const initialAbsoluteError = roundTo(
        Math.abs(item.initialEvaluation.overall - expectedOverall),
        4
    );
    const reviewV1AbsoluteError = sourceRun.parsedOutput
        ? roundTo(Math.abs(sourceRun.parsedOutput.overall - expectedOverall), 4)
        : undefined;
    const reviewV2AbsoluteError = parsedOutput
        ? roundTo(Math.abs(parsedOutput.overall - expectedOverall), 4)
        : undefined;

    return {
        id: item.id,
        sourceExperimentId: sourceRun.experimentId,
        sourceReviewRunId: sourceRun.id,
        strategy: REVIEW_V2_STRATEGY,
        status,
        model,
        configuredModel: item.configuredModel,
        promptVersion: item.promptVersion,
        questionSlug: sourceRun.questionSlug,
        referenceAnswerId: sourceRun.referenceAnswerId,
        profile: sourceRun.reference.profile,
        variant: sourceRun.reference.variant ?? "",
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        latencyMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
        callCount,
        ...(requestPath && { requestPath }),
        ...(rawOutputPath && { rawOutputPath }),
        ...(parsedOutput && { parsedOutput }),
        ...(errorMessage && { errorMessage }),
        ...(costEstimate && { costEstimate }),
        expectedOverall,
        expectedCriteria: sourceRun.reference.expectedCriteria,
        initialOverall: item.initialEvaluation.overall,
        reviewV1Overall: sourceRun.parsedOutput?.overall,
        reviewV2Overall: parsedOutput?.overall,
        initialAbsoluteError,
        ...(reviewV1AbsoluteError !== undefined && { reviewV1AbsoluteError }),
        ...(reviewV2AbsoluteError !== undefined && { reviewV2AbsoluteError }),
        ...(parsedOutput && {
            reviewV2SignedError: roundTo(parsedOutput.overall - expectedOverall, 4),
            reviewV2ScoreShiftFromInitial: roundTo(
                parsedOutput.overall - item.initialEvaluation.overall,
                4
            ),
        }),
        ...(reviewV2AbsoluteError !== undefined &&
            reviewV1AbsoluteError !== undefined && {
                reviewV2DeltaVsReviewV1: roundTo(reviewV2AbsoluteError - reviewV1AbsoluteError, 4),
            }),
        strategyMetadata: {
            sourceStrategy: "review",
            sourcePromptVersion: sourceRun.promptVersion,
            sourceModel: sourceRun.model,
            initialEvaluation: toJsonValue(item.initialEvaluation),
            ...(sourceRun.parsedOutput && { reviewV1Output: toJsonValue(sourceRun.parsedOutput) }),
            reviewerAttempts: callCount,
            promptVariant: REVIEW_V2_PROMPT_VERSION_SUFFIX,
        },
    };
}

function buildReviewV2Result({
    sourceExperimentId,
    officialRuns,
    reviewV2Runs,
}: {
    sourceExperimentId: string;
    officialRuns: ExperimentRun[];
    reviewV2Runs: ReviewV2SensitivityRun[];
}): ReviewV2SensitivityResult {
    const comparison = [
        summarizeOfficialStrategy("single", officialRuns),
        summarizeOfficialStrategy("review_v1", officialRuns.filter((run) => run.strategy === "review")),
        summarizeOfficialStrategy("multi_aggregate", officialRuns),
        summarizeReviewV2(reviewV2Runs),
    ];

    return {
        experimentId: `${sourceExperimentId}-${REVIEW_V2_PROMPT_VERSION_SUFFIX}`,
        sourceExperimentId,
        generatedAt: new Date().toISOString(),
        promptVariant: REVIEW_V2_PROMPT_VERSION_SUFFIX,
        plannedRuns: reviewV2Runs.length,
        successRuns: reviewV2Runs.filter((run) => run.status === "success").length,
        failedRuns: reviewV2Runs.filter((run) => run.status !== "success").length,
        runs: reviewV2Runs,
        comparison,
    };
}

function summarizeOfficialStrategy(
    strategy: "single" | "review_v1" | "multi_aggregate",
    officialRuns: ExperimentRun[]
): ReviewV2StrategyComparison {
    const sourceStrategy = strategy === "review_v1" ? "review" : strategy;
    const runs = officialRuns.filter((run) => run.strategy === sourceStrategy);
    const successfulRuns = runs.filter((run) => run.status === "success" && run.parsedOutput);
    return {
        strategy,
        source: "official",
        plannedRuns: runs.length,
        successRuns: successfulRuns.length,
        successRate: ratio(successfulRuns.length, runs.length),
        overallMAE: meanMetric(
            successfulRuns.map((run) =>
                run.parsedOutput ? Math.abs(run.parsedOutput.overall - run.reference.expectedOverall) : ""
            )
        ),
        meanSignedError: meanMetric(
            successfulRuns.map((run) =>
                run.parsedOutput ? run.parsedOutput.overall - run.reference.expectedOverall : ""
            )
        ),
        totalCallCount: runs.reduce((sum, run) => sum + run.callCount, 0),
        totalCostCredits: sumCostCredits(runs.map((run) => run.costEstimate)),
        avgLatencyMs: meanMetric(runs.map((run) => run.latencyMs)),
    };
}

function summarizeReviewV2(runs: ReviewV2SensitivityRun[]): ReviewV2StrategyComparison {
    const successfulRuns = runs.filter((run) => run.status === "success" && run.parsedOutput);
    return {
        strategy: REVIEW_V2_STRATEGY,
        source: "sensitivity",
        plannedRuns: runs.length,
        successRuns: successfulRuns.length,
        successRate: ratio(successfulRuns.length, runs.length),
        overallMAE: meanMetric(
            successfulRuns.map((run) =>
                run.parsedOutput ? Math.abs(run.parsedOutput.overall - run.expectedOverall) : ""
            )
        ),
        meanSignedError: meanMetric(
            successfulRuns.map((run) =>
                run.parsedOutput ? run.parsedOutput.overall - run.expectedOverall : ""
            )
        ),
        totalCallCount: runs.reduce((sum, run) => sum + run.callCount, 0),
        totalCostCredits: sumCostCredits(runs.map((run) => run.costEstimate)),
        avgLatencyMs: meanMetric(runs.map((run) => run.latencyMs)),
    };
}

function buildReviewV2Messages(
    input: EvaluationInput,
    initialOutput: EvaluationOutput
): LLMMessage[] {
    return [
        {
            role: "system",
            content: [
                "Você é um revisor técnico CONSERVADOR de avaliações de Engenharia de Software.",
                "Seu papel não é reavaliar a resposta do zero, mas auditar se a avaliação inicial contém erro claro em relação à rubrica.",
                "Seu padrão deve ser PRESERVAR as notas da avaliação inicial.",
                "Altere uma nota apenas quando houver incompatibilidade clara e relevante entre a rubrica, a resposta avaliada e a nota inicial.",
                "Em casos ambíguos, limítrofes ou discutíveis, mantenha a nota inicial.",
                "Não altere notas por preferência textual, estilo de explicação, formulação alternativa ou detalhe marginal.",
                "Não premie informação que não aparece explicitamente na resposta avaliada.",
                "Não penalize ausência de conteúdo que a rubrica não exige explicitamente.",
                "Não transforme a revisão em uma avaliação independente.",
                "Se a avaliação inicial estiver plausível dentro da rubrica, mantenha a nota mesmo que você escreveria um comentário diferente.",
                "Evite ajustes maiores que 0.5 ponto por critério, salvo quando a avaliação inicial contrariar diretamente a rubrica ou ignorar uma evidência central.",
                "Se alterar uma nota, explique no comentário do critério qual erro claro da avaliação inicial justificou a alteração.",
                "Se mantiver uma nota, o comentário pode ser melhorado, mas sem modificar o score.",
                "O campo overall deve ser coerente com a média ponderada dos critérios revisados.",
                "Responda estritamente com JSON válido no mesmo schema da avaliação normal: overall, criteria e feedback.",
            ].join(" "),
        },
        {
            role: "user",
            content: JSON.stringify(
                {
                    task: "Faça uma revisão conservadora da avaliação inicial contra a rubrica e retorne a avaliação final.",
                    reviewMode: "conservative_audit",
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
                    decisionPolicy: [
                        "Primeiro, verifique se cada nota inicial é plausível segundo a rubrica.",
                        "Se a nota inicial for plausível, mantenha o score.",
                        "Só altere o score se houver erro claro: evidência central ignorada, conteúdo inexistente premiado, penalização de algo não exigido, ou incompatibilidade evidente com descritores da rubrica.",
                        "Não ajuste score apenas para refinar calibragem fina.",
                        "Não ajuste score apenas porque a resposta poderia ser mais completa, se a nota inicial já refletia essa limitação.",
                        "Em dúvida, preserve a nota inicial.",
                    ],
                    requirements: [
                        "Mantenha a escala 0-5.",
                        "Retorne somente JSON válido no schema exigido.",
                        "Não introduza novos critérios e não remova critérios da rubrica.",
                        "Garanta que todos os critérios da rubrica apareçam em criteria.",
                        "Para cada critério, preserve o score inicial salvo quando ele não for defensável pela rubrica.",
                        "Se alterar um score, deixe claro no comentário qual evidência ou ausência de evidência tornou a nota inicial indefensável.",
                        "Calcule o overall de forma coerente com os critérios revisados e seus pesos.",
                    ],
                },
                null,
                2
            ),
        },
    ];
}

function validateReviewV2Output(output: string): ReviewV2ValidationResult {
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

function parseInitialEvaluation(run: ExperimentRun): EvaluationOutput {
    const parsed = evaluationOutputSchema.safeParse(run.strategyMetadata?.initialEvaluation);
    if (!parsed.success) {
        throw new Error(
            `Review run ${run.id} does not contain a valid strategyMetadata.initialEvaluation.`
        );
    }
    return parsed.data;
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

function getReviewV2OutputPaths(outputDir: string): ReviewV2SensitivityPaths {
    const absoluteOutputDir = path.resolve(process.cwd(), outputDir);
    return {
        outputDir: absoluteOutputDir,
        rawDir: path.join(absoluteOutputDir, "raw"),
        requestDir: path.join(absoluteOutputDir, "openrouter-inputs"),
        runsJsonlPath: path.join(absoluteOutputDir, "review-v2-runs.jsonl"),
        runsJsonPath: path.join(absoluteOutputDir, "review-v2-runs.json"),
        runsCsvPath: path.join(absoluteOutputDir, "review-v2-runs.csv"),
        comparisonJsonPath: path.join(absoluteOutputDir, "comparison-summary.json"),
        comparisonCsvPath: path.join(absoluteOutputDir, "comparison-summary.csv"),
        summaryMdPath: path.join(absoluteOutputDir, "summary.md"),
    };
}

async function initializeOutput(paths: ReviewV2SensitivityPaths, overwrite: boolean): Promise<void> {
    if (overwrite) {
        await fs.rm(paths.outputDir, { recursive: true, force: true });
    } else if (await pathHasEntries(paths.outputDir)) {
        throw new Error(
            `Output directory already exists and is not empty: ${paths.outputDir}. Pass --overwrite to replace exploratory review_v2 outputs.`
        );
    }

    await fs.mkdir(paths.rawDir, { recursive: true });
    await fs.mkdir(paths.requestDir, { recursive: true });
}

async function writeReviewV2Request({
    paths,
    item,
    messages,
    callIndex,
    index,
    total,
}: {
    paths: ReviewV2SensitivityPaths;
    item: ReviewV2Item;
    messages: LLMMessage[];
    callIndex: number;
    index: number;
    total: number;
}): Promise<string> {
    const fileName = `${index.toString().padStart(3, "0")}-${sanitizePathPart(
        item.sourceReviewRun.referenceAnswerId
    )}-attempt-${callIndex}.json`;
    const requestPath = path.join(paths.requestDir, fileName);
    await writeJson(requestPath, {
        endpoint: "OpenRouter chat completions via configured provider",
        capturedAt: new Date().toISOString(),
        plannedIndex: index,
        plannedTotal: total,
        model: item.configuredModel,
        sourceReviewRunId: item.sourceReviewRun.id,
        questionSlug: item.sourceReviewRun.questionSlug,
        referenceAnswerId: item.sourceReviewRun.referenceAnswerId,
        promptVariant: REVIEW_V2_PROMPT_VERSION_SUFFIX,
        body: {
            model: item.configuredModel,
            messages,
            temperature: 0,
            seed: 42,
            max_tokens: 3000,
            response_format: "json_schema:evaluationResponse",
        },
        leakageGuard: {
            expectedOverallSentToModel: false,
            expectedCriteriaSentToModel: false,
            profileSentToModel: false,
            notesSentToModel: false,
        },
    });
    return path.relative(process.cwd(), requestPath);
}

async function writeRawOutputs(
    paths: ReviewV2SensitivityPaths,
    runId: string,
    rawOutputs: RawStrategyOutput[]
): Promise<string | undefined> {
    if (rawOutputs.length === 0) return undefined;

    const rawOutputPath = path.join(paths.rawDir, `${runId}.json`);
    await writeJson(rawOutputPath, { runId, rawOutputs });
    return path.relative(process.cwd(), rawOutputPath);
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
            phase: "review_v2",
            promptVariant: REVIEW_V2_PROMPT_VERSION_SUFFIX,
            ...(usage && { usage: toJsonValue(usage) }),
        },
    };
}

function buildReviewV2SummaryMarkdown(
    result: ReviewV2SensitivityResult,
    paths: ReviewV2SensitivityPaths
): string {
    const lines = [
        "# Review v2 Conservative Sensitivity Analysis",
        "",
        "## Objective",
        "",
        "This exploratory sensitivity run applies a conservative reviewer prompt to the frozen `review_v1` initial evaluations. It does not rerun `single`, does not rerun `multi_aggregate`, and does not replace the official main experiment.",
        "",
        "## Scope",
        "",
        `- Source experiment: \`${result.sourceExperimentId}\``,
        `- Prompt variant: \`${result.promptVariant}\``,
        `- Planned review_v2 runs: ${result.plannedRuns}`,
        `- Successful review_v2 runs: ${result.successRuns}`,
        `- Failed review_v2 runs: ${result.failedRuns}`,
        `- Raw outputs: \`${path.relative(process.cwd(), paths.rawDir)}\``,
        `- Captured model inputs: \`${path.relative(process.cwd(), paths.requestDir)}\``,
        "",
        "## Strategy Comparison",
        "",
        markdownTable(
            [
                "strategy",
                "source",
                "planned",
                "success",
                "successRate",
                "overallMAE",
                "meanSignedError",
                "callCount",
                "costCredits",
                "avgLatencyMs",
            ],
            result.comparison.map((row) => [
                row.strategy,
                row.source,
                row.plannedRuns,
                row.successRuns,
                formatValue(row.successRate),
                formatValue(row.overallMAE),
                formatValue(row.meanSignedError),
                row.totalCallCount,
                formatValue(row.totalCostCredits),
                formatValue(row.avgLatencyMs),
            ])
        ),
        "",
        "## Methodological Note",
        "",
        "`review_v2_conservative` is an exploratory prompt-sensitivity ablation. It should be reported separately from the official `single`, `review_v1`, and `multi_aggregate` results.",
    ];

    return `${lines.join("\n")}\n`;
}

const reviewV2RunColumns: Array<keyof ReviewV2SensitivityRun> = [
    "id",
    "sourceExperimentId",
    "sourceReviewRunId",
    "strategy",
    "status",
    "model",
    "configuredModel",
    "promptVersion",
    "questionSlug",
    "referenceAnswerId",
    "profile",
    "variant",
    "startedAt",
    "finishedAt",
    "latencyMs",
    "callCount",
    "requestPath",
    "rawOutputPath",
    "expectedOverall",
    "initialOverall",
    "reviewV1Overall",
    "reviewV2Overall",
    "initialAbsoluteError",
    "reviewV1AbsoluteError",
    "reviewV2AbsoluteError",
    "reviewV2SignedError",
    "reviewV2ScoreShiftFromInitial",
    "reviewV2DeltaVsReviewV1",
    "errorMessage",
    "costEstimate",
];

const reviewV2ComparisonColumns: Array<keyof ReviewV2StrategyComparison> = [
    "strategy",
    "source",
    "plannedRuns",
    "successRuns",
    "successRate",
    "overallMAE",
    "meanSignedError",
    "totalCallCount",
    "totalCostCredits",
    "avgLatencyMs",
];

async function writeJson(filePath: string, data: unknown): Promise<void> {
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function writeCsv<T extends Record<string, unknown>>(
    filePath: string,
    rows: T[],
    columns: Array<keyof T>
): Promise<void> {
    const lines = [
        columns.join(","),
        ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
    ];
    await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

function csvEscape(value: unknown): string {
    if (value === undefined || value === null) return "";
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    if (!/[",\n\r]/.test(text)) return text;
    return `"${text.replace(/"/g, '""')}"`;
}

function createReviewV2RunId({
    sourceExperimentId,
    questionSlug,
    referenceAnswerId,
    model,
    promptVersion,
}: {
    sourceExperimentId: string;
    questionSlug: string;
    referenceAnswerId: string;
    model: string;
    promptVersion: string;
}): string {
    const stableKey = JSON.stringify({
        sourceExperimentId,
        strategy: REVIEW_V2_STRATEGY,
        questionSlug,
        referenceAnswerId,
        model,
        promptVersion,
    });
    const hash = createHash("sha1").update(stableKey).digest("hex").slice(0, 10);
    return [REVIEW_V2_STRATEGY, questionSlug, referenceAnswerId, hash]
        .map(sanitizePathPart)
        .join("__");
}

function validateRealProviderConfiguration(): void {
    const provider = process.env.LLM_PROVIDER?.trim().toLowerCase();
    if (!provider || provider === "mock") {
        throw new Error(
            "Set LLM_PROVIDER to a real provider before executing review_v2 sensitivity. Run without --execute for a no-cost plan."
        );
    }
}

function getExecutionNumber(
    config: { execution?: unknown },
    key: "timeoutMs" | "retryLimit",
    fallback: number
): number {
    const execution = config.execution;
    if (!execution || typeof execution !== "object") return fallback;
    const value = (execution as Record<string, unknown>)[key];
    return typeof value === "number" ? value : fallback;
}

function getQuestionSlug(input: EvaluationInput): string {
    return input.question.meta.slug ?? input.question.meta.id;
}

function sumCostCredits(estimates: Array<StrategyCostEstimate | undefined>): number | "" {
    const values = estimates
        .map((estimate) => estimate?.costCredits)
        .filter((value): value is number => typeof value === "number");
    if (values.length === 0) return "";
    return roundTo(
        values.reduce((sum, value) => sum + value, 0),
        8
    );
}

function meanMetric(values: Array<number | "">): number | "" {
    const numeric = values.filter((value): value is number => typeof value === "number");
    if (numeric.length === 0) return "";
    return roundTo(numeric.reduce((sum, value) => sum + value, 0) / numeric.length, 4);
}

function ratio(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return roundTo(numerator / denominator, 4);
}

function roundTo(value: number, decimalPlaces: number): number {
    const factor = 10 ** decimalPlaces;
    return Math.round(value * factor) / factor;
}

function pathHasEntries(dirPath: string): Promise<boolean> {
    return fs
        .readdir(dirPath)
        .then((entries) => entries.length > 0)
        .catch(() => false);
}

function sanitizePathPart(value: string): string {
    const sanitized = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return sanitized || "item";
}

function markdownTable(headers: string[], rows: Array<Array<string | number>>): string {
    return [
        `| ${headers.join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
        ...rows.map((row) => `| ${row.map((cell) => String(cell)).join(" | ")} |`),
    ].join("\n");
}

function formatValue(value: string | number): string {
    if (value === "") return "unavailable";
    if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(4);
    return value;
}

function isTimeoutError(message: string): boolean {
    return /abort/i.test(message);
}

function toJsonValue(value: unknown): JsonValue {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
}
