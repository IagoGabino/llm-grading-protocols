import { getQuestionBySlug } from "@/lib/question-loader";
import type { ReferenceAnswer } from "@/server/experiment/reference-answers";
import type { ExperimentRun } from "@/server/experiment/runner";
import type { StrategyId } from "@/server/experiment/strategies";

import type {
    ExperimentMetricsResult,
    GroupedSummary,
    MatrixCompleteness,
    MatrixKey,
    MetricsArtifacts,
    OperationalSummary,
    PerCriterionMetric,
    PerRunMetric,
    RobustnessSummary,
    StatusCounts,
    StrategyDiagnostics,
    StrategySummary,
} from "./types";

export class ExperimentMetricsValidationError extends Error {
    constructor(
        message: string,
        readonly errors: string[]
    ) {
        super(`${message}\n${errors.map((error) => `- ${error}`).join("\n")}`);
        this.name = "ExperimentMetricsValidationError";
    }
}

export async function computeExperimentMetrics(
    artifacts: MetricsArtifacts,
    referenceAnswers: ReferenceAnswer[]
): Promise<ExperimentMetricsResult> {
    const matrixCompleteness = buildMatrixCompleteness(artifacts, referenceAnswers);
    validateRunsForMetrics(artifacts.runs);

    const perRun = buildPerRunMetrics(artifacts.runs);
    const perCriterion = buildPerCriterionMetrics(artifacts.runs);
    const perStrategy = buildPerStrategySummary(
        artifacts.protocol.config.enabledStrategies,
        perRun,
        perCriterion,
        artifacts.runs,
        matrixCompleteness
    );
    const robustness = buildRobustnessSummary(artifacts, matrixCompleteness);
    const operational = buildOperationalSummary(artifacts);
    const diagnostics = buildStrategyDiagnostics(artifacts.runs);
    const grouped = await buildGroupedSummary(artifacts.runs, perRun);

    return {
        perRun,
        perCriterion,
        perStrategy,
        robustness,
        operational,
        diagnostics,
        grouped,
        consistency: {
            evaluated: false,
            reason:
                "No predeclared score-justification consistency annotations/checklist were provided in the protocol.",
        },
    };
}

export function validateRunsForMetrics(runs: ExperimentRun[]): void {
    const errors: string[] = [];

    for (const run of runs) {
        if (run.status !== "success") continue;

        if (!run.parsedOutput) {
            errors.push(`${run.id}: success run has no parsedOutput.`);
            continue;
        }

        if (typeof run.reference.expectedOverall !== "number") {
            errors.push(`${run.id}: reference.expectedOverall is missing.`);
        }

        if (!Array.isArray(run.reference.expectedCriteria) || run.reference.expectedCriteria.length === 0) {
            errors.push(`${run.id}: reference.expectedCriteria is missing.`);
            continue;
        }

        const expectedIds = run.reference.expectedCriteria.map((criterion) => criterion.criterionId);
        const predictedIds = run.parsedOutput.criteria.map((criterion) => criterion.criterionId);
        const missing = expectedIds.filter((criterionId) => !predictedIds.includes(criterionId));
        const extra = predictedIds.filter((criterionId) => !expectedIds.includes(criterionId));

        if (missing.length > 0 || extra.length > 0) {
            errors.push(
                `${run.id}: criterion ids mismatch. Missing predicted ids: ${
                    missing.join(", ") || "<none>"
                }; extra predicted ids: ${extra.join(", ") || "<none>"}.`
            );
        }
    }

    if (errors.length > 0) {
        throw new ExperimentMetricsValidationError("Experiment metrics validation failed.", errors);
    }
}

