// JSON Schema compartilhado para enforced outputs (OpenRouter Structured Outputs e Claude JSON mode)
export const evaluationResponseJsonSchema = {
    name: "evaluation_response",
    strict: true,
    schema: {
        type: "object",
        additionalProperties: false,
        properties: {
            overall: {
                type: "number",
                description:
                    "Nota geral agregada na escala de 0 a 5. É a média ponderada dos scores dos critérios.",
                minimum: 0,
                maximum: 5,
            },
            criteria: {
                type: "array",
                description: "Lista de critérios avaliados individualmente.",
                minItems: 1,
                items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        id: {
                            type: "string",
                            description: "Identificador único do critério.",
                            minLength: 1,
                        },
                        score: {
                            type: "number",
                            description: "Nota atribuída ao critério na escala de 0 a 5.",
                            minimum: 0,
                            maximum: 5,
                        },
                        weight: {
                            type: "number",
                            description: "Peso normalizado do critério (0 a 1).",
                            minimum: 0,
                            maximum: 1,
                        },
                        evidence: {
                            type: "array",
                            description: "Evidências textuais que justificam o score.",
                            items: {
                                type: "string",
                                minLength: 1,
                            },
                        },
                        comment: {
                            type: "string",
                            description: "Comentário adicional do avaliador para o critério.",
                        },
                    },
                    required: ["id", "score", "weight", "evidence", "comment"],
                },
            },
            feedback: {
                type: "string",
                description: "Resumo textual para o aluno, destacando melhorias e elogios.",
            },
        },
        required: ["overall", "criteria", "feedback"],
    },
} as const;

export type EvaluationResponseJsonSchema = typeof evaluationResponseJsonSchema;
