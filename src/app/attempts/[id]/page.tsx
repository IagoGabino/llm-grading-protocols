import { redirect, notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { getAttemptById } from "@/server/repositories/attempt-repo";
import { getQuestionBySlug } from "@/lib/question-loader";
import { AttemptDetail } from "./_components/attempt-detail";

type Params = Promise<{
    id: string;
}>;

export const metadata = {
    title: "Detalhes da Tentativa | POC-ES",
    description: "Visualize os detalhes completos da sua tentativa de resolução",
};

export default async function AttemptDetailPage({ params }: { params: Params }) {
    // Obter sessão e validar autenticação
    const session = await auth();

    if (!session?.user) {
        redirect("/login?callbackUrl=/attempts");
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
        redirect("/login?callbackUrl=/attempts");
    }

    // Obter ID do parâmetro
    const { id } = await params;

    // Buscar tentativa
    const attempt = await getAttemptById(id);

    if (!attempt) {
        notFound();
    }

    // Verificar ownership - tentativa pertence ao usuário autenticado
    if (attempt.userId !== userId) {
        redirect("/attempts");
    }

    // Type assertion since we know getAttemptById includes user from the include statement
    const attemptWithUser = attempt as typeof attempt & {
        user: {
            id: string;
            name: string | null;
            email: string | null;
            image: string | null;
        };
    };

    // Buscar questão original
    const question = await getQuestionBySlug(attempt.slug);

    if (!question) {
        // Se a questão não existe mais, ainda mostramos a tentativa
        // mas sem os dados da questão original
        return (
            <div className="container mx-auto py-8">
                <AttemptDetail attempt={attemptWithUser} question={null} />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8">
            <AttemptDetail attempt={attemptWithUser} question={question} />
        </div>
    );
}
