import assert from "node:assert/strict";

import {
    appEvaluationResponseToEvaluationOutput,
    evaluationOutputSchema,
    strategyIdSchema,
    strategyResultSchema,
    type EvaluationOutput,
} from "../src/server/experiment/strategies";

const acceptedIds = ["single", "review", "multi_aggregate"];
for (const id of acceptedIds) {
    assert.equal(strategyIdSchema.safeParse(id).success, true);
}

assert.equal(strategyIdSchema.safeParse("majority_vote").success, false);

const canonicalOutput: EvaluationOutput = {
    overall: 4.5,
    criteria: [
        {
            criterionId: "correctness",
            score: 4,
            weight: 0.7,
            evidence: "Cobre os casos principais.",
            comment: "Boa cobertura com pequenas lacunas.",
        },
        {
            criterionId: "clarity",
            score: 5,
            weight: 0.3,
            evidence: "",
            comment: "",
        },
    ],
    feedback: "Resposta consistente.",
};

assert.equal(evaluationOutputSchema.safeParse(canonicalOutput).success, true);
assert.equal(
    evaluationOutputSchema.safeParse({
        ...canonicalOutput,
        criteria: [{ ...canonicalOutput.criteria[0], score: 7 }],
    }).success,
    false
);

const mappedOutput = appEvaluationResponseToEvaluationOutput({
    overall: 4,
    criteria: [
        {
            id: "correctness",
            score: 4,
            weight: 0.8,
            evidence: ["Usa casos validos.", "Inclui caso invalido."],
            comment: "Atende a rubrica.",
        },
        {
            id: "communication",
            score: 3,
            evidence: [],
            comment: "",
        },
    ],
    feedback: "Bom resultado.",
});

assert.deepEqual(mappedOutput, {
    overall: 4,
    criteria: [
        {
            criterionId: "correctness",
            score: 4,
            weight: 0.8,
            evidence: "Usa casos validos.\nInclui caso invalido.",
            comment: "Atende a rubrica.",
        },
        {
            criterionId: "communication",
            score: 3,
            evidence: "",
            comment: "",
        },
    ],
    feedback: "Bom resultado.",
});

const now = new Date().toISOString();
const result = strategyResultSchema.parse({
    strategy: "single",
    status: "success",
    model: "mock/model",
    promptVersion: "v1",
    questionSlug: "easy-cpf-validation-tests",
    referenceAnswerId: "ref-1",
    startedAt: now,
    finishedAt: now,
    latencyMs: 12,
    callCount: 1,
    rawOutputs: [{ output: "{}", model: "mock/model", callIndex: 1 }],
    parsedOutput: canonicalOutput,
    strategyMetadata: { note: "diagnostic only", subcalls: [{ status: "ok" }] },
});

assert.equal(result.status, "success");

const failedResult = strategyResultSchema.parse({
    strategy: "review",
    status: "parse_error",
    model: "mock/model",
    promptVersion: "v1",
    questionSlug: "easy-cpf-validation-tests",
    startedAt: now,
    finishedAt: now,
    latencyMs: 20,
    callCount: 2,
    rawOutputs: [{ output: "not-json" }],
    errorMessage: "Invalid JSON",
});

assert.equal(failedResult.status, "parse_error");

console.log("evaluation strategy contract verification passed");
