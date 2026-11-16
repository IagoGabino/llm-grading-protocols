import path from "node:path";

import {
    computeExperimentMetrics,
    loadMetricsArtifacts,
    loadProtocolReferenceAnswers,
    writeMetricsOutputs,
} from "@/server/experiment/metrics";

type CliArgs = {
    experimentDir: string;
};

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    const artifacts = await loadMetricsArtifacts(args.experimentDir);
    const referenceAnswers = await loadProtocolReferenceAnswers(
        artifacts.protocol,
        artifacts.experimentDir
    );

    const metrics = await computeExperimentMetrics(artifacts, referenceAnswers.answers);
    metrics.robustness.validationWarnings.push(...referenceAnswers.warnings);
    metrics.robustness.matrixCompleteness.warnings.push(...referenceAnswers.warnings);

    const outputPaths = await writeMetricsOutputs(artifacts, metrics);

    console.log(`Experiment: ${artifacts.protocol.config.experimentId}`);
    console.log(`Input runs: ${path.relative(process.cwd(), path.join(artifacts.experimentDir, "runs.json"))}`);
    console.log(`Metrics dir: ${path.relative(process.cwd(), outputPaths.metricsDir)}`);
    console.log(`Planned runs: ${metrics.robustness.plannedRuns}`);
    console.log(`Found runs: ${metrics.robustness.foundRuns}`);
    console.log(`Successful runs: ${metrics.robustness.successRuns}`);
    console.log("Per-strategy summary:");
    for (const row of metrics.perStrategy) {
        console.log(
            `- ${row.strategy}: MAE=${formatMetric(row.overallMAE)} criterionMAE=${formatMetric(
                row.criterionMAE
            )} success=${row.successRuns}/${row.plannedRuns} cost=${formatMetric(
                row.totalCostCredits
            )}`
        );
    }
}

function parseArgs(argv: string[]): CliArgs {
    const experimentDir = readOption(argv, "--experiment-dir") ?? readOption(argv, "-d");
    if (!experimentDir) {
        throw new Error(
            "Usage: npm run run:experiment-metrics -- --experiment-dir <experiments/results/experiment-runs/<id>>"
        );
    }
    return { experimentDir };
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
