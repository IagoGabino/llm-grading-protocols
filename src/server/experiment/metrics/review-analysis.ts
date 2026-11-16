import fs from "node:fs/promises";
import path from "node:path";

import type { ExperimentRun } from "@/server/experiment/runner";

import { loadRuns } from "./artifacts";

const EPSILON = 0.05;
const OVERCORRECTION_CLOSE_THRESHOLD = 0.25;
const OVERCORRECTION_SHIFT_THRESHOLD = 0.5;

export type ReviewOutcome = "improved" | "worsened" | "unchanged" | "unavailable";

export type ReviewRunAnalysis = {
    runId: string;
    questionSlug: string;
    referenceAnswerId: string;
    profile: string;
    variant: string;
    status: ExperimentRun["status"];
    initialOverall: number | "";
    finalOverall: number | "";
    expectedOverall: number | "";
    initialAbsoluteError: number | "";
    finalAbsoluteError: number | "";
    reviewDelta: number | "";
    initialSignedError: number | "";
    finalSignedError: number | "";
    scoreShift: number | "";
    outcome: ReviewOutcome;
    overcorrectionCandidate: boolean;
};

export type ReviewCriterionAnalysis = {
    runId: string;
    questionSlug: string;
    referenceAnswerId: string;
    profile: string;
    variant: string;
    criterionId: string;
    initialCriterionScore: number;
    finalCriterionScore: number;
    expectedCriterionScore: number;
    initialCriterionAbsoluteError: number;
    finalCriterionAbsoluteError: number;
    criterionReviewDelta: number;
    criterionScoreShift: number;
    criterionOutcome: Exclude<ReviewOutcome, "unavailable">;
};

export type ReviewProfileSummary = {
    profile: string;
    runs: number;
    improvedRuns: number;
    worsenedRuns: number;
    unchangedRuns: number;
    unavailableRuns: number;
    avgInitialAbsoluteError: number | "";
    avgFinalAbsoluteError: number | "";
    avgReviewDelta: number | "";
    avgScoreShift: number | "";
    avgInitialSignedError: number | "";
    avgFinalSignedError: number | "";
};

export type ReviewCriterionSummary = {
    criterionId: string;
    samples: number;
    improvedCriteria: number;
    worsenedCriteria: number;
    unchangedCriteria: number;
    avgInitialCriterionAbsoluteError: number | "";
    avgFinalCriterionAbsoluteError: number | "";
    avgCriterionReviewDelta: number | "";
    avgCriterionScoreShift: number | "";
};

export type ReviewAnalysisResult = {
    experimentId: string;
    sourceRunsPath: string;
    generatedAt: string;
    epsilon: number;
    totalReviewRuns: number;
    analyzedRuns: number;
    unavailableRuns: number;
    improvedRuns: number;
    worsenedRuns: number;
    unchangedRuns: number;
    avgScoreShift: number | "";
    avgInitialSignedError: number | "";
    avgFinalSignedError: number | "";
    perRun: ReviewRunAnalysis[];
    perCriterion: ReviewCriterionAnalysis[];
    summaryByProfile: ReviewProfileSummary[];
    summaryByCriterion: ReviewCriterionSummary[];
    overcorrectionCandidates: ReviewRunAnalysis[];
};

export type ReviewAnalysisOutputPaths = {
    outputDir: string;
    perRunJson: string;
    perRunCsv: string;
    perCriterionJson: string;
    perCriterionCsv: string;
    summaryByProfileJson: string;
    summaryByProfileCsv: string;
    summaryByCriterionJson: string;
    summaryByCriterionCsv: string;
    summaryMd: string;
};

export async function runReviewAnalysis({
    experimentDir,
    outputDir,
}: {
    experimentDir: string;
    outputDir?: string;
}): Promise<{ result: ReviewAnalysisResult; paths: ReviewAnalysisOutputPaths }> {
    const absoluteExperimentDir = path.resolve(process.cwd(), experimentDir);
    const runsPath = path.join(absoluteExperimentDir, "runs.json");
    const runs = await loadRuns(runsPath);
    const result = computeReviewAnalysis(runs, path.relative(process.cwd(), runsPath));
    const paths = await writeReviewAnalysisOutputs(
        result,
        outputDir ?? path.join(absoluteExperimentDir, "metrics", "review-analysis")
    );

    return { result, paths };
}

