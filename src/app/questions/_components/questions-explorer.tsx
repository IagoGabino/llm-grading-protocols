"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bug, Code2, Filter, Layers, Search, TestTube } from "lucide-react";

import { type QuestionCard } from "@/lib/question-loader";
import {
    AXIS_LABELS,
    DIFFICULTY_ORDER,
    getAxisBadgeClass,
    getAxisLabel,
    getAxisLabelShort,
    getDifficultyBadgeClass,
    getDifficultyLabel,
    getSubthemeLabel,
    getTagLabel,
} from "@/lib/question-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubthemeBadge } from "@/components/shared/SubthemeBadge";
import { TagList } from "@/components/shared/TagList";

type QuestionsExplorerProps = {
    questions: QuestionCard[];
    title?: string;
};

function difficultySortValue(difficulty: string) {
    const index = DIFFICULTY_ORDER.indexOf(difficulty);
    return index === -1 ? DIFFICULTY_ORDER.length + difficulty.charCodeAt(0) : index;
}

const axisConfig: Record<string, { label: string; icon: typeof Code2 }> = {
    codeQuality: { label: AXIS_LABELS.codeQuality, icon: Code2 },
    bugFix: { label: AXIS_LABELS.bugFix, icon: Bug },
    tests: { label: AXIS_LABELS.tests, icon: TestTube },
    design: { label: AXIS_LABELS.design, icon: Layers },
    architecture: { label: AXIS_LABELS.architecture, icon: Layers },
};

