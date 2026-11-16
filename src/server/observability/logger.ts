import pino from "pino";

/**
 * Logger estruturado para o servidor
 *
 * Utiliza pino para logging performático e estruturado
 * Configuração simplificada compatível com Next.js/Turbopack
 */
export const logger = pino({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
    formatters: {
        level: (label) => ({ level: label }),
    },
    base: {
        env: process.env.NODE_ENV,
    },
});

/**
 * Helper para criar child logger com contexto específico
 *
 * @example
 * const apiLogger = createContextLogger('api/evaluate');
 * apiLogger.info({ slug, userId }, 'Iniciando avaliação');
 */
export function createContextLogger(context: string) {
    return logger.child({ context });
}
