import {
    applyConfiguredModelToEnvironment,
    validateRuntimeProviderConfiguration,
    type ExperimentRunnerConfig,
} from "./config";
import { experimentRunSchema, type ExperimentRun, type ExperimentRunnerSummary } from "./contracts";
import {
    buildExecutionMatrix,
    matrixItemToEvaluationInput,
    type ExecutionMatrixItem,
} from "./matrix";
import {
    appendRunRecord,
    initializeExperimentOutput,
    writeConsolidatedExports,
    writeRawOutputs,
    type ExperimentOutputPaths,
} from "./persistence";
import { loadValidatedReferenceInputs } from "./reference-inputs";
import {
    createMultiAggregateStrategy,
    createReviewStrategy,
    createSingleStrategy,
    type EvaluationInput,
    type EvaluationOutput,
    type RawStrategyOutput,
    type StrategyId,
    type StrategyResult,
} from "../strategies";

export type StrategyExecutor = (input: EvaluationInput) => Promise<StrategyResult>;

export type ExperimentRunnerEvent =
    | { type: "prepared"; plannedCount: number }
    | { type: "run_started"; item: ExecutionMatrixItem }
    | { type: "run_finished"; run: ExperimentRun }
    | { type: "summary"; summary: ExperimentRunnerSummary };

export type RunExperimentOptions = {
    strategyExecutors?: Partial<Record<StrategyId, StrategyExecutor>>;
    onEvent?: (event: ExperimentRunnerEvent) => void | Promise<void>;
    skipProviderValidation?: boolean;
};

export type ExperimentRunnerResult = {
    outputPaths: ExperimentOutputPaths;
    plannedCount: number;
    runs: ExperimentRun[];
    summary: ExperimentRunnerSummary;
};

export async function runExperiment(
    config: ExperimentRunnerConfig,
    options: RunExperimentOptions = {}
): Promise<ExperimentRunnerResult> {
    applyConfiguredModelToEnvironment(config);

    const { inputs } = await loadValidatedReferenceInputs(config.referenceAnswersPath);
    const matrix = buildExecutionMatrix(config, inputs);
    await options.onEvent?.({ type: "prepared", plannedCount: matrix.length });

    if (!options.skipProviderValidation) {
        validateRuntimeProviderConfiguration(config);
    }

    const outputPaths = await initializeExperimentOutput(config);
    const runById = new Map<string, ExperimentRun>();

    await runWithConcurrency(matrix, config.execution.concurrency, async (item) => {
        await options.onEvent?.({ type: "run_started", item });
        const { result, rawOutputs } = await executeMatrixItem(item, config, options);
        const rawOutputPath = await writeRawOutputs(outputPaths, item.id, rawOutputs);
        const run = experimentRunSchema.parse({ ...result, rawOutputPath });
        await appendRunRecord(outputPaths, run);
        runById.set(item.id, run);
        await options.onEvent?.({ type: "run_finished", run });
    });

    const runs = matrix.map((item) => {
        const run = runById.get(item.id);
        if (!run) {
            throw new Error(`Missing run record for ${item.id}`);
        }
        return run;
    });
    await writeConsolidatedExports(outputPaths, runs);

    const summary = summarizeRuns(runs);
    await options.onEvent?.({ type: "summary", summary });

    return {
        outputPaths,
        plannedCount: matrix.length,
        runs,
        summary,
    };
}

async function executeMatrixItem(
    item: ExecutionMatrixItem,
    config: ExperimentRunnerConfig,
    options: RunExperimentOptions
): Promise<{ result: Omit<ExperimentRun, "rawOutputPath">; rawOutputs: RawStrategyOutput[] }> {
    const input = matrixItemToEvaluationInput(item);
    const executor = resolveStrategyExecutor(item.strategy, config, options);
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();

    try {
        const strategyResult = await executor(input);
        return {
            result: strategyResultToExperimentRun(item, config, strategyResult),
            rawOutputs: strategyResult.rawOutputs,
        };
    } catch (error) {
        const finishedAtMs = Date.now();
        const finishedAt = new Date(finishedAtMs).toISOString();
        return {
            result: buildExceptionRun(
                item,
                config,
                startedAt,
                finishedAt,
                Math.max(0, finishedAtMs - startedAtMs),
                error
            ),
            rawOutputs: [],
        };
    }
}