export function buildMatrixCompleteness(
    artifacts: MetricsArtifacts,
    referenceAnswers: ReferenceAnswer[]
): MatrixCompleteness {
    const warnings: string[] = [];
    const expectedKeys =
        referenceAnswers.length > 0
            ? artifacts.protocol.config.enabledStrategies.flatMap((strategy) =>
                  referenceAnswers.map((answer) => ({
                      strategy,
                      questionSlug: answer.questionSlug,
                      referenceAnswerId: answer.id,
                      model: artifacts.protocol.config.model,
                      promptVersion: artifacts.protocol.config.promptVersion,
                  }))
              )
            : observedMatrixKeys(artifacts.runs, artifacts.protocol.config.enabledStrategies);

    if (referenceAnswers.length === 0) {
        warnings.push(
            "Reference answers were unavailable; missing executions can only be assessed against observed run pairs."
        );
    }

    const expectedKeyStrings = new Set(expectedKeys.map(matrixKeyString));
    const plannedRunsByStrategy = expectedKeys.reduce<Record<string, number>>((counts, key) => {
        counts[key.strategy] = (counts[key.strategy] ?? 0) + 1;
        return counts;
    }, {});
    const runsByKey = new Map<string, ExperimentRun[]>();
    for (const run of artifacts.runs) {
        const key = matrixKeyString(runToMatrixKey(run));
        runsByKey.set(key, [...(runsByKey.get(key) ?? []), run]);
    }

    const missingExecutions = expectedKeys.filter((key) => !runsByKey.has(matrixKeyString(key)));
    const duplicateExecutions = [...runsByKey.entries()]
        .filter(([key, runs]) => expectedKeyStrings.has(key) && runs.length > 1)
        .map(([, runs]) => ({
            ...runToMatrixKey(runs[0]),
            count: runs.length,
            runIds: runs.map((run) => run.id),
        }));

    return {
        assessmentSource: referenceAnswers.length > 0 ? "reference_answers" : "observed_runs",
        plannedRuns: expectedKeys.length,
        plannedRunsByStrategy,
        foundRuns: artifacts.runs.length,
        missingExecutions,
        duplicateExecutions,
        warnings,
    };
}

export function buildPerRunMetrics(runs: ExperimentRun[]): PerRunMetric[] {
    return runs.map((run) => {
        const predictedOverall = run.status === "success" ? (run.parsedOutput?.overall ?? "") : "";
        const expectedOverall = run.status === "success" ? run.reference.expectedOverall : "";
        const absoluteError =
            typeof predictedOverall === "number" && typeof expectedOverall === "number"
                ? roundTo(Math.abs(predictedOverall - expectedOverall), 4)
                : "";
        const signedError =
            typeof predictedOverall === "number" && typeof expectedOverall === "number"
                ? roundTo(predictedOverall - expectedOverall, 4)
                : "";
        const weightedOverallFromCriteria =
            run.status === "success" && run.parsedOutput
                ? calculateWeightedOverall(run.parsedOutput.criteria)
                : "";
        const overallConsistencyDelta =
            typeof weightedOverallFromCriteria === "number" && typeof predictedOverall === "number"
                ? roundTo(Math.abs(predictedOverall - weightedOverallFromCriteria), 4)
                : "";

        return {
            runId: run.id,
            strategy: run.strategy,
            questionSlug: run.questionSlug,
            referenceAnswerId: run.referenceAnswerId,
            profile: run.reference.profile,
            variant: run.reference.variant ?? "",
            status: run.status,
            predictedOverall,
            expectedOverall,
            absoluteError,
            signedError,
            weightedOverallFromCriteria,
            overallConsistencyDelta,
            callCount: run.callCount,
            latencyMs: run.latencyMs,
            costCredits: run.costEstimate?.costCredits ?? "",
        };
    });
}

export function buildPerCriterionMetrics(runs: ExperimentRun[]): PerCriterionMetric[] {
    return runs.flatMap((run) => {
        if (run.status !== "success" || !run.parsedOutput) return [];

        const predictedById = new Map(
            run.parsedOutput.criteria.map((criterion) => [criterion.criterionId, criterion])
        );

        return run.reference.expectedCriteria.map((expected) => {
            const predicted = predictedById.get(expected.criterionId);
            if (!predicted) {
                throw new ExperimentMetricsValidationError("Experiment metrics validation failed.", [
                    `${run.id}: missing predicted criterion ${expected.criterionId}.`,
                ]);
            }

            return {
                runId: run.id,
                strategy: run.strategy,
                questionSlug: run.questionSlug,
                referenceAnswerId: run.referenceAnswerId,
                profile: run.reference.profile,
                criterionId: expected.criterionId,
                predictedScore: predicted.score,
                expectedScore: expected.expectedScore,
                criterionAbsoluteError: roundTo(Math.abs(predicted.score - expected.expectedScore), 4),
                criterionSignedError: roundTo(predicted.score - expected.expectedScore, 4),
                weight: predicted.weight ?? "",
            };
        });
    });
}

