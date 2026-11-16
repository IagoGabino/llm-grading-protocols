import fs from "node:fs/promises";
import path from "node:path";

import { parseLLMJson } from "@/server/evaluation/json-parser";
import { recalculateOverall } from "@/server/evaluation/calculate-score";
import { evaluationResponseSchema } from "@/server/evaluation/schemas";
import { loadValidatedReferenceInputs } from "@/server/experiment/runner/reference-inputs";
import type { ExperimentRun } from "@/server/experiment/runner";
import { appEvaluationResponseToEvaluationOutput } from "@/server/experiment/strategies/adapters";
import type { EvaluationOutput, RawStrategyOutput } from "@/server/experiment/strategies";

import { loadProtocolSnapshot, loadRuns } from "./artifacts";

const EPSILON = 0.05;
const HIGH_STDDEV_THRESHOLD = 0.5;
const HIGH_ERROR_THRESHOLD = 0.3;

type Outcome = "multi_wins" | "single_wins" | "practical_tie";
type LossSeverity = "none" | "small" | "moderate" | "high";
type DispersionClass =
    | "low_dispersion_low_error"
    | "low_dispersion_high_error"
    | "high_dispersion_low_error"
    | "high_dispersion_high_error"
    | "unavailable";

export type MultiVsSinglePerRun = {
    questionSlug: string;
    referenceAnswerId: string;
    profile: string;
    variant: string;
    axis: string;
    difficulty: string;
    expectedOverall: number;
    singleOverall: number;
    multiOverall: number;
    singleAbsError: number;
    multiAbsError: number;
    singleSignedError: number;
    multiSignedError: number;
    multiVsSingleDelta: number;
    outcome: Outcome;
    lossSeverity: LossSeverity;
};

export type MultiVsSingleSummary = {
    group: string;
    value: string;
    pairs: number;
    multiWins: number;
    singleWins: number;
    practicalTies: number;
    avgSingleAbsError: number;
    avgMultiAbsError: number;
    avgDelta: number;
    avgSingleSignedError: number;
    avgMultiSignedError: number;
};

export type MultiCriterionSummary = {
    criterionId: string;
    samples: number;
    multiWins: number;
    singleWins: number;
    practicalTies: number;
    avgSingleCriterionAbsError: number;
    avgMultiCriterionAbsError: number;
    avgCriterionDelta: number;
    avgMultiSignedError: number;
    avgInternalStdDev: number | "";
};

export type MultiInternalDispersionPerRun = {
    questionSlug: string;
    referenceAnswerId: string;
    profile: string;
    variant: string;
    expectedOverall: number;
    aggregateOverall: number;
    aggregateOverallAbsError: number;
    internalOverallScores: number[];
    internalOverallMean: number | "";
    internalOverallMedian: number | "";
    internalOverallMin: number | "";
    internalOverallMax: number | "";
    internalOverallStdDev: number | "";
    bestInternalOverallAbsError: number | "";
    worstInternalOverallAbsError: number | "";
    dispersionClass: DispersionClass;
    internalEvaluationsAvailable: boolean;
    unavailableReason: string;
};

export type MultiInternalDispersionPerCriterion = {
    questionSlug: string;
    referenceAnswerId: string;
    profile: string;
    variant: string;
    criterionId: string;
    internalScores: number[];
    internalMean: number | "";
    internalMedian: number | "";
    internalMin: number | "";
    internalMax: number | "";
    internalStdDev: number | "";
    aggregateScore: number;
    expectedCriterionScore: number;
    aggregateCriterionAbsError: number;
    bestInternalCriterionAbsError: number | "";
    worstInternalCriterionAbsError: number | "";
    aggregationLoss: number | "";
    dispersionClass: DispersionClass;
};

export type MultiAggregationLossSummary = {
    totalCriterionComparisons: number;
    comparisonsWithInternalEvaluations: number;
    aggregateLostToInternalCount: number;
    avgAggregationLoss: number | "";
    byCriterion: Array<{
        criterionId: string;
        samples: number;
        aggregateLostToInternalCount: number;
        avgAggregationLoss: number | "";
    }>;
    byProfile: Array<{
        profile: string;
        samples: number;
        aggregateLostToInternalCount: number;
        avgAggregationLoss: number | "";
    }>;
};

