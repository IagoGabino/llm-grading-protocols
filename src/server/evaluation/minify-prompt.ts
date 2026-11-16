/**
 * Remove formatação Markdown desnecessária do prompt para economizar tokens.
 * A LLM entende o conteúdo sem precisar de decoração visual.
 *
 * Estratégias de otimização:
 * - Remove code fences (```)
 * - Remove bold/italic (**text**, *text*)
 * - Remove headers (##, ###)
 * - Colapsa múltiplas quebras de linha em texto
 * - MINIFICA código: remove indentação e quebras de linha extras
 * - MINIFICA JSON: compacta para uma linha só
 * - PRESERVA delimitadores de seção ([QUESTÃO], [RUBRICA])
 * - PRESERVA backticks inline para código (`sum()`)
 *
 * @param text - Texto do prompt com Markdown
 * @returns Texto minificado sem formatação desnecessária
 */
export function minifyPromptForLLM(text: string): string {
    // Função auxiliar para minificar código
    const minifyCode = (code: string): string => {
        return code
            .split("\n")
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0)
            .join(" ")
            .replace(/\s*{\s*/g, "{")
            .replace(/\s*}\s*/g, "}")
            .replace(/\s*;\s*/g, ";")
            .replace(/\s*,\s*/g, ",")
            .replace(/\s*\(\s*/g, "(")
            .replace(/\s*\)\s*/g, ")")
            .replace(/\s+=>\s*/g, "=>")
            .replace(/\s+/g, " ");
    };

    // Extrai e minifica blocos de código com fences
    const codeBlocks: string[] = [];
    let processed = text.replace(/```[\w]*\n([\s\S]*?)```/g, (match, code) => {
        const placeholder = `__CODE_${codeBlocks.length}__`;
        codeBlocks.push(minifyCode(code));
        return placeholder;
    });

    // Minifica código na seção [RESPOSTA DO ALUNO] (pode vir sem code fences)
    processed = processed.replace(
        /(\[RESPOSTA DO ALUNO\]\s*)([\s\S]*?)(?=\n\[|$)/g,
        (match, prefix, content) => {
            // Procura blocos que parecem código (linhas com { } ; () etc)
            const minifiedContent = content.replace(
                /(Resposta principal:|Raciocínio do aluno:|Trecho de código enviado:)([\s\S]*?)(?=\n(?:Raciocínio|Trecho|$))/g,
                (_match: string, label: string, code: string) => {
                    // Se tem caracteres de código ({ } ; etc), minifica
                    if (/[{};()=>]/.test(code)) {
                        return label + minifyCode(code);
                    }
                    // Senão, mantém original
                    return label + code;
                }
            );
            return prefix + minifiedContent;
        }
    );

    // Extrai e minifica JSON
    const jsonBlocks: string[] = [];
    processed = processed.replace(/(\[RUBRICA\]\s*)(\{[\s\S]*?\n\})/g, (match, prefix, json) => {
        const placeholder = `${prefix}__JSON_${jsonBlocks.length}__`;
        // Minifica JSON: remove espaços e quebras de linha
        try {
            const parsed = JSON.parse(json);
            const minified = JSON.stringify(parsed); // compacta tudo em uma linha
            jsonBlocks.push(minified);
        } catch {
            // Se falhar o parse, usa original
            jsonBlocks.push(json);
        }
        return placeholder;
    });

    // Minifica texto normal (não código/JSON)
    processed = processed
        // Remove bold (**text**)
        .replace(/\*\*([^*]+)\*\*/g, "$1")

        // Remove italic (*text*) mas preserva * em listas
        .replace(/(?<!\n)\*([^*\n]+)\*/g, "$1")

        // Remove headers (## Title → Title)
        .replace(/^#+\s+(.+)$/gm, "$1")

        // Colapsa múltiplas quebras de linha (mantém no máximo 2)
        .replace(/\n{3,}/g, "\n\n")

        // Remove espaços/tabs no início e fim de cada linha
        .replace(/^[ \t]+|[ \t]+$/gm, "")

        // Remove múltiplos espaços dentro da linha
        .replace(/[ \t]{2,}/g, " ")

        // Remove linhas vazias no início e fim
        .trim();

    // Restaura blocos de código minificados
    codeBlocks.forEach((code, i) => {
        processed = processed.replace(`__CODE_${i}__`, code);
    });

    // Restaura blocos JSON minificados
    jsonBlocks.forEach((json, i) => {
        processed = processed.replace(`__JSON_${i}__`, json);
    });

    return processed;
}
