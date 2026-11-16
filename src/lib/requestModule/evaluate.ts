import type { EvaluateRequest, EvaluateResponse, EvaluateError } from "./types";

/**
 * Erro customizado para avaliações
 */
export class EvaluationError extends Error {
    constructor(
        message: string,
        public readonly detail?: string,
        public readonly fieldErrors?: Record<string, string[]>
    ) {
        super(message);
        this.name = "EvaluationError";
    }
}

/**
 * Envia resposta do aluno para avaliação
 *
 * @param data - Dados da avaliação (slug, resposta, raciocinio, codigo)
 * @returns Resultado da avaliação estruturado
 * @throws EvaluationError em caso de erro na API
 */
export async function evaluateAnswer(data: EvaluateRequest): Promise<EvaluateResponse> {
    const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        let errorData: EvaluateError;

        try {
            errorData = await response.json();
        } catch {
            throw new EvaluationError(
                `Erro HTTP ${response.status}`,
                "Não foi possível processar a resposta do servidor"
            );
        }

        throw new EvaluationError(
            errorData.error || "Erro na avaliação",
            errorData.detail,
            errorData.fieldErrors
        );
    }

    return response.json();
}
