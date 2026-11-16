type ParseSuccess<T> = {
    success: true;
    data: T;
    raw: string;
};

type ParseFailure = {
    success: false;
    error: Error;
    raw: string;
};

export type JsonParseResult<T> = ParseSuccess<T> | ParseFailure;

export function parseLLMJson<T>(payload: string): JsonParseResult<T> {
    const attempts = buildCandidates(payload);
    for (const candidate of attempts) {
        try {
            const parsed = JSON.parse(candidate) as T;
            return { success: true, data: parsed, raw: candidate };
        } catch (error) {
            // tenta próximo candidato
            if (attempts[attempts.length - 1] === candidate) {
                return {
                    success: false,
                    error: error instanceof Error ? error : new Error("Falha ao parsear JSON"),
                    raw: candidate,
                };
            }
        }
    }
    return {
        success: false,
        error: new Error("Nenhum candidato de JSON pôde ser gerado"),
        raw: payload,
    };
}

function buildCandidates(payload: string): string[] {
    const raw = payload?.toString() ?? "";
    const trimmed = raw.trim();
    const withoutFences = trimmed
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();
    const withoutAllFences = withoutFences.replace(/```[\s\S]*?```/g, "").trim();

    const extracted =
        extractFirstObject(trimmed) ??
        extractFirstObject(withoutFences) ??
        extractFirstObject(withoutAllFences);

    const candidates = [trimmed, withoutFences, withoutAllFences, extracted].filter(
        (candidate): candidate is string => Boolean(candidate)
    );

    const repairedCandidates = candidates
        .map((candidate) => candidate.replace(/,\s*([}\]])/g, "$1"))
        .map((candidate) => candidate.replace(/^[^\[{]+/, "").replace(/[^\]}]+$/, ""));

    return dedupe([...candidates, ...repairedCandidates].filter(Boolean));
}

function extractFirstObject(content: string): string | undefined {
    const start = content.indexOf("{");
    if (start === -1) return undefined;
    let depth = 0;
    for (let i = start; i < content.length; i += 1) {
        const char = content[i];
        if (char === "{") depth += 1;
        else if (char === "}") {
            depth -= 1;
            if (depth === 0) {
                return content.slice(start, i + 1);
            }
        }
    }
    return undefined;
}

function dedupe(values: string[]): string[] {
    return Array.from(new Set(values));
}