export function QuestionsExplorer({ questions, title = "Explorar Questões" }: QuestionsExplorerProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedAxis, setSelectedAxis] = useState<string>("all");
    const [selectedSubtheme, setSelectedSubtheme] = useState<string>("all");
    const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");

    // Quando o usuário muda de eixo, resetar o filtro de subtema
    function handleAxisChange(axis: string) {
        setSelectedAxis(axis);
        setSelectedSubtheme("all");
    }

    const axisOptions = useMemo(() => {
        const unique = new Set<string>();
        for (const question of questions) {
            if (question.axis) unique.add(question.axis);
        }
        return Array.from(unique).sort((a, b) => getAxisLabel(a).localeCompare(getAxisLabel(b)));
    }, [questions]);

    const difficultyOptions = useMemo(() => {
        const unique = new Set<string>();
        for (const question of questions) {
            if (question.difficulty) unique.add(question.difficulty);
        }
        return Array.from(unique).sort((a, b) => difficultySortValue(a) - difficultySortValue(b));
    }, [questions]);

    // Subtemas disponíveis para o eixo selecionado (apenas quando um eixo está ativo)
    const subthemeOptions = useMemo(() => {
        if (selectedAxis === "all") return [];
        const unique = new Set<string>();
        for (const question of questions) {
            if (question.axis === selectedAxis && question.subtheme) {
                unique.add(question.subtheme);
            }
        }
        return Array.from(unique).sort((a, b) =>
            getSubthemeLabel(a).localeCompare(getSubthemeLabel(b))
        );
    }, [questions, selectedAxis]);

    const filteredQuestions = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        return questions.filter((question) => {
            const matchesSearch =
                normalizedQuery.length === 0 ||
                [
                    question.title,
                    question.summary,
                    getAxisLabel(question.axis),
                    getDifficultyLabel(question.difficulty),
                    getSubthemeLabel(question.subtheme),
                    ...(question.tags ?? []).map(getTagLabel),
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(normalizedQuery);

            const matchesAxis = selectedAxis === "all" || question.axis === selectedAxis;
            const matchesSubtheme =
                selectedSubtheme === "all" || question.subtheme === selectedSubtheme;
            const matchesDifficulty =
                selectedDifficulty === "all" || question.difficulty === selectedDifficulty;

            return matchesSearch && matchesAxis && matchesSubtheme && matchesDifficulty;
        });
    }, [questions, searchQuery, selectedAxis, selectedSubtheme, selectedDifficulty]);

    const groupedByDifficulty = useMemo(() => {
        const groups: Record<string, QuestionCard[]> = {};
        for (const question of filteredQuestions) {
            const key = question.difficulty ?? "unknown";
            if (!groups[key]) groups[key] = [];
            groups[key].push(question);
        }
        return groups;
    }, [filteredQuestions]);

    const orderedDifficultyKeys = useMemo(() => {
        const keys = Object.keys(groupedByDifficulty).filter(
            (key) => groupedByDifficulty[key]?.length
        );
        return keys.sort((a, b) => difficultySortValue(a) - difficultySortValue(b));
    }, [groupedByDifficulty]);

    return (
        <div className="space-y-8">
            <div className="space-y-6">
                <div>
                    <h1 className="mb-2 text-4xl font-bold">{title}</h1>
                    <p className="text-muted-foreground">
                        Explore desafios de refatoração, correção de bugs, testes automatizados e
                        arquitetura.
                    </p>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                    <Input
                        placeholder="Buscar questões..."
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Filtros — dificuldade sempre visível; subtema aparece apenas com eixo selecionado */}
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-6">
                <div className="flex items-center gap-2 text-sm font-medium sm:mr-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span>Filtros:</span>
                </div>

                <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Dificuldade" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas as dificuldades</SelectItem>
                        {difficultyOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                                {getDifficultyLabel(option)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Filtro de subtema: só aparece quando um eixo específico está selecionado */}
                {selectedAxis !== "all" && subthemeOptions.length > 0 && (
                    <Select value={selectedSubtheme} onValueChange={setSelectedSubtheme}>
                        <SelectTrigger className="w-full sm:w-[240px]">
                            <SelectValue placeholder="Subtema" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os subtemas</SelectItem>
                            {subthemeOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                    {getSubthemeLabel(option)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            <Tabs value={selectedAxis} onValueChange={handleAxisChange}>
                <TabsList className="grid h-auto w-full grid-cols-2 gap-0 rounded-lg bg-muted/50 p-1 md:grid-cols-5">
                    <TabsTrigger
                        value="all"
                        className="gap-2 border-0 bg-transparent py-3 shadow-none data-[state=active]:border-0 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                        Todas
                    </TabsTrigger>
                    {axisOptions.map((option) => {
                        const config = axisConfig[option];
                        const Icon = config?.icon;
                        const label = config?.label ?? getAxisLabel(option);

                        return (
                            <TabsTrigger
                                key={option}
                                value={option}
                                className="gap-2 border-0 bg-transparent py-3 shadow-none data-[state=active]:border-0 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                {Icon && <Icon className="h-4 w-4" />}
                                <span className="hidden md:inline">{label}</span>
                                <span className="md:hidden">{getAxisLabelShort(option)}</span>
                            </TabsTrigger>
                        );
                    })}
                </TabsList>

                <TabsContent value={selectedAxis} className="space-y-10 pt-6">
                    {orderedDifficultyKeys.map((difficulty) => {
                        const questionsInDifficulty = groupedByDifficulty[difficulty] ?? [];
                        if (questionsInDifficulty.length === 0) return null;

                        return (
                            <section key={difficulty} className="space-y-4">
                                <h2 className="text-2xl font-semibold">
                                    {getDifficultyLabel(difficulty)}
                                </h2>
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    {questionsInDifficulty.map((question) => (
                                        <Card
                                            key={question.slug}
                                            className="flex flex-col transition-shadow hover:shadow-lg"
                                        >
                                            <CardHeader className="flex-1 space-y-3">
                                                {/* Linha 1: dificuldade + eixo */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <Badge
                                                        className={getDifficultyBadgeClass(
                                                            question.difficulty
                                                        )}
                                                    >
                                                        {getDifficultyLabel(question.difficulty)}
                                                    </Badge>
                                                    <Badge
                                                        className={getAxisBadgeClass(question.axis)}
                                                    >
                                                        {getAxisLabel(question.axis)}
                                                    </Badge>
                                                </div>

                                                {/* Título */}
                                                <CardTitle className="text-lg leading-snug">
                                                    {question.title}
                                                </CardTitle>

                                                {/* Resumo */}
                                                <CardDescription className="line-clamp-3 text-sm leading-relaxed">
                                                    {question.summary}
                                                </CardDescription>

                                                {/* Subtema */}
                                                <SubthemeBadge subtheme={question.subtheme} />

                                                {/* Tags — máx. 3 visíveis no card */}
                                                <TagList
                                                    tags={question.tags}
                                                    maxVisible={3}
                                                    compact
                                                />
                                            </CardHeader>
                                            <CardContent className="pt-0">
                                                <Button asChild className="w-full">
                                                    <Link href={`/questions/${question.slug}`}>
                                                        Abrir questão
                                                    </Link>
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        );
                    })}

                    {filteredQuestions.length === 0 ? (
                        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                            Nenhuma questão encontrada com esses filtros.
                        </div>
                    ) : null}
                </TabsContent>
            </Tabs>
        </div>
    );
}
