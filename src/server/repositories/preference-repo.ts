import { prisma } from "@/server/db";
import { createContextLogger } from "@/server/observability/logger";
import type { UserPreference } from "@/generated/prisma";

const logger = createContextLogger("repo/preference");

export async function getPreferences(userId: string): Promise<UserPreference | null> {
    try {
        logger.info({ userId }, "Fetching user preferences");

        const preferences = await prisma.userPreference.findUnique({
            where: { userId },
        });

        return preferences;
    } catch (error) {
        logger.error({ userId, error }, "Error fetching preferences");
        throw error;
    }
}

export async function upsertPreferences(
    userId: string,
    data: Partial<Omit<UserPreference, "id" | "userId" | "createdAt" | "updatedAt">>
): Promise<UserPreference> {
    try {
        logger.info({ userId, data }, "Upserting user preferences");

        const preferences = await prisma.userPreference.upsert({
            where: { userId },
            create: {
                userId,
                ...data,
            },
            update: data,
        });

        logger.info({ userId, preferencesId: preferences.id }, "Preferences upserted successfully");

        return preferences;
    } catch (error) {
        logger.error({ userId, error }, "Error upserting preferences");
        throw error;
    }
}
