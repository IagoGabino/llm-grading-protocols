import { z } from "zod";

/**
 * Schema Zod para validação de front matter de questões
 */

// Schema para rubric criterion
const rubricCriterionSchema = z.object({
    id: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    weight: z.number().min(0).max(1).optional(),
});

// Schema para rubric completo
const rubricSchema = z.object({
    criteria: z.array(rubricCriterionSchema),
});

// Schema para inputConfig (questões não-código)
const inputSectionSchema = z.object({
    id: z.string(),
    label: z.string(),
    placeholder: z.string().optional(),
});

const inputConfigSchema = z.object({
    type: z.enum(["code", "form", "multi-section"]).optional(),
    // code: Editor de código (padrão)
    // form: Formulário simples
    // multi-section: Múltiplas seções de texto (ex: questões de arquitetura)
    sections: z.array(inputSectionSchema).optional(),
});

// Schema principal para front matter
export const questionMetaSchema = z.object({
    id: z.string(),
    slug: z.string().optional(),
    title: z.string(),
    axis: z
        .enum(["codeQuality", "bugFix", "tests", "design", "architecture"])
        .or(z.string())
        .optional(),
    subtheme: z.string().optional(),
    difficulty: z.enum(["easy", "intermediate", "hard", "advanced"]).or(z.string()).optional(),
    promptTemplate: z.string().optional(),
    supportedLanguages: z.array(z.string()).optional(), // Pode incluir 'none' para questões sem código
    defaultLanguage: z.string().optional(),
    tags: z.array(z.string()).optional(),
    inputConfig: inputConfigSchema.optional(),
    rubric: rubricSchema.optional(),
});

// Tipos inferidos
export type QuestionMeta = z.infer<typeof questionMetaSchema>;
export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;
export type Rubric = z.infer<typeof rubricSchema>;
export type InputSection = z.infer<typeof inputSectionSchema>;
export type InputConfig = z.infer<typeof inputConfigSchema>;

/**
 * Valida e normaliza metadata de questão
 */
export function validateQuestionMeta(raw: unknown): QuestionMeta {
    const result = questionMetaSchema.safeParse(raw);

    if (!result.success) {
        // Log de erro estruturado
        console.error("Question metadata validation failed:", {
            errors: result.error.issues,
            raw,
        });

        // Tentar extrair pelo menos id e title para não quebrar
        const fallback = raw as Partial<QuestionMeta>;
        if (!fallback.id || !fallback.title) {
            throw new Error(`Invalid question metadata: missing required fields (id, title)`);
        }

        // Retornar versão parcialmente válida
        return {
            id: fallback.id,
            title: fallback.title,
            slug: fallback.slug,
            axis: fallback.axis,
            subtheme: fallback.subtheme,
            difficulty: fallback.difficulty,
            promptTemplate: fallback.promptTemplate,
            supportedLanguages: fallback.supportedLanguages,
            defaultLanguage: fallback.defaultLanguage,
            tags: fallback.tags,
            inputConfig: fallback.inputConfig,
            rubric: fallback.rubric,
        };
    }

    return result.data;
}
