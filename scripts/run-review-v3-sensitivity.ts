import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import { parseLLMJson } from "@/server/evaluation/json-parser";
import { recalculateOverall } from "@/server/evaluation/calculate-score";
import { evaluationResponseSchema, type EvaluationResponse } from "@/server/evaluation/schemas";
import { createLLMProvider } from "@/server/llm";
import type { LLMMessage, LLMProvider, LLMUsage } from "@/server/llm/types";
import { loadProtocolSnapshot, loadRuns } from "@/server/experiment/metrics/artifacts";
import { appEvaluationResponseToEvaluationOutput } from "@/server/experiment/strategies/adapters";
import {
    evaluationOutputSchema,
    type EvaluationInput,
    type EvaluationOutput,
    type JsonValue,
    type RawStrategyOutput,
    type StrategyCostEstimate,
    type StrategyStatus,
} from "@/server/experiment/strategies/contracts";
import { sumCostEstimates, usageToCostEstimate } from "@/server/experiment/strategies/cost";
import type { ExperimentRun } from "@/server/experiment/runner/contracts";
import {
    loadValidatedReferenceInputs,
    type ValidatedReferenceInput,
} from "@/server/experiment/runner/reference-inputs";

const STRATEGY = "review_v3_balanced";
const PROMPT_VARIANT = "review-v3-balanced-calibration";
const RETRY_NUDGE_INVALID_JSON =
    "A resposta anterior da revisão não estava em JSON válido. Reenvie apenas o JSON no schema de avaliação, sem comentários adicionais.";
const RETRY_NUDGE_SCHEMA =
    "O JSON anterior da revisão não seguiu o schema exigido. Corrija os campos e retorne somente o JSON válido conforme descrito.";

type CliArgs = {
    experimentDir: string;
    outputDir?: string;
    overwrite: boolean;
    limit?: number;
};

type ValidationResult =
    | {
          success: true;
          evaluation: EvaluationResponse & { originalOverall?: number };
          canonicalOutput: EvaluationOutput;
      }
    | {
          success: false;
          status: "parse_error" | "schema_error";
          parsedOutput?: unknown;
          errorMessage: string;
      };

type ReviewV3Item = {
    id: string;
    sourceReviewRun: ExperimentRun;
    input: EvaluationInput;
    initialEvaluation: EvaluationOutput;
    promptVersion: string;
    configuredModel: string;
};

type ReviewV3Plan = {
    sourceExperimentId: string;
    sourceExperimentDir: string;
    outputDir: string;
    configuredModel: string;
    promptVersion: string;
    plannedRuns: number;
    referenceAnswersPath: string;
    promptVariant: typeof PROMPT_VARIANT;
    reviewRuns: Array<{
        sourceReviewRunId: string;
        questionSlug: string;
        referenceAnswerId: string;
        profile: string;
        variant: string;
    }>;
};

type ReviewV3Run = {
    id: string;
    sourceExperimentId: string;
    sourceReviewRunId: string;
    strategy: typeof STRATEGY;
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
    reviewV3Overall?: number;
    initialAbsoluteError: number;
    reviewV1AbsoluteError?: number;
    reviewV3AbsoluteError?: number;
    reviewV3SignedError?: number;
    reviewV3ScoreShiftFromInitial?: number;
    reviewV3DeltaVsReviewV1?: number;
    strategyMetadata: {
        sourceStrategy: "review";
        sourcePromptVersion: string;
        sourceModel: string;
        initialEvaluation: JsonValue;
        reviewV1Output?: JsonValue;
        reviewerAttempts: number;
        promptVariant: typeof PROMPT_VARIANT;
    };
};

