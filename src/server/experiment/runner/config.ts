import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { strategyIdSchema } from "../strategies";

export const DEFAULT_RUNNER_REFERENCE_ANSWERS_DIR = path.join(
    process.cwd(),
    "experiments",
    "reference-answers",
    "final"
);

export const DEFAULT_RUNNER_OUTPUT_DIR = path.join(
    process.cwd(),
    "experiments",
    "results",
    "experiment-runs"
);

const executionOptionsSchema = z
    .object({
        useMock: z.boolean().default(false),
        timeoutMs: z.number().int().positive().default(60_000),
        retryLimit: z.number().int().min(0).default(0),
        concurrency: z.number().int().min(1).max(3).default(1),
        overwrite: z.boolean().default(false),
    })
    .strict();

const rawExperimentRunnerConfigSchema = z
    .object({
        experimentId: z.string().trim().min(1),
        model: z.string().trim().min(1),
        promptVersion: z.string().trim().min(1),
        enabledStrategies: z.array(strategyIdSchema).min(1),
        referenceAnswersPath: z.string().trim().min(1).default(DEFAULT_RUNNER_REFERENCE_ANSWERS_DIR),
        outputDir: z.string().trim().min(1).default(DEFAULT_RUNNER_OUTPUT_DIR),
        execution: executionOptionsSchema.default({
            useMock: false,
            timeoutMs: 60_000,
            retryLimit: 0,
            concurrency: 1,
            overwrite: false,
        }),
    })
    .strict();

export type ExperimentRunnerExecutionOptions = z.infer<typeof executionOptionsSchema>;

export type ExperimentRunnerConfig = Omit<
    z.infer<typeof rawExperimentRunnerConfigSchema>,
    "referenceAnswersPath" | "outputDir"
> & {
    referenceAnswersPath: string;
    outputDir: string;
};

export class ExperimentRunnerConfigError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "ExperimentRunnerConfigError";
    }
}

export function parseExperimentRunnerConfig(
    value: unknown,
    options: { cwd?: string } = {}
): ExperimentRunnerConfig {
    const parsed = rawExperimentRunnerConfigSchema.safeParse(value);
    if (!parsed.success) {
        throw new ExperimentRunnerConfigError(formatZodError(parsed.error));
    }

    const cwd = options.cwd ?? process.cwd();
    return {
        ...parsed.data,
        referenceAnswersPath: path.resolve(cwd, parsed.data.referenceAnswersPath),
        outputDir: path.resolve(cwd, parsed.data.outputDir),
    };
}

export async function loadExperimentRunnerConfig(configPath: string): Promise<ExperimentRunnerConfig> {
    const absolutePath = path.resolve(process.cwd(), configPath);
    let raw: string;

    try {
        raw = await fs.readFile(absolutePath, "utf8");
    } catch (error) {
        throw new ExperimentRunnerConfigError(
            `Could not read experiment config: ${
                error instanceof Error ? error.message : String(error)
            }`,
            error instanceof Error ? { cause: error } : undefined
        );
    }

    let parsedJson: unknown;
    try {
        parsedJson = JSON.parse(raw);
    } catch (error) {
        throw new ExperimentRunnerConfigError(
            `Experiment config must be valid JSON: ${
                error instanceof Error ? error.message : String(error)
            }`,
            error instanceof Error ? { cause: error } : undefined
        );
    }

    return parseExperimentRunnerConfig(parsedJson);
}

export function validateRuntimeProviderConfiguration(config: ExperimentRunnerConfig): void {
    if (config.execution.useMock) return;

    const provider = process.env.LLM_PROVIDER?.trim().toLowerCase();
    if (!provider || provider === "mock") {
        throw new ExperimentRunnerConfigError(
            "Set LLM_PROVIDER to a real provider or set execution.useMock=true for a mock run."
        );
    }
}

export function applyConfiguredModelToEnvironment(config: ExperimentRunnerConfig): void {
    process.env.LLM_MODEL = config.model;
}

function formatZodError(error: z.ZodError): string {
    const details = error.issues
        .map((issue) => {
            const location = issue.path.length > 0 ? issue.path.join(".") : "<root>";
            return `- ${location}: ${issue.message}`;
        })
        .join("\n");

    return `Invalid experiment config:\n${details}`;
}
