"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import Markdown from "@/components/shared/Markdown";
import { CodeEditor } from "@/components/shared/CodeEditor";
import { SubthemeBadge } from "@/components/shared/SubthemeBadge";
import { TagList } from "@/components/shared/TagList";
import { usePreferences } from "@/contexts/preferences-context";
import { type QuestionData } from "@/lib/question-loader";
import {
    ensureSupportedLanguageCodes,
    getAxisBadgeClass,
    getAxisLabel,
    getDifficultyBadgeClass,
    getDifficultyLabel,
    getLanguageLabel,
    SUPPORTED_LANGUAGES,
} from "@/lib/question-meta";
import { Loader2Icon } from "lucide-react";
import { useCodeEditor } from "../_hooks/use-code-editor";
import { useQuestionForm } from "../_hooks/use-question-form";
import { useEvaluation } from "../_hooks/use-evaluation";

type QuestionWorkspaceProps = {
    question: QuestionData;
};

type RubricCriterion = {
    id?: string;
    name: string;
    description?: string;
    weight?: number;
};

function normalizeRubric(rubric: unknown): RubricCriterion[] {
    if (!rubric || typeof rubric !== "object") return [];
    const maybeCriteria = (rubric as { criteria?: unknown }).criteria;
    if (!Array.isArray(maybeCriteria)) return [];
    const items = maybeCriteria as unknown[];
    const mapped = items.map((item) => {
        if (!item || typeof item !== "object") return null;
        const { id, name, description, weight } = item as Record<string, unknown>;
        const safeName = typeof name === "string" ? name : undefined;
        if (!safeName) return null;
        const criterion: RubricCriterion = {
            id: typeof id === "string" ? id : undefined,
            name: safeName,
            description: typeof description === "string" ? description : undefined,
            weight: typeof weight === "number" ? weight : undefined,
        };
        return criterion;
    });
    return mapped.filter((c): c is RubricCriterion => c !== null);
}

