import { NextResponse } from "next/server";

import {
    EvaluationPromptBuildError,
    EvaluationProviderSetupError,
    runSingleEvaluation,
    type EvaluationEngineFailureResult,
    type EvaluationEngineSuccessResult,
} from "@/server/evaluation/engine";
import { buildEvaluateSuccessResponseBody } from "@/server/evaluation/api-response";
import { evaluationRequestSchema, type EvaluationRequestInput } from "@/server/evaluation/schemas";
import { createContextLogger } from "@/server/observability/logger";
import { auth } from "@/server/auth";
import {
    createAttempt,
    updateAttempt,
    type CreateAttemptInput,
} from "@/server/repositories/attempt-repo";

const logger = createContextLogger("api/evaluate");

export async function POST(request: Request) {
    // Check authentication
    const session = await auth();
    const userId = session?.user?.id;
    const isAuthenticated = !!userId;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Corpo inválido ou ausente" }, { status: 400 });
    }

    const parsedInput = evaluationRequestSchema.safeParse(body);
    if (!parsedInput.success) {
        const errors = parsedInput.error.flatten();
        return NextResponse.json(
            {
                error: "Validação falhou",
                fieldErrors: errors.fieldErrors,
                formErrors: errors.formErrors,
            },
            { status: 400 }
        );
    }

    const input = parsedInput.data;
    const useMock = isTruthy(process.env.USE_MOCK);
    const timeoutMs = parseInteger(process.env.LLM_TIMEOUT_MS, 25_000);
    const retryLimit = parseInteger(process.env.LLM_RETRY_ON_INVALID_JSON, 1);

    logger.info(
        {
            userId: userId ?? "anonymous",
            slug: input.slug,
            isAuthenticated,
            useMock,
        },
        "Starting evaluation"
    );

    let attemptId: string | undefined;

    try {
        const result = await runSingleEvaluation(input, {
            useMock,
            timeoutMs,
            retryLimit,
            onReady: async () => {
                attemptId = await createUserAttemptIfAuthenticated({
                    input,
                    userId,
                    isAuthenticated,
                });
            },
        });

        if (result.status === "success") {
            await persistSuccessIfNeeded({
                attemptId,
                result,
                input,
                userId,
                useMock,
            });

            return NextResponse.json(
                buildEvaluateSuccessResponseBody({ result, attemptId, useMock })
            );
        }

        await persistFailureIfNeeded({ attemptId, result, useMock });
        logEngineFailure({ result, input, userId, attemptId, useMock });

        if (useMock) {
            return NextResponse.json(
                {
                    error: "Falha ao gerar resposta mock",
                    detail: result.errorMessage,
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                error: "Falha ao processar a avaliação",
                detail: result.errorMessage,
            },
            { status: result.status === "timeout" ? 504 : 500 }
        );
    } catch (error) {
        if (error instanceof EvaluationPromptBuildError) {
            logger.error(
                {
                    error: JSON.stringify(error),
                    slug: input.slug,
                    userId: userId ?? "anonymous",
                    stack: error.stack,
                },
                "Failed to build evaluation prompt"
            );

            return NextResponse.json(
                {
                    error: "Não foi possível montar o prompt",
                    detail: error.message,
                },
                { status: 400 }
            );
        }

        if (error instanceof EvaluationProviderSetupError) {
            return NextResponse.json(
                {
                    error: "Provider LLM indisponível",
                    detail: error.message,
                },
                { status: 500 }
            );
        }

        const message = error instanceof Error ? error.message : "Erro desconhecido";
        logger.error(
            {
                error,
                message,
                slug: input.slug,
                userId: userId ?? "anonymous",
                attemptId,
            },
            "Erro inesperado durante a avaliação"
        );
        return NextResponse.json(
            {
                error: "Falha ao processar a avaliação",
                detail: message,
            },
            { status: 500 }
        );
    }
}

