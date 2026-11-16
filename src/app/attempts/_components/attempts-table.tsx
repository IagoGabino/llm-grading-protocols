import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { AttemptWithUser } from "@/server/repositories/attempt-repo";
import type { QuestionCard } from "@/lib/question-loader";
import {
    getAxisLabel,
    getDifficultyLabel,
    getAxisBadgeClass,
    getDifficultyBadgeClass,
    LANGUAGE_LABELS,
    AXIS_LABELS,
    DIFFICULTY_LABELS,
} from "@/lib/question-meta";

type AxisFilter = keyof typeof AXIS_LABELS | "all";
type DifficultyFilter = keyof typeof DIFFICULTY_LABELS | "all";

type AttemptsTableProps = {
    attempts: AttemptWithUser[];
    questionsMap: Record<string, QuestionCard>;
    filterAxis: AxisFilter;
    filterDifficulty: DifficultyFilter;
    onAxisChange: (value: AxisFilter) => void;
    onDifficultyChange: (value: DifficultyFilter) => void;
    calculateScore: (evaluation: unknown) => number | null;
};

const axisFilterOptions: Array<{ value: AxisFilter; label: string }> = [
    { value: "all", label: "Todas as áreas" },
    { value: "codeQuality", label: AXIS_LABELS.codeQuality },
    { value: "bugFix", label: AXIS_LABELS.bugFix },
    { value: "tests", label: AXIS_LABELS.tests },
    { value: "design", label: AXIS_LABELS.design },
];

const difficultyFilterOptions: Array<{ value: DifficultyFilter; label: string }> = [
    { value: "all", label: "Todas" },
    { value: "easy", label: DIFFICULTY_LABELS.easy },
    { value: "intermediate", label: DIFFICULTY_LABELS.intermediate },
    { value: "advanced", label: DIFFICULTY_LABELS.advanced },
];

export function AttemptsTable({
    attempts,
    questionsMap,
    filterAxis,
    filterDifficulty,
    onAxisChange,
    onDifficultyChange,
    calculateScore,
}: AttemptsTableProps) {
    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <CardTitle>Histórico de Tentativas</CardTitle>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Select value={filterAxis} onValueChange={onAxisChange}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Área" />
                            </SelectTrigger>
                            <SelectContent>
                                {axisFilterOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={filterDifficulty} onValueChange={onDifficultyChange}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Dificuldade" />
                            </SelectTrigger>
                            <SelectContent>
                                {difficultyFilterOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table className="min-w-[600px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Questão</TableHead>
                                <TableHead>Área</TableHead>
                                <TableHead>Dificuldade</TableHead>
                                <TableHead>Linguagem</TableHead>
                                <TableHead>Nota</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {attempts.map((attempt) => {
                                const question = questionsMap[attempt.slug];
                                const overallScore = calculateScore(attempt.evaluation);

                                return (
                                    <TableRow key={attempt.id} className="hover:bg-muted/50">
                                        <TableCell>
                                            {new Date(attempt.createdAt).toLocaleDateString(
                                                "pt-BR",
                                                {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                }
                                            )}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {question?.title ?? attempt.slug}
                                        </TableCell>
                                        <TableCell>
                                            {question?.axis ? (
                                                <Badge className={getAxisBadgeClass(question.axis)}>
                                                    {getAxisLabel(question.axis)}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {question?.difficulty ? (
                                                <Badge
                                                    className={getDifficultyBadgeClass(
                                                        question.difficulty
                                                    )}
                                                >
                                                    {getDifficultyLabel(question.difficulty)}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {attempt.language
                                                ? LANGUAGE_LABELS[attempt.language]
                                                : "N/A"}
                                        </TableCell>
                                        <TableCell className="font-bold">
                                            {overallScore !== null ? overallScore.toFixed(1) : "-"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link href={`/attempts/${attempt.id}`}>
                                                    Ver detalhes
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                {!attempts.length && (
                    <div className="py-12 text-center">
                        <p className="text-muted-foreground">Nenhuma tentativa encontrada</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