export type MultiAggregateDiagnosticsResult = {
    generatedAt: string;
    experimentId: string;
    thresholds: {
        epsilon: number;
        highStddevThreshold: number;
        highErrorThreshold: number;
    };
    pairCount: number;
    missingPairs: string[];
    internalDataWarnings: string[];
    perRun: MultiVsSinglePerRun[];
    summaryByProfile: MultiVsSingleSummary[];
    summaryByGroup: MultiVsSingleSummary[];
    summaryByCriterion: MultiCriterionSummary[];
    internalDispersionPerRun: MultiInternalDispersionPerRun[];
    internalDispersionPerCriterion: MultiInternalDispersionPerCriterion[];
    aggregationLoss: MultiAggregationLossSummary;
};

export type MultiAggregateDiagnosticsPaths = {
    outputDir: string;
    perRunJson: string;
    perRunCsv: string;
    summaryByProfileJson: string;
    summaryByProfileCsv: string;
    summaryByCriterionJson: string;
    summaryByCriterionCsv: string;
    internalDispersionPerRunJson: string;
    internalDispersionPerCriterionJson: string;
    aggregationLossJson: string;
    summaryMd: string;
    summaryByGroupJson: string;
    summaryByGroupCsv: string;
};

type RunWithQuestionMetadata = ExperimentRun & {
    axis?: string;
    difficulty?: string;
};

type InternalEvaluation = {
    callIndex: number;
    promptVariantId: string;
    output: EvaluationOutput;
};

type InternalEvaluationLookup = {
    evaluations: InternalEvaluation[];
    warnings: string[];
};

export async function runMultiAggregateDiagnostics({
    experimentDir,
    outputDir,
}: {
    experimentDir: string;
    outputDir?: string;
}): Promise<{ result: MultiAggregateDiagnosticsResult; paths: MultiAggregateDiagnosticsPaths }> {
    const absoluteExperimentDir = path.resolve(process.cwd(), experimentDir);
    const runs = await loadRuns(path.join(absoluteExperimentDir, "runs.json"));
    const protocol = await loadProtocolSnapshot(path.join(absoluteExperimentDir, "config.json"));
    const metadataByReferenceAnswerId = await loadQuestionMetadata(protocol.config.referenceAnswersPath);
    const enrichedRuns = runs.map((run): RunWithQuestionMetadata => ({
        ...run,
        ...metadataByReferenceAnswerId.get(run.referenceAnswerId),
    }));

    const result = await computeMultiAggregateDiagnostics(enrichedRuns, absoluteExperimentDir);
    const paths = await writeMultiAggregateDiagnosticsOutputs(
        result,
        outputDir ?? path.join(absoluteExperimentDir, "metrics", "multi-aggregate-diagnostics")
    );

    return { result, paths };
}

