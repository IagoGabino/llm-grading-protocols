import type { EvaluationEngineSuccessResult } from "./engine";

export type EvaluateSuccessResponseBody = EvaluationEngineSuccessResult["evaluation"] & {
    model: string;
    timingMs: number;
    attemptId?: string;
};

export function buildEvaluateSuccessResponseBody({
    result,
    attemptId,
    useMock,
}: {
    result: EvaluationEngineSuccessResult;
    attemptId?: string;
    useMock: boolean;
}): EvaluateSuccessResponseBody {
    return {
        ...result.evaluation,
        model: result.model,
        timingMs: useMock ? 0 : result.latencyMs,
        ...(attemptId && { attemptId }),
    };
}
