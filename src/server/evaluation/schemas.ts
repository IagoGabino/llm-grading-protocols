import { z } from "zod";

export const evaluationRequestSchema = z.object({
    slug: z.string({ message: "slug deve ser uma string" }).min(1, "slug não pode ser vazio"),
    resposta: z.string({ message: "resposta deve ser uma string" }).default(""),
    raciocinio: z.string({ message: "raciocinio deve ser uma string" }).optional().default(""),
    codigo: z.string({ message: "codigo deve ser uma string" }).optional(),
    language: z.enum(["javascript", "python", "java"]).optional(),
});

export type EvaluationRequestInput = z.infer<typeof evaluationRequestSchema>;

export const evaluationCriterionSchema = z.object({
    id: z
        .string({ message: "criteria[].id deve ser string" })
        .min(1, "criteria[].id não pode ser vazio"),
    score: z
        .number({ message: "criteria[].score deve ser número" })
        .min(0, "criteria[].score deve ser >= 0")
        .max(5, "criteria[].score deve ser <= 5"),
    weight: z
        .number({ message: "criteria[].weight deve ser número" })
        .min(0, "criteria[].weight deve ser >= 0")
        .max(1, "criteria[].weight deve ser <= 1")
        .optional(),
    evidence: z
        .array(
            z
                .string({ message: "criteria[].evidence[] deve ser string" })
                .min(1, "criteria[].evidence[] não pode ser vazia")
        )
        .optional()
        .default([]),
    label: z.string({ message: "criteria[].label deve ser string" }).optional(),
    comment: z.string({ message: "criteria[].comment deve ser string" }).optional().default(""),
});

export const evaluationResponseSchema = z.object({
    overall: z
        .number({ message: "overall deve ser número" })
        .min(0, "overall deve ser >= 0")
        .max(5, "overall deve ser <= 5"),
    criteria: z.array(evaluationCriterionSchema).min(1, "criteria deve ter pelo menos um item"),
    feedback: z.string({ message: "feedback deve ser string" }).default(""),
});

export type EvaluationResponse = z.infer<typeof evaluationResponseSchema>;
