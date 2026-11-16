import fs from "node:fs/promises";
import path from "node:path";

import type {
    ExperimentMetricsResult,
    MetricsArtifacts,
    OperationalSummary,
    PerCriterionMetric,
    PerRunMetric,
    RobustnessSummary,
    StrategyDiagnostics,
    StrategySummary,
} from "./types";

export type MetricsOutputPaths = {
    metricsDir: string;
    perRunJson: string;
    perRunCsv: string;
    perCriterionJson: string;
    perCriterionCsv: string;
    perStrategyJson: string;
    perStrategyCsv: string;
    robustnessJson: string;
    operationalJson: string;
    diagnosticsJson: string;
    groupedJson: string;
    summaryMd: string;
};

export async function writeMetricsOutputs(
    artifacts: MetricsArtifacts,
    result: ExperimentMetricsResult
): Promise<MetricsOutputPaths> {
    const paths = getMetricsOutputPaths(artifacts.metricsDir);
    await fs.mkdir(paths.metricsDir, { recursive: true });

    await writeJson(paths.perRunJson, result.perRun);
    await writeCsv(paths.perRunCsv, result.perRun, perRunColumns);
    await writeJson(paths.perCriterionJson, result.perCriterion);
    await writeCsv(paths.perCriterionCsv, result.perCriterion, perCriterionColumns);
    await writeJson(paths.perStrategyJson, result.perStrategy);
    await writeCsv(paths.perStrategyCsv, result.perStrategy, perStrategyColumns);
    await writeJson(paths.robustnessJson, result.robustness);
    await writeJson(paths.operationalJson, result.operational);
    await writeJson(paths.diagnosticsJson, result.diagnostics);
    await writeJson(paths.groupedJson, result.grouped);
    await fs.writeFile(paths.summaryMd, buildMarkdownSummary(artifacts, result), "utf8");

    return paths;
}

export function getMetricsOutputPaths(metricsDir: string): MetricsOutputPaths {
    return {
        metricsDir,
        perRunJson: path.join(metricsDir, "per-run-metrics.json"),
        perRunCsv: path.join(metricsDir, "per-run-metrics.csv"),
        perCriterionJson: path.join(metricsDir, "per-criterion-metrics.json"),
        perCriterionCsv: path.join(metricsDir, "per-criterion-metrics.csv"),
        perStrategyJson: path.join(metricsDir, "per-strategy-summary.json"),
        perStrategyCsv: path.join(metricsDir, "per-strategy-summary.csv"),
        robustnessJson: path.join(metricsDir, "robustness-summary.json"),
        operationalJson: path.join(metricsDir, "operational-summary.json"),
        diagnosticsJson: path.join(metricsDir, "strategy-diagnostics.json"),
        groupedJson: path.join(metricsDir, "grouped-summary.json"),
        summaryMd: path.join(metricsDir, "summary.md"),
    };
}

const perRunColumns: Array<keyof PerRunMetric> = [
    "runId",
    "strategy",
    "questionSlug",
    "referenceAnswerId",
    "profile",
    "variant",
    "status",
    "predictedOverall",
    "expectedOverall",
    "absoluteError",
    "signedError",
    "weightedOverallFromCriteria",
    "overallConsistencyDelta",
    "callCount",
    "latencyMs",
    "costCredits",
];

const perCriterionColumns: Array<keyof PerCriterionMetric> = [
    "runId",
    "strategy",
    "questionSlug",
    "referenceAnswerId",
    "profile",
    "criterionId",
    "predictedScore",
    "expectedScore",
    "criterionAbsoluteError",
    "criterionSignedError",
    "weight",
];

const perStrategyColumns: Array<keyof StrategySummary> = [
    "strategy",
    "plannedRuns",
    "foundRuns",
    "successRuns",
    "successRate",
    "overallMAE",
    "overallMeanSignedError",
    "criterionMAE",
    "totalCallCount",
    "avgCallCount",
    "totalCostCredits",
    "avgLatencyMs",
    "maxLatencyMs",
];