async function computeMultiAggregateDiagnostics(
    runs: RunWithQuestionMetadata[],
    experimentDir: string
): Promise<MultiAggregateDiagnosticsResult> {
    const singleByKey = new Map(
        runs
            .filter((run) => run.strategy === "single")
            .map((run) => [runKey(run), run])
    );
    const multiRuns = runs.filter((run) => run.strategy === "multi_aggregate");
    const missingPairs: string[] = [];
    const internalDataWarnings: string[] = [];
    const perRun: MultiVsSinglePerRun[] = [];
    const internalDispersionPerRun: MultiInternalDispersionPerRun[] = [];
    const internalDispersionPerCriterion: MultiInternalDispersionPerCriterion[] = [];
    const criterionRows: Array<{
        criterionId: string;
        profile: string;
        singleAbsError: number;
        multiAbsError: number;
        criterionDelta: number;
        multiSignedError: number;
        internalStdDev: number | "";
        outcome: Outcome;
    }> = [];

    for (const multiRun of multiRuns) {
        const singleRun = singleByKey.get(runKey(multiRun));
        if (!singleRun) {
            missingPairs.push(`${multiRun.questionSlug}:${multiRun.referenceAnswerId}`);
            continue;
        }
        if (singleRun.status !== "success" || multiRun.status !== "success") continue;
        if (!singleRun.parsedOutput || !multiRun.parsedOutput) continue;

        perRun.push(toPerRunComparison(singleRun, multiRun));

        const internal = await loadInternalEvaluations(multiRun, experimentDir);
        internalDataWarnings.push(...internal.warnings);
        internalDispersionPerRun.push(toInternalDispersionPerRun(multiRun, internal.evaluations));

        for (const expected of multiRun.reference.expectedCriteria) {
            const singleCriterion = singleRun.parsedOutput.criteria.find(
                (criterion) => criterion.criterionId === expected.criterionId
            );
            const multiCriterion = multiRun.parsedOutput.criteria.find(
                (criterion) => criterion.criterionId === expected.criterionId
            );
            if (!singleCriterion || !multiCriterion) {
                internalDataWarnings.push(
                    `Missing criterion '${expected.criterionId}' in single or multi output for ${multiRun.referenceAnswerId}.`
                );
                continue;
            }

            const singleAbsError = roundTo(
                Math.abs(singleCriterion.score - expected.expectedScore),
                4
            );
            const multiAbsError = roundTo(
                Math.abs(multiCriterion.score - expected.expectedScore),
                4
            );
            const criterionDelta = roundTo(multiAbsError - singleAbsError, 4);
            const internalScores = getInternalCriterionScores(internal.evaluations, expected.criterionId);
            const internalStdDev =
                internalScores.length > 0 ? roundTo(standardDeviation(internalScores), 4) : "";

            criterionRows.push({
                criterionId: expected.criterionId,
                profile: multiRun.reference.profile,
                singleAbsError,
                multiAbsError,
                criterionDelta,
                multiSignedError: roundTo(multiCriterion.score - expected.expectedScore, 4),
                internalStdDev,
                outcome: classifyDelta(criterionDelta),
            });

            internalDispersionPerCriterion.push(
                toInternalDispersionPerCriterion(multiRun, expected, multiCriterion.score, internalScores)
            );
        }
    }

    return {
        generatedAt: new Date().toISOString(),
        experimentId: runs[0]?.experimentId ?? "unknown",
        thresholds: {
            epsilon: EPSILON,
            highStddevThreshold: HIGH_STDDEV_THRESHOLD,
            highErrorThreshold: HIGH_ERROR_THRESHOLD,
        },
        pairCount: perRun.length,
        missingPairs,
        internalDataWarnings,
        perRun,
        summaryByProfile: summarizeComparisons(perRun, "profile"),
        summaryByGroup: [
            ...summarizeComparisons(perRun, "variant"),
            ...summarizeComparisons(perRun, "questionSlug"),
            ...summarizeComparisons(perRun, "difficulty"),
            ...summarizeComparisons(perRun, "axis"),
        ],
        summaryByCriterion: summarizeCriteria(criterionRows),
        internalDispersionPerRun,
        internalDispersionPerCriterion,
        aggregationLoss: summarizeAggregationLoss(internalDispersionPerCriterion),
    };
}

function toPerRunComparison(
    singleRun: RunWithQuestionMetadata,
    multiRun: RunWithQuestionMetadata
): MultiVsSinglePerRun {
    const expectedOverall = multiRun.reference.expectedOverall;
    const singleOverall = singleRun.parsedOutput?.overall ?? 0;
    const multiOverall = multiRun.parsedOutput?.overall ?? 0;
    const singleAbsError = roundTo(Math.abs(singleOverall - expectedOverall), 4);
    const multiAbsError = roundTo(Math.abs(multiOverall - expectedOverall), 4);
    const multiVsSingleDelta = roundTo(multiAbsError - singleAbsError, 4);

    return {
        questionSlug: multiRun.questionSlug,
        referenceAnswerId: multiRun.referenceAnswerId,
        profile: multiRun.reference.profile,
        variant: multiRun.reference.variant ?? "",
        axis: multiRun.axis ?? "",
        difficulty: multiRun.difficulty ?? "",
        expectedOverall,
        singleOverall,
        multiOverall,
        singleAbsError,
        multiAbsError,
        singleSignedError: roundTo(singleOverall - expectedOverall, 4),
        multiSignedError: roundTo(multiOverall - expectedOverall, 4),
        multiVsSingleDelta,
        outcome: classifyDelta(multiVsSingleDelta),
        lossSeverity: classifyLossSeverity(multiVsSingleDelta),
    };
}

function toInternalDispersionPerRun(
    multiRun: RunWithQuestionMetadata,
    internalEvaluations: InternalEvaluation[]
): MultiInternalDispersionPerRun {
    const expectedOverall = multiRun.reference.expectedOverall;
    const aggregateOverall = multiRun.parsedOutput?.overall ?? 0;
    const aggregateOverallAbsError = roundTo(Math.abs(aggregateOverall - expectedOverall), 4);
    const scores = internalEvaluations.map((evaluation) => evaluation.output.overall);
    const internalErrors = scores.map((score) => Math.abs(score - expectedOverall));
    const stddev = scores.length > 0 ? roundTo(standardDeviation(scores), 4) : "";

    return {
        questionSlug: multiRun.questionSlug,
        referenceAnswerId: multiRun.referenceAnswerId,
        profile: multiRun.reference.profile,
        variant: multiRun.reference.variant ?? "",
        expectedOverall,
        aggregateOverall,
        aggregateOverallAbsError,
        internalOverallScores: scores,
        internalOverallMean: scores.length > 0 ? roundTo(mean(scores), 4) : "",
        internalOverallMedian: scores.length > 0 ? roundTo(median(scores), 4) : "",
        internalOverallMin: scores.length > 0 ? Math.min(...scores) : "",
        internalOverallMax: scores.length > 0 ? Math.max(...scores) : "",
        internalOverallStdDev: stddev,
        bestInternalOverallAbsError:
            internalErrors.length > 0 ? roundTo(Math.min(...internalErrors), 4) : "",
        worstInternalOverallAbsError:
            internalErrors.length > 0 ? roundTo(Math.max(...internalErrors), 4) : "",
        dispersionClass: classifyDispersion(stddev, aggregateOverallAbsError),
        internalEvaluationsAvailable: scores.length > 0,
        unavailableReason: scores.length > 0 ? "" : "No parseable internal raw outputs found.",
    };
}

