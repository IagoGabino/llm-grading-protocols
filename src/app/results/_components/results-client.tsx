"use client";

import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EvaluationRadarChart } from "../_components/evaluation-radar";
import {
    useEvaluationFromStorage,
    clearEvaluationFromStorage,
} from "../_hooks/use-evaluation-storage";
import type { EvaluateResponse } from "@/lib/requestModule/types";
import { MarkdownInline } from "@/components/shared/MarkdownInline";

type NormalizedEvaluation = {
    overall: number;
    criteria: Array<{
        id: string;
        label: string;
        score: number;
        weight: number;
        evidence: string;
        comment: string;
    }>;
    feedback: string;
};

type RubricCriterion = {
    id: string;
    name: string;
};

type ResultsClientProps = {
    questionSlug: string;
    questionLink: string;
    normalizedMockEvaluation: NormalizedEvaluation;
    rubricCriteria?: RubricCriterion[];
};

function clampScore(score: number) {
    if (Number.isNaN(score)) return 0;
    return Math.min(5, Math.max(0, score));
}

function getScoreTone(score: number) {
    const normalized = clampScore(score);
    if (normalized >= 4.5) return { text: "text-success", badge: "bg-success/10 text-success" };
    if (normalized >= 3.5) return { text: "text-warning", badge: "bg-warning/10 text-warning" };
    return { text: "text-destructive", badge: "bg-destructive/10 text-destructive" };
}

function normalizeRealEvaluation(
    realEval: EvaluateResponse,
    rubricCriteria?: RubricCriterion[]
): NormalizedEvaluation {
    return {
        overall: realEval.overall,
        criteria: realEval.criteria.map((c) => {
            // Buscar o nome do critério na rubrica
            const rubricItem = rubricCriteria?.find((r) => r.id === c.id);
            const label = rubricItem?.name || c.id; // Fallback para id se não encontrar

            return {
                id: c.id,
                label,
                score: c.score,
                weight: c.weight,
                evidence: c.evidence[0] || "Sem evidências",
                comment: c.comment,
            };
        }),
        feedback: realEval.feedback,
    };
}

export function ResultsClient({
    questionSlug,
    questionLink,
    normalizedMockEvaluation,
    rubricCriteria,
}: ResultsClientProps) {
    // Tentar ler do sessionStorage
    const storedEvaluation = useEvaluationFromStorage(questionSlug);

    // Usar avaliação real se disponível, senão fallback para mock
    const evaluation = storedEvaluation
        ? normalizeRealEvaluation(storedEvaluation, rubricCriteria)
        : normalizedMockEvaluation;

    const normalizedOverall = clampScore(evaluation.overall);
    const overallTone = getScoreTone(normalizedOverall);
    const overallPercentage = Math.round((normalizedOverall / 5) * 100);

    const radarData = evaluation.criteria.map((criterion) => ({
        subject: criterion.label,
        score: clampScore(criterion.score),
        fullMark: 5,
    }));

    const handleTryAgain = () => {
        clearEvaluationFromStorage(questionSlug);
    };

    return (
        <>
            <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                    <h1 className="text-3xl font-bold tracking-tight">Resultados da avaliação</h1>
                    {storedEvaluation && (
                        <Badge variant="outline" className="bg-success/10 text-success">
                            Avaliação Real
                        </Badge>
                    )}
                    {!storedEvaluation && (
                        <Badge variant="outline" className="bg-muted">
                            Modo Demo
                        </Badge>
                    )}
                </div>
                <div className="flex gap-3">
                    <Button asChild variant="outline">
                        <Link href={questionLink} aria-label="Voltar para editar a questão">
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            <span>Voltar para editar</span>
                        </Link>
                    </Button>
                    <Button asChild onClick={handleTryAgain}>
                        <Link href={questionLink} aria-label="Tentar resolver a questão novamente">
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            <span>Tentar novamente</span>
                        </Link>
                    </Button>
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="flex items-start justify-between gap-6">
                            <div>
                                <CardTitle>Resumo da avaliação</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Análise automática com base nos critérios cadastrados para a
                                    questão.
                                </p>
                            </div>
                            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-center">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                    Nota geral
                                </p>
                                <p className={`text-4xl font-bold ${overallTone.text}`}>
                                    {normalizedOverall.toFixed(1)}
                                </p>
                                <p className="text-xs text-muted-foreground">de 5.0</p>
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-6 lg:grid-cols-2">
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                        Progresso na escala
                                    </p>
                                    <Progress value={overallPercentage} className="h-2" />
                                    <p className="text-xs text-muted-foreground">
                                        {overallPercentage}% da nota máxima
                                    </p>
                                </div>
                            </div>
                            <div className="h-56">
                                <EvaluationRadarChart data={radarData} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Avaliação por critério</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {evaluation.criteria.map((criterion) => {
                                const tone = getScoreTone(criterion.score);
                                const percentage = Math.round(
                                    (clampScore(criterion.score) / 5) * 100
                                );

                                return (
                                    <div key={criterion.id} className="space-y-2">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <Badge className={tone.badge}>
                                                    {clampScore(criterion.score).toFixed(1)}
                                                </Badge>
                                                <span className="font-medium">
                                                    {criterion.label}
                                                </span>
                                            </div>
                                            <span className="text-sm text-muted-foreground">
                                                Peso {(criterion.weight * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                        <Progress value={percentage} className="h-2" />
                                        {criterion.evidence ? (
                                            <p className="text-xs text-muted-foreground">
                                                <span className="font-medium text-foreground">
                                                    Evidência:{" "}
                                                </span>
                                                <MarkdownInline>
                                                    {criterion.evidence}
                                                </MarkdownInline>
                                            </p>
                                        ) : null}
                                        <p className="text-sm leading-relaxed text-muted-foreground/90">
                                            <MarkdownInline>{criterion.comment}</MarkdownInline>
                                        </p>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Feedback geral</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="leading-7 text-muted-foreground">
                                <MarkdownInline>{evaluation.feedback}</MarkdownInline>
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <aside className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sobre esta avaliação</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            {storedEvaluation ? (
                                <div className="rounded-lg border-l-4 border-success bg-success/5 p-3">
                                    <p className="font-medium text-success">
                                        ✓ Avaliação real concluída
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Esta avaliação foi processada pela LLM com base na sua
                                        resposta.
                                    </p>
                                </div>
                            ) : (
                                <div className="rounded-lg border-l-4 border-muted bg-muted/30 p-3">
                                    <p className="font-medium">Modo demonstração</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Ative a avaliação real desmarcando &quot;Modo demo&quot;
                                        antes de enviar.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </aside>
            </div>
        </>
    );
}
