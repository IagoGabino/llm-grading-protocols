import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getQuestionBySlug, type QuestionData } from "../src/lib/question-loader";
import {
    buildExecutionMatrix,
    loadValidatedReferenceInputs,
    matrixItemToEvaluationInput,
    parseExperimentRunnerConfig,
    runExperiment,
} from "../src/server/experiment/runner";
import type {
    EvaluationInput,
    StrategyId,
    StrategyResult,
} from "../src/server/experiment/strategies";

const QUESTION_SLUG = "easy-refactor-shipping";

async function main(): Promise<void> {
    assert.throws(() => parseExperimentRunnerConfig({}), /Invalid experiment config/);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "poc-es-runner-"));
    const referenceDir = path.join(tempDir, "reference-answers");
    const outputDir = path.join(tempDir, "results");
    await fs.mkdir(referenceDir, { recursive: true });

    const question = await getQuestionBySlug(QUESTION_SLUG);
    assert.ok(question, `question not found: ${QUESTION_SLUG}`);

    await writeReferenceFile(referenceDir, question, false);
    const validation = await loadValidatedReferenceInputs(referenceDir);
    assert.equal(validation.inputs.length, 3);

    const badReferenceDir = path.join(tempDir, "bad-reference-answers");
    await fs.mkdir(badReferenceDir);
    await writeReferenceFile(badReferenceDir, question, true);
    await assert.rejects(() => loadValidatedReferenceInputs(badReferenceDir), /expected_criteria/);

    const config = parseExperimentRunnerConfig({
        experimentId: "runner-verification",
        model: "verification/model",
        promptVersion: "runner-v1",
        enabledStrategies: ["single", "review"] satisfies StrategyId[],
        referenceAnswersPath: referenceDir,
        outputDir,
        execution: {
            useMock: true,
            concurrency: 2,
            retryLimit: 0,
            timeoutMs: 5_000,
            overwrite: true,
        },
    });

    const matrix = buildExecutionMatrix(config, validation.inputs);
    assert.equal(matrix.length, 6);
    assert.deepEqual(
        matrix.map((item) => item.id),
        buildExecutionMatrix(config, validation.inputs).map((item) => item.id)
    );

    const firstInput = matrixItemToEvaluationInput(matrix[0]);
    assert.equal(firstInput.answer.kind, "student");
    assert.equal("expectedOverall" in firstInput.answer, false);
    assert.equal("profile" in firstInput.answer, false);
    assert.equal("notes" in firstInput.answer, false);

    const result = await runExperiment(config, {
        skipProviderValidation: true,
        strategyExecutors: {
            single: createMockStrategy("single", "success"),
            review: createMockStrategy("review", "parse_error"),
        },
    });

    assert.equal(result.plannedCount, 6);
    assert.equal(result.summary.byStatus.success, 3);
    assert.equal(result.summary.byStatus.parse_error, 3);
    assert.equal(result.runs.length, 6);
    assert.ok(result.runs.every((run) => run.referenceAnswerId.length > 0));
    assert.ok(result.runs.every((run) => run.reference.expectedCriteria.length > 0));
    assert.ok(result.runs.some((run) => run.strategyMetadata?.note === "kept"));
    assert.ok(result.runs.some((run) => run.status === "parse_error"));
    assert.ok(result.runs.every((run) => run.rawOutputPath));

    const jsonl = await fs.readFile(result.outputPaths.runsJsonlPath, "utf8");
    assert.equal(jsonl.trim().split(/\r?\n/).length, 6);

    const json = JSON.parse(await fs.readFile(result.outputPaths.runsJsonPath, "utf8")) as {
        runs: unknown[];
    };
    assert.equal(json.runs.length, 6);

    const csv = await fs.readFile(result.outputPaths.runsCsvPath, "utf8");
    assert.ok(csv.includes("strategyMetadataJson"));
    assert.ok(csv.includes("actualCriteriaJson"));
    assert.ok(csv.includes('""criterionId"":""problems""'));
    assert.ok(csv.includes("expectedCriteriaJson"));

    const exceptionOutputDir = path.join(tempDir, "exception-results");
    const exceptionConfig = parseExperimentRunnerConfig({
        ...config,
        experimentId: "runner-exception-verification",
        outputDir: exceptionOutputDir,
        enabledStrategies: ["single"],
        execution: {
            ...config.execution,
            concurrency: 1,
            overwrite: true,
        },
    });

    const exceptionResult = await runExperiment(exceptionConfig, {
        skipProviderValidation: true,
        strategyExecutors: {
            single: async () => {
                await delay(5);
                throw new Error("executor exploded");
            },
        },
    });

    assert.equal(exceptionResult.runs.length, 3);
    assert.ok(exceptionResult.runs.every((run) => run.status === "llm_error"));
    assert.ok(exceptionResult.runs.every((run) => run.startedAt <= run.finishedAt));
    assert.ok(exceptionResult.runs.every((run) => run.latencyMs > 0));

    console.log("experiment runner verification passed");
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMockStrategy(
    strategy: StrategyId,
    status: "success" | "parse_error"
): (input: EvaluationInput) => Promise<StrategyResult> {
    return async (input) => {
        assert.equal(input.answer.kind, "student");
        assert.equal("expectedOverall" in input.answer, false);
        assert.equal("expectedCriteria" in input.answer, false);
        assert.equal("profile" in input.answer, false);
        assert.equal("notes" in input.answer, false);

        const now = new Date().toISOString();
        const base = {
            strategy,
            model: "verification/model",
            promptVersion: input.promptVersion,
            questionSlug: input.question.meta.slug ?? input.question.meta.id,
            startedAt: now,
            finishedAt: now,
            latencyMs: 1,
            callCount: 1,
            rawOutputs: [
                {
                    output: status === "success" ? "{}" : "not-json",
                    model: "verification/model",
                    callIndex: 1,
                },
            ],
            strategyMetadata: { note: "kept" },
        };

        if (status === "success") {
            const rubric = input.question.meta.rubric;
            assert.ok(rubric);

            return {
                ...base,
                status: "success",
                parsedOutput: {
                    overall: 4,
                    criteria: rubric.criteria.map((criterion) => ({
                        criterionId: criterion.id ?? "criterion",
                        score: 4,
                        ...(criterion.weight !== undefined && { weight: criterion.weight }),
                        evidence: "mock evidence",
                        comment: "mock comment",
                    })),
                    feedback: "mock feedback",
                },
            };
        }

        return {
            ...base,
            status: "parse_error",
            errorMessage: "Invalid JSON",
        };
    };
}