function toInternalDispersionPerCriterion(
    multiRun: RunWithQuestionMetadata,
    expected: ExperimentRun["reference"]["expectedCriteria"][number],
    aggregateScore: number,
    internalScores: number[]
): MultiInternalDispersionPerCriterion {
    const aggregateCriterionAbsError = roundTo(
        Math.abs(aggregateScore - expected.expectedScore),
        4
    );
    const internalErrors = internalScores.map((score) => Math.abs(score - expected.expectedScore));
    const bestInternalCriterionAbsError =
        internalErrors.length > 0 ? roundTo(Math.min(...internalErrors), 4) : "";
    const worstInternalCriterionAbsError =
        internalErrors.length > 0 ? roundTo(Math.max(...internalErrors), 4) : "";
    const aggregationLoss =
        typeof bestInternalCriterionAbsError === "number"
            ? roundTo(aggregateCriterionAbsError - bestInternalCriterionAbsError, 4)
            : "";
    const stddev = internalScores.length > 0 ? roundTo(standardDeviation(internalScores), 4) : "";

    return {
        questionSlug: multiRun.questionSlug,
        referenceAnswerId: multiRun.referenceAnswerId,
        profile: multiRun.reference.profile,
        variant: multiRun.reference.variant ?? "",
        criterionId: expected.criterionId,
        internalScores,
        internalMean: internalScores.length > 0 ? roundTo(mean(internalScores), 4) : "",
        internalMedian: internalScores.length > 0 ? roundTo(median(internalScores), 4) : "",
        internalMin: internalScores.length > 0 ? Math.min(...internalScores) : "",
        internalMax: internalScores.length > 0 ? Math.max(...internalScores) : "",
        internalStdDev: stddev,
        aggregateScore,
        expectedCriterionScore: expected.expectedScore,
        aggregateCriterionAbsError,
        bestInternalCriterionAbsError,
        worstInternalCriterionAbsError,
        aggregationLoss,
        dispersionClass: classifyDispersion(stddev, aggregateCriterionAbsError),
    };
}

