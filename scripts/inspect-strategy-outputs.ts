import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

import { getQuestionBySlug } from "../src/lib/question-loader";
import { loadReferenceAnswers } from "../src/server/experiment/reference-answers";
import {
    runMultiAggregateStrategy,
    runReviewStrategy,
    runSingleStrategy,
    strategyResultSchema,
    type EvaluationInput,
    type EvaluationOutput,
    type ReferenceAnswer,
    type StrategyResult,
} from "../src/server/experiment/strategies";

const TARGET_REFERENCE_ANSWER_ID = "easy-refactor-shipping-weak-example";
const EXAMPLES_DIR = path.join(process.cwd(), "experiments", "reference-answers", "examples");
const OUTPUT_DIR = path.join(process.cwd(), "experiments", "results", "strategy-inspection");
const PROMPT_VERSION = "manual-inspection-v1";

type CriterionSummary = {
    criterionId: string;
    score?: number;
    expectedScore?: number;
    difference?: number;
};

type StrategyInspectionSummary = {
    strategy: StrategyResult["strategy"];
    status: StrategyResult["status"];
    overall?: number;
    expectedOverall: number;
    overallDifference?: number;
    criteria: CriterionSummary[];
    rawOutputsCount: number;
    promptVariantIds?: Array<string | undefined>;
    criterionScoreStdDev?: unknown;
    errorMessage?: string;
};

async function main() {
    loadLocalEnv();
    assertRealProviderConfigured();
    const { input, referenceAnswer } = await loadInspectionInput();
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    console.log(
        `Using provider=${process.env.LLM_PROVIDER} model=${getConfiguredModel()} useMock=false`
    );

    const results = [
        await runAndPersist(
            "single",
            () => runSingleStrategy(input, { useMock: false, retryLimit: 0 }),
            referenceAnswer
        ),
        await runAndPersist(
            "review",
            () => runReviewStrategy(input, { useMock: false, retryLimit: 0 }),
            referenceAnswer
        ),
        await runAndPersist(
            "multi_aggregate",
            () => runMultiAggregateStrategy(input, { useMock: false, retryLimit: 0 }),
            referenceAnswer
        ),
    ];

    const summaryPath = path.join(OUTPUT_DIR, `${TARGET_REFERENCE_ANSWER_ID}.summary.json`);
    await writeJson(summaryPath, {
        referenceAnswerId: referenceAnswer.id,
        questionSlug: referenceAnswer.questionSlug,
        expectedOverall: referenceAnswer.expectedOverall,
        generatedAt: new Date().toISOString(),
        results,
    });

    printSummary(results, summaryPath);
}

async function loadInspectionInput(): Promise<{
    input: EvaluationInput;
    referenceAnswer: ReferenceAnswer;
}> {
    const loaded = await loadReferenceAnswers(EXAMPLES_DIR);
    if (loaded.errors.length > 0) {
        throw new Error(
            `Failed to load reference answers: ${loaded.errors
                .map((error) => `${error.path}: ${error.message}`)
                .join("; ")}`
        );
    }

    const sourceAnswer = loaded.answers.find((answer) => answer.id === TARGET_REFERENCE_ANSWER_ID);
    if (!sourceAnswer) {
        throw new Error(`Reference answer not found: ${TARGET_REFERENCE_ANSWER_ID}`);
    }

    const question = await getQuestionBySlug(sourceAnswer.questionSlug);
    if (!question) {
        throw new Error(`Question not found: ${sourceAnswer.questionSlug}`);
    }

    const referenceAnswer: ReferenceAnswer = {
        kind: "reference",
        ...sourceAnswer,
    };

    return {
        referenceAnswer,
        input: {
            question,
            answer: referenceAnswer,
            model: getConfiguredModel(),
            promptVersion: PROMPT_VERSION,
        },
    };
}