export function computeReviewAnalysis(
    runs: ExperimentRun[],
    sourceRunsPath = "runs.json"
): ReviewAnalysisResult {
    const reviewRuns = runs.filter((run) => run.strategy === "review");
    const perRun = reviewRuns.map(toReviewRunAnalysis);
    const perCriterion = reviewRuns.flatMap(toReviewCriterionAnalysis);
    const summaryByProfile = summarizeByProfile(perRun);
    const summaryByCriterion = summarizeByCriterion(perCriterion);
    const analyzedRuns = perRun.filter((run) => run.outcome !== "unavailable");
    const overcorrectionCandidates = analyzedRuns
        .filter((run) => run.overcorrectionCandidate)
        .sort((left, right) => numericDesc(left.reviewDelta, right.reviewDelta))
        .slice(0, 8);

    return {
        experimentId: runs[0]?.experimentId ?? "unknown",
        sourceRunsPath,
        generatedAt: new Date().toISOString(),
        epsilon: EPSILON,
        totalReviewRuns: reviewRuns.length,
        analyzedRuns: analyzedRuns.length,
        unavailableRuns: perRun.filter((run) => run.outcome === "unavailable").length,
        improvedRuns: analyzedRuns.filter((run) => run.outcome === "improved").length,
        worsenedRuns: analyzedRuns.filter((run) => run.outcome === "worsened").length,
        unchangedRuns: analyzedRuns.filter((run) => run.outcome === "unchanged").length,
        avgScoreShift: meanMetric(analyzedRuns.map((run) => run.scoreShift)),
        avgInitialSignedError: meanMetric(analyzedRuns.map((run) => run.initialSignedError)),
        avgFinalSignedError: meanMetric(analyzedRuns.map((run) => run.finalSignedError)),
        perRun,
        perCriterion,
        summaryByProfile,
        summaryByCriterion,
        overcorrectionCandidates,
    };
}

async function writeReviewAnalysisOutputs(
    result: ReviewAnalysisResult,
    outputDir: string
): Promise<ReviewAnalysisOutputPaths> {
    const absoluteOutputDir = path.resolve(process.cwd(), outputDir);
    const paths = getReviewAnalysisOutputPaths(absoluteOutputDir);
    await fs.mkdir(paths.outputDir, { recursive: true });

    await writeJson(paths.perRunJson, result.perRun);
    await writeCsv(paths.perRunCsv, result.perRun, reviewRunColumns);
    await writeJson(paths.perCriterionJson, result.perCriterion);
    await writeCsv(paths.perCriterionCsv, result.perCriterion, reviewCriterionColumns);
    await writeJson(paths.summaryByProfileJson, result.summaryByProfile);
    await writeCsv(paths.summaryByProfileCsv, result.summaryByProfile, profileSummaryColumns);
    await writeJson(paths.summaryByCriterionJson, result.summaryByCriterion);
    await writeCsv(paths.summaryByCriterionCsv, result.summaryByCriterion, criterionSummaryColumns);
    await fs.writeFile(paths.summaryMd, buildReviewSummaryMarkdown(result), "utf8");

    return paths;
}

function getReviewAnalysisOutputPaths(outputDir: string): ReviewAnalysisOutputPaths {
    return {
        outputDir,
        perRunJson: path.join(outputDir, "review-v1-per-run-analysis.json"),
        perRunCsv: path.join(outputDir, "review-v1-per-run-analysis.csv"),
        perCriterionJson: path.join(outputDir, "review-v1-per-criterion-analysis.json"),
        perCriterionCsv: path.join(outputDir, "review-v1-per-criterion-analysis.csv"),
        summaryByProfileJson: path.join(outputDir, "review-v1-summary-by-profile.json"),
        summaryByProfileCsv: path.join(outputDir, "review-v1-summary-by-profile.csv"),
        summaryByCriterionJson: path.join(outputDir, "review-v1-summary-by-criterion.json"),
        summaryByCriterionCsv: path.join(outputDir, "review-v1-summary-by-criterion.csv"),
        summaryMd: path.join(outputDir, "review-v1-summary.md"),
    };
}

