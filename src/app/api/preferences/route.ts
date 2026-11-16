import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { getPreferences, upsertPreferences } from "@/server/repositories/preference-repo";
import { createContextLogger } from "@/server/observability/logger";

const logger = createContextLogger("api/preferences");

const preferencesSchema = z.object({
    defaultLanguage: z.enum(["javascript", "python", "java"]).optional(),
    showHints: z.boolean().optional(),
    theme: z.enum(["light", "dark", "system"]).optional(),
});

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        logger.info({ userId }, "Fetching preferences");

        const preferences = await getPreferences(userId);

        // Return default preferences if none exist
        return NextResponse.json(
            preferences ?? {
                defaultLanguage: "javascript",
                showHints: true,
                theme: "system",
            }
        );
    } catch (error) {
        logger.error({ error }, "Error fetching preferences");
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await request.json();
        const parsed = preferencesSchema.safeParse(body);

        if (!parsed.success) {
            logger.warn({ userId, errors: parsed.error.flatten() }, "Invalid preferences data");
            return NextResponse.json(
                { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        logger.info({ userId, data: parsed.data }, "Updating preferences");

        const updated = await upsertPreferences(userId, parsed.data);

        return NextResponse.json(updated);
    } catch (error) {
        logger.error({ error }, "Error updating preferences");
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
