export type EvaluationCriterion = {
    id: string;
    label: string;
    weight: number;
    score: number;
    comment: string;
    evidence?: string;
};

export type EvaluationResult = {
    questionSlug: string;
    overallScore: number;
    feedback: string;
    submittedAt: string;
    attemptNumber: number;
    language?: string;
    reviewer?: string;
    criteria: EvaluationCriterion[];
};

const mockEvaluationResults: EvaluationResult[] = [
    {
        questionSlug: "refactoring-shipping-calculator",
        overallScore: 4.2,
        feedback:
            "Ótima evolução! O código ficou mais modular e fácil de ler. Há oportunidades pontuais de reforçar a validação e explicar melhor algumas escolhas na justificativa.",
        submittedAt: "2024-02-21T18:45:00.000Z",
        attemptNumber: 2,
        language: "javascript",
        reviewer: "Avaliação Automática",
        criteria: [
            {
                id: "problem_identification",
                label: "Identificação de problemas",
                weight: 0.3,
                score: 4.5,
                comment:
                    "Listou corretamente os code smells principais e sugeriu abordagens coerentes.",
            },
            {
                id: "solution_quality",
                label: "Qualidade da solução",
                weight: 0.3,
                score: 4,
                comment:
                    "Refatoração consistente com extração de constantes e tabelas, mantendo boa legibilidade.",
                evidence: "Trecho com uso de tabela de tarifas e constantes nomeadas.",
            },
            {
                id: "behavior_preservation",
                label: "Preservação de comportamento",
                weight: 0.2,
                score: 4.5,
                comment: "Cobriu os fluxos principais e documentou cenários limite.",
            },
            {
                id: "code_clarity",
                label: "Clareza do código",
                weight: 0.1,
                score: 4.1,
                comment: "Nomenclaturas claras e divisão lógica de responsabilidades.",
            },
            {
                id: "reasoning",
                label: "Justificativa e trade-offs",
                weight: 0.1,
                score: 3.8,
                comment: "Poderia detalhar melhor decisões sobre validações e erros.",
            },
        ],
    },
    {
        questionSlug: "bugfix-pagination",
        overallScore: 3.6,
        feedback:
            "Corrigiu o fluxo principal e os cálculos básicos. Falta abordar cenários limites e explicar decisões de UX ao tratar páginas inválidas.",
        submittedAt: "2024-02-10T14:12:00.000Z",
        attemptNumber: 1,
        language: "python",
        reviewer: "Mentoria Skill Lab",
        criteria: [
            {
                id: "bug_understanding",
                label: "Compreensão dos bugs",
                weight: 0.35,
                score: 3.5,
                comment: "Identificou os bugs críticos, mas faltou citar impactos em UX.",
            },
            {
                id: "fix_quality",
                label: "Qualidade do fix",
                weight: 0.35,
                score: 3.9,
                comment:
                    "Ajustes corretos na paginação, com uso adequado de limites e arredondamentos.",
            },
            {
                id: "regression_prevention",
                label: "Prevenção de regressões",
                weight: 0.2,
                score: 3.2,
                comment: "Ainda sem cobertura para cenários com listas vazias.",
            },
            {
                id: "communication",
                label: "Comunicação da solução",
                weight: 0.1,
                score: 3.8,
                comment: "Descrição objetiva, mas poderia detalhar próximas etapas de validação.",
            },
        ],
    },
];

export function getMockEvaluationResult(questionSlug?: string): EvaluationResult | undefined {
    if (mockEvaluationResults.length === 0) return undefined;
    if (!questionSlug) return mockEvaluationResults[0];
    return (
        mockEvaluationResults.find((result) => result.questionSlug === questionSlug) ??
        mockEvaluationResults[0]
    );
}