async function loadInternalEvaluations(
    multiRun: ExperimentRun,
    experimentDir: string
): Promise<InternalEvaluationLookup> {
    const warnings: string[] = [];
    const rawOutputPath = multiRun.rawOutputPath;
    if (!rawOutputPath) {
        return {
            evaluations: [],
            warnings: [`No rawOutputPath for ${multiRun.id}.`],
        };
    }

    const resolvedRawOutputPath = path.isAbsolute(rawOutputPath)
        ? rawOutputPath
        : path.resolve(process.cwd(), rawOutputPath);

    let rawFile: { rawOutputs?: RawStrategyOutput[] };
    try {
        rawFile = JSON.parse(await fs.readFile(resolvedRawOutputPath, "utf8")) as {
            rawOutputs?: RawStrategyOutput[];
        };
    } catch (error) {
        return {
            evaluations: [],
            warnings: [
                `Could not read raw outputs for ${multiRun.id}: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            ],
        };
    }

    const evaluations: InternalEvaluation[] = [];
    for (const rawOutput of rawFile.rawOutputs ?? []) {
        const parsed = parseLLMJson<unknown>(rawOutput.output);
        if (!parsed.success) {
            warnings.push(`Could not parse raw output for ${multiRun.id} call ${rawOutput.callIndex}.`);
            continue;
        }

        const validated = evaluationResponseSchema.safeParse(parsed.data);
        if (!validated.success) {
            warnings.push(
                `Raw output schema mismatch for ${multiRun.id} call ${rawOutput.callIndex}.`
            );
            continue;
        }

        const evaluation = appEvaluationResponseToEvaluationOutput(
            recalculateOverall(validated.data)
        );
        evaluations.push({
            callIndex: rawOutput.callIndex ?? evaluations.length + 1,
            promptVariantId:
                typeof rawOutput.metadata?.promptVariantId === "string"
                    ? rawOutput.metadata.promptVariantId
                    : "",
            output: evaluation,
        });
    }

    if (evaluations.length === 0) {
        warnings.push(`No parseable internal evaluations for ${multiRun.id}.`);
    }

    void experimentDir;
    return { evaluations, warnings };
}

function summarizeComparisons(
    rows: MultiVsSinglePerRun[],
    groupKey: "profile" | "variant" | "questionSlug" | "difficulty" | "axis"
): MultiVsSingleSummary[] {
    const groups = [...new Set(rows.map((row) => row[groupKey] || "unavailable"))].sort();
    return groups.map((value) => {
        const matching = rows.filter((row) => (row[groupKey] || "unavailable") === value);
        return {
            group: groupKey,
            value,
            pairs: matching.length,
            multiWins: matching.filter((row) => row.outcome === "multi_wins").length,
            singleWins: matching.filter((row) => row.outcome === "single_wins").length,
            practicalTies: matching.filter((row) => row.outcome === "practical_tie").length,
            avgSingleAbsError: meanRounded(matching.map((row) => row.singleAbsError)),
            avgMultiAbsError: meanRounded(matching.map((row) => row.multiAbsError)),
            avgDelta: meanRounded(matching.map((row) => row.multiVsSingleDelta)),
            avgSingleSignedError: meanRounded(matching.map((row) => row.singleSignedError)),
            avgMultiSignedError: meanRounded(matching.map((row) => row.multiSignedError)),
        };
    });
}

function summarizeCriteria(
    rows: Array<{
        criterionId: string;
        singleAbsError: number;
        multiAbsError: number;
        criterionDelta: number;
        multiSignedError: number;
        internalStdDev: number | "";
        outcome: Outcome;
    }>
): MultiCriterionSummary[] {
    const criterionIds = [...new Set(rows.map((row) => row.criterionId))].sort();
    return criterionIds.map((criterionId) => {
        const matching = rows.filter((row) => row.criterionId === criterionId);
        return {
            criterionId,
            samples: matching.length,
            multiWins: matching.filter((row) => row.outcome === "multi_wins").length,
            singleWins: matching.filter((row) => row.outcome === "single_wins").length,
            practicalTies: matching.filter((row) => row.outcome === "practical_tie").length,
            avgSingleCriterionAbsError: meanRounded(matching.map((row) => row.singleAbsError)),
            avgMultiCriterionAbsError: meanRounded(matching.map((row) => row.multiAbsError)),
            avgCriterionDelta: meanRounded(matching.map((row) => row.criterionDelta)),
            avgMultiSignedError: meanRounded(matching.map((row) => row.multiSignedError)),
            avgInternalStdDev: meanMetric(matching.map((row) => row.internalStdDev)),
        };
    });
}

function summarizeAggregationLoss(
    rows: MultiInternalDispersionPerCriterion[]
): MultiAggregationLossSummary {
    const withInternal = rows.filter(hasNumericAggregationLoss);
    return {
        totalCriterionComparisons: rows.length,
        comparisonsWithInternalEvaluations: withInternal.length,
        aggregateLostToInternalCount: withInternal.filter((row) => row.aggregationLoss > 0).length,
        avgAggregationLoss: meanMetric(withInternal.map((row) => row.aggregationLoss)),
        byCriterion: summarizeAggregationLossGroup(withInternal, "criterionId"),
        byProfile: summarizeAggregationLossGroup(withInternal, "profile").map((row) => ({
            profile: row.criterionId,
            samples: row.samples,
            aggregateLostToInternalCount: row.aggregateLostToInternalCount,
            avgAggregationLoss: row.avgAggregationLoss,
        })),
    };
}

function hasNumericAggregationLoss(
    row: MultiInternalDispersionPerCriterion
): row is MultiInternalDispersionPerCriterion & { aggregationLoss: number } {
    return typeof row.aggregationLoss === "number";
}

function summarizeAggregationLossGroup(
    rows: MultiInternalDispersionPerCriterion[],
    key: "criterionId" | "profile"
): Array<{
    criterionId: string;
    samples: number;
    aggregateLostToInternalCount: number;
    avgAggregationLoss: number | "";
}> {
    const values = [...new Set(rows.map((row) => row[key]))].sort();
    return values.map((value) => {
        const matching = rows.filter((row) => row[key] === value);
        return {
            criterionId: value,
            samples: matching.length,
            aggregateLostToInternalCount: matching.filter(
                (row) => typeof row.aggregationLoss === "number" && row.aggregationLoss > 0
            ).length,
            avgAggregationLoss: meanMetric(matching.map((row) => row.aggregationLoss)),
        };
    });
}

async function loadQuestionMetadata(
    referenceAnswersPath: string | undefined
): Promise<Map<string, { axis?: string; difficulty?: string }>> {
    if (!referenceAnswersPath) return new Map();
    const { inputs } = await loadValidatedReferenceInputs(referenceAnswersPath);
    return new Map(
        inputs.map((input) => [
            input.referenceAnswer.id,
            {
                axis: input.question.meta.axis,
                difficulty: input.question.meta.difficulty,
            },
        ])
    );
}

async function writeMultiAggregateDiagnosticsOutputs(
    result: MultiAggregateDiagnosticsResult,
    outputDir: string
): Promise<MultiAggregateDiagnosticsPaths> {
    const paths = getOutputPaths(path.resolve(process.cwd(), outputDir));
    await fs.mkdir(paths.outputDir, { recursive: true });

    await writeJson(paths.perRunJson, result.perRun);
    await writeCsv(paths.perRunCsv, result.perRun, perRunColumns);
    await writeJson(paths.summaryByProfileJson, result.summaryByProfile);
    await writeCsv(paths.summaryByProfileCsv, result.summaryByProfile, summaryColumns);
    await writeJson(paths.summaryByCriterionJson, result.summaryByCriterion);
    await writeCsv(paths.summaryByCriterionCsv, result.summaryByCriterion, criterionSummaryColumns);
    await writeJson(paths.internalDispersionPerRunJson, result.internalDispersionPerRun);
    await writeJson(paths.internalDispersionPerCriterionJson, result.internalDispersionPerCriterion);
    await writeJson(paths.aggregationLossJson, result.aggregationLoss);
    await writeJson(paths.summaryByGroupJson, result.summaryByGroup);
    await writeCsv(paths.summaryByGroupCsv, result.summaryByGroup, summaryColumns);
    await fs.writeFile(paths.summaryMd, buildSummaryMarkdown(result), "utf8");

    return paths;
}

function getOutputPaths(outputDir: string): MultiAggregateDiagnosticsPaths {
    return {
        outputDir,
        perRunJson: path.join(outputDir, "multi-vs-single-per-run.json"),
        perRunCsv: path.join(outputDir, "multi-vs-single-per-run.csv"),
        summaryByProfileJson: path.join(outputDir, "multi-vs-single-summary-by-profile.json"),
        summaryByProfileCsv: path.join(outputDir, "multi-vs-single-summary-by-profile.csv"),
        summaryByCriterionJson: path.join(outputDir, "multi-vs-single-summary-by-criterion.json"),
        summaryByCriterionCsv: path.join(outputDir, "multi-vs-single-summary-by-criterion.csv"),
        internalDispersionPerRunJson: path.join(outputDir, "multi-internal-dispersion-per-run.json"),
        internalDispersionPerCriterionJson: path.join(
            outputDir,
            "multi-internal-dispersion-per-criterion.json"
        ),
        aggregationLossJson: path.join(outputDir, "multi-aggregation-loss.json"),
        summaryMd: path.join(outputDir, "multi-aggregate-diagnostics-summary.md"),
        summaryByGroupJson: path.join(outputDir, "multi-vs-single-summary-by-group.json"),
        summaryByGroupCsv: path.join(outputDir, "multi-vs-single-summary-by-group.csv"),
    };
}

function buildSummaryMarkdown(result: MultiAggregateDiagnosticsResult): string {
    const totals = summarizeComparisons(result.perRun, "profile").reduce(
        (acc, row) => ({
            multiWins: acc.multiWins + row.multiWins,
            singleWins: acc.singleWins + row.singleWins,
            practicalTies: acc.practicalTies + row.practicalTies,
        }),
        { multiWins: 0, singleWins: 0, practicalTies: 0 }
    );
    const losses = result.perRun
        .filter((row) => row.outcome === "single_wins")
        .sort((left, right) => right.multiVsSingleDelta - left.multiVsSingleDelta)
        .slice(0, 8);
    const dispersionCounts = countBy(result.internalDispersionPerRun, "dispersionClass");
    const hasPattern =
        totals.singleWins > totals.multiWins &&
        result.aggregationLoss.aggregateLostToInternalCount > result.aggregationLoss.comparisonsWithInternalEvaluations / 2;

    return [
        "# Multi Aggregate Diagnostics",
        "",
        "## Objective",
        "",
        "This diagnostic analysis compares the frozen official `multi_aggregate` runs against `single` and inspects existing internal aggregate metadata/raw outputs. No new LLM calls were made, the runner was not executed, and official artifacts were not modified.",
        "",
        "## Scope",
        "",
        `- Experiment: \`${result.experimentId}\``,
        `- Analyzed single vs multi pairs: ${result.pairCount}`,
        `- Missing pairs: ${result.missingPairs.length}`,
        `- Epsilon for practical ties: ${result.thresholds.epsilon}`,
        `- High stddev threshold: ${result.thresholds.highStddevThreshold}`,
        `- High error threshold: ${result.thresholds.highErrorThreshold}`,
        `- Internal data warnings: ${result.internalDataWarnings.length}`,
        "",
        "## Overall Multi Vs Single",
        "",
        `- Multi wins: ${totals.multiWins}`,
        `- Single wins: ${totals.singleWins}`,
        `- Practical ties: ${totals.practicalTies}`,
        "",
        "## Summary By Profile",
        "",
        markdownTable(
            ["profile", "pairs", "multiWins", "singleWins", "ties", "singleMAE", "multiMAE", "avgDelta", "multiSigned"],
            result.summaryByProfile.map((row) => [
                row.value,
                row.pairs,
                row.multiWins,
                row.singleWins,
                row.practicalTies,
                formatValue(row.avgSingleAbsError),
                formatValue(row.avgMultiAbsError),
                formatValue(row.avgDelta),
                formatValue(row.avgMultiSignedError),
            ])
        ),
        "",
        "## Summary By Criterion",
        "",
        markdownTable(
            ["criterionId", "samples", "multiWins", "singleWins", "ties", "singleMAE", "multiMAE", "avgDelta", "multiSigned", "stddev"],
            result.summaryByCriterion.map((row) => [
                row.criterionId,
                row.samples,
                row.multiWins,
                row.singleWins,
                row.practicalTies,
                formatValue(row.avgSingleCriterionAbsError),
                formatValue(row.avgMultiCriterionAbsError),
                formatValue(row.avgCriterionDelta),
                formatValue(row.avgMultiSignedError),
                formatValue(row.avgInternalStdDev),
            ])
        ),
        "",
        "## Signed Error",
        "",
        signedErrorNarrative(result),
        "",
        "## Internal Dispersion",
        "",
        `- low_dispersion_low_error: ${dispersionCounts.low_dispersion_low_error ?? 0}`,
        `- low_dispersion_high_error: ${dispersionCounts.low_dispersion_high_error ?? 0}`,
        `- high_dispersion_low_error: ${dispersionCounts.high_dispersion_low_error ?? 0}`,
        `- high_dispersion_high_error: ${dispersionCounts.high_dispersion_high_error ?? 0}`,
        `- unavailable: ${dispersionCounts.unavailable ?? 0}`,
        "",
        "Low dispersion with high error suggests common evaluator bias. High dispersion with high error suggests internal instability may have hurt the final score.",
        "",
        "## Aggregation Loss",
        "",
        `- Criterion comparisons with internal evaluations: ${result.aggregationLoss.comparisonsWithInternalEvaluations}`,
        `- Criteria where aggregate lost to at least one internal evaluator: ${result.aggregationLoss.aggregateLostToInternalCount}`,
        `- Average aggregationLoss: ${formatValue(result.aggregationLoss.avgAggregationLoss)}`,
        "",
        "This is a post-hoc diagnostic only. It does not imply that production could know which internal evaluator was best without expected scores.",
        "",
        "## Main Cases Where Multi Lost To Single",
        "",
        losses.length === 0
            ? "No single-winning cases were found beyond the practical-tie threshold."
            : markdownTable(
                  ["questionSlug", "referenceAnswerId", "profile", "expected", "single", "multi", "singleErr", "multiErr", "delta", "severity"],
                  losses.map((row) => [
                      row.questionSlug,
                      row.referenceAnswerId,
                      row.profile,
                      row.expectedOverall,
                      row.singleOverall,
                      row.multiOverall,
                      row.singleAbsError,
                      row.multiAbsError,
                      row.multiVsSingleDelta,
                      row.lossSeverity,
                  ])
              ),
        "",
        "## Should we run multi_aggregate_v2?",
        "",
        hasPattern
            ? "There is some evidence worth investigating in a future exploratory `multi_aggregate_v2`: multi lost to single often enough and aggregationLoss appears frequently, suggesting the mean aggregation rule may smooth away better individual judgments. This would need to be a separate ablation and should not replace the official experiment."
            : "I would not run `multi_aggregate_v2` now. The diagnostics do not show a strong enough pattern to justify another expensive multi run before consolidating the current results. Treat possible aggregation-rule improvements as future work.",
        "",
    ].join("\n");
}

function signedErrorNarrative(result: MultiAggregateDiagnosticsResult): string {
    const overall = {
        single: meanRounded(result.perRun.map((row) => row.singleSignedError)),
        multi: meanRounded(result.perRun.map((row) => row.multiSignedError)),
    };
    const tendency =
        overall.multi > overall.single
            ? "more generous"
            : overall.multi < overall.single
              ? "more severe"
              : "similarly calibrated";
    return `Overall mean signed error: single=${formatValue(overall.single)}, multi=${formatValue(overall.multi)}. By this aggregate, multi_aggregate is ${tendency} than single. Positive signed error means generosity; negative signed error means severity.`;
}

const perRunColumns: Array<keyof MultiVsSinglePerRun> = [
    "questionSlug",
    "referenceAnswerId",
    "profile",
    "variant",
    "axis",
    "difficulty",
    "expectedOverall",
    "singleOverall",
    "multiOverall",
    "singleAbsError",
    "multiAbsError",
    "singleSignedError",
    "multiSignedError",
    "multiVsSingleDelta",
    "outcome",
    "lossSeverity",
];

const summaryColumns: Array<keyof MultiVsSingleSummary> = [
    "group",
    "value",
    "pairs",
    "multiWins",
    "singleWins",
    "practicalTies",
    "avgSingleAbsError",
    "avgMultiAbsError",
    "avgDelta",
    "avgSingleSignedError",
    "avgMultiSignedError",
];

const criterionSummaryColumns: Array<keyof MultiCriterionSummary> = [
    "criterionId",
    "samples",
    "multiWins",
    "singleWins",
    "practicalTies",
    "avgSingleCriterionAbsError",
    "avgMultiCriterionAbsError",
    "avgCriterionDelta",
    "avgMultiSignedError",
    "avgInternalStdDev",
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

function classifyDelta(delta: number): Outcome {
    if (delta < -EPSILON) return "multi_wins";
    if (delta > EPSILON) return "single_wins";
    return "practical_tie";
}

function classifyLossSeverity(delta: number): LossSeverity {
    if (delta <= EPSILON) return "none";
    if (delta <= 0.1) return "small";
    if (delta <= 0.3) return "moderate";
    return "high";
}

function classifyDispersion(stddev: number | "", error: number): DispersionClass {
    if (stddev === "") return "unavailable";
    const highDispersion = stddev >= HIGH_STDDEV_THRESHOLD;
    const highError = error >= HIGH_ERROR_THRESHOLD;
    if (!highDispersion && !highError) return "low_dispersion_low_error";
    if (!highDispersion && highError) return "low_dispersion_high_error";
    if (highDispersion && !highError) return "high_dispersion_low_error";
    return "high_dispersion_high_error";
}

function getInternalCriterionScores(
    evaluations: InternalEvaluation[],
    criterionId: string
): number[] {
    return evaluations
        .map((evaluation) =>
            evaluation.output.criteria.find((criterion) => criterion.criterionId === criterionId)
        )
        .filter((criterion): criterion is NonNullable<typeof criterion> => Boolean(criterion))
        .map((criterion) => criterion.score);
}

function runKey(run: ExperimentRun): string {
    return `${run.questionSlug}:${run.referenceAnswerId}`;
}

function mean(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
    const sorted = [...values].sort((left, right) => left - right);
    const midpoint = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[midpoint] ?? 0;
    return ((sorted[midpoint - 1] ?? 0) + (sorted[midpoint] ?? 0)) / 2;
}

function standardDeviation(values: number[]): number {
    const average = mean(values);
    const variance = mean(values.map((value) => (value - average) ** 2));
    return Math.sqrt(variance);
}

function meanRounded(values: number[]): number {
    return roundTo(mean(values), 4);
}

function meanMetric(values: Array<number | "">): number | "" {
    const numeric = values.filter((value): value is number => typeof value === "number");
    if (numeric.length === 0) return "";
    return meanRounded(numeric);
}

function roundTo(value: number, decimalPlaces: number): number {
    const factor = 10 ** decimalPlaces;
    return Math.round(value * factor) / factor;
}

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T): Record<string, number> {
    const result: Record<string, number> = {};
    for (const row of rows) {
        const value = String(row[key]);
        result[value] = (result[value] ?? 0) + 1;
    }
    return result;
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
