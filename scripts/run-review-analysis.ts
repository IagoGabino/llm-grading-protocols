import path from "node:path";

import { runReviewAnalysis } from "@/server/experiment/metrics";

type CliArgs = {
    experimentDir: string;
    outputDir?: string;
};

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    const { result, paths } = await runReviewAnalysis(args);

    console.log(`Experiment: ${result.experimentId}`);
    console.log(`Source runs: ${result.sourceRunsPath}`);
    console.log(`Output dir: ${path.relative(process.cwd(), paths.outputDir)}`);
    console.log(`Review runs: ${result.totalReviewRuns}`);
    console.log(`Analyzed runs: ${result.analyzedRuns}`);
    console.log(`Improved: ${result.improvedRuns}`);
    console.log(`Worsened: ${result.worsenedRuns}`);
    console.log(`Unchanged: ${result.unchangedRuns}`);
    console.log(`Average score shift: ${formatMetric(result.avgScoreShift)}`);
    console.log(`Average initial signed error: ${formatMetric(result.avgInitialSignedError)}`);
    console.log(`Average final signed error: ${formatMetric(result.avgFinalSignedError)}`);
}

function parseArgs(argv: string[]): CliArgs {
    const experimentDir = readOption(argv, "--experiment-dir") ?? readOption(argv, "-d");
    const outputDir = readOption(argv, "--output-dir");

    if (!experimentDir) {
        throw new Error(
            "Usage: npm run run:review-analysis -- --experiment-dir <experiments/results/experiment-runs/<id>> [--output-dir <dir>]"
        );
    }

    return {
        experimentDir,
        ...(outputDir && { outputDir }),
    };
}

function readOption(argv: string[], name: string): string | undefined {
    const index = argv.indexOf(name);
    if (index === -1) return undefined;
    return argv[index + 1];
}

function formatMetric(value: number | string): string {
    if (value === "") return "unavailable";
    if (typeof value === "number") return value.toFixed(4);
    return value;
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
