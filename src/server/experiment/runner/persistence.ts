import fs from "node:fs/promises";
import path from "node:path";

import type { ExperimentRunnerConfig } from "./config";
import type { ExperimentRun } from "./contracts";
import type { RawStrategyOutput } from "../strategies";

export type ExperimentOutputPaths = {
    rootDir: string;
    rawDir: string;
    configSnapshotPath: string;
    runsJsonlPath: string;
    runsJsonPath: string;
    runsCsvPath: string;
};

export async function initializeExperimentOutput(
    config: ExperimentRunnerConfig
): Promise<ExperimentOutputPaths> {
    const paths = getExperimentOutputPaths(config);

    if (config.execution.overwrite) {
        await fs.rm(paths.rootDir, { recursive: true, force: true });
    } else if (await pathHasEntries(paths.rootDir)) {
        throw new Error(
            `Output directory already exists and is not empty: ${paths.rootDir}. Set execution.overwrite=true to replace it.`
        );
    }

    await fs.mkdir(paths.rawDir, { recursive: true });
    await writeJson(paths.configSnapshotPath, {
        generatedAt: new Date().toISOString(),
        config,
    });

    return paths;
}

export function getExperimentOutputPaths(config: ExperimentRunnerConfig): ExperimentOutputPaths {
    const rootDir = path.join(config.outputDir, sanitizePathPart(config.experimentId));
    return {
        rootDir,
        rawDir: path.join(rootDir, "raw"),
        configSnapshotPath: path.join(rootDir, "config.json"),
        runsJsonlPath: path.join(rootDir, "runs.jsonl"),
        runsJsonPath: path.join(rootDir, "runs.json"),
        runsCsvPath: path.join(rootDir, "runs.csv"),
    };
}

export async function writeRawOutputs(
    paths: ExperimentOutputPaths,
    runId: string,
    rawOutputs: RawStrategyOutput[]
): Promise<string | undefined> {
    if (rawOutputs.length === 0) return undefined;

    const rawOutputPath = path.join(paths.rawDir, `${runId}.json`);
    await writeJson(rawOutputPath, { runId, rawOutputs });
    return displayPath(rawOutputPath);
}

export async function appendRunRecord(
    paths: ExperimentOutputPaths,
    run: ExperimentRun
): Promise<void> {
    await fs.appendFile(paths.runsJsonlPath, `${JSON.stringify(run)}\n`, "utf8");
}

export async function writeConsolidatedExports(
    paths: ExperimentOutputPaths,
    runs: ExperimentRun[]
): Promise<void> {
    await writeJson(paths.runsJsonPath, { runs });
    await fs.writeFile(paths.runsCsvPath, toCsv(runs), "utf8");
}

function toCsv(runs: ExperimentRun[]): string {
    const columns = [
        "id",
        "experimentId",
        "strategy",
        "status",
        "model",
        "configuredModel",
        "questionSlug",
        "referenceAnswerId",
        "promptVersion",
        "startedAt",
        "finishedAt",
        "latencyMs",
        "callCount",
        "rawOutputPath",
        "overall",
        "expectedOverall",
        "actualCriteriaJson",
        "profile",
        "variant",
        "errorMessage",
        "costEstimateJson",
        "strategyMetadataJson",
        "expectedCriteriaJson",
    ] as const;

    const rows = runs.map((run) => ({
        id: run.id,
        experimentId: run.experimentId,
        strategy: run.strategy,
        status: run.status,
        model: run.model,
        configuredModel: run.configuredModel,
        questionSlug: run.questionSlug,
        referenceAnswerId: run.referenceAnswerId,
        promptVersion: run.promptVersion,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        latencyMs: run.latencyMs,
        callCount: run.callCount,
        rawOutputPath: run.rawOutputPath ?? "",
        overall: run.parsedOutput?.overall ?? "",
        expectedOverall: run.reference.expectedOverall,
        actualCriteriaJson: run.parsedOutput ? JSON.stringify(toActualCriteria(run)) : "",
        profile: run.reference.profile,
        variant: run.reference.variant ?? "",
        errorMessage: run.errorMessage ?? "",
        costEstimateJson: run.costEstimate ? JSON.stringify(run.costEstimate) : "",
        strategyMetadataJson: run.strategyMetadata ? JSON.stringify(run.strategyMetadata) : "",
        expectedCriteriaJson: JSON.stringify(
            run.reference.expectedCriteria.map((criterion) => ({
                criterionId: criterion.criterionId,
                expectedScore: criterion.expectedScore,
            }))
        ),
    }));

    return [
        columns.join(","),
        ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
    ].join("\n");
}

function toActualCriteria(run: ExperimentRun): Array<{ criterionId: string; score: number }> {
    return (
        run.parsedOutput?.criteria.map((criterion) => ({
            criterionId: criterion.criterionId,
            score: criterion.score,
        })) ?? []
    );
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function pathHasEntries(dirPath: string): Promise<boolean> {
    try {
        const entries = await fs.readdir(dirPath);
        return entries.length > 0;
    } catch {
        return false;
    }
}

function displayPath(filePath: string): string {
    return path.relative(process.cwd(), filePath) || filePath;
}

function csvEscape(value: string | number): string {
    const text = String(value);
    if (!/[",\n\r]/.test(text)) return text;
    return `"${text.replace(/"/g, '""')}"`;
}

function sanitizePathPart(value: string): string {
    const sanitized = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return sanitized || "experiment";
}
