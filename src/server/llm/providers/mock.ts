import type { LLMProvider } from "../types";

type RubricCriterionInput = {
    id?: string;
    name?: string;
    description?: string;
    weight?: number;
};

type MockCriterion = {
    id: string;
    label?: string;
    score: number;
    weight?: number;
    evidence: string[];
    comment: string;
};

type MockEvaluationPayload = {
    overall: number;
    criteria: MockCriterion[];
    feedback: string;
};

export function createMockProvider(): LLMProvider {
    const model = process.env.LLM_MODEL ?? "mock/evaluator-v1";
    return {
        name: "mock",
        async invoke(messages, options) {
            const signal = options?.signal;
            await delay(Math.min(options?.timeoutMs ?? 150, 150), signal);

            const lastMessage = messages.at(-1)?.content ?? "";
            const rubricCriteria = extractRubricCriteria(lastMessage);
            const evaluation = buildMockEvaluation(rubricCriteria);

            return {
                output: JSON.stringify(evaluation, null, 2),
                model,
            };
        },
    };
}

function extractRubricCriteria(content: string): RubricCriterionInput[] {
    const startMarker = "[RUBRICA DE AVALIAÇÃO]";
    const endMarker = "[PONTOS ESPERADOS";
    const startIndex = content.indexOf(startMarker);
    const endIndex = content.indexOf(endMarker, startIndex + startMarker.length);
    if (startIndex === -1 || endIndex === -1) return [];
    const raw = content.slice(startIndex + startMarker.length, endIndex).trim();

    try {
        const parsed = JSON.parse(raw) as { criteria?: RubricCriterionInput[] };
        if (!parsed || !Array.isArray(parsed.criteria)) return [];
        return parsed.criteria.filter(
            (criterion) => typeof criterion === "object" && criterion !== null
        );
    } catch {
        return [];
    }
}

function buildMockEvaluation(rubricCriteria: RubricCriterionInput[]): MockEvaluationPayload {
    const criteriaSource =
        rubricCriteria.length > 0
            ? rubricCriteria
            : [
                  { id: "analysis", name: "Análise da solução", weight: 0.4 },
                  { id: "implementation", name: "Implementação", weight: 0.4 },
                  { id: "communication", name: "Comunicação", weight: 0.2 },
              ];

    const totalWeight =
        criteriaSource.reduce(
            (sum, criterion) => sum + (typeof criterion.weight === "number" ? criterion.weight : 1),
            0
        ) ||
        criteriaSource.length ||
        1;

    const rawWeights: number[] = [];
    const criteria: MockCriterion[] = criteriaSource.map((criterion, index) => {
        const weightFraction =
            (typeof criterion.weight === "number" ? criterion.weight : 1) / totalWeight;
        rawWeights.push(weightFraction);
        const variance = pseudoRandom(criterion.id ?? criterion.name ?? `criterion-${index}`);
        const score = roundTo(Math.min(5, 3.2 + variance * 1.8), 1);
        return {
            id: (criterion.id ?? `criterion_${index + 1}`).toString(),
            label: criterion.name,
            score,
            weight: roundTo(weightFraction, 3),
            evidence: [
                `Indicadores positivos em ${criterion.name ?? criterion.id ?? "um dos critérios"}.`,
            ],
            comment: `Avaliação automática para ${criterion.name ?? criterion.id ?? "o critério"}. Ajuste conforme feedback.`,
        };
    });

    const overallScore = criteria.reduce(
        (sum, criterion, index) => sum + criterion.score * rawWeights[index],
        0
    );
    const overall = roundTo(overallScore, 1);

    return {
        overall,
        criteria,
        feedback:
            "Resultado gerado pelo provedor mock. Use como referência de payload enquanto a integração com o LLM real não está ativa.",
    };
}

function pseudoRandom(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }
    return (Math.abs(hash) % 1000) / 1000;
}

function roundTo(value: number, decimalPlaces: number): number {
    const factor = 10 ** decimalPlaces;
    return Math.round(value * factor) / factor;
}

function delay(durationMs: number, signal?: AbortSignal) {
    if (signal?.aborted) return Promise.reject(new Error("Operação abortada"));
    return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            resolve();
        }, durationMs);

        const onAbort = () => {
            cleanup();
            reject(new Error("Operação abortada"));
        };

        const cleanup = () => {
            clearTimeout(timeout);
            if (signal) {
                signal.removeEventListener("abort", onAbort);
            }
        };

        if (signal) {
            signal.addEventListener("abort", onAbort);
        }
    });
}