function resolveStrategyExecutor(
    strategy: StrategyId,
    config: ExperimentRunnerConfig,
    options: RunExperimentOptions
): StrategyExecutor {
    const injected = options.strategyExecutors?.[strategy];
    if (injected) return injected;

    const strategyOptions = {
        useMock: config.execution.useMock,
        timeoutMs: config.execution.timeoutMs,
        retryLimit: config.execution.retryLimit,
    };

    if (strategy === "single") return createSingleStrategy(strategyOptions).execute;
    if (strategy === "review") return createReviewStrategy(strategyOptions).execute;
    return createMultiAggregateStrategy(strategyOptions).execute;
}

function strategyResultToExperimentRun(
    item: ExecutionMatrixItem,
    config: ExperimentRunnerConfig,
    result: StrategyResult
): Omit<ExperimentRun, "rawOutputPath"> {
    return {
        id: item.id,
        experimentId: config.experimentId,
        strategy: item.strategy,
        status: result.status,
        model: result.model,
        configuredModel: config.model,
        questionSlug: item.questionSlug,
        referenceAnswerId: item.referenceAnswerId,
        promptVersion: config.promptVersion,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        latencyMs: result.latencyMs,
        callCount: result.callCount,
        ...extractParsedOutput(result),
        ...(result.status !== "success" && { errorMessage: result.errorMessage }),
        ...(result.costEstimate && { costEstimate: result.costEstimate }),
        ...(result.strategyMetadata && { strategyMetadata: result.strategyMetadata }),
        reference: toRunReference(item),
    };
}

function buildExceptionRun(
    item: ExecutionMatrixItem,
    config: ExperimentRunnerConfig,
    startedAt: string,
    finishedAt: string,
    latencyMs: number,
    error: unknown
): Omit<ExperimentRun, "rawOutputPath"> {
    return {
        id: item.id,
        experimentId: config.experimentId,
        strategy: item.strategy,
        status: "llm_error",
        model: config.model,
        configuredModel: config.model,
        questionSlug: item.questionSlug,
        referenceAnswerId: item.referenceAnswerId,
        promptVersion: config.promptVersion,
        startedAt,
        finishedAt,
        latencyMs,
        callCount: 0,
        errorMessage: error instanceof Error ? error.message : String(error),
        reference: toRunReference(item),
    };
}

function extractParsedOutput(result: StrategyResult): { parsedOutput?: EvaluationOutput } {
    if (result.status === "success") {
        return { parsedOutput: result.parsedOutput };
    }

    if (result.parsedOutput) {
        return { parsedOutput: result.parsedOutput };
    }

    return {};
}

function toRunReference(item: ExecutionMatrixItem): ExperimentRun["reference"] {
    const answer = item.input.referenceAnswer;
    return {
        profile: answer.profile,
        ...(answer.variant && { variant: answer.variant }),
        expectedOverall: answer.expectedOverall,
        expectedCriteria: answer.expectedCriteria,
        ...(answer.notes && { notes: answer.notes }),
    };
}

async function runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    execute: (item: T) => Promise<void>
): Promise<void> {
    let nextIndex = 0;
    const workerCount = Math.min(concurrency, items.length);

    await Promise.all(
        Array.from({ length: workerCount }, async () => {
            while (nextIndex < items.length) {
                const item = items[nextIndex];
                nextIndex += 1;
                await execute(item);
            }
        })
    );
}

export function summarizeRuns(runs: ExperimentRun[]): ExperimentRunnerSummary {
    const byStatus: ExperimentRunnerSummary["byStatus"] = {
        success: 0,
        parse_error: 0,
        schema_error: 0,
        llm_error: 0,
        timeout: 0,
    };

    for (const run of runs) {
        byStatus[run.status] += 1;
    }

    return {
        total: runs.length,
        byStatus,
    };
}
