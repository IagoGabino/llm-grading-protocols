import fs from "node:fs";
import path from "node:path";

import { runReviewV2Sensitivity } from "@/server/experiment/review-v2-sensitivity";

type CliArgs = {
    experimentDir: string;
    outputDir?: string;
    execute: boolean;
    overwrite: boolean;
    limit?: number;
};

async function main(): Promise<void> {
    loadLocalEnv();

    const args = parseArgs(process.argv.slice(2));
    const { plan, result, paths } = await runReviewV2Sensitivity(args);

    console.log(`Source experiment: ${plan.sourceExperimentId}`);
    console.log(`Source dir: ${path.relative(process.cwd(), plan.sourceExperimentDir)}`);
    console.log(`Output dir: ${path.relative(process.cwd(), plan.outputDir)}`);
    console.log(`Model: ${plan.configuredModel}`);
    console.log(`Prompt version: ${plan.promptVersion}`);
    console.log(`Planned review_v2 executions: ${plan.plannedRuns}`);
    console.log("");

    if (!args.execute) {
        console.log("Dry run only. No LLM calls were made.");
        console.log("");
        console.log("To execute:");
        console.log(
            `npm run run:review-v2-sensitivity -- --experiment-dir ${shellQuote(
                args.experimentDir
            )} --execute`
        );
        return;
    }

    if (!result || !paths) {
        throw new Error("Review v2 sensitivity execution did not return result paths.");
    }

    console.log("Review v2 sensitivity complete");
    console.log(`Success: ${result.successRuns}`);
    console.log(`Failed: ${result.failedRuns}`);
    console.log("");
    for (const row of result.comparison) {
        console.log(
            `${row.strategy}: MAE=${formatMetric(row.overallMAE)} success=${row.successRuns}/${row.plannedRuns} cost=${formatMetric(row.totalCostCredits)}`
        );
    }
    console.log("");
    console.log(`Runs JSON: ${path.relative(process.cwd(), paths.runsJsonPath)}`);
    console.log(`Runs CSV: ${path.relative(process.cwd(), paths.runsCsvPath)}`);
    console.log(`Comparison: ${path.relative(process.cwd(), paths.comparisonJsonPath)}`);
    console.log(`Summary: ${path.relative(process.cwd(), paths.summaryMdPath)}`);
}

function parseArgs(argv: string[]): CliArgs {
    const experimentDir = readOption(argv, "--experiment-dir") ?? readOption(argv, "-d");
    const outputDir = readOption(argv, "--output-dir");
    const limitValue = readOption(argv, "--limit");

    if (!experimentDir) {
        throw new Error(
            "Usage: npm run run:review-v2-sensitivity -- --experiment-dir <experiments/results/experiment-runs/<id>> [--execute] [--overwrite] [--limit <n>] [--output-dir <dir>]"
        );
    }

    return {
        experimentDir,
        ...(outputDir && { outputDir }),
        execute: argv.includes("--execute"),
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

function formatMetric(value: number | string): string {
    if (value === "") return "unavailable";
    if (typeof value === "number") return value.toFixed(4);
    return value;
}

function shellQuote(value: string): string {
    return /\s/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
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