async function writeReferenceFile(
    dir: string,
    question: QuestionData,
    withCriterionMismatch: boolean
): Promise<void> {
    const rubric = question.meta.rubric;
    assert.ok(rubric);
    const criteria = rubric.criteria;
    const expectedCriteria = criteria
        .map((criterion, index) => {
            const criterionId =
                withCriterionMismatch && index === 0 ? `${criterion.id}-missing` : criterion.id;
            return [
                "      - criterionId: " + criterionId,
                "        expectedScore: 4",
                "        rationale: Covers the criterion.",
            ].join("\n");
        })
        .join("\n");

    const answers = [
        ["strong", "complete_correct", "4.5"],
        ["medium", "partial_correct", "3.0"],
        ["weak", "subtle_error", "1.5"],
    ]
        .map(
            ([profile, variant, expectedOverall]) => `  - id: ${QUESTION_SLUG}-${profile}
    profile: ${profile}
    variant: ${variant}
    language: javascript
    code: |
      function calculateShipping(order) {
        return order.total > 100 ? 0 : 10;
      }
    justification: |
      Candidate explanation for ${profile}.
    expectedOverall: ${expectedOverall}
    expectedCriteria:
${expectedCriteria}
    notes: Verification fixture.`
        )
        .join("\n");

    await fs.writeFile(
        path.join(dir, `${QUESTION_SLUG}.yaml`),
        `questionSlug: ${QUESTION_SLUG}\n\nanswers:\n${answers}\n`,
        "utf8"
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
