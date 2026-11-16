import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { createContextLogger } from "@/server/observability/logger";

const logger = createContextLogger("api/me");

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        logger.info({ userId }, "Fetching user profile");

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { preference: true },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Buscar estatísticas do usuário
        const attempts = await prisma.attempt.findMany({
            where: { userId },
            select: {
                evaluation: true,
                status: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });

        // Calcular nota média
        const completedAttempts = attempts.filter((a) => a.status === "completed");
        const scores = completedAttempts
            .map((a) => {
                if (!a.evaluation || typeof a.evaluation !== "object") return null;
                const evalObj = a.evaluation as { overall?: number };
                return typeof evalObj.overall === "number" ? evalObj.overall : null;
            })
            .filter((score): score is number => score !== null);

        const averageScore =
            scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;

        // Calcular streak atual (dias consecutivos com tentativas)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let currentStreak = 0;
        const attemptDates = new Set(
            attempts.map((a) => {
                const date = new Date(a.createdAt);
                date.setHours(0, 0, 0, 0);
                return date.getTime();
            })
        );

        const checkDate = new Date(today);
        while (attemptDates.has(checkDate.getTime())) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }

        // Default preferences if none exist
        const preferences = user.preference ?? {
            defaultLanguage: "javascript",
            showHints: true,
            theme: "system",
        };

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image,
            },
            preferences,
            stats: {
                averageScore: Number(averageScore.toFixed(2)),
                totalAttempts: attempts.length,
                currentStreak,
            },
        });
    } catch (error) {
        logger.error({ error }, "Error fetching user profile");
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