type StrategyComparison = {
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

type OutputPaths = {
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

async function main(): Promise<void> {
    loadLocalEnv();
    validateRealProviderConfiguration();

    const args = parseArgs(process.argv.slice(2));
    const context = await loadContext(args);
    process.env.LLM_MODEL = context.configuredModel;

    const paths = getOutputPaths(context.outputDir);
    await initializeOutput(paths, args.overwrite);
    await writeJson(path.join(paths.outputDir, "plan.json"), context.plan);

    const provider = createLLMProvider();
    const runs: ReviewV3Run[] = [];

    console.log(`Source experiment: ${context.plan.sourceExperimentId}`);
    console.log(`Output dir: ${path.relative(process.cwd(), paths.outputDir)}`);
    console.log(`Model: ${context.configuredModel}`);
    console.log(`Prompt version: ${context.promptVersion}`);
    console.log(`Planned review_v3 executions: ${context.items.length}`);
    console.log("");

    for (const [index, item] of context.items.entries()) {
        console.log(
            `Running ${index + 1}/${context.items.length} | ${item.sourceReviewRun.referenceAnswerId}`
        );
        const run = await executeItem({
            provider,
            item,
            index: index + 1,
            total: context.items.length,
            paths,
            timeoutMs: context.timeoutMs,
            retryLimit: context.retryLimit,
        });
        runs.push(run);
        await fsp.appendFile(paths.runsJsonlPath, `${JSON.stringify(run)}\n`, "utf8");
        console.log(`Finished ${run.referenceAnswerId} | ${run.status}`);
    }

    const comparison = buildComparison(context.officialRuns, runs, context.reviewV2Runs);
    await writeJson(paths.runsJsonPath, { runs });
    await writeCsv(paths.runsCsvPath, runs, runColumns);
    await writeJson(paths.comparisonJsonPath, comparison);
    await writeCsv(paths.comparisonCsvPath, comparison, comparisonColumns);
    await fsp.writeFile(paths.summaryMdPath, buildSummaryMarkdown(context, runs, comparison, paths), "utf8");

    console.log("");
    console.log("Review v3 sensitivity complete");
    for (const row of comparison) {
        console.log(
            `${row.strategy}: MAE=${formatMetric(row.overallMAE)} success=${row.successRuns}/${row.plannedRuns} cost=${formatMetric(row.totalCostCredits)}`
        );
    }
    console.log("");
    console.log(`Summary: ${path.relative(process.cwd(), paths.summaryMdPath)}`);
}

async function loadContext(args: CliArgs): Promise<{
    officialRuns: ExperimentRun[];
    reviewV2Runs: ReviewV3Run[];
    items: ReviewV3Item[];
    outputDir: string;
    configuredModel: string;
    promptVersion: string;
    timeoutMs: number;
    retryLimit: number;
    plan: ReviewV3Plan;
}> {
    const experimentDir = path.resolve(process.cwd(), args.experimentDir);
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
        .slice(0, args.limit);

    const { inputs } = await loadValidatedReferenceInputs(config.referenceAnswersPath ?? "");
    const inputByReferenceAnswerId = new Map(
        inputs.map((input) => [input.referenceAnswer.id, input])
    );
    const configuredModel = config.model;
    const promptVersion = `${config.promptVersion}+${PROMPT_VARIANT}`;
    const outputDir =
        args.outputDir ?? path.join(experimentDir, "metrics", "review-v3-sensitivity");

    const items = reviewRuns.map((sourceReviewRun) =>
        toItem({
            sourceReviewRun,
            validatedInput: requireInput(inputByReferenceAnswerId, sourceReviewRun),
            promptVersion,
            configuredModel,
            sourceExperimentId: config.experimentId,
        })
    );
    const runtimeConfig = config as typeof config & { execution?: unknown };

    return {
        officialRuns,
        reviewV2Runs: await loadReviewV2Runs(experimentDir),
        items,
        outputDir,
        configuredModel,
        promptVersion,
        timeoutMs: getExecutionNumber(runtimeConfig, "timeoutMs", 60_000),
        retryLimit: getExecutionNumber(runtimeConfig, "retryLimit", 0),
        plan: {
            sourceExperimentId: config.experimentId,
            sourceExperimentDir: experimentDir,
            outputDir: path.resolve(process.cwd(), outputDir),
            configuredModel,
            promptVersion,
            plannedRuns: items.length,
            referenceAnswersPath: config.referenceAnswersPath ?? "",
            promptVariant: PROMPT_VARIANT,
            reviewRuns: items.map((item) => ({
                sourceReviewRunId: item.sourceReviewRun.id,
                questionSlug: item.sourceReviewRun.questionSlug,
                referenceAnswerId: item.sourceReviewRun.referenceAnswerId,
                profile: item.sourceReviewRun.reference.profile,
                variant: item.sourceReviewRun.reference.variant ?? "",
            })),
        },
    };
}

function toItem({
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
}): ReviewV3Item {
    if (sourceReviewRun.status !== "success" || !sourceReviewRun.parsedOutput) {
        throw new Error(
            `Review v3 sensitivity requires successful review_v1 runs. ${sourceReviewRun.id} has status ${sourceReviewRun.status}.`
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
        id: createRunId({
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

async function executeItem({
    provider,
    item,
    index,
    total,
    paths,
    timeoutMs,
    retryLimit,
}: {
    provider: LLMProvider;
    item: ReviewV3Item;
    index: number;
    total: number;
    paths: OutputPaths;
    timeoutMs: number;
    retryLimit: number;
}): Promise<ReviewV3Run> {
    const startedAt = new Date();
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    const rawOutputs: RawStrategyOutput[] = [];
    let messages = buildReviewV3Messages(item.input, item.initialEvaluation);
    let callCount = 0;
    let costEstimate: StrategyCostEstimate | undefined;
    let requestPath: string | undefined;
    let lastFailure:
        | {
              status: "parse_error" | "schema_error";
              errorMessage: string;
          }
        | undefined;

    try {
        while (callCount <= retryLimit) {
            callCount += 1;
            requestPath = await writeRequest({ paths, item, messages, callIndex: callCount, index, total });

            const response = await provider.invoke(messages, {
                timeoutMs,
                signal: controller.signal,
            });
            costEstimate = sumCostEstimates([
                costEstimate,
                usageToCostEstimate(response.usage),
            ]);
            rawOutputs.push(toRawStrategyOutput(response.output, response.model, callCount, response.usage));

            const validated = validateOutput(response.output);
            if (!validated.success) {
                lastFailure = {
                    status: validated.status,
                    errorMessage: validated.errorMessage,
                };

                if (callCount > retryLimit) break;

                messages = [
                    ...messages,
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

            const rawOutputPath = await writeRawOutputs(paths, item.id, rawOutputs);
            const finishedAt = new Date();
            return buildRun({
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
        return buildRun({
            item,
            status: lastFailure?.status ?? "parse_error",
            model: rawOutputs.at(-1)?.model ?? item.configuredModel,
            startedAt,
            finishedAt,
            callCount,
            requestPath,
            rawOutputPath,
            costEstimate,
            errorMessage: lastFailure?.errorMessage ?? "Não foi possível obter JSON válido do revisor v3",
        });
    } catch (error) {
        const rawOutputPath = await writeRawOutputs(paths, item.id, rawOutputs);
        const finishedAt = new Date();
        const message = error instanceof Error ? error.message : String(error);
        return buildRun({
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

function buildReviewV3Messages(
    input: EvaluationInput,
    initialOutput: EvaluationOutput
): LLMMessage[] {
    return [
        {
            role: "system",
            content: [
                "Você é um revisor técnico CALIBRADO de avaliações de Engenharia de Software.",
                "Seu objetivo é melhorar a acurácia da avaliação inicial contra a rubrica, sem transformar a revisão em uma avaliação independente do zero.",
                "Use a avaliação inicial como ponto de partida e preserve notas que estejam bem sustentadas.",
                "Mas corrija notas quando a resposta avaliada e a rubrica indicarem uma nota materialmente melhor, mesmo que a nota inicial seja apenas plausível.",
                "Procure tanto superestimações quanto subestimações.",
                "Não seja conservador a ponto de manter erro corrigível; também não faça ajustes cosméticos.",
                "Ajustes pequenos de calibragem fina devem ser evitados; prefira alterar quando a diferença esperada for de pelo menos 0.25 ponto no critério.",
                "Evite ajustes maiores que 1.0 ponto por critério salvo quando houver evidência muito clara.",
                "Não premie informação que não aparece explicitamente na resposta avaliada.",
                "Não penalize ausência de conteúdo que a rubrica não exige explicitamente.",
                "Se alterar uma nota, explique no comentário do critério qual evidência da resposta e qual ponto da rubrica justificam a mudança.",
                "Se mantiver uma nota, o comentário pode ser melhorado, mas não precisa defender longamente a manutenção.",
                "O campo overall deve ser coerente com a média ponderada dos critérios revisados.",
                "Responda estritamente com JSON válido no mesmo schema da avaliação normal: overall, criteria e feedback.",
            ].join(" "),
        },
        {
            role: "user",
            content: JSON.stringify(
                {
                    task: "Faça uma revisão calibrada da avaliação inicial contra a rubrica e retorne a avaliação final.",
                    reviewMode: "balanced_calibration",
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
                        "Para cada critério, identifique primeiro a evidência explícita presente na resposta avaliada.",
                        "Compare essa evidência com os descritores e pesos da rubrica.",
                        "Compare então a nota inicial com a nota mais bem sustentada pela rubrica.",
                        "Mantenha a nota inicial se ela estiver próxima da nota melhor sustentada.",
                        "Altere a nota se a resposta e a rubrica sustentarem uma correção material, incluindo casos de nota inicial excessivamente alta ou baixa.",
                        "Não altere nota apenas por estilo, preferência textual, comentário incompleto ou diferença marginal.",
                        "Não use expectedOverall, profile, notes ou qualquer expectativa externa; decida apenas por resposta, rubrica e avaliação inicial.",
                    ],
                    requirements: [
                        "Mantenha a escala 0-5.",
                        "Retorne somente JSON válido no schema exigido.",
                        "Não introduza novos critérios e não remova critérios da rubrica.",
                        "Garanta que todos os critérios da rubrica apareçam em criteria.",
                        "Ajustes por critério devem ser deliberados: preserve quando a nota inicial estiver boa, corrija quando houver ganho claro de alinhamento com a rubrica.",
                        "Se alterar um score, deixe claro no comentário qual evidência ou ausência de evidência tornou a alteração necessária.",
                        "Calcule o overall de forma coerente com os critérios revisados e seus pesos.",
                    ],
                },
                null,
                2
            ),
        },
    ];
}

function buildRun({
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
    item: ReviewV3Item;
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
}): ReviewV3Run {
    const sourceRun = item.sourceReviewRun;
    const expectedOverall = sourceRun.reference.expectedOverall;
    const initialAbsoluteError = roundTo(
        Math.abs(item.initialEvaluation.overall - expectedOverall),
        4
    );
    const reviewV1AbsoluteError = sourceRun.parsedOutput
        ? roundTo(Math.abs(sourceRun.parsedOutput.overall - expectedOverall), 4)
        : undefined;
    const reviewV3AbsoluteError = parsedOutput
        ? roundTo(Math.abs(parsedOutput.overall - expectedOverall), 4)
        : undefined;

    return {
        id: item.id,
        sourceExperimentId: sourceRun.experimentId,
        sourceReviewRunId: sourceRun.id,
        strategy: STRATEGY,
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
        reviewV3Overall: parsedOutput?.overall,
        initialAbsoluteError,
        ...(reviewV1AbsoluteError !== undefined && { reviewV1AbsoluteError }),
        ...(reviewV3AbsoluteError !== undefined && { reviewV3AbsoluteError }),
        ...(parsedOutput && {
            reviewV3SignedError: roundTo(parsedOutput.overall - expectedOverall, 4),
            reviewV3ScoreShiftFromInitial: roundTo(
                parsedOutput.overall - item.initialEvaluation.overall,
                4
            ),
        }),
        ...(reviewV3AbsoluteError !== undefined &&
            reviewV1AbsoluteError !== undefined && {
                reviewV3DeltaVsReviewV1: roundTo(reviewV3AbsoluteError - reviewV1AbsoluteError, 4),
            }),
        strategyMetadata: {
            sourceStrategy: "review",
            sourcePromptVersion: sourceRun.promptVersion,
            sourceModel: sourceRun.model,
            initialEvaluation: toJsonValue(item.initialEvaluation),
            ...(sourceRun.parsedOutput && { reviewV1Output: toJsonValue(sourceRun.parsedOutput) }),
            reviewerAttempts: callCount,
            promptVariant: PROMPT_VARIANT,
        },
    };
}

function buildComparison(
    officialRuns: ExperimentRun[],
    reviewV3Runs: ReviewV3Run[],
    reviewV2Runs: ReviewV3Run[]
): StrategyComparison[] {
    return [
        summarizeOfficialStrategy("single", officialRuns),
        summarizeOfficialStrategy("review_v1", officialRuns),
        summarizeSensitivity("review_v2_conservative", reviewV2Runs, "reviewV3AbsoluteError"),
        summarizeSensitivity(STRATEGY, reviewV3Runs, "reviewV3AbsoluteError"),
        summarizeOfficialStrategy("multi_aggregate", officialRuns),
    ];
}

function summarizeOfficialStrategy(
    strategy: "single" | "review_v1" | "multi_aggregate",
    officialRuns: ExperimentRun[]
): StrategyComparison {
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

function summarizeSensitivity(
    strategy: string,
    runs: ReviewV3Run[],
    absoluteErrorKey: keyof Pick<ReviewV3Run, "reviewV3AbsoluteError">
): StrategyComparison {
    const successfulRuns = runs.filter((run) => run.status === "success" && run.parsedOutput);
    return {
        strategy,
        source: "sensitivity",
        plannedRuns: runs.length,
        successRuns: successfulRuns.length,
        successRate: ratio(successfulRuns.length, runs.length),
        overallMAE: meanMetric(
            successfulRuns.map((run) => {
                const value = run[absoluteErrorKey];
                return typeof value === "number" ? value : "";
            })
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

async function loadReviewV2Runs(experimentDir: string): Promise<ReviewV3Run[]> {
    const reviewV2Path = path.join(
        experimentDir,
        "metrics",
        "review-v2-sensitivity",
        "review-v2-runs.json"
    );
    try {
        const raw = JSON.parse(await fsp.readFile(reviewV2Path, "utf8")) as { runs?: unknown[] };
        return (raw.runs ?? []).map((run) => normalizeReviewV2Run(run));
    } catch {
        return [];
    }
}

function normalizeReviewV2Run(value: unknown): ReviewV3Run {
    const run = value as Record<string, unknown>;
    return {
        ...(run as unknown as ReviewV3Run),
        strategy: "review_v2_conservative" as typeof STRATEGY,
        reviewV3Overall: run.reviewV2Overall as number | undefined,
        reviewV3AbsoluteError: run.reviewV2AbsoluteError as number | undefined,
        reviewV3SignedError: run.reviewV2SignedError as number | undefined,
        reviewV3ScoreShiftFromInitial: run.reviewV2ScoreShiftFromInitial as number | undefined,
        reviewV3DeltaVsReviewV1: run.reviewV2DeltaVsReviewV1 as number | undefined,
    };
}

function validateOutput(output: string): ValidationResult {
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
    return {
        kind: "student",
        resposta: input.answer.kind === "student" ? input.answer.resposta : input.answer.answerText,
        raciocinio: input.answer.kind === "student" ? input.answer.raciocinio : input.answer.justification,
        codigo: input.answer.kind === "student" ? input.answer.codigo : input.answer.code,
        language: input.answer.language,
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

function getOutputPaths(outputDir: string): OutputPaths {
    const absoluteOutputDir = path.resolve(process.cwd(), outputDir);
    return {
        outputDir: absoluteOutputDir,
        rawDir: path.join(absoluteOutputDir, "raw"),
        requestDir: path.join(absoluteOutputDir, "openrouter-inputs"),
        runsJsonlPath: path.join(absoluteOutputDir, "review-v3-runs.jsonl"),
        runsJsonPath: path.join(absoluteOutputDir, "review-v3-runs.json"),
        runsCsvPath: path.join(absoluteOutputDir, "review-v3-runs.csv"),
        comparisonJsonPath: path.join(absoluteOutputDir, "comparison-summary.json"),
        comparisonCsvPath: path.join(absoluteOutputDir, "comparison-summary.csv"),
        summaryMdPath: path.join(absoluteOutputDir, "summary.md"),
    };
}

async function initializeOutput(paths: OutputPaths, overwrite: boolean): Promise<void> {
    if (overwrite) {
        await fsp.rm(paths.outputDir, { recursive: true, force: true });
    } else if (await pathHasEntries(paths.outputDir)) {
        throw new Error(
            `Output directory already exists and is not empty: ${paths.outputDir}. Pass --overwrite to replace exploratory review_v3 outputs.`
        );
    }

    await fsp.mkdir(paths.rawDir, { recursive: true });
    await fsp.mkdir(paths.requestDir, { recursive: true });
}

async function writeRequest({
    paths,
    item,
    messages,
    callIndex,
    index,
    total,
}: {
    paths: OutputPaths;
    item: ReviewV3Item;
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
        promptVariant: PROMPT_VARIANT,
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
    paths: OutputPaths,
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
            phase: STRATEGY,
            promptVariant: PROMPT_VARIANT,
            ...(usage && { usage: toJsonValue(usage) }),
        },
    };
}

function buildSummaryMarkdown(
    context: { plan: unknown },
    runs: ReviewV3Run[],
    comparison: StrategyComparison[],
    paths: OutputPaths
): string {
    const changedRuns = runs.filter((run) => run.reviewV3Overall !== run.initialOverall).length;
    const lines = [
        "# Review v3 Balanced Sensitivity Analysis",
        "",
        "## Objective",
        "",
        "This exploratory sensitivity run applies a balanced reviewer prompt to the frozen `review_v1` initial evaluations. It does not rerun `single`, does not rerun `multi_aggregate`, and does not replace the official main experiment.",
        "",
        "## Scope",
        "",
        `- Prompt variant: \`${PROMPT_VARIANT}\``,
        `- Planned review_v3 runs: ${runs.length}`,
        `- Successful review_v3 runs: ${runs.filter((run) => run.status === "success").length}`,
        `- Changed overall scores vs initial: ${changedRuns}`,
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
            comparison.map((row) => [
                row.strategy,
                row.source,
                row.plannedRuns,
                row.successRuns,
                formatMetric(row.successRate),
                formatMetric(row.overallMAE),
                formatMetric(row.meanSignedError),
                row.totalCallCount,
                formatMetric(row.totalCostCredits),
                formatMetric(row.avgLatencyMs),
            ])
        ),
        "",
        "## Methodological Note",
        "",
        "`review_v3_balanced` is an exploratory prompt-sensitivity ablation. It should be reported separately from the official `single`, `review_v1`, and `multi_aggregate` results.",
    ];

    void context;
    return `${lines.join("\n")}\n`;
}

const runColumns: Array<keyof ReviewV3Run> = [
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
    "reviewV3Overall",
    "initialAbsoluteError",
    "reviewV1AbsoluteError",
    "reviewV3AbsoluteError",
    "reviewV3SignedError",
    "reviewV3ScoreShiftFromInitial",
    "reviewV3DeltaVsReviewV1",
    "errorMessage",
    "costEstimate",
];

const comparisonColumns: Array<keyof StrategyComparison> = [
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

function parseArgs(argv: string[]): CliArgs {
    const experimentDir = readOption(argv, "--experiment-dir") ?? readOption(argv, "-d");
    const outputDir = readOption(argv, "--output-dir");
    const limitValue = readOption(argv, "--limit");

    if (!experimentDir) {
        throw new Error(
            "Usage: npm run run:review-v3-sensitivity -- --experiment-dir <experiments/results/experiment-runs/<id>> [--overwrite] [--limit <n>] [--output-dir <dir>]"
        );
    }

    return {
        experimentDir,
        ...(outputDir && { outputDir }),
        overwrite: argv.includes("--overwrite"),
        ...(limitValue && { limit: parsePositiveInteger(limitValue, "--limit") }),
    };
}

function readOption(argv: string[], name: string): string | undefined {
    const index = argv.indexOf(name);
    if (index === -1) return undefined;
    return argv[index + 1];
}

function parsePositiveInteger(value: string, label: string): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`${label} must be a positive integer.`);
    }
    return parsed;
}

function createRunId({
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
        strategy: STRATEGY,
        questionSlug,
        referenceAnswerId,
        model,
        promptVersion,
    });
    const hash = createHash("sha1").update(stableKey).digest("hex").slice(0, 10);
    return [STRATEGY, questionSlug, referenceAnswerId, hash].map(sanitizePathPart).join("__");
}

function validateRealProviderConfiguration(): void {
    const provider = process.env.LLM_PROVIDER?.trim().toLowerCase();
    if (!provider || provider === "mock") {
        throw new Error("Set LLM_PROVIDER to a real provider before executing review_v3 sensitivity.");
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
    return fsp
        .readdir(dirPath)
        .then((entries) => entries.length > 0)
        .catch(() => false);
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
    await fsp.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
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
    await fsp.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

function csvEscape(value: unknown): string {
    if (value === undefined || value === null) return "";
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    if (!/[",\n\r]/.test(text)) return text;
    return `"${text.replace(/"/g, '""')}"`;
}

function markdownTable(headers: string[], rows: Array<Array<string | number>>): string {
    return [
        `| ${headers.join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
        ...rows.map((row) => `| ${row.map((cell) => String(cell)).join(" | ")} |`),
    ].join("\n");
}

function formatMetric(value: number | string): string {
    if (value === "") return "unavailable";
    if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(4);
    return value;
}

function sanitizePathPart(value: string): string {
    const sanitized = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return sanitized || "item";
}

function isTimeoutError(message: string): boolean {
    return /abort/i.test(message);
}

function toJsonValue(value: unknown): JsonValue {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function loadLocalEnv(): void {
    const envPath = path.join(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) return;

    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex === -1) continue;

        const key = trimmed.slice(0, separatorIndex).trim();
        const rawValue = trimmed.slice(separatorIndex + 1).trim();
        if (!key || process.env[key] !== undefined) continue;

        process.env[key] = stripEnvQuotes(rawValue);
    }
}

function stripEnvQuotes(value: string): string {
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        return value.slice(1, -1);
    }

    return value;
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
