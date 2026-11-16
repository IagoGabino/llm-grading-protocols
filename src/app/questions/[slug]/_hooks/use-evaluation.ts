import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { evaluateAnswer, EvaluationError } from "@/lib/requestModule/evaluate";
import type { EvaluateRequest } from "@/lib/requestModule/types";
import type { SupportedLanguage } from "@/lib/question-meta";
import { logger } from "@/server/observability/logger";
import { useAuth } from "@/contexts/auth-context";

type UseEvaluationProps = {
    questionId: string;
    questionSlug?: string;
    isCodeTask: boolean;
};

type EvaluateOptions = {
    currentCode: string;
    formValues: Record<string, string>;
    justification: string;
    selectedLanguage: SupportedLanguage;
    demoMode: boolean;
};

/**
 * Hook para gerenciar o processo de avaliação de respostas
 */
export function useEvaluation({ questionId, questionSlug, isCodeTask }: UseEvaluationProps) {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const [isEvaluating, setIsEvaluating] = useState(false);

    const handleEvaluate = useCallback(
        async (options: EvaluateOptions) => {
            const { currentCode, formValues, justification, selectedLanguage, demoMode } = options;

            // Modo demo: simular avaliação
            if (demoMode) {
                setIsEvaluating(true);
                try {
                    await new Promise((resolve) => setTimeout(resolve, 1200));
                    const targetSlug = questionSlug ?? questionId;

                    // Limpar avaliação real anterior do sessionStorage
                    sessionStorage.removeItem(`evaluation-${targetSlug}`);

                    const params = new URLSearchParams();
                    if (targetSlug) params.set("slug", targetSlug);
                    if (selectedLanguage) params.set("language", selectedLanguage);
                    params.set("attempt", "0");
                    router.push(`/results?${params.toString()}`);
                } finally {
                    setIsEvaluating(false);
                }
                return;
            }

            // Validação: código não pode estar vazio
            if (isCodeTask && !currentCode.trim()) {
                toast.error("Escreva sua solução antes de avaliar");
                return;
            }

            setIsEvaluating(true);

            try {
                const targetSlug = questionSlug ?? questionId;

                // Preparar payload
                const payload: EvaluateRequest = {
                    slug: targetSlug,
                    // Para questões de código: codigo preenchido, resposta vazia
                    // Para questões de arquitetura: resposta preenchida (JSON), codigo vazio
                    resposta: isCodeTask ? "" : JSON.stringify(formValues),
                    raciocinio: justification.trim() || undefined,
                    codigo: isCodeTask ? currentCode.trim() : undefined,
                    language: selectedLanguage,
                };

                // Chamar API real
                const result = await evaluateAnswer(payload);

                // Salvar resultado no sessionStorage (com attemptId se autenticado)
                sessionStorage.setItem(
                    `evaluation-${targetSlug}`,
                    JSON.stringify({
                        result,
                        attemptId: result.attemptId, // Pode ser undefined se anônimo
                        timestamp: Date.now(),
                        language: selectedLanguage,
                    })
                );

                // Log de sucesso com contexto
                if (isAuthenticated && result.attemptId) {
                    logger.info(
                        {
                            context: "useEvaluation",
                            attemptId: result.attemptId,
                            slug: targetSlug,
                        },
                        "Evaluation saved with attemptId"
                    );
                }

                // Navegar para página de resultados
                const params = new URLSearchParams();
                params.set("slug", targetSlug);
                if (selectedLanguage) params.set("language", selectedLanguage);
                params.set("attempt", "1");

                router.push(`/results?${params.toString()}`);
            } catch (error) {
                if (error instanceof EvaluationError) {
                    toast.error(error.message);
                    logger.error(
                        {
                            context: "useEvaluation",
                            error: error.message,
                            detail: error.detail,
                            fieldErrors: error.fieldErrors,
                            slug: questionSlug ?? questionId,
                        },
                        "Evaluation failed"
                    );
                } else {
                    toast.error("Erro inesperado na avaliação. Tente novamente.");
                    logger.error(
                        {
                            context: "useEvaluation",
                            error: error instanceof Error ? error.message : String(error),
                            slug: questionSlug ?? questionId,
                        },
                        "Unexpected error during evaluation"
                    );
                }
            } finally {
                setIsEvaluating(false);
            }
        },
        [questionId, questionSlug, router, isCodeTask, isAuthenticated]
    );

    return {
        isEvaluating,
        handleEvaluate,
    };
}
