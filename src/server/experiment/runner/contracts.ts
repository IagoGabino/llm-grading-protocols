import { z } from "zod";

import {
    expectedCriterionSchema,
    referenceAnswerProfiles,
    referenceAnswerVariants,
} from "../reference-answers";
import {
    evaluationOutputSchema,
    strategyCostEstimateSchema,
    strategyIdSchema,
    strategyMetadataSchema,
    strategyStatusSchema,
} from "../strategies";

const nonEmptyString = z.string().trim().min(1);

export const experimentRunReferenceSchema = z
    .object({
        profile: z.enum(referenceAnswerProfiles),
        variant: z.enum(referenceAnswerVariants).optional(),
        expectedOverall: z.number().min(0).max(5),
        expectedCriteria: z.array(expectedCriterionSchema).min(1),
        notes: z.string().optional(),
    })
    .strict();

export type ExperimentRunReference = z.infer<typeof experimentRunReferenceSchema>;

export const experimentRunSchema = z
    .object({
        id: nonEmptyString,
        experimentId: nonEmptyString,
        strategy: strategyIdSchema,
        status: strategyStatusSchema,
        model: nonEmptyString,
        configuredModel: nonEmptyString,
        questionSlug: nonEmptyString,
        referenceAnswerId: nonEmptyString,
        promptVersion: nonEmptyString,
        startedAt: z.string().datetime(),
        finishedAt: z.string().datetime(),
        latencyMs: z.number().nonnegative(),
        callCount: z.number().int().nonnegative(),
        rawOutputPath: z.string().optional(),
        parsedOutput: evaluationOutputSchema.optional(),
        errorMessage: z.string().optional(),
        costEstimate: strategyCostEstimateSchema.optional(),
        strategyMetadata: strategyMetadataSchema.optional(),
        reference: experimentRunReferenceSchema,
    })
    .strict();

export type ExperimentRun = z.infer<typeof experimentRunSchema>;

export type ExperimentRunnerSummary = {
    total: number;
    byStatus: Record<ExperimentRun["status"], number>;
};
