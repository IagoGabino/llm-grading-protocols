import Link from "next/link";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getQuestionBySlug } from "@/lib/question-loader";
import {
    getAxisBadgeClass,
    getAxisLabel,
    getDifficultyBadgeClass,
    getDifficultyLabel,
    getLanguageLabel,
} from "@/lib/question-meta";
import { getMockEvaluationResult } from "./_data/mock-results";
import { ResultsClient } from "./_components/results-client";
import { normalizeEvaluation } from "@/lib/evaluation-types";

type ResultsPageProps = {
    searchParams: Promise<{
        slug?: string;
        language?: string;
        attempt?: string;
    }>;
};

function humanizeSlug(slug?: string) {
    if (!slug) return undefined;
    return slug
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
    const params = await searchParams;

    const questionSlug = params.slug && typeof params.slug === "string" ? params.slug : undefined;
    const requestedLanguage =
        params.language && typeof params.language === "string"
            ? params.language.toLowerCase()
            : undefined;

    const evaluation = getMockEvaluationResult(questionSlug);

    if (!evaluation) {
        return (
            <div className="container mx-auto max-w-5xl px-4 py-10">
                <Card>
                    <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                        <p className="text-lg font-semibold text-foreground">
                            Resultados ainda não disponíveis.
                        </p>
                        <p className="max-w-md text-sm text-muted-foreground">
                            Envie uma avaliação para ver os resultados aqui.
                        </p>
                        <div className="flex gap-3">
                            <Button asChild>
                                <Link href="/questions">Ir para questões</Link>
                            </Button>
                            <Button asChild variant="outline">
                                <Link href="/">Voltar ao início</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const effectiveSlug = questionSlug ?? evaluation.questionSlug;
    const question = effectiveSlug ? await getQuestionBySlug(effectiveSlug) : null;

    const language = requestedLanguage ?? evaluation.language;
    const languageLabel = language ? getLanguageLabel(language) : undefined;

    const resolvedQuestionSlug = question?.meta.slug ?? evaluation.questionSlug;
    const questionLink = resolvedQuestionSlug ? `/questions/${resolvedQuestionSlug}` : "/questions";
    const questionTitle =
        question?.meta.title ?? humanizeSlug(resolvedQuestionSlug) ?? "Questão em avaliação";
    const questionAxis = question?.meta.axis;
    const questionDifficulty = question?.meta.difficulty;

    // Extrair rubrica da questão para mapear IDs → nomes
    const rubricCriteria =
        question?.meta.rubric && typeof question.meta.rubric === "object"
            ? ((question.meta.rubric as { criteria?: unknown[] }).criteria?.map((c: unknown) => {
                  const criterion = c as Record<string, unknown>;
                  return {
                      id: criterion.id as string,
                      name: criterion.name as string,
                  };
              }) ?? [])
            : [];

    // Normalizar mock evaluation no servidor (não pode passar função para client component)
    const normalizedMockEvaluation = normalizeEvaluation(evaluation);

    return (
        <div className="container mx-auto max-w-6xl px-4 py-8">
            <Breadcrumb
                items={[
                    { label: "Questões", href: "/questions" },
                    resolvedQuestionSlug
                        ? { label: questionTitle, href: questionLink }
                        : { label: questionTitle },
                    { label: "Resultados" },
                ]}
            />

            <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge>{questionTitle}</Badge>
                {questionDifficulty ? (
                    <Badge className={getDifficultyBadgeClass(questionDifficulty)}>
                        {getDifficultyLabel(questionDifficulty)}
                    </Badge>
                ) : null}
                {questionAxis ? (
                    <Badge className={getAxisBadgeClass(questionAxis)}>
                        {getAxisLabel(questionAxis)}
                    </Badge>
                ) : null}
                {languageLabel ? <Badge variant="outline">{languageLabel}</Badge> : null}
            </div>

            <ResultsClient
                questionSlug={resolvedQuestionSlug || ""}
                questionLink={questionLink}
                normalizedMockEvaluation={normalizedMockEvaluation}
                rubricCriteria={rubricCriteria}
            />
        </div>
    );
}