function toReviewRunAnalysis(run: ExperimentRun): ReviewRunAnalysis {
    const initial = extractInitialEvaluation(run);
    const final = run.parsedOutput;
    const expectedOverall = run.reference.expectedOverall;

    if (run.status !== "success" || !initial || !final) {
        return {
            runId: run.id,
            questionSlug: run.questionSlug,
            referenceAnswerId: run.referenceAnswerId,
            profile: run.reference.profile,
            variant: run.reference.variant ?? "",
            status: run.status,
            initialOverall: "",
            finalOverall: "",
            expectedOverall: run.status === "success" ? expectedOverall : "",
            initialAbsoluteError: "",
            finalAbsoluteError: "",
            reviewDelta: "",
            initialSignedError: "",
            finalSignedError: "",
            scoreShift: "",
            outcome: "unavailable",
            overcorrectionCandidate: false,
        };
    }

    const initialAbsoluteError = roundTo(Math.abs(initial.overall - expectedOverall), 4);
    const finalAbsoluteError = roundTo(Math.abs(final.overall - expectedOverall), 4);
    const reviewDelta = roundTo(finalAbsoluteError - initialAbsoluteError, 4);
    const scoreShift = roundTo(final.overall - initial.overall, 4);

    return {
        runId: run.id,
        questionSlug: run.questionSlug,
        referenceAnswerId: run.referenceAnswerId,
        profile: run.reference.profile,
        variant: run.reference.variant ?? "",
        status: run.status,
        initialOverall: initial.overall,
        finalOverall: final.overall,
        expectedOverall,
        initialAbsoluteError,
        finalAbsoluteError,
        reviewDelta,
        initialSignedError: roundTo(initial.overall - expectedOverall, 4),
        finalSignedError: roundTo(final.overall - expectedOverall, 4),
        scoreShift,
        outcome: classifyDelta(reviewDelta),
        overcorrectionCandidate:
            (initialAbsoluteError <= OVERCORRECTION_CLOSE_THRESHOLD &&
                reviewDelta > OVERCORRECTION_CLOSE_THRESHOLD) ||
            (Math.abs(scoreShift) >= OVERCORRECTION_SHIFT_THRESHOLD && reviewDelta >= 0),
    };
}

function toReviewCriterionAnalysis(run: ExperimentRun): ReviewCriterionAnalysis[] {
    const initial = extractInitialEvaluation(run);
    const final = run.parsedOutput;
    if (run.status !== "success" || !initial || !final) return [];

    const initialById = new Map(initial.criteria.map((criterion) => [criterion.criterionId, criterion]));
    const finalById = new Map(final.criteria.map((criterion) => [criterion.criterionId, criterion]));

    return run.reference.expectedCriteria.map((expected) => {
        const initialCriterion = initialById.get(expected.criterionId);
        const finalCriterion = finalById.get(expected.criterionId);

        if (!initialCriterion || !finalCriterion) {
            const missingSource = [
                !initialCriterion && "initialEvaluation",
                !finalCriterion && "parsedOutput",
            ]
                .filter(Boolean)
                .join(" and ");
            throw new Error(
                `Review analysis cannot match criterion '${expected.criterionId}' for run '${run.id}' in ${missingSource}.`
            );
        }

        const initialCriterionAbsoluteError = roundTo(
            Math.abs(initialCriterion.score - expected.expectedScore),
            4
        );
        const finalCriterionAbsoluteError = roundTo(
            Math.abs(finalCriterion.score - expected.expectedScore),
            4
        );
        const criterionReviewDelta = roundTo(
            finalCriterionAbsoluteError - initialCriterionAbsoluteError,
            4
        );

        return {
            runId: run.id,
            questionSlug: run.questionSlug,
            referenceAnswerId: run.referenceAnswerId,
            profile: run.reference.profile,
            variant: run.reference.variant ?? "",
            criterionId: expected.criterionId,
            initialCriterionScore: initialCriterion.score,
            finalCriterionScore: finalCriterion.score,
            expectedCriterionScore: expected.expectedScore,
            initialCriterionAbsoluteError,
            finalCriterionAbsoluteError,
            criterionReviewDelta,
            criterionScoreShift: roundTo(finalCriterion.score - initialCriterion.score, 4),
            criterionOutcome: classifyDelta(criterionReviewDelta),
        };
    });
}

function extractInitialEvaluation(
    run: ExperimentRun
): ExperimentRun["parsedOutput"] | undefined {
    const candidate = run.strategyMetadata?.initialEvaluation;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return undefined;
    if (!("overall" in candidate) || !("criteria" in candidate)) return undefined;

    return candidate as ExperimentRun["parsedOutput"];
}

