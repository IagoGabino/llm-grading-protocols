import type { EvaluationResponse } from "@/server/evaluation/schemas";

import type { EvaluationOutput } from "./contracts";

export function appEvaluationResponseToEvaluationOutput(
    evaluation: EvaluationResponse
): EvaluationOutput {
    return {
        overall: evaluation.overall,
        criteria: evaluation.criteria.map((criterion) => ({
            criterionId: criterion.id,
            score: criterion.score,
            ...(criterion.weight !== undefined && { weight: criterion.weight }),
            evidence: formatEvidence(criterion.evidence),
            comment: criterion.comment,
        })),
        feedback: evaluation.feedback,
    };
}

function formatEvidence(evidence: string[] | undefined): string {
    if (!evidence?.length) return "";
    return evidence.join("\n");
}
