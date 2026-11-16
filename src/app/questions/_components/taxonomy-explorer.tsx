"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { type QuestionCard } from "@/lib/question-loader";
import {
    AXIS_ORDER,
    SUBTHEME_ORDER,
    getAxisLabel,
    getAxisDescription,
} from "@/lib/question-meta";
import { Button } from "@/components/ui/button";
import { AxisCard } from "./axis-card";
import { SubthemeSection } from "./subtheme-section";

type TaxonomyExplorerProps = {
    questions: QuestionCard[];
    initialAxis: string | null;
};

export function TaxonomyExplorer({ questions, initialAxis }: TaxonomyExplorerProps) {
    const router = useRouter();
    const [selectedAxis, setSelectedAxis] = useState<string | null>(initialAxis);

    function handleSelectAxis(axisId: string) {
        setSelectedAxis(axisId);
        router.replace(`/questions?axis=${axisId}`, { scroll: false });
    }

    function handleClearAxis() {
        setSelectedAxis(null);
        router.replace("/questions", { scroll: false });
    }

    // Contador de questões por eixo (apenas as classificadas com subtema)
    const questionCountByAxis = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const q of questions) {
            if (q.axis && q.subtheme) counts[q.axis] = (counts[q.axis] ?? 0) + 1;
        }
        return counts;
    }, [questions]);

    // Questões do eixo selecionado que têm subtema definido
    const questionsForAxis = useMemo(() => {
        if (!selectedAxis) return [];
        return questions.filter((q) => q.axis === selectedAxis && q.subtheme);
    }, [questions, selectedAxis]);

    // Agrupadas por subtema na ordem canônica, pulando subtemas vazios
    const subthemeSections = useMemo(() => {
        if (!selectedAxis) return [];
        const order = SUBTHEME_ORDER[selectedAxis] ?? [];
        const bySubtheme: Record<string, QuestionCard[]> = {};
        for (const q of questionsForAxis) {
            if (q.subtheme) {
                if (!bySubtheme[q.subtheme]) bySubtheme[q.subtheme] = [];
                bySubtheme[q.subtheme].push(q);
            }
        }
        return order
            .filter((sub) => (bySubtheme[sub]?.length ?? 0) > 0)
            .map((sub) => ({ subthemeId: sub, questions: bySubtheme[sub]! }));
    }, [questionsForAxis, selectedAxis]);

    // ─── Visão inicial: grade de eixos ────────────────────────────────────────
    if (!selectedAxis) {
        return (
            <div className="space-y-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Navegue pelos eixos</h1>
                        <p className="mt-1 text-muted-foreground">
                            Selecione um eixo para ver os subtemas e questões organizadas.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" asChild className="shrink-0 self-start">
                        <Link href="/questions/all">
                            Explorar todas as questões
                            <ExternalLink className="ml-2 h-3.5 w-3.5" />
                        </Link>
                    </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {AXIS_ORDER.map((axisId) => (
                        <AxisCard
                            key={axisId}
                            axisId={axisId}
                            label={getAxisLabel(axisId)}
                            description={getAxisDescription(axisId)}
                            questionCount={questionCountByAxis[axisId] ?? 0}
                            onClick={() => handleSelectAxis(axisId)}
                        />
                    ))}
                </div>
            </div>
        );
    }

    // ─── Visão de eixo selecionado: subtemas e questões ───────────────────────
    return (
        <div className="space-y-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <button
                        onClick={handleClearAxis}
                        className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Voltar aos eixos
                    </button>
                    <h1 className="text-3xl font-bold">{getAxisLabel(selectedAxis)}</h1>
                    <p className="mt-1 text-muted-foreground">{getAxisDescription(selectedAxis)}</p>
                </div>
                <Button variant="outline" size="sm" asChild className="shrink-0 self-start sm:mt-10">
                    <Link href="/questions/all">
                        Explorar todas
                        <ExternalLink className="ml-2 h-3.5 w-3.5" />
                    </Link>
                </Button>
            </div>

            {subthemeSections.length === 0 ? (
                <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                    Nenhuma questão classificada neste eixo ainda.
                </div>
            ) : (
                <div className="space-y-12">
                    {subthemeSections.map(({ subthemeId, questions: qs }) => (
                        <SubthemeSection key={subthemeId} subthemeId={subthemeId} questions={qs} />
                    ))}
                </div>
            )}
        </div>
    );
}
