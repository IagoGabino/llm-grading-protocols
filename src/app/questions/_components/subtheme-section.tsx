import Link from "next/link";
import { type QuestionCard } from "@/lib/question-loader";
import {
    getDifficultyBadgeClass,
    getDifficultyLabel,
    getSubthemeLabel,
    getSubthemeDescription,
} from "@/lib/question-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TagList } from "@/components/shared/TagList";

type SubthemeSectionProps = {
    subthemeId: string;
    questions: QuestionCard[];
};

export function SubthemeSection({ subthemeId, questions }: SubthemeSectionProps) {
    if (questions.length === 0) return null;

    return (
        <section className="space-y-4">
            {/* Cabeçalho do subtema */}
            <div className="flex flex-col gap-0.5 border-b pb-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-xl font-semibold">{getSubthemeLabel(subthemeId)}</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        {getSubthemeDescription(subthemeId)}
                    </p>
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">
                    {questions.length} {questions.length === 1 ? "questão" : "questões"}
                </span>
            </div>

            {/* Grid de questões — sem badge de eixo e subtema (já contextualizados) */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {questions.map((question) => (
                    <Card
                        key={question.slug}
                        className="flex flex-col transition-shadow hover:shadow-md"
                    >
                        <CardHeader className="flex-1 space-y-3 pb-3">
                            <Badge
                                className={getDifficultyBadgeClass(question.difficulty)}
                            >
                                {getDifficultyLabel(question.difficulty)}
                            </Badge>
                            <CardTitle className="text-base leading-snug">
                                {question.title}
                            </CardTitle>
                            <CardDescription className="line-clamp-2 text-sm leading-relaxed">
                                {question.summary}
                            </CardDescription>
                            <TagList tags={question.tags} maxVisible={3} compact />
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
}
