import { z } from "zod";

import type { QuestionData } from "@/lib/question-loader";
import {
    expectedCriterionSchema,
    referenceAnswerProfiles,
    referenceAnswerVariants,
} from "@/server/experiment/reference-answers/schema";

export const strategyIds = ["single", "review", "multi_aggregate"] as const;

export const strategyIdSchema = z.enum(strategyIds);

export type StrategyId = z.infer<typeof strategyIdSchema>;

export const strategyStatusSchema = z.enum([
    "success",
    "parse_error",
    "schema_error",
    "llm_error",
    "timeout",
]);

export type StrategyStatus = z.infer<typeof strategyStatusSchema>;

const nonEmptyString = z.string().trim().min(1);

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
    z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(jsonValueSchema),
        z.record(z.string(), jsonValueSchema),
    ])
);

export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

export const strategyMetadataSchema = z.record(z.string(), jsonValueSchema);

export type StrategyMetadata = z.infer<typeof strategyMetadataSchema>;

export const studentAnswerSchema = z
    .object({
        kind: z.literal("student"),
        resposta: z.string().default(""),
        raciocinio: z.string().optional().default(""),
        codigo: z.string().optional(),
        language: z.enum(["javascript", "python", "java"]).optional(),
    })
    .strict();

export type StudentAnswer = z.infer<typeof studentAnswerSchema>;

export const referenceAnswerSchema = z
    .object({
        kind: z.literal("reference"),
        id: nonEmptyString,
        questionSlug: nonEmptyString,
        profile: z.enum(referenceAnswerProfiles),
        variant: z.enum(referenceAnswerVariants).optional(),
        language: nonEmptyString.optional(),
        answerText: z.string().optional(),
        code: z.string().optional(),
        justification: z.string().optional(),
        expectedOverall: z.number().min(0).max(5),
        expectedCriteria: z.array(expectedCriterionSchema).min(1),
        notes: z.string().optional(),
    })
    .strict()
    .refine(
        (answer) =>
            [answer.answerText, answer.code, answer.justification].some(
                (value) => typeof value === "string" && value.trim().length > 0
            ),
        {
            message: "answer must include at least one non-empty content field",
            path: ["answerText"],
        }
    );

export type ReferenceAnswer = z.infer<typeof referenceAnswerSchema>;

export const evaluationInputSchema = z
    .object({
        question: z.custom<QuestionData>(
            (value) =>
                typeof value === "object" &&
                value !== null &&
                "meta" in value &&
                "sections" in value
        ),
        answer: z.discriminatedUnion("kind", [studentAnswerSchema, referenceAnswerSchema]),
        model: nonEmptyString,
        promptVersion: nonEmptyString,
    })
    .strict();

export type EvaluationInput = z.infer<typeof evaluationInputSchema>;

export const evaluationOutputCriterionSchema = z
    .object({
        criterionId: nonEmptyString,
        score: z.number().min(0).max(5),
        weight: z.number().min(0).max(1).optional(),
        evidence: z.string().default(""),
        comment: z.string().default(""),
    })
    .strict();

export type EvaluationOutputCriterion = z.infer<typeof evaluationOutputCriterionSchema>;

export const evaluationOutputSchema = z
    .object({
        overall: z.number().min(0).max(5),
        criteria: z.array(evaluationOutputCriterionSchema).min(1),
        feedback: z.string().default(""),
    })
    .strict();

export type EvaluationOutput = z.infer<typeof evaluationOutputSchema>;

export const rawStrategyOutputSchema = z
    .object({
        output: z.string(),
        model: z.string().optional(),
        callIndex: z.number().int().positive().optional(),
        metadata: strategyMetadataSchema.optional(),
    })
    .strict();

export type RawStrategyOutput = z.infer<typeof rawStrategyOutputSchema>;

export const strategyCostEstimateSchema = z
    .object({
        provider: nonEmptyString.optional(),
        inputTokens: z.number().nonnegative().optional(),
        outputTokens: z.number().nonnegative().optional(),
        totalTokens: z.number().nonnegative().optional(),
        reasoningTokens: z.number().nonnegative().optional(),
        cachedTokens: z.number().nonnegative().optional(),
        cacheWriteTokens: z.number().nonnegative().optional(),
        costCredits: z.number().nonnegative().optional(),
        providerCostUnit: nonEmptyString.optional(),
        upstreamInferenceCost: z.number().nonnegative().optional(),
        estimatedUsd: z.number().nonnegative().optional(),
    })
    .strict();

export type StrategyCostEstimate = z.infer<typeof strategyCostEstimateSchema>;

const strategyResultBaseSchema = z
    .object({
        strategy: strategyIdSchema,
        status: strategyStatusSchema,
        model: nonEmptyString,
        promptVersion: nonEmptyString,
        questionSlug: nonEmptyString,
        referenceAnswerId: nonEmptyString.optional(),
        startedAt: z.string().datetime(),
        finishedAt: z.string().datetime(),
        latencyMs: z.number().nonnegative(),
        callCount: z.number().int().nonnegative(),
        rawOutputs: z.array(rawStrategyOutputSchema).default([]),
        costEstimate: strategyCostEstimateSchema.optional(),
        strategyMetadata: strategyMetadataSchema.optional(),
    })
    .strict();

export const strategySuccessResultSchema = strategyResultBaseSchema.extend({
    status: z.literal("success"),
    parsedOutput: evaluationOutputSchema,
    errorMessage: z.never().optional(),
});

export const strategyFailureResultSchema = strategyResultBaseSchema.extend({
    status: z.enum(["parse_error", "schema_error", "llm_error", "timeout"]),
    parsedOutput: evaluationOutputSchema.optional(),
    errorMessage: nonEmptyString,
});

export const strategyResultSchema = z.discriminatedUnion("status", [
    strategySuccessResultSchema,
    strategyFailureResultSchema,
]);

export type StrategySuccessResult = z.infer<typeof strategySuccessResultSchema>;
export type StrategyFailureResult = z.infer<typeof strategyFailureResultSchema>;
export type StrategyResult = z.infer<typeof strategyResultSchema>;

export type EvaluationStrategy = {
    id: StrategyId;
    execute(input: EvaluationInput): Promise<StrategyResult>;
};