function summarizeByProfile(perRun: ReviewRunAnalysis[]): ReviewProfileSummary[] {
    const profiles = [...new Set(perRun.map((run) => run.profile))].sort();
    return profiles.map((profile) => {
        const rows = perRun.filter((run) => run.profile === profile);
        return {
            profile,
            runs: rows.length,
            improvedRuns: rows.filter((run) => run.outcome === "improved").length,
            worsenedRuns: rows.filter((run) => run.outcome === "worsened").length,
            unchangedRuns: rows.filter((run) => run.outcome === "unchanged").length,
            unavailableRuns: rows.filter((run) => run.outcome === "unavailable").length,
            avgInitialAbsoluteError: meanMetric(rows.map((run) => run.initialAbsoluteError)),
            avgFinalAbsoluteError: meanMetric(rows.map((run) => run.finalAbsoluteError)),
            avgReviewDelta: meanMetric(rows.map((run) => run.reviewDelta)),
            avgScoreShift: meanMetric(rows.map((run) => run.scoreShift)),
            avgInitialSignedError: meanMetric(rows.map((run) => run.initialSignedError)),
            avgFinalSignedError: meanMetric(rows.map((run) => run.finalSignedError)),
        };
    });
}

function summarizeByCriterion(perCriterion: ReviewCriterionAnalysis[]): ReviewCriterionSummary[] {
    const criterionIds = [...new Set(perCriterion.map((criterion) => criterion.criterionId))].sort();
    return criterionIds.map((criterionId) => {
        const rows = perCriterion.filter((criterion) => criterion.criterionId === criterionId);
        return {
            criterionId,
            samples: rows.length,
            improvedCriteria: rows.filter((criterion) => criterion.criterionOutcome === "improved")
                .length,
            worsenedCriteria: rows.filter((criterion) => criterion.criterionOutcome === "worsened")
                .length,
            unchangedCriteria: rows.filter((criterion) => criterion.criterionOutcome === "unchanged")
                .length,
            avgInitialCriterionAbsoluteError: meanMetric(
                rows.map((criterion) => criterion.initialCriterionAbsoluteError)
            ),
            avgFinalCriterionAbsoluteError: meanMetric(
                rows.map((criterion) => criterion.finalCriterionAbsoluteError)
            ),
            avgCriterionReviewDelta: meanMetric(
                rows.map((criterion) => criterion.criterionReviewDelta)
            ),
            avgCriterionScoreShift: meanMetric(rows.map((criterion) => criterion.criterionScoreShift)),
        };
    });
}

function buildReviewSummaryMarkdown(result: ReviewAnalysisResult): string {
    const lines = [
        "# Review v1 Exploratory Analysis",
        "",
        "## Objective",
        "",
        "This diagnostic analysis explains the observed behavior of `review_v1` by comparing the initial evaluation saved in `strategyMetadata.initialEvaluation` with the final revised `parsedOutput` from the same frozen review runs.",
        "",
        "This is exploratory and diagnostic. It reads frozen experiment artifacts only and does not replace, modify, or rerun the main experiment.",
        "",
        "## Scope",
        "",
        `- Source runs: \`${result.sourceRunsPath}\``,
        `- Total review runs: ${result.totalReviewRuns}`,
        `- Analyzed runs: ${result.analyzedRuns}`,
        `- Unavailable runs: ${result.unavailableRuns}`,
        `- Epsilon for unchanged classification: ${result.epsilon}`,
        "",
        "## Overall Review Effect",
        "",
        `- Improved runs: ${result.improvedRuns}`,
        `- Worsened runs: ${result.worsenedRuns}`,
        `- Unchanged runs: ${result.unchangedRuns}`,
        `- Average score shift (final - initial): ${formatValue(result.avgScoreShift)}`,
        `- Average initial signed error: ${formatValue(result.avgInitialSignedError)}`,
        `- Average final signed error: ${formatValue(result.avgFinalSignedError)}`,
        "",
        "Positive score shift means the reviewer raised scores on average; negative score shift means it lowered scores.",
        "",
        "## Summary By Profile",
        "",
        markdownTable(
            [
                "profile",
                "runs",
                "improved",
                "worsened",
                "unchanged",
                "avgInitialAbsErr",
                "avgFinalAbsErr",
                "avgDelta",
                "avgScoreShift",
            ],
            result.summaryByProfile.map((row) => [
                row.profile,
                row.runs,
                row.improvedRuns,
                row.worsenedRuns,
                row.unchangedRuns,
                formatValue(row.avgInitialAbsoluteError),
                formatValue(row.avgFinalAbsoluteError),
                formatValue(row.avgReviewDelta),
                formatValue(row.avgScoreShift),
            ])
        ),
        "",
        "## Summary By Criterion",
        "",
        markdownTable(
            [
                "criterionId",
                "samples",
                "improved",
                "worsened",
                "unchanged",
                "avgInitialAbsErr",
                "avgFinalAbsErr",
                "avgDelta",
                "avgScoreShift",
            ],
            result.summaryByCriterion.map((row) => [
                row.criterionId,
                row.samples,
                row.improvedCriteria,
                row.worsenedCriteria,
                row.unchangedCriteria,
                formatValue(row.avgInitialCriterionAbsoluteError),
                formatValue(row.avgFinalCriterionAbsoluteError),
                formatValue(row.avgCriterionReviewDelta),
                formatValue(row.avgCriterionScoreShift),
            ])
        ),
        "",
        "## Overcorrection Candidates",
        "",
        result.overcorrectionCandidates.length === 0
            ? "No overcorrection candidates were detected with the configured thresholds."
            : markdownTable(
                  [
                      "questionSlug",
                      "referenceAnswerId",
                      "profile",
                      "initial",
                      "final",
                      "expected",
                      "scoreShift",
                      "reviewDelta",
                  ],
                  result.overcorrectionCandidates.map((run) => [
                      run.questionSlug,
                      run.referenceAnswerId,
                      run.profile,
                      formatValue(run.initialOverall),
                      formatValue(run.finalOverall),
                      formatValue(run.expectedOverall),
                      formatValue(run.scoreShift),
                      formatValue(run.reviewDelta),
                  ])
              ),
        "",
        "## Interpretation Guardrail",
        "",
        "This analysis describes observed behavior of `review_v1` on the frozen main experiment. It does not establish a causal claim about all possible review prompts, and it does not include any new LLM calls.",
        "",
        "A future `review_v2` sensitivity analysis may test a revised reviewer prompt as a separate exploratory experiment. That future analysis should not be included in the official main-experiment results.",
    ];

    return `${lines.join("\n")}\n`;
}

