"use client";

import { useMemo, useState } from "react";
import type { AttemptWithUser } from "@/server/repositories/attempt-repo";
import type { QuestionCard } from "@/lib/question-loader";
import { AXIS_LABELS, DIFFICULTY_LABELS } from "@/lib/question-meta";
import { EmptyState } from "./empty-state";
import { StatsCards } from "./stats-cards";
import { EvolutionChart } from "./evolution-chart";
import { DifficultyChart } from "./difficulty-chart";
import { AttemptsTable } from "./attempts-table";

type AttemptsDashboardProps = {
    attempts: AttemptWithUser[];
    questionsMap: Record<string, QuestionCard>;
};

type AxisFilter = keyof typeof AXIS_LABELS | "all";
type DifficultyFilter = keyof typeof DIFFICULTY_LABELS | "all";

/**
 * Extrai nota geral da avaliação
 */
function calculateOverallScore(evaluation: unknown): number | null {
    if (!evaluation || typeof evaluation !== "object") return null;

    const evalObj = evaluation as { overall?: number };
    if (typeof evalObj.overall !== "number") return null;

    return evalObj.overall;
}

export function AttemptsDashboard({ attempts, questionsMap }: AttemptsDashboardProps) {
    const [filterAxis, setFilterAxis] = useState<AxisFilter>("all");
    const [filterDifficulty, setFilterDifficulty] = useState<DifficultyFilter>("all");

    const filteredAttempts = useMemo(() => {
        return attempts.filter((attempt) => {
            const question = questionsMap[attempt.slug];
            if (!question) return true; // Mostrar tentativas sem metadata

            const matchesAxis = filterAxis === "all" || question.axis === filterAxis;
            const matchesDifficulty =
                filterDifficulty === "all" || question.difficulty === filterDifficulty;
            return matchesAxis && matchesDifficulty;
        });
    }, [attempts, questionsMap, filterAxis, filterDifficulty]);

    const { averageScore, bestScore } = useMemo(() => {
        const completedAttempts = filteredAttempts.filter((a) => a.status === "completed");
        if (!completedAttempts.length) {
            return { averageScore: 0, bestScore: 0 };
        }

        const scores = completedAttempts
            .map((a) => calculateOverallScore(a.evaluation))
            .filter((score): score is number => score !== null);

        if (scores.length === 0) {
            return { averageScore: 0, bestScore: 0 };
        }

        const totalScore = scores.reduce((sum, score) => sum + score, 0);
        const bestScoreValue = Math.max(...scores);
        return {
            averageScore: totalScore / scores.length,
            bestScore: bestScoreValue,
        };
    }, [filteredAttempts]);

    const difficultyDistribution = useMemo(() => {
        return filteredAttempts.reduce<Record<string, number>>(
            (acc, attempt) => {
                const question = questionsMap[attempt.slug];
                const difficulty = question?.difficulty ?? "unknown";
                acc[difficulty] = (acc[difficulty] ?? 0) + 1;
                return acc;
            },
            { easy: 0, intermediate: 0, advanced: 0 }
        );
    }, [filteredAttempts, questionsMap]);

    const evolutionData = useMemo(() => {
        return [...filteredAttempts]
            .filter((a) => a.status === "completed")
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            .map((attempt, index) => ({
                attempt: index + 1,
                score: calculateOverallScore(attempt.evaluation) ?? 0,
                date: new Date(attempt.createdAt).toLocaleDateString("pt-BR", {
                    month: "short",
                    day: "numeric",
                }),
            }));
    }, [filteredAttempts]);

    const difficultyData = useMemo(() => {
        return [
            { name: "Fácil", value: difficultyDistribution.easy },
            { name: "Intermediário", value: difficultyDistribution.intermediate },
            { name: "Avançado", value: difficultyDistribution.advanced },
        ];
    }, [difficultyDistribution]);

    if (attempts.length === 0) {
        return <EmptyState />;
    }

    return (
        <div className="space-y-8">
            <StatsCards
                averageScore={averageScore}
                bestScore={bestScore}
                totalAttempts={filteredAttempts.length}
            />

            <div className="grid gap-6 lg:grid-cols-2">
                <EvolutionChart data={evolutionData} />
                <DifficultyChart data={difficultyData} />
            </div>

            <AttemptsTable
                attempts={filteredAttempts}
                questionsMap={questionsMap}
                filterAxis={filterAxis}
                filterDifficulty={filterDifficulty}
                onAxisChange={setFilterAxis}
                onDifficultyChange={setFilterDifficulty}
                calculateScore={calculateOverallScore}
            />
        </div>
    );
}
