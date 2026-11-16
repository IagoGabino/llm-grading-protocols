"use client";

import { useMemo } from "react";
import Link from "next/link";
import { RotateCcw, Calendar, Code, FileText, Box, GitBranch, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Markdown from "@/components/shared/Markdown";
import { MarkdownInline } from "@/components/shared/MarkdownInline";
import { CodeEditor } from "@/components/shared/CodeEditor";
import { EvaluationRadarChart } from "@/app/results/_components/evaluation-radar";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import type { Attempt } from "@/generated/prisma";
import type { QuestionData } from "@/lib/question-loader";
import {
    getAxisBadgeClass,
    getAxisLabel,
    getDifficultyBadgeClass,
    getDifficultyLabel,
} from "@/lib/question-meta";

type AttemptWithUser = Attempt & {
    user: {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
    };
};

type AttemptDetailProps = {
    attempt: AttemptWithUser;
    question: QuestionData | null;
};

type EvaluationData = {
    overall: number;
    criteria: Array<{
        id: string;
        score: number;
        weight: number;
        evidence: string[];
        comment: string;
    }>;
    feedback: string;
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

function formatDate(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d);
}

function getStatusLabel(status: string): {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
} {
    switch (status) {
        case "completed":
            return { label: "Concluída", variant: "default" };
        case "in_progress":
            return { label: "Em Progresso", variant: "secondary" };
        case "failed":
            return { label: "Falhou", variant: "destructive" };
        default:
            return { label: status, variant: "outline" };
    }
}

export function AttemptDetail({ attempt, question }: AttemptDetailProps) {
    // Parse evaluation data
    const evaluation = useMemo(() => {
        if (!attempt.evaluation) return null;
        return attempt.evaluation as EvaluationData;
    }, [attempt.evaluation]);

    // Prepare radar chart data
    const radarData = useMemo(() => {
        if (!evaluation) return [];

        return evaluation.criteria.map((criterion) => {
            const rubricCriterion = question?.meta.rubric?.criteria.find(
                (r) => r.id === criterion.id
            );
            const label = rubricCriterion?.name || criterion.id;

            return {
                subject: label,
                score: clampScore(criterion.score),
                fullMark: 5,
            };
        });
    }, [evaluation, question]);

    // Calculate overall score metrics
    const normalizedOverall = evaluation ? clampScore(evaluation.overall) : 0;
    const overallTone = getScoreTone(normalizedOverall);
    const overallPercentage = Math.round((normalizedOverall / 5) * 100);

    const statusInfo = getStatusLabel(attempt.status);

    // Language display name
    const languageLabels: Record<string, string> = {
        javascript: "JavaScript",
        python: "Python",
        java: "Java",
    };

    return (
        <div className="container mx-auto max-w-7xl px-4 py-8">
            <Breadcrumb
                items={[
                    { label: "Minhas Tentativas", href: "/attempts" },
                    { label: question?.meta.title || "Tentativa de Resolução" },
                ]}
            />

            {/* Header */}
            <div className="mb-8">
                <div className="space-y-4 mb-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 break-words">
                                {question?.meta.title || "Tentativa de Resolução"}
                            </h1>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4 flex-shrink-0" />
                                    <span className="break-words">
                                        {formatDate(attempt.completedAt || attempt.createdAt)}
                                    </span>
                                </div>
                                {attempt.language && (
                                    <>
                                        <span className="hidden sm:inline">•</span>
                                        <span className="break-words">
                                            {languageLabels[attempt.language] || attempt.language}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <Button asChild className="w-full sm:w-auto flex-shrink-0">
                            <Link href={`/questions/${attempt.slug}?fromAttempt=${attempt.id}`}>
                                <RotateCcw className="h-4 w-4" />
                                <span className="sm:inline">Tentar novamente</span>
                            </Link>
                        </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {question?.meta.axis && (
                            <Badge className={getAxisBadgeClass(question.meta.axis)}>
                                {getAxisLabel(question.meta.axis)}
                            </Badge>
                        )}
                        {question?.meta.difficulty && (
                            <Badge className={getDifficultyBadgeClass(question.meta.difficulty)}>
                                {getDifficultyLabel(question.meta.difficulty)}
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

            {/* Score Card - Resumo da Avaliação */}
            {evaluation && (
                <Card className="mb-6">
                    <CardHeader className="flex items-start justify-between gap-6">
                        <div>
                            <CardTitle>Resumo da Avaliação</CardTitle>
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
            )}

            {/* Evaluation Results - Avaliação por Critério */}
            {evaluation && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Avaliação por Critério</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {evaluation.criteria.map((criterion, index) => {
                            const rubricCriterion = question?.meta.rubric?.criteria.find(
                                (r) => r.id === criterion.id
                            );
                            const label = rubricCriterion?.name || criterion.id;
                            const tone = getScoreTone(criterion.score);

                            return (
                                <div key={criterion.id}>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-medium">{label}</h4>
                                            <div className="flex items-center gap-2">
                                                <Badge className={tone.badge}>
                                                    {clampScore(criterion.score).toFixed(1)} pts
                                                </Badge>
                                                <div className="text-sm text-muted-foreground">
                                                    Peso: {(criterion.weight * 100).toFixed(0)}%
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            <MarkdownInline>{criterion.comment}</MarkdownInline>
                                        </p>
                                        {criterion.evidence.length > 0 && (
                                            <div className="mt-2 space-y-1">
                                                <p className="text-xs font-medium text-muted-foreground">
                                                    Evidências:
                                                </p>
                                                {criterion.evidence.map((evidence, idx) => (
                                                    <p
                                                        key={idx}
                                                        className="text-xs text-muted-foreground ml-2"
                                                    >
                                                        •{" "}
                                                        <MarkdownInline>{evidence}</MarkdownInline>
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {index < evaluation.criteria.length - 1 && (
                                        <div className="border-b my-4" />
                                    )}
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* General Feedback */}
            {evaluation?.feedback && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Feedback Geral</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                            <Markdown>{evaluation.feedback}</Markdown>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Justification */}
            {attempt.raciocinio && (
                <Card className="mb-6">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            <CardTitle>Justificativa</CardTitle>
                        </div>
                        <CardDescription>Raciocínio e decisões técnicas</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                            <Markdown>{attempt.raciocinio}</Markdown>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Code Implementation */}
            {attempt.codigo && (
                <Card className="mb-6">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Code className="h-5 w-5" />
                            <CardTitle>Código Implementado</CardTitle>
                        </div>
                        <CardDescription>Solução submetida para avaliação</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CodeEditor
                            language={attempt.language || "javascript"}
                            value={attempt.codigo}
                            onChange={() => {}}
                            height={400}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Response (if no code) */}
            {!attempt.codigo &&
                attempt.resposta &&
                (() => {
                    // Tentar parsear como JSON para questões multi-section
                    let parsedSections: Record<string, string> | null = null;
                    try {
                        parsedSections = JSON.parse(attempt.resposta);
                    } catch {
                        // Não é JSON, exibir como texto simples
                    }

                    // Se for multi-section (JSON parseado com sucesso)
                    if (parsedSections && typeof parsedSections === "object") {
                        // Buscar labels das seções da configuração da questão
                        const sectionLabelsFromQuestion = new Map<string, string>();
                        if (
                            question?.meta.inputConfig &&
                            typeof question.meta.inputConfig === "object" &&
                            "sections" in question.meta.inputConfig
                        ) {
                            const sections = (
                                question.meta.inputConfig as {
                                    sections?: Array<{ id: string; label: string }>;
                                }
                            ).sections;
                            if (Array.isArray(sections)) {
                                sections.forEach((section) => {
                                    sectionLabelsFromQuestion.set(section.id, section.label);
                                });
                            }
                        }

                        // Ícones padrão por tipo de seção
                        const defaultIcons: Record<string, React.ReactNode> = {
                            componentes: <Box className="h-4 w-4" />,
                            fluxo: <GitBranch className="h-4 w-4" />,
                            justificativa: <Scale className="h-4 w-4" />,
                        };

                        return (
                            <Card className="mb-6">
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        <CardTitle>Resposta Submetida</CardTitle>
                                    </div>
                                    <CardDescription>
                                        {question?.meta.inputConfig &&
                                        typeof question.meta.inputConfig === "object" &&
                                        "type" in question.meta.inputConfig &&
                                        question.meta.inputConfig.type === "multi-section"
                                            ? "Arquitetura proposta para avaliação"
                                            : "Solução enviada para avaliação"}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {Object.entries(parsedSections).map(([key, value], index) => {
                                        // Buscar label da questão ou usar fallback
                                        const label =
                                            sectionLabelsFromQuestion.get(key) ||
                                            key.charAt(0).toUpperCase() + key.slice(1);
                                        const icon = defaultIcons[key] || (
                                            <FileText className="h-4 w-4" />
                                        );

                                        return (
                                            <div key={key}>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="text-primary">{icon}</div>
                                                    <h4 className="font-semibold text-sm text-primary">
                                                        {label}
                                                    </h4>
                                                </div>
                                                <div className="prose prose-sm dark:prose-invert max-w-none pl-4 border-l-2 border-primary/20">
                                                    <Markdown>{value}</Markdown>
                                                </div>
                                                {index <
                                                    Object.entries(parsedSections!).length - 1 && (
                                                    <div className="border-b mt-4" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        );
                    }

                    // Fallback: resposta em texto simples
                    return (
                        <Card className="mb-6">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    <CardTitle>Resposta Submetida</CardTitle>
                                </div>
                                <CardDescription>Solução enviada para avaliação</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <Markdown>{attempt.resposta}</Markdown>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })()}

            {/* Attempt Information */}
            <Card>
                <CardHeader>
                    <CardTitle>Informações da Tentativa</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-muted-foreground mb-1">Status</p>
                            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        </div>
                        <div>
                            <p className="text-muted-foreground mb-1">Número da Tentativa</p>
                            <p className="font-medium">#{attempt.attemptNumber}</p>
                        </div>
                        {attempt.language && (
                            <div>
                                <p className="text-muted-foreground mb-1">Linguagem</p>
                                <p className="font-medium">
                                    {languageLabels[attempt.language] || attempt.language}
                                </p>
                            </div>
                        )}
                        {evaluation && (
                            <div>
                                <p className="text-muted-foreground mb-1">Nota Geral</p>
                                <p className={`text-xl font-bold ${overallTone.text}`}>
                                    {normalizedOverall.toFixed(1)}
                                    <span className="text-sm text-muted-foreground font-normal">
                                        {" "}
                                        / 5.0
                                    </span>
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="border-b my-4" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-muted-foreground mb-1">Iniciada em</p>
                            <p className="font-medium">{formatDate(attempt.startedAt)}</p>
                        </div>
                        {attempt.completedAt && (
                            <div>
                                <p className="text-muted-foreground mb-1">Concluída em</p>
                                <p className="font-medium">{formatDate(attempt.completedAt)}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
