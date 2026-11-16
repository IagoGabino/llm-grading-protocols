import assert from "node:assert/strict";
import path from "node:path";

import { getQuestionBySlug } from "../src/lib/question-loader";
import type { LLMProvider } from "../src/server/llm/types";
import { loadReferenceAnswers } from "../src/server/experiment/reference-answers";
import {
    runReviewStrategy,
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

    let invokeCount = 0;
    const provider: LLMProvider = {
        name: "verification-review-mock",
        async invoke() {
            invokeCount += 1;
            const scoreOffset = invokeCount === 1 ? -0.4 : 0;
            return {
                model: "verification/review-mock",
                output: JSON.stringify({
                    overall: invokeCount === 1 ? 4.4 : 4.8,
                    criteria: referenceAnswer.expectedCriteria.map((criterion) => ({
                        id: criterion.criterionId,
                        score: Math.max(0, criterion.expectedScore + scoreOffset),
                        weight: 1 / referenceAnswer.expectedCriteria.length,
                        evidence: [
                            invokeCount === 1
                                ? `Avaliação inicial: ${criterion.rationale}`
                                : `Revisão alinhada à rubrica: ${criterion.rationale}`,
                        ],
                        comment:
                            invokeCount === 1
                                ? "Comentário inicial."
                                : "Comentário revisado contra a rubrica.",
                    })),
                    feedback:
                        invokeCount === 1
                            ? "Avaliação inicial mockada."
                            : "Avaliação revisada mockada.",
                }),
            };
        },
    };

    const input: EvaluationInput = {
        question,
        answer: referenceAnswer,
        model: "verification/review-mock",
        promptVersion: "verify-review-v1",
    };

    const result = await runReviewStrategy(input, {
        provider,
        useMock: false,
        retryLimit: 0,
        timeoutMs: 5_000,
    });

    const parsedResult = strategyResultSchema.parse(result);

    assert.equal(parsedResult.strategy, "review");
    assert.equal(parsedResult.status, "success");
    assert.equal(parsedResult.model, "verification/review-mock");
    assert.equal(parsedResult.promptVersion, "verify-review-v1");
    assert.equal(parsedResult.questionSlug, sourceAnswer.questionSlug);
    assert.equal(parsedResult.referenceAnswerId, sourceAnswer.id);
    assert.equal(parsedResult.callCount, 2);
    assert.equal(parsedResult.rawOutputs.length, 2);

    assert.equal(parsedResult.parsedOutput.criteria[0].criterionId, "problems");
    assert.equal(invokeCount, 2);

    console.log("review strategy verification passed");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
