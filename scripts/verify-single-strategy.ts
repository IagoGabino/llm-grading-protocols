import assert from "node:assert/strict";
import path from "node:path";

import { getQuestionBySlug } from "../src/lib/question-loader";
import type { LLMProvider } from "../src/server/llm/types";
import { loadReferenceAnswers } from "../src/server/experiment/reference-answers";
import {
    runSingleStrategy,
    strategyResultSchema,
    type EvaluationInput,
    type ReferenceAnswer,
} from "../src/server/experiment/strategies";

async function main() {
    const examplesDir = path.join(process.cwd(), "experiments", "reference-answers", "examples");
    const loaded = await loadReferenceAnswers(examplesDir);
    assert.deepEqual(loaded.errors, []);
    assert.ok(loaded.answers.length > 0);

    const sourceAnswer = loaded.answers[0];
    const question = await getQuestionBySlug(sourceAnswer.questionSlug);
    assert.ok(question, `question not found: ${sourceAnswer.questionSlug}`);

    const referenceAnswer: ReferenceAnswer = {
        kind: "reference",
        ...sourceAnswer,
    };

    const provider: LLMProvider = {
        name: "verification-single-mock",
        async invoke(messages) {
            assert.equal(
                messages.some((message) => message.content.includes("MODO DE AVALIACAO")),
                false
            );
            return {
                model: "verification/single-mock",
                output: JSON.stringify({
                    overall: 4.8,
                    criteria: referenceAnswer.expectedCriteria.map((criterion) => ({
                        id: criterion.criterionId,
                        score: criterion.expectedScore,
                        weight: 1 / referenceAnswer.expectedCriteria.length,
                        evidence: [criterion.rationale],
                        comment: criterion.rationale,
                    })),
                    feedback: "Resultado mockado para verificacao da estrategia single.",
                }),
            };
        },
    };

    const input: EvaluationInput = {
        question,
        answer: referenceAnswer,
        model: "verification/single-mock",
        promptVersion: "verify-single-v1",
    };

    const result = await runSingleStrategy(input, {
        provider,
        useMock: false,
        retryLimit: 0,
        timeoutMs: 5_000,
    });

    const parsedResult = strategyResultSchema.parse(result);

    assert.equal(parsedResult.strategy, "single");
    assert.equal(parsedResult.status, "success");
    assert.equal(parsedResult.model, "verification/single-mock");
    assert.equal(parsedResult.promptVersion, "verify-single-v1");
    assert.equal(parsedResult.questionSlug, sourceAnswer.questionSlug);
    assert.equal(parsedResult.referenceAnswerId, sourceAnswer.id);
    assert.equal(parsedResult.callCount, 1);
    assert.equal(parsedResult.rawOutputs.length, 1);

    assert.equal(parsedResult.parsedOutput.criteria[0].criterionId, "problems");

    await verifyFailureStatus(input, "parse_error", {
        name: "verification-parse-error",
        async invoke() {
            return {
                model: "verification/single-mock",
                output: "not-json",
            };
        },
    });

    await verifyFailureStatus(input, "schema_error", {
        name: "verification-schema-error",
        async invoke() {
            return {
                model: "verification/single-mock",
                output: JSON.stringify({
                    overall: 3,
                    criteria: [],
                    feedback: "Invalid because criteria is empty.",
                }),
            };
        },
    });

    await verifyFailureStatus(input, "llm_error", {
        name: "verification-llm-error",
        async invoke() {
            throw new Error("provider failed");
        },
    });

    await verifyFailureStatus(input, "timeout", {
        name: "verification-timeout",
        async invoke() {
            throw new Error("Operacao abortada");
        },
    });

    console.log("single strategy verification passed");
}

async function verifyFailureStatus(
    input: EvaluationInput,
    expectedStatus: "parse_error" | "schema_error" | "llm_error" | "timeout",
    provider: LLMProvider
) {
    const result = await runSingleStrategy(input, {
        provider,
        useMock: false,
        retryLimit: 0,
        timeoutMs: 5_000,
    });

    const parsedResult = strategyResultSchema.parse(result);
    assert.equal(parsedResult.strategy, "single");
    assert.equal(parsedResult.status, expectedStatus);
    assert.equal(parsedResult.callCount, 1);

    assert.ok(parsedResult.errorMessage.length > 0);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
