import { listQuestionCards } from "@/lib/question-loader";
import { TaxonomyExplorer } from "./_components/taxonomy-explorer";

type PageProps = {
    searchParams: Promise<{ axis?: string }>;
};

export default async function QuestionsPage({ searchParams }: PageProps) {
    const { axis } = await searchParams;
    const questions = await listQuestionCards();

    return (
        <main className="container mx-auto max-w-7xl px-4 py-8">
            <TaxonomyExplorer questions={questions} initialAxis={axis ?? null} />
        </main>
    );
}
