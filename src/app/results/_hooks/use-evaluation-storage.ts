"use client";

import { useEffect, useState } from "react";
import type { EvaluateResponse } from "@/lib/requestModule/types";

type StoredEvaluation = {
    result: EvaluateResponse;
    timestamp: number;
    language?: string;
};

/**
 * Hook para ler avaliação do sessionStorage
 */
export function useEvaluationFromStorage(slug?: string): EvaluateResponse | null {
    const [evaluation, setEvaluation] = useState<EvaluateResponse | null>(null);

    useEffect(() => {
        if (!slug) return;

        const key = `evaluation-${slug}`;
        const stored = sessionStorage.getItem(key);

        if (!stored) {
            setEvaluation(null);
            return;
        }

        try {
            const parsed: StoredEvaluation = JSON.parse(stored);
            setEvaluation(parsed.result);
        } catch (error) {
            // Log estruturado do erro de parsing
            console.error("Failed to parse evaluation from sessionStorage:", {
                slug,
                error: error instanceof Error ? error.message : String(error),
                stored: stored.substring(0, 100), // Primeiros 100 chars para debug
            });
            setEvaluation(null);
        }
    }, [slug]);

    return evaluation;
}

/**
 * Limpa avaliação do sessionStorage
 */
export function clearEvaluationFromStorage(slug: string): void {
    const key = `evaluation-${slug}`;
    sessionStorage.removeItem(key);
}
