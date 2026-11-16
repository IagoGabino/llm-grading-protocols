/**
 * Types para integração com API de avaliação
 * Sincronizado com schemas em src/server/eval/schemas.ts
 */

export type EvaluateRequest = {
    slug: string;
    resposta: string;
    raciocinio?: string;
    codigo?: string;
    language?: "javascript" | "python" | "java";
};

export type EvaluationCriterion = {
    id: string;
    score: number;
    weight: number;
    evidence: string[];
    comment: string;
};

export type EvaluateResponse = {
    overall: number;
    criteria: EvaluationCriterion[];
    feedback: string;
    model: string;
    timingMs: number;
    attemptId?: string; // Presente apenas se usuário autenticado
};

export type EvaluateError = {
    error: string;
    detail?: string;
    fieldErrors?: Record<string, string[]>;
};
