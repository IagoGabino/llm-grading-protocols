/**
 * Tipos para avaliações (mock e real)
 */

import { z } from "zod";

// Schema para critério de avaliação (API real)
export const evaluationCriterionSchema = z.object({
    id: z.string(),
    score: z.number().min(0).max(10),
    weight: z.number().min(0).max(1),
    evidence: z.array(z.string()),
    comment: z.string(),
});

// Schema para resposta completa de avaliação (API real)
export const evaluationResponseSchema = z.object({
    overall: z.number().min(0).max(10),
    criteria: z.array(evaluationCriterionSchema),
    feedback: z.string(),
});

// Tipos inferidos dos schemas
export type EvaluationCriterion = z.infer<typeof evaluationCriterionSchema>;
export type EvaluationResponse = z.infer<typeof evaluationResponseSchema>;

// Tipo para critério mock (formato antigo)
export type MockEvaluationCriterion = {
    id: string;
    label: string;
    score: number;
    weight: number;
    evidence: string;
    comment: string;
};

// Tipo para avaliação mock
export type MockEvaluation = {
    overallScore: number;
    criteria: MockEvaluationCriterion[];
    feedback: string;
};

// Tipo unificado para exibição
export type NormalizedCriterion = {
    id: string;
    label: string;
    score: number;
    weight: number;
    evidence: string;
    comment: string;
};

export type NormalizedEvaluation = {
    overall: number;
    criteria: NormalizedCriterion[];
    feedback: string;
};

/**
 * Normaliza dados de avaliação (real ou mock) para formato consistente
 */
export function normalizeEvaluation(
    evaluation: EvaluationResponse | MockEvaluation | unknown
): NormalizedEvaluation {
    // Validar se é avaliação real (da API)
    const realResult = evaluationResponseSchema.safeParse(evaluation);
    if (realResult.success) {
        const realEval = realResult.data;
        return {
            overall: realEval.overall,
            criteria: realEval.criteria.map((c) => ({
                id: c.id,
                label: c.id, // API não retorna label, usar id
                score: c.score,
                weight: c.weight,
                evidence: c.evidence[0] || "Sem evidências", // Pegar primeira evidência
                comment: c.comment,
            })),
            feedback: realEval.feedback,
        };
    }

    // Se for mock (formato antigo), fazer cast seguro
    const mockEval = evaluation as Partial<MockEvaluation>;
    return {
        overall: mockEval?.overallScore ?? 0,
        criteria:
            mockEval?.criteria?.map((c) => ({
                id: c.id,
                label: c.label,
                score: c.score,
                weight: c.weight,
                evidence: c.evidence,
                comment: c.comment,
            })) ?? [],
        feedback: mockEval?.feedback ?? "Feedback não disponível",
    };
}