export function QuestionWorkspace({ question }: QuestionWorkspaceProps) {
    const { showHints } = usePreferences();
    const statement =
        question.sections.statement ??
        "Seção de enunciado ausente. Adicione <!-- SECTION:statement --> ao markdown.";

    const inputType =
        (question.meta.inputConfig && typeof question.meta.inputConfig === "object"
            ? (question.meta.inputConfig as { type?: string }).type
            : undefined) ?? "code";
    const isCodeTask = inputType === "code";

    const supportedLanguages = useMemo(
        () => ensureSupportedLanguageCodes(isCodeTask ? question.meta.supportedLanguages : []),
        [isCodeTask, question.meta.supportedLanguages]
    );

    // Custom hooks
    const { selectedLanguage, currentCode, handleCodeChange, handleLanguageChange } = useCodeEditor(
        {
            templates: question.templates,
            supportedLanguages,
            defaultLanguage: question.meta.defaultLanguage,
        }
    );

    const { formValues, justification, multiSections, updateFormValue, setJustification } =
        useQuestionForm({
            inputConfig: question.meta.inputConfig,
        });

    const { isEvaluating, handleEvaluate } = useEvaluation({
        questionId: question.meta.id,
        questionSlug: question.meta.slug,
        isCodeTask,
    });

    const [demoMode, setDemoMode] = useState(false);

    const rubricCriteria = useMemo(
        () => normalizeRubric(question.meta.rubric),
        [question.meta.rubric]
    );

    const languagesForSelect =
        supportedLanguages.length > 0 ? supportedLanguages : SUPPORTED_LANGUAGES;

    const onEvaluate = useCallback(() => {
        void handleEvaluate({
            currentCode,
            formValues,
            justification,
            selectedLanguage,
            demoMode,
        });
    }, [handleEvaluate, currentCode, formValues, justification, selectedLanguage, demoMode]);

    useEffect(() => {
        const listener = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                if (!isEvaluating) {
                    onEvaluate();
                }
            }
        };

        window.addEventListener("keydown", listener);
        return () => window.removeEventListener("keydown", listener);
    }, [onEvaluate, isEvaluating]);

    return (
        <div className="space-y-8">
            <header className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <h1 className="text-3xl font-bold">{question.meta.title}</h1>

                        {/* Linha de badges: dificuldade, eixo e subtema */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge className={getDifficultyBadgeClass(question.meta.difficulty)}>
                                {getDifficultyLabel(question.meta.difficulty)}
                            </Badge>
                            <Badge className={getAxisBadgeClass(question.meta.axis)}>
                                {getAxisLabel(question.meta.axis)}
                            </Badge>
                            <SubthemeBadge subtheme={question.meta.subtheme} />
                        </div>

                        {/* Tags — todas visíveis no workspace (usuário já entrou na questão) */}
                        <div className="mt-2">
                            <TagList tags={question.meta.tags} />
                        </div>
                    </div>

                    {isCodeTask ? (
                        <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                            <SelectTrigger className="w-[200px] shrink-0">
                                <SelectValue placeholder="Escolha a linguagem" />
                            </SelectTrigger>
                            <SelectContent>
                                {languagesForSelect.map((language) => (
                                    <SelectItem key={language} value={language}>
                                        {getLanguageLabel(language)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : null}
                </div>
            </header>

            <div className="grid gap-6 xl:grid-cols-2">
                <Card className="flex h-full flex-col overflow-hidden xl:max-h-[800px]">
                    <CardHeader>
                        <CardTitle>Enunciado</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto pr-2">
                        <Markdown>{statement}</Markdown>
                    </CardContent>
                </Card>

                {isCodeTask ? (
                    <Card className="flex h-full flex-col overflow-hidden xl:max-h-[800px]">
                        <CardHeader>
                            <CardTitle>
                                Sua solução ({getLanguageLabel(selectedLanguage)})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto pr-2">
                            <div className="space-y-4">
                                <div>
                                    <CodeEditor
                                        language={selectedLanguage}
                                        value={currentCode}
                                        onChange={handleCodeChange}
                                        height={400}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="justification" className="text-sm font-medium">
                                        Justificativa das decisões de código
                                    </Label>
                                    <div className="h-[200px] overflow-hidden rounded-md border border-input">
                                        <Textarea
                                            id="justification"
                                            placeholder="Explique as principais decisões técnicas da sua solução: padrões aplicados, trade-offs considerados, etc."
                                            className="h-full resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                            value={justification}
                                            onChange={(e) => setJustification(e.target.value)}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Descreva o raciocínio por trás da sua implementação para uma
                                        avaliação mais completa.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="flex h-full flex-col overflow-hidden xl:max-h-[800px]">
                        <CardHeader>
                            <CardTitle>Suas respostas</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto pr-2">
                            {multiSections.length > 0 ? (
                                <div className="space-y-4">
                                    {multiSections.map((section) => (
                                        <div key={section.id} className="space-y-2">
                                            <Label htmlFor={section.id}>{section.label}</Label>
                                            <div className="h-[200px] overflow-hidden rounded-md border border-input">
                                                <Textarea
                                                    id={section.id}
                                                    placeholder={section.placeholder}
                                                    className="h-full resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                                    value={formValues[section.id] ?? ""}
                                                    onChange={(event) =>
                                                        updateFormValue(section.id, event.target.value)
                                                    }
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Configure seções de formulário em{" "}
                                    <code>inputConfig.sections</code> para habilitar respostas
                                    estruturadas.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            <section className="space-y-6">
                <div className="flex flex-col gap-4 rounded-lg border border-dashed border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="flex flex-1 items-start gap-3">
                        <Switch
                            id="demo-mode"
                            checked={demoMode}
                            onCheckedChange={setDemoMode}
                            aria-describedby="demo-mode-hint"
                        />
                        <div>
                            <Label htmlFor="demo-mode" className="text-sm font-medium">
                                Modo demo
                            </Label>
                            <p
                                id="demo-mode-hint"
                                className="text-xs text-muted-foreground sm:text-sm"
                            >
                                Usa uma resposta simulada para visualizar o fluxo de avaliação.
                            </p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        size="lg"
                        className="w-full sm:w-auto"
                        disabled={isEvaluating}
                        onClick={onEvaluate}
                        aria-label="Avaliar resposta"
                    >
                        {isEvaluating ? (
                            <>
                                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                Avaliando...
                            </>
                        ) : (
                            <>
                                <span className="hidden sm:inline">Avaliar (Ctrl+Enter)</span>
                                <span className="sm:hidden">Avaliar</span>
                            </>
                        )}
                    </Button>
                </div>

                {showHints ? (
                    <Card className="bg-muted/40">
                        <CardHeader>
                            <CardTitle>💡 Pontos esperados</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {rubricCriteria.length > 0 ? (
                                <ul className="ml-4 list-disc space-y-2 text-sm text-muted-foreground">
                                    {rubricCriteria.map((criterion) => (
                                        <li key={criterion.id ?? criterion.name}>
                                            <span className="font-medium text-foreground">
                                                {criterion.name}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Documente neste card as principais expectativas de avaliação
                                    utilizando a chave
                                    <code className="mx-1 rounded bg-muted px-1 py-0.5">
                                        rubric.criteria
                                    </code>{" "}
                                    no front matter.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                ) : null}
            </section>
        </div>
    );
}
