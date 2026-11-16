import { createHash } from "node:crypto";

import type { ExperimentRunnerConfig } from "./config";
import type { ValidatedReferenceInput } from "./reference-inputs";
import type { EvaluationInput, StrategyId } from "../strategies";

export type ExecutionMatrixItem = {
    id: string;
    experimentId: string;
    strategy: StrategyId;
    model: string;
    promptVersion: string;
    questionSlug: string;
    referenceAnswerId: string;
    input: ValidatedReferenceInput;
};

export function buildExecutionMatrix(
    config: ExperimentRunnerConfig,
    inputs: ValidatedReferenceInput[]
): ExecutionMatrixItem[] {
    const sortedInputs = [...inputs].sort((left, right) =>
        `${left.referenceAnswer.questionSlug}:${left.referenceAnswer.id}`.localeCompare(
            `${right.referenceAnswer.questionSlug}:${right.referenceAnswer.id}`
        )
    );

    return sortedInputs.flatMap((input) =>
        config.enabledStrategies.map((strategy) => {
            const questionSlug = input.referenceAnswer.questionSlug;
            const referenceAnswerId = input.referenceAnswer.id;
            return {
                id: createRunId({
                    experimentId: config.experimentId,
                    strategy,
                    questionSlug,
                    referenceAnswerId,
                    model: config.model,
                    promptVersion: config.promptVersion,
                }),
                experimentId: config.experimentId,
                strategy,
                model: config.model,
                promptVersion: config.promptVersion,
                questionSlug,
                referenceAnswerId,
                input,
            };
        })
    );
}

export function matrixItemToEvaluationInput(item: ExecutionMatrixItem): EvaluationInput {
    return {
        question: item.input.question,
        answer: item.input.candidateAnswer,
        model: item.model,
        promptVersion: item.promptVersion,
    };
}

function createRunId({
    experimentId,
    strategy,
    questionSlug,
    referenceAnswerId,
    model,
    promptVersion,
}: {
    experimentId: string;
    strategy: StrategyId;
    questionSlug: string;
    referenceAnswerId: string;
    model: string;
    promptVersion: string;
}): string {
    const stableKey = JSON.stringify({
        experimentId,
        strategy,
        questionSlug,
        referenceAnswerId,
        model,
        promptVersion,
    });
    const hash = createHash("sha1").update(stableKey).digest("hex").slice(0, 10);
    return [strategy, questionSlug, referenceAnswerId, hash].map(sanitizeForId).join("__");
}

function sanitizeForId(value: string): string {
    const sanitized = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return sanitized || "item";
}
