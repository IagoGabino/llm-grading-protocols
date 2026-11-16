import fs from "node:fs";
import path from "node:path";

import {
    loadExperimentRunnerConfig,
    runExperiment,
    type ExperimentRunnerEvent,
} from "../src/server/experiment/runner";

async function main(): Promise<void> {
    loadLocalEnv();

    const configPath = parseConfigPath(process.argv.slice(2));
    if (!configPath) {
        printUsage();
        process.exitCode = 1;
        return;
    }

    const config = await loadExperimentRunnerConfig(configPath);
    console.log(`Experiment: ${config.experimentId}`);
    console.log(`Reference answers: ${config.referenceAnswersPath}`);
    console.log(`Output dir: ${config.outputDir}`);
    console.log(`Model: ${config.model}`);
    console.log(`Prompt version: ${config.promptVersion}`);
    console.log(`Strategies: ${config.enabledStrategies.join(", ")}`);
    console.log("");

    const result = await runExperiment(config, { onEvent: printEvent });

    console.log("");
    console.log("Experiment complete");
    console.log(`Runs: ${result.summary.total}`);
    for (const [status, count] of Object.entries(result.summary.byStatus)) {
        console.log(`- ${status}: ${count}`);
    }
    console.log("");
    console.log(`JSONL: ${result.outputPaths.runsJsonlPath}`);
    console.log(`JSON: ${result.outputPaths.runsJsonPath}`);
    console.log(`CSV: ${result.outputPaths.runsCsvPath}`);
}

function parseConfigPath(args: string[]): string | undefined {
    const configIndex = args.findIndex((arg) => arg === "--config" || arg === "-c");
    if (configIndex !== -1) {
        return args[configIndex + 1];
    }

    return args.find((arg) => !arg.startsWith("-"));
}

function printUsage(): void {
    console.log("Usage: npm run run:experiment -- --config <config.json>");
}

function printEvent(event: ExperimentRunnerEvent): void {
    if (event.type === "prepared") {
        console.log(`Planned executions: ${event.plannedCount}`);
        return;
    }

    if (event.type === "run_started") {
        console.log(
            `Running ${event.item.strategy} | ${event.item.questionSlug} | ${event.item.referenceAnswerId}`
        );
        return;
    }

    if (event.type === "run_finished") {
        console.log(
            `Finished ${event.run.strategy} | ${event.run.referenceAnswerId} | ${event.run.status}`
        );
    }
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

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
