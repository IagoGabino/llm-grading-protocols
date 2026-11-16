import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { listAttempts } from "@/server/repositories/attempt-repo";
import { listQuestionCards } from "@/lib/question-loader";
import { AttemptsDashboard } from "./_components/attempts-dashboard";

export const metadata = {
    title: "Minhas Tentativas | POC-ES",
    description: "Histórico de tentativas de resolução de questões",
};

export default async function AttemptsPage() {
    // Verificar autenticação
    const session = await auth();

    if (!session?.user) {
        redirect("/login?callbackUrl=/attempts");
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
        redirect("/login?callbackUrl=/attempts");
    }

    // Obter todas as tentativas (sem paginação para dashboard completo)
    const [attemptsData, questionCards] = await Promise.all([
        listAttempts({
            userId,
            page: 1,
            pageSize: 1000, // Buscar todas para análise
        }),
        listQuestionCards(),
    ]);

    // Criar mapa de questões para lookup rápido
    const questionsMap = new Map(questionCards.map((q) => [q.slug, q]));

    return (
        <main className="container mx-auto max-w-7xl px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Minhas Tentativas</h1>
                <p className="text-muted-foreground">
                    Acompanhe seu progresso e evolução ao longo do tempo
                </p>
            </div>

            <AttemptsDashboard
                attempts={attemptsData.attempts}
                questionsMap={Object.fromEntries(questionsMap)}
            />
        </main>
    );
}
