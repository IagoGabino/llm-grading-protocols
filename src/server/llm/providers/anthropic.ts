import axios, { isAxiosError } from "axios";

import { evaluationResponseJsonSchema } from "@/server/evaluation/response-json-schema";

import type { LLMMessage, LLMProvider } from "../types";

/**
 * Provider Anthropic Claude com JSON Mode melhorado.
 *
 * Implementa as melhores práticas da Anthropic para garantir outputs estruturados:
 *
 * 1. **System Prompt Detalhado**: Inclui schema JSON completo com exemplos e regras
 * 2. **Prefilling**: Adiciona "{" como resposta do assistant para forçar formato JSON imediatamente,
 *    evitando o "preamble amigável" do Claude (ex: "Claro! Aqui está o JSON...")
 * 3. **Validação Rigorosa**: Schema com additionalProperties: false e tipos estritos
 *
 * Referências:
 * - https://docs.anthropic.com/en/docs/build-with-claude/tool-use#json-mode
 * - Prefilling: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/prefill-claudes-response
 */

type ClaudeMessage = {
    role: "user" | "assistant";
    content: Array<{ type: "text"; text: string }>;
};

const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const DEFAULT_MODEL = "claude-haiku-4-5";
const DEFAULT_MAX_TOKENS = 1200;

const JSON_MODE_SYSTEM_INSTRUCTION = buildJsonModeInstruction();

export function createAnthropicProvider(): LLMProvider {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY não configurada.");
    }

    const model = process.env.LLM_MODEL ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
    const maxTokens = parseInteger(process.env.ANTHROPIC_MAX_TOKENS, DEFAULT_MAX_TOKENS);
    const version = process.env.ANTHROPIC_VERSION ?? "2023-06-01";
    const beta = process.env.ANTHROPIC_BETA;

    const client = axios.create({
        baseURL: ANTHROPIC_BASE_URL,
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": version,
            ...(beta ? { "anthropic-beta": beta } : {}),
        },
    });

    return {
        name: "anthropic",
        async invoke(messages, options) {
            const { system, conversation } = transformMessages(
                messages,
                JSON_MODE_SYSTEM_INSTRUCTION
            );

            try {
                const response = await client.post(
                    "/messages",
                    {
                        model,
                        max_tokens: maxTokens,
                        system,
                        messages: conversation,
                    },
                    {
                        timeout: options?.timeoutMs,
                        signal: options?.signal,
                    }
                );

                const output = extractAnthropicText(response.data);
                if (!output) {
                    throw new Error("Claude retornou conteúdo vazio ou incompatível.");
                }

                return {
                    output,
                    model: response.data?.model ?? model,
                };
            } catch (error) {
                throw normalizeAnthropicError(error);
            }
        },
    };
}

function transformMessages(
    messages: LLMMessage[],
    jsonModeInstruction: string
): { system?: string; conversation: ClaudeMessage[] } {
    const systemParts: string[] = jsonModeInstruction ? [jsonModeInstruction] : [];
    const conversation: ClaudeMessage[] = [];

    for (const message of messages) {
        if (message.role === "system") {
            if (message.content.trim()) {
                systemParts.push(message.content.trim());
            }
            continue;
        }

        conversation.push({
            role: message.role,
            content: [{ type: "text", text: message.content }],
        });
    }

    if (conversation.length === 0) {
        throw new Error("É necessário enviar pelo menos uma mensagem de usuário para o Claude.");
    }

    if (conversation[0]?.role !== "user") {
        throw new Error("O primeiro turno enviado ao Claude deve ser do usuário.");
    }

    // Prefilling: adiciona início da resposta do assistant para forçar formato JSON
    // Isso "bypassa" o preamble amigável do Claude e força estrutura imediatamente
    conversation.push({
        role: "assistant",
        content: [{ type: "text", text: "{" }],
    });

    const system = systemParts.length > 0 ? systemParts.join("\n\n") : undefined;
    return { system, conversation };
}

function extractAnthropicText(payload: unknown): string {
    if (!payload || typeof payload !== "object" || !("content" in payload)) {
        return "";
    }

    const data = payload as { content?: Array<{ type?: string; text?: string }> };
    const blocks = Array.isArray(data.content) ? data.content : [];

    const text = blocks
        .map((block) =>
            block?.type === "text" && typeof block.text === "string" ? block.text : ""
        )
        .join("\n")
        .trim();

    // Adiciona a chave de abertura que foi prefilled se não estiver presente
    // Isso garante que o JSON seja válido mesmo após o prefilling
    if (text && !text.startsWith("{")) {
        return "{" + text;
    }

    return text;
}

function normalizeAnthropicError(error: unknown): Error {
    if (isAxiosError(error)) {
        if (error.code === "ERR_CANCELED") {
            return new Error("Operação abortada");
        }

        const status = error.response?.status;
        const responseData = error.response?.data as
            | { error?: { message?: string } | string; message?: string }
            | undefined;
        const detail =
            typeof responseData?.error === "string"
                ? responseData.error
                : (responseData?.error?.message ?? responseData?.message);

        const messageParts = ["Falha ao chamar Claude"];
        if (status) {
            messageParts.push(`(status ${status})`);
        }
        if (detail) {
            messageParts.push(`- ${detail}`);
        }
        return new Error(messageParts.join(" "));
    }

    if (error instanceof Error) return error;
    return new Error("Erro desconhecido ao acessar Claude");
}

function parseInteger(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

function buildJsonModeInstruction(): string {
    const schemaString = JSON.stringify(evaluationResponseJsonSchema.schema, null, 2);
    return [
        "JSON_MODE=STRICT — produza apenas JSON válido, sem texto extra ou Markdown.",
        "Siga exatamente o schema abaixo (campos adicionais são proibidos):",
        schemaString,
        'Se algum campo não puder ser preenchido, use valores permitidos (ex.: 0, "", []).',
    ].join("\n");
}
