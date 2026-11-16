import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { getQuestionBySlug } from "@/lib/question-loader";
import { getAxisLabel, getSubthemeLabel } from "@/lib/question-meta";

import { QuestionWorkspace } from "./_components/question-workspace";

type PageProps = {
    params: Promise<{ slug: string }>;
};

export default async function QuestionDetailPage({ params }: PageProps) {
    const { slug } = await params;
    const question = await getQuestionBySlug(slug);
    if (!question) return notFound();

    const breadcrumbItems = [
        { label: "Questões", href: "/questions" },
        ...(question.meta.axis
            ? [{ label: getAxisLabel(question.meta.axis), href: `/questions?axis=${question.meta.axis}` }]
            : []),
        ...(question.meta.subtheme
            ? [{ label: getSubthemeLabel(question.meta.subtheme) }]
            : []),
        { label: question.meta.title },
    ];

    return (
        <main className="px-6 py-8">
            <Breadcrumb items={breadcrumbItems} />
            <QuestionWorkspace question={question} />
        </main>
    );
}