function loadLocalEnv() {
    const envPath = path.join(process.cwd(), ".env");
    if (!fsSync.existsSync(envPath)) return;

    const content = fsSync.readFileSync(envPath, "utf8");
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

function getConfiguredModel(): string {
    return process.env.LLM_MODEL ?? process.env.ANTHROPIC_MODEL ?? "env-configured-provider";
}

function assertRealProviderConfigured() {
    const provider = process.env.LLM_PROVIDER?.toLowerCase();
    if (!provider || provider === "mock") {
        throw new Error(
            "Configure LLM_PROVIDER com um provider real no .env antes de rodar este script."
        );
    }
}

async function runAndPersist(
    strategy: StrategyResult["strategy"],
    execute: () => Promise<StrategyResult>,
    referenceAnswer: ReferenceAnswer
): Promise<StrategyInspectionSummary> {
    console.log(`Running ${strategy}...`);
    const result = strategyResultSchema.parse(await execute());
    const outputPath = path.join(OUTPUT_DIR, `${TARGET_REFERENCE_ANSWER_ID}.${strategy}.json`);
    await writeJson(outputPath, result);
    return summarizeResult(result, referenceAnswer);
}

function summarizeResult(
    result: StrategyResult,
    referenceAnswer: ReferenceAnswer
): StrategyInspectionSummary {
    const parsedOutput = result.status === "success" ? result.parsedOutput : undefined;
    const overall = parsedOutput?.overall;

    return {
        strategy: result.strategy,
        status: result.status,
        ...(overall !== undefined && { overall }),
        expectedOverall: referenceAnswer.expectedOverall,
        ...(overall !== undefined && {
            overallDifference: roundTo(overall - referenceAnswer.expectedOverall, 3),
        }),
        criteria: summarizeCriteria(parsedOutput, referenceAnswer),
        rawOutputsCount: result.rawOutputs.length,
        ...(result.strategy === "multi_aggregate" && {
            promptVariantIds: result.rawOutputs.map((rawOutput) =>
                typeof rawOutput.metadata?.promptVariantId === "string"
                    ? rawOutput.metadata.promptVariantId
                    : undefined
            ),
            criterionScoreStdDev: result.strategyMetadata?.criterionScoreStdDev,
        }),
        ...(result.status !== "success" && { errorMessage: result.errorMessage }),
    };
}

function summarizeCriteria(
    output: EvaluationOutput | undefined,
    referenceAnswer: ReferenceAnswer
): CriterionSummary[] {
    return referenceAnswer.expectedCriteria.map((expectedCriterion) => {
        const actualCriterion = output?.criteria.find(
            (criterion) => criterion.criterionId === expectedCriterion.criterionId
        );

        return {
            criterionId: expectedCriterion.criterionId,
            ...(actualCriterion && { score: actualCriterion.score }),
            expectedScore: expectedCriterion.expectedScore,
            ...(actualCriterion && {
                difference: roundTo(actualCriterion.score - expectedCriterion.expectedScore, 3),
            }),
        };
    });
}

function printSummary(results: StrategyInspectionSummary[], summaryPath: string) {
    console.log("");
    console.log("Strategy inspection summary");
    console.log(`Saved JSON results to: ${OUTPUT_DIR}`);
    console.log(`Summary file: ${summaryPath}`);
    console.log("");

    for (const result of results) {
        console.log(
            [
                `${result.strategy}: ${result.status}`,
                `overall=${formatNumber(result.overall)}`,
                `expected=${formatNumber(result.expectedOverall)}`,
                `diff=${formatNumber(result.overallDifference)}`,
                `rawOutputs=${result.rawOutputsCount}`,
            ].join(" | ")
        );

        for (const criterion of result.criteria) {
            console.log(
                `  - ${criterion.criterionId}: score=${formatNumber(
                    criterion.score
                )}, expected=${formatNumber(criterion.expectedScore)}, diff=${formatNumber(
                    criterion.difference
                )}`
            );
        }

        if (result.strategy === "multi_aggregate") {
            console.log(
                `  promptVariantIds: ${(result.promptVariantIds ?? []).join(", ") || "none"}`
            );
            console.log(
                `  criterionScoreStdDev: ${JSON.stringify(result.criterionScoreStdDev ?? {})}`
            );
        }

        if (result.errorMessage) {
            console.log(`  error: ${result.errorMessage}`);
        }
    }
}

async function writeJson(filePath: string, data: unknown) {
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function roundTo(value: number, decimalPlaces: number): number {
    const factor = 10 ** decimalPlaces;
    return Math.round(value * factor) / factor;
}

function formatNumber(value: number | undefined): string {
    return value === undefined ? "n/a" : value.toString();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
