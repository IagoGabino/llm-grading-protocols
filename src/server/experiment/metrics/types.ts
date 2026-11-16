import type { ExperimentRun } from "@/server/experiment/runner";
import type { StrategyId } from "@/server/experiment/strategies";

export type MetricsProtocolSnapshot = {
    generatedAt?: string;
    config: {
        experimentId: string;
        model: string;
        promptVersion: string;
        enabledStrategies: StrategyId[];
        referenceAnswersPath?: string;
        outputDir?: string;
    };
};

export type MetricsArtifacts = {
    experimentDir: string;
    metricsDir: string;
    protocol: MetricsProtocolSnapshot;
    runs: ExperimentRun[];
};

export type MatrixKey = {
    strategy: StrategyId;
    questionSlug: string;
    referenceAnswerId: string;
    model: string;
    promptVersion: string;
};

export type MatrixCompleteness = {
    assessmentSource: "reference_answers" | "observed_runs";
    plannedRuns: number;
    plannedRunsByStrategy: Record<string, number>;
    foundRuns: number;
    missingExecutions: MatrixKey[];
    duplicateExecutions: Array<MatrixKey & { count: number; runIds: string[] }>;
    warnings: string[];
};

export type PerRunMetric = {
    runId: string;
    strategy: StrategyId;
    questionSlug: string;
    referenceAnswerId: string;
    profile: string;
    variant: string;
    status: ExperimentRun["status"];
    predictedOverall: number | "";
    expectedOverall: number | "";
    absoluteError: number | "";
    signedError: number | "";
    weightedOverallFromCriteria: number | "";
    overallConsistencyDelta: number | "";
    callCount: number;
    latencyMs: number;
    costCredits: number | "";
};

export type PerCriterionMetric = {
    runId: string;
    strategy: StrategyId;
    questionSlug: string;
    referenceAnswerId: string;
    profile: string;
    criterionId: string;
    predictedScore: number;
    expectedScore: number;
    criterionAbsoluteError: number;
    criterionSignedError: number;
    weight: number | "";
};

export type StrategySummary = {
    strategy: StrategyId;
    plannedRuns: number;
    foundRuns: number;
    successRuns: number;
    successRate: number;
    overallMAE: number | "";
    overallMeanSignedError: number | "";
    criterionMAE: number | "";
    totalCallCount: number;
    avgCallCount: number;
    totalCostCredits: number | "";
    avgLatencyMs: number | "";
    maxLatencyMs: number | "";
};

export type StatusCounts = Record<ExperimentRun["status"], number>;

export type RobustnessSummary = {
    experimentId: string;
    plannedRuns: number;
    foundRuns: number;
    successRuns: number;
    statusCountsByStrategy: Record<string, StatusCounts>;
    matrixCompleteness: MatrixCompleteness;
    validationWarnings: string[];
};

export type OperationalSummary = {
    experimentId: string;
    byStrategy: Record<
        string,
        {
            foundRuns: number;
            totalCallCount: number;
            avgCallCount: number;
            totalLatencyMs: number;
            avgLatencyMs: number | "";
            maxLatencyMs: number | "";
            totalCostCredits: number | "";
            avgCostCredits: number | "";
            costAvailableRuns: number;
        }
    >;
};

export type StrategyDiagnostics = {
    multiAggregate: {
        availableRuns: number;
        unavailableRuns: number;
        byCriterion: Record<
            string,
            {
                samples: number;
                avgStdDev: number;
                maxStdDev: number;
            }
        >;
    };
};

export type GroupedSummary = {
    note: string;
    groups: Array<{
        groupBy: "axis" | "difficulty" | "profile";
        groupValue: string;
        strategy: StrategyId;
        successRuns: number;
        overallMAE: number | "";
        sparse: boolean;
    }>;
};

export type ExperimentMetricsResult = {
    perRun: PerRunMetric[];
    perCriterion: PerCriterionMetric[];
    perStrategy: StrategySummary[];
    robustness: RobustnessSummary;
    operational: OperationalSummary;
    diagnostics: StrategyDiagnostics;
    grouped: GroupedSummary;
    consistency: {
        evaluated: false;
        reason: string;
    };
};
