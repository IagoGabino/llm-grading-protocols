import type { EvaluationResponse } from "./schemas";

/**
 * Calcula a nota overall com base na média ponderada dos critérios.
 * Substitui o valor retornado pela LLM para garantir precisão matemática.
 *
 * @param evaluation - Resposta da avaliação da LLM
 * @returns Nota overall calculada (0-5, arredondada para 2 casas decimais)
 */
export function calculateOverallScore(evaluation: EvaluationResponse): number {
    const { criteria } = evaluation;

    // Se não há critérios, retorna 0
    if (criteria.length === 0) {
        return 0;
    }

    // Calcula soma ponderada
    let weightedSum = 0;
    let totalWeight = 0;

    for (const criterion of criteria) {
        const score = criterion.score;
        const weight = criterion.weight ?? 0;

        weightedSum += score * weight;
        totalWeight += weight;
    }

    // Se não há pesos definidos ou soma é 0, usa média simples
    if (totalWeight === 0) {
        const simpleAverage = criteria.reduce((sum, c) => sum + c.score, 0) / criteria.length;
        return Math.round(simpleAverage * 100) / 100;
    }

    // Calcula média ponderada
    const overall = weightedSum / totalWeight;

    // Arredonda para 2 casas decimais e garante que está no intervalo [0, 5]
    const rounded = Math.round(overall * 100) / 100;
    return Math.max(0, Math.min(5, rounded));
}

/**
 * Recalcula o overall de uma resposta de avaliação.
 * Retorna uma nova resposta com o overall corrigido.
 */
export function recalculateOverall(
    evaluation: EvaluationResponse
): EvaluationResponse & { originalOverall?: number } {
    const calculatedOverall = calculateOverallScore(evaluation);
    const originalOverall = evaluation.overall;

    // Se a diferença é maior que 0.05, registra o valor original
    const shouldTrackOriginal = Math.abs(calculatedOverall - originalOverall) > 0.05;

    return {
        ...evaluation,
        overall: calculatedOverall,
        ...(shouldTrackOriginal && { originalOverall }),
    };
}