export function buildPerStrategySummary(
    strategies: StrategyId[],
    perRun: PerRunMetric[],
    perCriterion: PerCriterionMetric[],
    runs: ExperimentRun[],
    matrixCompleteness: MatrixCompleteness
): StrategySummary[] {
    return strategies.map((strategy) => {
        const strategyRuns = perRun.filter((run) => run.strategy === strategy);
        const successRuns = strategyRuns.filter((run) => run.status === "success");
        const strategyCriteria = perCriterion.filter((criterion) => criterion.strategy === strategy);
        const plannedRuns = matrixCompleteness.plannedRunsByStrategy[strategy] ?? strategyRuns.length;
        const runRecords = runs.filter((run) => run.strategy === strategy);
        const costValues = strategyRuns
            .map((run) => run.costCredits)
            .filter((value): value is number => typeof value === "number");

        return {
            strategy,
            plannedRuns,
            foundRuns: strategyRuns.length,
            successRuns: successRuns.length,
            successRate: plannedRuns > 0 ? roundTo(successRuns.length / plannedRuns, 4) : 0,
            overallMAE: meanMetric(successRuns.map((run) => run.absoluteError)),
            overallMeanSignedError: meanMetric(successRuns.map((run) => run.signedError)),
            criterionMAE: mean(strategyCriteria.map((criterion) => criterion.criterionAbsoluteError)),
            totalCallCount: sum(runRecords.map((run) => run.callCount)),
            avgCallCount: mean(runRecords.map((run) => run.callCount)) || 0,
            totalCostCredits: costValues.length > 0 ? roundTo(sum(costValues), 8) : "",
            avgLatencyMs: mean(runRecords.map((run) => run.latencyMs)),
            maxLatencyMs: max(runRecords.map((run) => run.latencyMs)),
        };
    });
}

export function buildRobustnessSummary(
    artifacts: MetricsArtifacts,
    matrixCompleteness: MatrixCompleteness
): RobustnessSummary {
    const statusCountsByStrategy: Record<string, StatusCounts> = {};
    for (const strategy of artifacts.protocol.config.enabledStrategies) {
        statusCountsByStrategy[strategy] = createStatusCounts();
    }

    for (const run of artifacts.runs) {
        statusCountsByStrategy[run.strategy] ??= createStatusCounts();
        statusCountsByStrategy[run.strategy][run.status] += 1;
    }

    return {
        experimentId: artifacts.protocol.config.experimentId,
        plannedRuns: matrixCompleteness.plannedRuns,
        foundRuns: artifacts.runs.length,
        successRuns: artifacts.runs.filter((run) => run.status === "success").length,
        statusCountsByStrategy,
        matrixCompleteness,
        validationWarnings: [...matrixCompleteness.warnings],
    };
}

export function buildOperationalSummary(artifacts: MetricsArtifacts): OperationalSummary {
    const byStrategy: OperationalSummary["byStrategy"] = {};

    for (const strategy of artifacts.protocol.config.enabledStrategies) {
        const runs = artifacts.runs.filter((run) => run.strategy === strategy);
        const costs = runs
            .map((run) => run.costEstimate?.costCredits)
            .filter((value): value is number => typeof value === "number");

        byStrategy[strategy] = {
            foundRuns: runs.length,
            totalCallCount: sum(runs.map((run) => run.callCount)),
            avgCallCount: mean(runs.map((run) => run.callCount)) || 0,
            totalLatencyMs: sum(runs.map((run) => run.latencyMs)),
            avgLatencyMs: mean(runs.map((run) => run.latencyMs)),
            maxLatencyMs: max(runs.map((run) => run.latencyMs)),
            totalCostCredits: costs.length > 0 ? roundTo(sum(costs), 8) : "",
            avgCostCredits: costs.length > 0 ? roundTo(sum(costs) / costs.length, 8) : "",
            costAvailableRuns: costs.length,
        };
    }

    return {
        experimentId: artifacts.protocol.config.experimentId,
        byStrategy,
    };
}

export function buildStrategyDiagnostics(runs: ExperimentRun[]): StrategyDiagnostics {
    const byCriterion: StrategyDiagnostics["multiAggregate"]["byCriterion"] = {};
    let availableRuns = 0;
    let unavailableRuns = 0;

    for (const run of runs.filter((item) => item.strategy === "multi_aggregate")) {
        const stdDev = run.strategyMetadata?.criterionScoreStdDev;
        if (!stdDev || typeof stdDev !== "object" || Array.isArray(stdDev)) {
            unavailableRuns += 1;
            continue;
        }

        availableRuns += 1;
        for (const [criterionId, value] of Object.entries(stdDev)) {
            if (typeof value !== "number") continue;
            byCriterion[criterionId] ??= { samples: 0, avgStdDev: 0, maxStdDev: 0 };
            const current = byCriterion[criterionId];
            const total = current.avgStdDev * current.samples + value;
            current.samples += 1;
            current.avgStdDev = roundTo(total / current.samples, 4);
            current.maxStdDev = roundTo(Math.max(current.maxStdDev, value), 4);
        }
    }

    return {
        multiAggregate: {
            availableRuns,
            unavailableRuns,
            byCriterion,
        },
    };
}