const reviewRunColumns: Array<keyof ReviewRunAnalysis> = [
    "runId",
    "questionSlug",
    "referenceAnswerId",
    "profile",
    "variant",
    "status",
    "initialOverall",
    "finalOverall",
    "expectedOverall",
    "initialAbsoluteError",
    "finalAbsoluteError",
    "reviewDelta",
    "initialSignedError",
    "finalSignedError",
    "scoreShift",
    "outcome",
    "overcorrectionCandidate",
];

const reviewCriterionColumns: Array<keyof ReviewCriterionAnalysis> = [
    "runId",
    "questionSlug",
    "referenceAnswerId",
    "profile",
    "variant",
    "criterionId",
    "initialCriterionScore",
    "finalCriterionScore",
    "expectedCriterionScore",
    "initialCriterionAbsoluteError",
    "finalCriterionAbsoluteError",
    "criterionReviewDelta",
    "criterionScoreShift",
    "criterionOutcome",
];

const profileSummaryColumns: Array<keyof ReviewProfileSummary> = [
    "profile",
    "runs",
    "improvedRuns",
    "worsenedRuns",
    "unchangedRuns",
    "unavailableRuns",
    "avgInitialAbsoluteError",
    "avgFinalAbsoluteError",
    "avgReviewDelta",
    "avgScoreShift",
    "avgInitialSignedError",
    "avgFinalSignedError",
];

const criterionSummaryColumns: Array<keyof ReviewCriterionSummary> = [
    "criterionId",
    "samples",
    "improvedCriteria",
    "worsenedCriteria",
    "unchangedCriteria",
    "avgInitialCriterionAbsoluteError",
    "avgFinalCriterionAbsoluteError",
    "avgCriterionReviewDelta",
    "avgCriterionScoreShift",
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
    await fs.writeFile(filePath, lines.join("\n"), "utf8");
}

function csvEscape(value: unknown): string {
    if (value === undefined || value === null) return "";
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    if (!/[",\n\r]/.test(text)) return text;
    return `"${text.replace(/"/g, '""')}"`;
}

function classifyDelta(delta: number): Exclude<ReviewOutcome, "unavailable"> {
    if (delta > EPSILON) return "worsened";
    if (delta < -EPSILON) return "improved";
    return "unchanged";
}

function meanMetric(values: Array<number | "">): number | "" {
    const numeric = values.filter((value): value is number => typeof value === "number");
    if (numeric.length === 0) return "";
    return roundTo(numeric.reduce((sum, value) => sum + value, 0) / numeric.length, 4);
}

function numericDesc(left: number | "", right: number | ""): number {
    const leftValue = typeof left === "number" ? left : Number.NEGATIVE_INFINITY;
    const rightValue = typeof right === "number" ? right : Number.NEGATIVE_INFINITY;
    return rightValue - leftValue;
}

function roundTo(value: number, decimalPlaces: number): number {
    const factor = 10 ** decimalPlaces;
    return Math.round(value * factor) / factor;
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
