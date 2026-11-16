import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

import {
    ExperimentMetricsValidationError,
    computeExperimentMetrics,
    loadProtocolSnapshot,
    writeMetricsOutputs,
    type MetricsArtifacts,
} from "@/server/experiment/metrics";
import type { ReferenceAnswer } from "@/server/experiment/reference-answers";
import type { ExperimentRun } from "@/server/experiment/runner";

async function main(): Promise<void> {
    const artifacts = buildArtifacts();
    const referenceAnswers = buildReferenceAnswers();

    const metrics = await computeExperimentMetrics(artifacts, referenceAnswers);

    assert.equal(metrics.robustness.plannedRuns, 6);
    assert.equal(metrics.robustness.matrixCompleteness.plannedRunsByStrategy.single, 2);
    assert.equal(metrics.robustness.matrixCompleteness.plannedRunsByStrategy.review, 2);
    assert.equal(metrics.robustness.matrixCompleteness.plannedRunsByStrategy.multi_aggregate, 2);
    assert.equal(metrics.robustness.foundRuns, 6);
    assert.equal(metrics.robustness.successRuns, 4);
    assert.equal(metrics.robustness.statusCountsByStrategy.single.success, 2);
    assert.equal(metrics.robustness.statusCountsByStrategy.review.parse_error, 1);
    assert.equal(metrics.robustness.matrixCompleteness.missingExecutions.length, 1);
    assert.equal(metrics.robustness.matrixCompleteness.duplicateExecutions.length, 1);

    const singleSummary = metrics.perStrategy.find((row) => row.strategy === "single");
    assert(singleSummary);
    assert.equal(singleSummary.overallMAE, 0.5);
    assert.equal(singleSummary.criterionMAE, 0.5);
    assert.equal(singleSummary.totalCallCount, 2);
    assert.equal(singleSummary.totalCostCredits, 0.03);

    const firstCriterion = metrics.perCriterion.find(
        (row) => row.runId === "single-ref-a" && row.criterionId === "criterion_a"
    );
    assert(firstCriterion);
    assert.equal(firstCriterion.criterionAbsoluteError, 0.5);
    assert.equal(firstCriterion.criterionSignedError, 0.5);

    await assert.rejects(
        () =>
            computeExperimentMetrics(
                {
                    ...artifacts,
                    runs: [
                        {
                            ...artifacts.runs[0],
                            id: "invalid-success",
                            parsedOutput: undefined,
                        },
                    ],
                },
                referenceAnswers
            ),
        ExperimentMetricsValidationError
    );

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "experiment-metrics-"));
    const bareConfigPath = path.join(tempDir, "config.json");
    await fs.writeFile(
        bareConfigPath,
        JSON.stringify({
            experimentId: "bare-config",
            model: "mock/evaluator",
            promptVersion: "v1",
            enabledStrategies: ["single"],
        }),
        "utf8"
    );
    const bareProtocol = await loadProtocolSnapshot(bareConfigPath);
    assert.equal(bareProtocol.config.experimentId, "bare-config");

    const outputPaths = await writeMetricsOutputs(
        { ...artifacts, metricsDir: path.join(tempDir, "metrics") },
        metrics
    );
    await assertFileExists(outputPaths.perRunJson);
    await assertFileExists(outputPaths.perRunCsv);
    await assertFileExists(outputPaths.perCriterionJson);
    await assertFileExists(outputPaths.perStrategyCsv);
    await assertFileExists(outputPaths.summaryMd);

    const csv = await fs.readFile(outputPaths.perRunCsv, "utf8");
    const lines = csv.split(/\r?\n/);
    const expectedColumns = parseCsvLine(lines[0]).length;
    for (const line of lines.slice(1)) {
        assert.equal(parseCsvLine(line).length, expectedColumns);
    }

    const metricsSource = await fs.readFile(
        path.join(process.cwd(), "src", "server", "experiment", "metrics", "calculate.ts"),
        "utf8"
    );
    assert(!metricsSource.includes("createLLMProvider"));
    assert(!metricsSource.includes("runExperiment"));
    assert(!metricsSource.includes("runSingleStrategy"));

    console.log("experiment metrics verification passed");
}

