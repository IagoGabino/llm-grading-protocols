import { listQuestionCards } from "@/lib/question-loader";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { QuestionsExplorer } from "../_components/questions-explorer";

export default async function AllQuestionsPage() {
    const questions = await listQuestionCards();

    return (
        <main className="container mx-auto max-w-7xl px-4 py-8">
            <Breadcrumb
                items={[
                    { label: "Questões", href: "/questions" },
                    { label: "Todas as questões" },
                ]}
            />
            <QuestionsExplorer questions={questions} title="Todas as questões" />
        </main>
    );
}
