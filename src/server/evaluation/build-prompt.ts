import fs from "node:fs/promises";
import path from "node:path";
import Mustache from "mustache";

import { getQuestionBySlug, type QuestionData } from "@/lib/question-loader";
import { createContextLogger } from "@/server/observability/logger";
import type { LLMMessage } from "@/server/llm/types";

import type { EvaluationRequestInput } from "./schemas";
import { minifyPromptForLLM } from "./minify-prompt";

const PROMPTS_ROOT = path.join(process.cwd(), "prompts");

const DEFAULT_SYSTEM_PROMPT = [
    "Você é um avaliador técnico especializado em Engenharia de Software.",
    "Siga fielmente a rubrica da questão, atribuindo notas numéricas.",
    "Responda ESTRITAMENTE com JSON válido; não escreva texto fora do JSON.",
    "Se o aluno não respondeu, use notas mínimas e explique no feedback.",
].join(" ");

type PromptTemplateInfo = {
    name: string;
    axis?: string;
    absolutePath: string;
};

export type PromptBuildResult = {
    question: QuestionData;
    template: PromptTemplateInfo;
    messages: LLMMessage[];
};

type BuildPromptParams = {
    slug: string;
    input: EvaluationRequestInput;
    promptVariantInstruction?: string;
};

export async function buildEvaluationPrompt({
    slug,
    input,
    promptVariantInstruction,
}: BuildPromptParams): Promise<PromptBuildResult> {
    const question = await getQuestionBySlug(slug);
    if (!question) {
        throw new Error(`Questão com slug "${slug}" não encontrada`);
    }

    const templateInfo = await resolvePromptTemplate(question);
    const templateContent = await fs.readFile(templateInfo.absolutePath, "utf8");

    const enunciado = normalizeMultiline(question.sections.statement);
    const pontosEsperados =
        normalizeMultiline(question.sections["solution-outline"]) ||
        normalizeMultiline(question.sections["solution_outline"]) ||
        "Pontos esperados não documentados.";
    const rubricBlock = stringifyRubric(question.meta.rubric);
    const respostaDoAluno = buildStudentAnswerBlock(input);

    // Preparar variáveis para o template Mustache
    const templateVars: Record<string, string> = {
        enunciado: enunciado || "Enunciado indisponível para esta questão.",
        rubrica: rubricBlock,
        pontos_esperados: pontosEsperados,
        resposta: respostaDoAluno,
        codigo: input.codigo?.trim() || "",
        raciocinio: input.raciocinio?.trim() || "",
    };

    // Se for questão multi-section, parsear JSON da resposta e adicionar seções individuais
    if (question.meta.inputConfig?.type === "multi-section") {
        try {
            const parsedResposta = JSON.parse(input.resposta);
            // Adicionar cada seção como variável individual para o Mustache
            for (const [key, value] of Object.entries(parsedResposta)) {
                if (typeof value === "string") {
                    templateVars[key] = value;
                }
            }
        } catch (error) {
            // Se falhar o parse, manter apenas a resposta unificada
            const logger = createContextLogger("eval/build-prompt");
            logger.warn(
                { slug: question.meta.slug, error },
                "Failed to parse multi-section response as JSON, using unified response"
            );
        }
    }

    const filledTemplate = appendPromptVariantInstruction(
        Mustache.render(templateContent, templateVars),
        promptVariantInstruction
    );

    // Minifica o prompt para economizar tokens (remove markdown desnecessário)
    const minifiedPrompt = minifyPromptForLLM(filledTemplate);

    // DEBUG: Salvar comparação antes/depois da minificação (apenas em dev quando DEBUG_MINIFY=true)
    if (process.env.NODE_ENV === "development" && process.env.DEBUG_MINIFY === "true") {
        const logger = createContextLogger("eval/build-prompt");
        const fs_debug = await import("fs/promises");
        const path_debug = await import("path");
        const debugDir = path_debug.join(process.cwd(), "debug");
        await fs_debug.mkdir(debugDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

        const comparison = {
            timestamp: new Date().toISOString(),
            slug,
            stats: {
                before: {
                    length: filledTemplate.length,
                    lines: filledTemplate.split("\n").length,
                },
                after: {
                    length: minifiedPrompt.length,
                    lines: minifiedPrompt.split("\n").length,
                },
                reduction: {
                    characters: filledTemplate.length - minifiedPrompt.length,
                    percentage:
                        (
                            ((filledTemplate.length - minifiedPrompt.length) /
                                filledTemplate.length) *
                            100
                        ).toFixed(1) + "%",
                },
            },
            before: filledTemplate,
            after: minifiedPrompt,
        };

        const debugFile = path_debug.join(debugDir, `minify-comparison-${timestamp}.json`);
        await fs_debug.writeFile(debugFile, JSON.stringify(comparison, null, 2), "utf-8");

        logger.debug(
            {
                slug,
                reduction: comparison.stats.reduction,
                debugFile,
            },
            "Comparação de minificação salva"
        );
    }

    const messages: LLMMessage[] = [
        { role: "system", content: DEFAULT_SYSTEM_PROMPT },
        { role: "user", content: minifiedPrompt },
    ];

    // LOG: Debug do prompt final sendo enviado ao LLM
    const logger = createContextLogger("eval/build-prompt");

    // Salvar prompt em arquivo JSON para debug
    if (process.env.NODE_ENV === "development") {
        const fs_debug = await import("fs/promises");
        const path_debug = await import("path");
        const debugDir = path_debug.join(process.cwd(), "debug");
        await fs_debug.mkdir(debugDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

        const promptDebug = {
            timestamp: new Date().toISOString(),
            slug,
            template: {
                name: templateInfo.name,
                axis: templateInfo.axis,
                path: templateInfo.absolutePath,
            },
            messages: {
                system: DEFAULT_SYSTEM_PROMPT,
                user: minifiedPrompt,
            },
            stats: {
                systemLength: DEFAULT_SYSTEM_PROMPT.length,
                userLength: minifiedPrompt.length,
                totalLength: DEFAULT_SYSTEM_PROMPT.length + minifiedPrompt.length,
            },
        };

        const debugFile = path_debug.join(debugDir, `prompt-${slug}-${timestamp}.json`);
        await fs_debug.writeFile(debugFile, JSON.stringify(promptDebug, null, 2), "utf-8");

        logger.info(
            {
                slug,
                templateName: templateInfo.name,
                debugFile,
            },
            "🔍 Prompt salvo em arquivo para debug"
        );
    }

    return {
        question,
        template: templateInfo,
        messages,
    };
}

async function resolvePromptTemplate(question: QuestionData): Promise<PromptTemplateInfo> {
    const axis = question.meta.axis;
    const templateName = question.meta.promptTemplate ?? question.meta.slug ?? question.meta.id;
    const slugFallback = question.meta.slug ?? question.meta.id;

    const candidatePaths = dedupe(
        [
            axis && templateName ? path.join(axis, `${templateName}.txt`) : null,
            axis && slugFallback ? path.join(axis, `${slugFallback}.txt`) : null,
            templateName ? `${templateName}.txt` : null,
            slugFallback ? `${slugFallback}.txt` : null,
        ]
            .filter((item): item is string => Boolean(item))
            .map((relative) => path.join(PROMPTS_ROOT, relative))
    );

    for (const candidate of candidatePaths) {
        try {
            await fs.access(candidate);
            return {
                name: path.basename(candidate, ".txt"),
                axis,
                absolutePath: candidate,
            };
        } catch {
            // tenta próxima opção
        }
    }

    throw new Error(
        `Template de prompt não encontrado para a questão "${slugFallback}". Verifique os arquivos em /prompts`
    );
}

function dedupe(items: string[]): string[] {
    return Array.from(new Set(items));
}

function normalizeMultiline(value?: string): string {
    if (!value || typeof value !== "string") return "";
    // Decodifica entidades HTML antes de usar
    const decoded = decodeHtmlEntities(value);
    return decoded.replace(/\r\n/g, "\n").trim();
}

function decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
        "&quot;": '"',
        "&#x60;": "`",
        "&#x3D;": "=",
        "&#x2F;": "/",
        "&lt;": "<",
        "&gt;": ">",
        "&amp;": "&",
        "&#39;": "'",
        "&#x27;": "'",
    };

    return (
        text
            // Hex entities COM e SEM ponto e vírgula
            .replace(/&#x([0-9A-Fa-f]+);?/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
            // Decimal entities COM e SEM ponto e vírgula
            .replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
            // Named entities
            .replace(/&[a-z]+;/gi, (entity) => entities[entity] || entity)
    );
}

function stringifyRubric(rubric: unknown): string {
    if (!rubric) return "Rubrica não disponível.";
    try {
        return JSON.stringify(rubric, null, 2);
    } catch {
        return "Rubrica não pôde ser serializada.";
    }
}

function appendPromptVariantInstruction(template: string, instruction: string | undefined): string {
    const normalizedInstruction = instruction?.trim();
    if (!normalizedInstruction) return template;

    return [
        template.trimEnd(),
        "",
        "[MODO DE AVALIACAO DESTA CHAMADA]",
        normalizedInstruction,
    ].join("\n");
}

function buildStudentAnswerBlock(input: EvaluationRequestInput): string {
    const blocks: string[] = [];

    // Para questões de código: usar campo 'codigo'
    // Para questões de arquitetura/texto: usar campo 'resposta'
    if (input.codigo?.trim()) {
        blocks.push(`Código do aluno:\n${input.codigo.trim()}`);
    } else if (input.resposta?.trim()) {
        blocks.push(`Resposta do aluno:\n${input.resposta.trim()}`);
    }

    if (input.raciocinio?.trim()) {
        blocks.push(`Raciocínio do aluno:\n${input.raciocinio.trim()}`);
    }

    return blocks.join("\n\n");
}
