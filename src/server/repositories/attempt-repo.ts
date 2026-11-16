import { prisma } from "@/server/db";
import { createContextLogger } from "@/server/observability/logger";
import type { Attempt, SupportedLanguage, AttemptStatus } from "@/generated/prisma";

const logger = createContextLogger("repo/attempt");

// Constants
const MAX_RAW_SIZE_BYTES = 500 * 1024; // 500KB - permite respostas grandes do LLM

// ============================================
// Input/Output Types
// ============================================

export type CreateAttemptInput = {
    userId: string;
    slug: string;
    resposta: string;
    raciocinio?: string;
    codigo?: string;
    language?: SupportedLanguage;
};

export type UpdateAttemptInput = {
    evaluation?: object;
    raw?: object;
    status?: AttemptStatus;
    completedAt?: Date;
    resposta?: string;
    raciocinio?: string;
    codigo?: string;
};

export type ListAttemptsFilters = {
    userId: string;
    slug?: string;
    status?: AttemptStatus;
    page?: number;
    pageSize?: number;
};

export type AttemptWithUser = Attempt & {
    user: {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
    };
};

export type ListAttemptsResult = {
    attempts: AttemptWithUser[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
};

// ============================================
// Repository Functions
// ============================================

/**
 * Creates a new attempt with automatic attemptNumber calculation
 * Uses Prisma transaction to prevent race conditions
 */
export async function createAttempt(input: CreateAttemptInput): Promise<Attempt> {
    const { userId, slug, resposta, raciocinio, codigo, language } = input;

    try {
        logger.info({ userId, slug }, "Creating new attempt");

        // Use transaction to ensure atomicity when calculating attemptNumber
        const attempt = await prisma.$transaction(async (tx) => {
            // Find the highest attemptNumber for this user+slug combination
            const lastAttempt = await tx.attempt.findFirst({
                where: { userId, slug },
                orderBy: { attemptNumber: "desc" },
                select: { attemptNumber: true },
            });

            const attemptNumber = (lastAttempt?.attemptNumber ?? 0) + 1;

            logger.info({ userId, slug, attemptNumber }, "Calculated attempt number");

            // Create the attempt
            return tx.attempt.create({
                data: {
                    userId,
                    slug,
                    attemptNumber,
                    resposta,
                    raciocinio,
                    codigo,
                    language,
                    status: "in_progress",
                },
            });
        });
        logger.info(
            { userId, slug, attemptId: attempt.id, attemptNumber: attempt.attemptNumber },
            "Attempt created successfully"
        );

        return attempt;
    } catch (error) {
        logger.error(
            { userId, slug, error, stack: error instanceof Error ? error.stack : undefined },
            "Error creating attempt"
        );
        throw error;
    }
}

/**
 * Updates an existing attempt
 * Handles raw payload truncation if it exceeds 50KB
 */
export async function updateAttempt(id: string, update: UpdateAttemptInput): Promise<Attempt> {
    const { evaluation, raw, status, completedAt, resposta, raciocinio, codigo } = update;

    try {
        logger.info({ attemptId: id, status }, "Updating attempt");

        // Process raw payload - truncate if too large
        let processedRaw = raw;
        if (raw) {
            const rawString = JSON.stringify(raw);
            const rawSizeBytes = Buffer.byteLength(rawString, "utf8");

            if (rawSizeBytes > MAX_RAW_SIZE_BYTES) {
                logger.warn(
                    { attemptId: id, rawSizeBytes, maxSize: MAX_RAW_SIZE_BYTES },
                    "Raw payload exceeds size limit, truncating"
                );

                // Truncate and add metadata
                processedRaw = {
                    _truncated: true,
                    _originalSizeBytes: rawSizeBytes,
                    _truncatedAt: new Date().toISOString(),
                    ...raw,
                };

                // Re-stringify and truncate to fit within limit
                const truncatedString = JSON.stringify(processedRaw).slice(
                    0,
                    MAX_RAW_SIZE_BYTES - 100
                );
                processedRaw = JSON.parse(truncatedString + '"}');
            }
        }

        const attempt = await prisma.attempt.update({
            where: { id },
            data: {
                ...(evaluation !== undefined && { evaluation }),
                ...(processedRaw !== undefined && { raw: processedRaw }),
                ...(status !== undefined && { status }),
                ...(completedAt !== undefined && { completedAt }),
                ...(resposta !== undefined && { resposta }),
                ...(raciocinio !== undefined && { raciocinio }),
                ...(codigo !== undefined && { codigo }),
            },
        });

        logger.info({ attemptId: id, status: attempt.status }, "Attempt updated successfully");

        return attempt;
    } catch (error) {
        logger.error(
            { attemptId: id, error, stack: error instanceof Error ? error.stack : undefined },
            "Error updating attempt"
        );
        throw error;
    }
}

/**
 * Retrieves a single attempt by ID
 * Includes user information
 */
export async function getAttemptById(id: string): Promise<Attempt | null> {
    try {
        logger.info({ attemptId: id }, "Fetching attempt by ID");

        const attempt = await prisma.attempt.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
            },
        });

        if (!attempt) {
            logger.info({ attemptId: id }, "Attempt not found");
            return null;
        }

        logger.info({ attemptId: id, userId: attempt.userId }, "Attempt retrieved");
        return attempt;
    } catch (error) {
        logger.error(
            { attemptId: id, error, stack: error instanceof Error ? error.stack : undefined },
            "Error fetching attempt by ID"
        );
        throw error;
    }
}

/**
 * Retrieves the latest attempt for a specific user and question
 */
export async function getLatestAttempt(userId: string, slug: string): Promise<Attempt | null> {
    try {
        logger.info({ userId, slug }, "Fetching latest attempt");

        const attempt = await prisma.attempt.findFirst({
            where: { userId, slug },
            orderBy: { attemptNumber: "desc" },
        });

        if (!attempt) {
            logger.info({ userId, slug }, "No attempts found");
            return null;
        }

        logger.info(
            { userId, slug, attemptId: attempt.id, attemptNumber: attempt.attemptNumber },
            "Latest attempt retrieved"
        );
        return attempt;
    } catch (error) {
        logger.error(
            { userId, slug, error, stack: error instanceof Error ? error.stack : undefined },
            "Error fetching latest attempt"
        );
        throw error;
    }
}

/**
 * Lists attempts with filtering and pagination
 * Returns attempts ordered by creation date (newest first)
 */
export async function listAttempts(filters: ListAttemptsFilters): Promise<ListAttemptsResult> {
    const { userId, slug, status, page = 1, pageSize = 20 } = filters;

    try {
        logger.info({ userId, slug, status, page, pageSize }, "Listing attempts");

        // Build where clause
        const where = {
            userId,
            ...(slug && { slug }),
            ...(status && { status }),
        };

        // Execute count and query in parallel for performance
        const [attempts, total] = await Promise.all([
            prisma.attempt.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            image: true,
                        },
                    },
                },
            }),
            prisma.attempt.count({ where }),
        ]);

        const totalPages = Math.ceil(total / pageSize);

        logger.info(
            { userId, total, page, totalPages, resultsCount: attempts.length },
            "Attempts listed successfully"
        );

        return {
            attempts,
            pagination: {
                page,
                pageSize,
                total,
                totalPages,
            },
        };
    } catch (error) {
        logger.error(
            { userId, slug, error, stack: error instanceof Error ? error.stack : undefined },
            "Error listing attempts"
        );
        throw error;
    }
}