function buildMarkdownSummary(
    artifacts: MetricsArtifacts,
    result: ExperimentMetricsResult
): string {
    const lines = [
        `# Experiment Metrics Summary`,
        "",
        `Experiment: ${artifacts.protocol.config.experimentId}`,
        `Model: ${artifacts.protocol.config.model}`,
        `Prompt version: ${artifacts.protocol.config.promptVersion}`,
        "",
        "## Formulas",
        "",
        "- `absoluteError = abs(predictedOverall - expectedOverall)`",
        "- `signedError = predictedOverall - expectedOverall`",
        "- `criterionAbsoluteError = abs(predictedScore - expectedScore)`",
        "- `criterionSignedError = predictedScore - expectedScore`",
        "- `overallMAE = mean(absoluteError)` over successful runs only",
        "- `criterionMAE = mean(criterionAbsoluteError)` over matched criteria from successful runs only",
        "- Failed runs are excluded from MAE and included in robustness summaries.",
        "",
        "## Counts",
        "",
        `- Planned runs: ${result.robustness.plannedRuns}`,
        `- Found runs: ${result.robustness.foundRuns}`,
        `- Successful runs: ${result.robustness.successRuns}`,
        `- Matrix assessment source: ${result.robustness.matrixCompleteness.assessmentSource}`,
        "",
        "## Per-Strategy Summary",
        "",
        markdownTable(
            [
                "strategy",
                "planned",
                "success",
                "successRate",
                "overallMAE",
                "criterionMAE",
                "totalCostCredits",
                "avgLatencyMs",
                "totalCallCount",
            ],
            result.perStrategy.map((row) => [
                row.strategy,
                row.plannedRuns,
                row.successRuns,
                formatValue(row.successRate),
                formatValue(row.overallMAE),
                formatValue(row.criterionMAE),
                formatValue(row.totalCostCredits),
                formatValue(row.avgLatencyMs),
                row.totalCallCount,
            ])
        ),
        "",
        "## Status Counts",
        "",
        markdownStatusCounts(result.robustness),
        "",
        "## Operational Summary",
        "",
        markdownOperational(result.operational),
        "",
        "## Strategy Diagnostics",
        "",
        markdownDiagnostics(result.diagnostics),
        "",
        "## Consistency",
        "",
        `Score-justification consistency was not evaluated: ${result.consistency.reason}`,
        "",
        "## Notes",
        "",
        "- `weightedOverallFromCriteria` and `overallConsistencyDelta` are diagnostics only; they do not replace `parsedOutput.overall`.",
        "- Grouped summaries are exploratory and marked sparse when support is low.",
        "- Python notebooks should consume the exported tables instead of redefining official formulas.",
    ];

    if (result.robustness.matrixCompleteness.warnings.length > 0) {
        lines.push(
            "",
            "## Warnings",
            "",
            ...result.robustness.matrixCompleteness.warnings.map((warning) => `- ${warning}`)
        );
    }

    return `${lines.join("\n")}\n`;
}

function markdownStatusCounts(robustness: RobustnessSummary): string {
    return markdownTable(
        ["strategy", "success", "parse_error", "schema_error", "llm_error", "timeout"],
        Object.entries(robustness.statusCountsByStrategy).map(([strategy, counts]) => [
            strategy,
            counts.success,
            counts.parse_error,
            counts.schema_error,
            counts.llm_error,
            counts.timeout,
        ])
    );
}

function markdownOperational(operational: OperationalSummary): string {
    return markdownTable(
        [
            "strategy",
            "foundRuns",
            "totalCallCount",
            "avgCallCount",
            "totalCostCredits",
            "avgLatencyMs",
            "maxLatencyMs",
        ],
        Object.entries(operational.byStrategy).map(([strategy, summary]) => [
            strategy,
            summary.foundRuns,
            summary.totalCallCount,
            formatValue(summary.avgCallCount),
            formatValue(summary.totalCostCredits),
            formatValue(summary.avgLatencyMs),
            formatValue(summary.maxLatencyMs),
        ])
    );
}

function markdownDiagnostics(diagnostics: StrategyDiagnostics): string {
    const rows = Object.entries(diagnostics.multiAggregate.byCriterion).map(
        ([criterionId, summary]) => [
            criterionId,
            summary.samples,
            formatValue(summary.avgStdDev),
            formatValue(summary.maxStdDev),
        ]
    );

    if (rows.length === 0) {
        return "No multi_aggregate criterionScoreStdDev diagnostics were available.";
    }

    return [
        `Multi-aggregate diagnostic runs available: ${diagnostics.multiAggregate.availableRuns}`,
        `Multi-aggregate diagnostic runs unavailable: ${diagnostics.multiAggregate.unavailableRuns}`,
        "",
        markdownTable(["criterionId", "samples", "avgStdDev", "maxStdDev"], rows),
    ].join("\n");
}

function markdownTable(headers: string[], rows: Array<Array<string | number>>): string {
    return [
        `| ${headers.join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
        ...rows.map((row) => `| ${row.map((cell) => String(cell)).join(" | ")} |`),
    ].join("\n");
}

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

function formatValue(value: string | number): string {
    if (value === "") return "unavailable";
    if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(4);
    return value;
}