async function buildGroupedSummary(runs: ExperimentRun[], perRun: PerRunMetric[]): Promise<GroupedSummary> {
    const axisByQuestion = new Map<string, string>();
    const difficultyByQuestion = new Map<string, string>();

    for (const questionSlug of new Set(runs.map((run) => run.questionSlug))) {
        const question = await getQuestionBySlug(questionSlug);
        axisByQuestion.set(questionSlug, question?.meta.axis ?? "unknown");
        difficultyByQuestion.set(questionSlug, question?.meta.difficulty ?? "unknown");
    }

    const groups: GroupedSummary["groups"] = [];
    groups.push(
        ...groupByDimension(perRun, "profile", (run) => run.profile),
        ...groupByDimension(perRun, "axis", (run) => axisByQuestion.get(run.questionSlug) ?? "unknown"),
        ...groupByDimension(
            perRun,
            "difficulty",
            (run) => difficultyByQuestion.get(run.questionSlug) ?? "unknown"
        )
    );

    return {
        note: "Grouped summaries are exploratory and marked sparse when a group has fewer than 3 successful runs.",
        groups,
    };
}

function groupByDimension(
    perRun: PerRunMetric[],
    groupBy: "axis" | "difficulty" | "profile",
    getGroupValue: (run: PerRunMetric) => string
): GroupedSummary["groups"] {
    const grouped = new Map<string, PerRunMetric[]>();
    for (const run of perRun.filter((item) => item.status === "success")) {
        const key = `${getGroupValue(run)}|${run.strategy}`;
        grouped.set(key, [...(grouped.get(key) ?? []), run]);
    }

    return [...grouped.entries()].map(([key, rows]) => {
        const [groupValue, strategy] = key.split("|") as [string, StrategyId];
        return {
            groupBy,
            groupValue,
            strategy,
            successRuns: rows.length,
            overallMAE: meanMetric(rows.map((row) => row.absoluteError)),
            sparse: rows.length < 3,
        };
    });
}

function observedMatrixKeys(runs: ExperimentRun[], strategies: StrategyId[]): MatrixKey[] {
    const references = uniqueBy(
        runs.map((run) => ({
            questionSlug: run.questionSlug,
            referenceAnswerId: run.referenceAnswerId,
            model: run.configuredModel,
            promptVersion: run.promptVersion,
        })),
        (item) => `${item.questionSlug}|${item.referenceAnswerId}|${item.model}|${item.promptVersion}`
    );

    return strategies.flatMap((strategy) =>
        references.map((reference) => ({
            strategy,
            ...reference,
        }))
    );
}

function runToMatrixKey(run: ExperimentRun): MatrixKey {
    return {
        strategy: run.strategy,
        questionSlug: run.questionSlug,
        referenceAnswerId: run.referenceAnswerId,
        model: run.configuredModel,
        promptVersion: run.promptVersion,
    };
}

function matrixKeyString(key: MatrixKey): string {
    return [
        key.strategy,
        key.questionSlug,
        key.referenceAnswerId,
        key.model,
        key.promptVersion,
    ].join("|");
}

function createStatusCounts(): StatusCounts {
    return {
        success: 0,
        parse_error: 0,
        schema_error: 0,
        llm_error: 0,
        timeout: 0,
    };
}

function calculateWeightedOverall(
    criteria: Array<{ score: number; weight?: number }>
): number | "" {
    if (criteria.length === 0) return "";
    const totalWeight = sum(criteria.map((criterion) => criterion.weight ?? 0));
    if (totalWeight <= 0) return roundTo(sum(criteria.map((criterion) => criterion.score)) / criteria.length, 4);
    return roundTo(
        sum(criteria.map((criterion) => criterion.score * (criterion.weight ?? 0))) / totalWeight,
        4
    );
}

function meanMetric(values: Array<number | "">): number | "" {
    return mean(values.filter((value): value is number => typeof value === "number"));
}

function mean(values: number[]): number | "" {
    if (values.length === 0) return "";
    return roundTo(sum(values) / values.length, 4);
}

function max(values: number[]): number | "" {
    if (values.length === 0) return "";
    return Math.max(...values);
}

function sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
}

function roundTo(value: number, decimalPlaces: number): number {
    const factor = 10 ** decimalPlaces;
    return Math.round(value * factor) / factor;
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
    const seen = new Set<string>();
    const unique: T[] = [];
    for (const item of items) {
        const key = getKey(item);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(item);
    }
    return unique;
}
