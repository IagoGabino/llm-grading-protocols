import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import {
    flattenReferenceAnswers,
    loadReferenceAnswerFile,
    loadReferenceAnswerFiles,
    validateReferenceAnswerFiles,
    type ReferenceAnswer,
} from "@/server/experiment/reference-answers";
import { experimentRunSchema, type ExperimentRun } from "@/server/experiment/runner";
import { strategyIdSchema } from "@/server/experiment/strategies";

import type { MetricsArtifacts, MetricsProtocolSnapshot } from "./types";

const protocolSnapshotSchema = z
    .object({
        generatedAt: z.string().optional(),
        config: z
            .object({
                experimentId: z.string().trim().min(1),
                model: z.string().trim().min(1),
                promptVersion: z.string().trim().min(1),
                enabledStrategies: z.array(strategyIdSchema).min(1),
                referenceAnswersPath: z.string().optional(),
                outputDir: z.string().optional(),
            })
            .passthrough(),
    })
    .passthrough();

const bareProtocolConfigSchema = protocolSnapshotSchema.shape.config;

const runsFileSchema = z
    .object({
        runs: z.array(experimentRunSchema),
    })
    .strict();

const manifestSchema = z
    .object({
        files: z.array(z.string().trim().min(1)).min(1),
    })
    .strict();

export class ExperimentMetricsArtifactError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "ExperimentMetricsArtifactError";
    }
}

export async function loadMetricsArtifacts(experimentDir: string): Promise<MetricsArtifacts> {
    const absoluteExperimentDir = path.resolve(process.cwd(), experimentDir);
    const protocol = await loadProtocolSnapshot(path.join(absoluteExperimentDir, "config.json"));
    const runs = await loadRuns(path.join(absoluteExperimentDir, "runs.json"));

    return {
        experimentDir: absoluteExperimentDir,
        metricsDir: path.join(absoluteExperimentDir, "metrics"),
        protocol,
        runs,
    };
}

export async function loadProtocolSnapshot(configPath: string): Promise<MetricsProtocolSnapshot> {
    const raw = await readJson(configPath, "protocol config");
    const parsed = protocolSnapshotSchema.safeParse(raw);
    if (parsed.success) {
        return parsed.data;
    }

    const bareParsed = bareProtocolConfigSchema.safeParse(raw);
    if (!bareParsed.success) {
        throw new ExperimentMetricsArtifactError(
            `Invalid experiment protocol snapshot at ${configPath}:\n${formatZodError(parsed.error)}`
        );
    }

    return {
        config: bareParsed.data,
    };
}

export async function loadRuns(runsPath: string): Promise<ExperimentRun[]> {
    const raw = await readJson(runsPath, "runs file");
    const parsed = runsFileSchema.safeParse(raw);
    if (!parsed.success) {
        throw new ExperimentMetricsArtifactError(
            `Invalid ExperimentRun records at ${runsPath}:\n${formatZodError(parsed.error)}`
        );
    }
    return parsed.data.runs;
}

export async function loadProtocolReferenceAnswers(
    protocol: MetricsProtocolSnapshot,
    experimentDir: string
): Promise<{ answers: ReferenceAnswer[]; warnings: string[] }> {
    const sourcePath = protocol.config.referenceAnswersPath;
    if (!sourcePath) {
        return {
            answers: [],
            warnings: ["Protocol config has no referenceAnswersPath; matrix uses observed runs."],
        };
    }

    const resolvedSourcePath = await resolveReferenceAnswersPath(sourcePath, experimentDir);

    try {
        const stats = await fs.stat(resolvedSourcePath);
        if (stats.isFile() && path.extname(resolvedSourcePath).toLowerCase() === ".json") {
            return loadReferenceAnswersFromManifest(resolvedSourcePath);
        }

        const loaded = await loadReferenceAnswerFiles(resolvedSourcePath);
        const validated = await validateReferenceAnswerFiles(loaded.files, {
            loadErrors: loaded.errors,
        });
        if (validated.errors.length > 0) {
            return {
                answers: [],
                warnings: validated.errors.map(
                    (error) => `Reference answer validation error: ${error.message}`
                ),
            };
        }
        return {
            answers: validated.answers,
            warnings: validated.warnings.map((warning) => warning.message),
        };
    } catch (error) {
        return {
            answers: [],
            warnings: [
                `Could not load reference answers from protocol path "${resolvedSourcePath}": ${
                    error instanceof Error ? error.message : String(error)
                }. Matrix uses observed runs.`,
            ],
        };
    }
}

async function resolveReferenceAnswersPath(sourcePath: string, experimentDir: string): Promise<string> {
    if (path.isAbsolute(sourcePath)) return sourcePath;

    const projectRelative = path.resolve(process.cwd(), sourcePath);
    if (await pathExists(projectRelative)) return projectRelative;

    const experimentRelative = path.resolve(experimentDir, sourcePath);
    if (await pathExists(experimentRelative)) return experimentRelative;

    return projectRelative;
}

async function pathExists(candidatePath: string): Promise<boolean> {
    try {
        await fs.stat(candidatePath);
        return true;
    } catch {
        return false;
    }
}

async function loadReferenceAnswersFromManifest(
    manifestPath: string
): Promise<{ answers: ReferenceAnswer[]; warnings: string[] }> {
    const raw = await readJson(manifestPath, "reference answer manifest");
    const parsed = manifestSchema.safeParse(raw);
    if (!parsed.success) {
        return {
            answers: [],
            warnings: [`Invalid reference answer manifest: ${formatZodError(parsed.error)}`],
        };
    }

    const manifestDir = path.dirname(manifestPath);
    const files = [];
    const errors = [];
    for (const entry of parsed.data.files) {
        const loaded = await loadReferenceAnswerFile(path.resolve(manifestDir, entry));
        files.push(...loaded.files);
        errors.push(...loaded.errors);
    }

    const validated = await validateReferenceAnswerFiles(files, { loadErrors: errors });
    if (validated.errors.length > 0) {
        return {
            answers: [],
            warnings: validated.errors.map(
                (error) => `Reference answer validation error: ${error.message}`
            ),
        };
    }

    return {
        answers: flattenReferenceAnswers(files),
        warnings: validated.warnings.map((warning) => warning.message),
    };
}

async function readJson(filePath: string, label: string): Promise<unknown> {
    let raw: string;
    try {
        raw = await fs.readFile(filePath, "utf8");
    } catch (error) {
        throw new ExperimentMetricsArtifactError(
            `Could not read ${label} at ${filePath}: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }

    try {
        return JSON.parse(raw) as unknown;
    } catch (error) {
        throw new ExperimentMetricsArtifactError(
            `${label} must be valid JSON at ${filePath}: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
}

function formatZodError(error: z.ZodError): string {
    return error.issues
        .map((issue) => {
            const location = issue.path.length > 0 ? issue.path.join(".") : "<root>";
            return `- ${location}: ${issue.message}`;
        })
        .join("\n");
}