function buildArtifacts(): MetricsArtifacts {
    const runs: ExperimentRun[] = [
        buildRun("single-ref-a", "single", "success", "ref-a", 4.5, 4, 1, 10, 0.01),
        buildRun("single-ref-b", "single", "success", "ref-b", 2.5, 3, 1, 12, 0.02),
        buildRun("review-ref-a", "review", "success", "ref-a", 4, 4, 2, 20, 0.03),
        buildRun("review-ref-a-duplicate", "review", "success", "ref-a", 4.2, 4, 2, 21, 0.03),
        buildRun("review-ref-b", "review", "parse_error", "ref-b", undefined, 3, 1, 8),
        buildRun("multi-ref-a", "multi_aggregate", "llm_error", "ref-a", undefined, 4, 1, 5),
    ];

    return {
        experimentDir: process.cwd(),
        metricsDir: path.join(process.cwd(), "metrics"),
        protocol: {
            generatedAt: "2026-06-16T00:00:00.000Z",
            config: {
                experimentId: "fixture",
                model: "mock/evaluator",
                promptVersion: "v1",
                enabledStrategies: ["single", "review", "multi_aggregate"],
                referenceAnswersPath: "unused",
            },
        },
        runs,
    };
}

function buildRun(
    id: string,
    strategy: ExperimentRun["strategy"],
    status: ExperimentRun["status"],
    referenceAnswerId: string,
    predictedOverall: number | undefined,
    expectedOverall: number,
    callCount: number,
    latencyMs: number,
    costCredits?: number
): ExperimentRun {
    return {
        id,
        experimentId: "fixture",
        strategy,
        status,
        model: "mock/evaluator",
        configuredModel: "mock/evaluator",
        questionSlug: "question-a",
        referenceAnswerId,
        promptVersion: "v1",
        startedAt: "2026-06-16T00:00:00.000Z",
        finishedAt: "2026-06-16T00:00:01.000Z",
        latencyMs,
        callCount,
        ...(costCredits !== undefined && {
            costEstimate: {
                provider: "openrouter",
                costCredits,
                providerCostUnit: "credits",
            },
        }),
        ...(status === "success" &&
            predictedOverall !== undefined && {
                parsedOutput: {
                    overall: predictedOverall,
                    criteria: [
                        {
                            criterionId: "criterion_a",
                            score: predictedOverall,
                            weight: 0.5,
                            evidence: "evidence",
                            comment: "comment",
                        },
                        {
                            criterionId: "criterion_b",
                            score: predictedOverall - 1,
                            weight: 0.5,
                            evidence: "evidence",
                            comment: "comment",
                        },
                    ],
                    feedback: "feedback",
                },
            }),
        ...(status !== "success" && { errorMessage: "fixture failure" }),
        reference: {
            profile: referenceAnswerId === "ref-a" ? "strong" : "medium",
            variant: referenceAnswerId === "ref-a" ? "complete_correct" : "partial_correct",
            expectedOverall,
            expectedCriteria: [
                {
                    criterionId: "criterion_a",
                    expectedScore: expectedOverall,
                    rationale: "expected rationale",
                },
                {
                    criterionId: "criterion_b",
                    expectedScore: expectedOverall - 1,
                    rationale: "expected rationale",
                },
            ],
        },
    };
}

function buildReferenceAnswers(): ReferenceAnswer[] {
    return [
        {
            id: "ref-a",
            questionSlug: "question-a",
            profile: "strong",
            variant: "complete_correct",
            answerText: "answer",
            expectedOverall: 4,
            expectedCriteria: [
                { criterionId: "criterion_a", expectedScore: 4, rationale: "rationale" },
                { criterionId: "criterion_b", expectedScore: 3, rationale: "rationale" },
            ],
        },
        {
            id: "ref-b",
            questionSlug: "question-a",
            profile: "medium",
            variant: "partial_correct",
            answerText: "answer",
            expectedOverall: 3,
            expectedCriteria: [
                { criterionId: "criterion_a", expectedScore: 3, rationale: "rationale" },
                { criterionId: "criterion_b", expectedScore: 2, rationale: "rationale" },
            ],
        },
    ];
}

async function assertFileExists(filePath: string): Promise<void> {
    const stats = await fs.stat(filePath);
    assert(stats.isFile());
}

function parseCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"') {
            if (inQuotes && line[index + 1] === '"') {
                current += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            cells.push(current);
            current = "";
        } else {
            current += char;
        }
    }
    cells.push(current);
    return cells;
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