async function createUserAttemptIfAuthenticated({
    input,
    userId,
    isAuthenticated,
}: {
    input: EvaluationRequestInput;
    userId: string | undefined;
    isAuthenticated: boolean;
}): Promise<string | undefined> {
    if (!isAuthenticated || !userId) return undefined;

    try {
        const attemptInput: CreateAttemptInput = {
            userId,
            slug: input.slug,
            resposta: input.resposta,
            raciocinio: input.raciocinio || undefined,
            codigo: input.codigo,
            language: input.language,
        };

        const attempt = await createAttempt(attemptInput);

        logger.info(
            { userId, slug: input.slug, attemptId: attempt.id },
            "Attempt created, starting LLM evaluation"
        );

        return attempt.id;
    } catch (error) {
        logger.error(
            { userId, slug: input.slug, error },
            "Failed to create attempt, continuing without persistence"
        );
        return undefined;
    }
}

async function persistSuccessIfNeeded({
    attemptId,
    result,
    input,
    userId,
    useMock,
}: {
    attemptId: string | undefined;
    result: EvaluationEngineSuccessResult;
    input: EvaluationRequestInput;
    userId: string | undefined;
    useMock: boolean;
}) {
    if (!attemptId) return;

    try {
        await updateAttempt(attemptId, {
            evaluation: result.evaluation,
            raw: buildSuccessRaw(result, useMock),
            status: "completed",
            completedAt: new Date(),
        });

        if (useMock) {
            logger.info({ attemptId, mode: "mock" }, "Attempt completed successfully");
            return;
        }

        logger.info(
            {
                attemptId,
                userId,
                slug: input.slug,
                timingMs: result.latencyMs,
                llmAttempts: result.callCount,
            },
            "Evaluation completed and persisted successfully"
        );
    } catch (error) {
        logger.error(
            { attemptId, error },
            useMock
                ? "Failed to update attempt in mock mode"
                : "Failed to update attempt, but evaluation succeeded"
        );
    }
}

async function persistFailureIfNeeded({
    attemptId,
    result,
    useMock,
}: {
    attemptId: string | undefined;
    result: EvaluationEngineFailureResult;
    useMock: boolean;
}) {
    if (!attemptId) return;

    try {
        await updateAttempt(attemptId, {
            status: "failed",
            raw: useMock
                ? { error: result.errorMessage }
                : {
                      error: result.errorMessage,
                      isTimeout: result.status === "timeout",
                      timestamp: new Date().toISOString(),
                  },
        });

        if (!useMock) {
            logger.info(
                { attemptId, isTimeout: result.status === "timeout" },
                "Attempt marked as failed"
            );
        }
    } catch (updateError) {
        logger.error(
            { attemptId, updateError },
            useMock
                ? "Failed to mark attempt as failed"
                : "Failed to mark attempt as failed in database"
        );
    }
}

function buildSuccessRaw(result: EvaluationEngineSuccessResult, useMock: boolean): object {
    if (useMock) {
        return { output: result.rawOutput, model: result.model };
    }

    return {
        output: result.rawOutput,
        model: result.model,
        attempts: result.callCount,
        timingMs: result.latencyMs,
    };
}

function logEngineFailure({
    result,
    input,
    userId,
    attemptId,
    useMock,
}: {
    result: EvaluationEngineFailureResult;
    input: EvaluationRequestInput;
    userId: string | undefined;
    attemptId: string | undefined;
    useMock: boolean;
}) {
    if (useMock) {
        logger.error({ error: result.errorMessage, mode: "mock" }, "Erro no modo mock");
        return;
    }

    logger.error(
        {
            error: result.errorMessage,
            message: result.errorMessage,
            isTimeout: result.status === "timeout",
            status: result.status,
            slug: input.slug,
            userId: userId ?? "anonymous",
            attemptId,
        },
        "Erro durante a avaliação"
    );
}

function parseInteger(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

function isTruthy(value: string | undefined): boolean {
    if (!value) return false;
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}
