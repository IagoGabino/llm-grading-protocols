import { z } from "zod";

/**
 * Environment variables schema with complete validation
 */
const envSchema = z.object({
    // Node environment
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    // Database
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    DIRECT_URL: z.string().optional(),

    // Auth.js / NextAuth
    AUTH_SECRET: z
        .string()
        .min(32, "AUTH_SECRET must be at least 32 characters (use: openssl rand -base64 32)"),
    NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    // LLM Configuration
    LLM_PROVIDER: z.enum(["mock", "openrouter", "anthropic"]).default("mock"),
    LLM_MODEL: z.string().optional(),
    LLM_TIMEOUT_MS: z.string().default("60000").transform(Number).pipe(z.number().positive()),
    LLM_RETRY_ON_INVALID_JSON: z
        .string()
        .default("1")
        .transform(Number)
        .pipe(z.number().int().nonnegative()),
    USE_MOCK: z
        .string()
        .default("false")
        .transform((val) => val === "true"),

    // Anthropic (Direct API)
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_MODEL: z.string().optional(),
    ANTHROPIC_VERSION: z.string().optional(),
    ANTHROPIC_MAX_TOKENS: z.string().optional(),
    ANTHROPIC_BETA: z.string().optional(),

    // OpenRouter
    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_SITE_URL: z.string().optional(),
    OPENROUTER_SITE_NAME: z.string().optional(),
    OPENROUTER_APP_URL: z.string().optional(),
    OPENROUTER_APP_NAME: z.string().optional(),

    // Logging
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),
    DEBUG_MINIFY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * Validates and returns environment variables with caching
 * @throws {Error} If validation fails with detailed error messages
 */
export function validateEnv(): Env {
    if (cachedEnv) {
        return cachedEnv;
    }

    try {
        cachedEnv = envSchema.parse(process.env);
        return cachedEnv;
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessage = error.issues
                .map((err) => `  - ${err.path.join(".")}: ${err.message}`)
                .join("\n");

            throw new Error(
                `Environment validation failed:\n${errorMessage}\n\nPlease check your .env file.`
            );
        }
        throw error;
    }
}

/**
 * Gets validated environment variables (singleton pattern)
 */
export function getEnv(): Env {
    return validateEnv();
}

/**
 * Clears the cached environment (useful for testing)
 */
export function clearEnvCache(): void {
    cachedEnv = null;
}
