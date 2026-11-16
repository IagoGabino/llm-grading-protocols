import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const referenceAnswerProfiles = ["strong", "medium", "weak", "misleading"] as const;

export const referenceAnswerVariants = [
    "complete_correct",
    "partial_correct",
    "good_writing_low_coverage",
    "conceptually_close_incomplete",
    "subtle_error",
    "inconsistent",
] as const;

export const expectedCriterionSchema = z
    .object({
        criterionId: nonEmptyString,
        expectedScore: z.number().min(0).max(5),
        rationale: nonEmptyString,
    })
    .strict();

export const referenceAnswerItemSchema = z
    .object({
        id: nonEmptyString,
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

export const referenceAnswerFileSchema = z
    .object({
        questionSlug: nonEmptyString,
        answers: z.array(referenceAnswerItemSchema),
    })
    .strict();

export type ExpectedCriterion = z.infer<typeof expectedCriterionSchema>;
export type ReferenceAnswerItem = z.infer<typeof referenceAnswerItemSchema>;
export type ReferenceAnswerFile = z.infer<typeof referenceAnswerFileSchema>;
export type ReferenceAnswerProfile = (typeof referenceAnswerProfiles)[number];
export type ReferenceAnswerVariant = (typeof referenceAnswerVariants)[number];

export type ReferenceAnswer = ReferenceAnswerItem & {
    questionSlug: string;
};

