import assert from "node:assert/strict";
import path from "node:path";

import { getQuestionBySlug } from "../src/lib/question-loader";
import type { LLMProvider } from "../src/server/llm/types";
import { loadReferenceAnswers } from "../src/server/experiment/reference-answers";
import {
    DEFAULT_MULTI_AGGREGATE_PROMPT_VARIANTS,
    runMultiAggregateStrategy,
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
    const seenVariantPrompts: string[] = [];
    const provider: LLMProvider = {
        name: "verification-multi-aggregate-mock",
        async invoke(messages) {
            invokeCount += 1;
            seenVariantPrompts.push(messages.map((message) => message.content).join("\n"));
            const scoreOffset = [-0.2, 0, 0.2][invokeCount - 1] ?? 0;
            return {
                model: "verification/multi-aggregate-mock",
                output: JSON.stringify({
                    overall: 4.8 + scoreOffset,
                    criteria: referenceAnswer.expectedCriteria.map((criterion) => ({
                        id: criterion.criterionId,
                        score: Math.max(0, Math.min(5, criterion.expectedScore + scoreOffset)),
                        weight: 1 / referenceAnswer.expectedCriteria.length,
                        evidence: [`Chamada ${invokeCount}: ${criterion.rationale}`],
                        comment: `Comentário da chamada ${invokeCount}.`,
                    })),
                    feedback: `Feedback da chamada ${invokeCount}.`,
                }),
            };
        },
    };

    const input: EvaluationInput = {
        question,
        answer: referenceAnswer,
        model: "verification/multi-aggregate-mock",
        promptVersion: "verify-multi-aggregate-v1",
    };

    const result = await runMultiAggregateStrategy(input, {
        provider,
        useMock: false,
        retryLimit: 0,
        timeoutMs: 5_000,
    });

    const parsedResult = strategyResultSchema.parse(result);

    assert.equal(parsedResult.strategy, "multi_aggregate");
    assert.equal(parsedResult.status, "success");
    assert.equal(parsedResult.model, "verification/multi-aggregate-mock");
    assert.equal(parsedResult.promptVersion, "verify-multi-aggregate-v1");
    assert.equal(parsedResult.questionSlug, sourceAnswer.questionSlug);
    assert.equal(parsedResult.referenceAnswerId, sourceAnswer.id);
    assert.equal(parsedResult.callCount, 3);
    assert.equal(parsedResult.rawOutputs.length, 3);

    assert.equal(parsedResult.strategyMetadata?.aggregationMethod, "mean_by_criterion");
    assert.equal(parsedResult.strategyMetadata?.subcallCount, 3);
    assert.equal(parsedResult.strategyMetadata?.validSubcallCount, 3);
    assert.equal(seenVariantPrompts.length, 3);

    for (const variant of DEFAULT_MULTI_AGGREGATE_PROMPT_VARIANTS) {
        assert.ok(
            seenVariantPrompts.some((prompt) => prompt.includes(variant.instruction)),
            `missing prompt variant instruction: ${variant.id}`
        );
    }

    const criterionScoreStdDev = parsedResult.strategyMetadata?.criterionScoreStdDev;
    assert.equal(typeof criterionScoreStdDev, "object");
    assert.ok(
        criterionScoreStdDev !== null &&
            !Array.isArray(criterionScoreStdDev) &&
            typeof criterionScoreStdDev === "object" &&
            "problems" in criterionScoreStdDev
    );

    assert.equal(parsedResult.parsedOutput.criteria[0].criterionId, "problems");
    assert.equal(invokeCount, 3);

    const promptVariantIds = parsedResult.rawOutputs.map(
        (rawOutput) => rawOutput.metadata?.promptVariantId
    );
    assert.deepEqual(
        promptVariantIds,
        DEFAULT_MULTI_AGGREGATE_PROMPT_VARIANTS.map((variant) => variant.id)
    );

    await verifyCriterionMismatch(input, referenceAnswer);

    console.log("multi aggregate strategy verification passed");
}

async function verifyCriterionMismatch(input: EvaluationInput, referenceAnswer: ReferenceAnswer) {
    let invokeCount = 0;
    const provider: LLMProvider = {
        name: "verification-multi-aggregate-mismatch",
        async invoke() {
            invokeCount += 1;
            return {
                model: "verification/multi-aggregate-mock",
                output: JSON.stringify({
                    overall: 4.5,
                    criteria: referenceAnswer.expectedCriteria.map((criterion, index) => ({
                        id:
                            invokeCount === 3 && index === 0
                                ? `${criterion.criterionId}_mismatch`
                                : criterion.criterionId,
                        score: criterion.expectedScore,
                        weight: 1 / referenceAnswer.expectedCriteria.length,
                        evidence: [`Chamada ${invokeCount}: ${criterion.rationale}`],
                        comment: `Comentário da chamada ${invokeCount}.`,
                    })),
                    feedback: `Feedback da chamada ${invokeCount}.`,
                }),
            };
        },
    };

    const result = await runMultiAggregateStrategy(input, {
        provider,
        useMock: false,
        retryLimit: 0,
        timeoutMs: 5_000,
    });

    const parsedResult = strategyResultSchema.parse(result);
    assert.equal(parsedResult.strategy, "multi_aggregate");
    assert.equal(parsedResult.status, "schema_error");
    assert.equal(parsedResult.callCount, 3);
    assert.equal(parsedResult.rawOutputs.length, 3);
    assert.equal(parsedResult.strategyMetadata?.validSubcallCount, 3);
    assert.ok(parsedResult.errorMessage.includes("criterion ids"));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
