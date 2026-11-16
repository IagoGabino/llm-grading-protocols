import fs from "node:fs/promises";
import path from "node:path";

import { getQuestionBySlug, type QuestionData } from "@/lib/question-loader";

import {
    loadAndValidateReferenceAnswers,
    loadReferenceAnswerFile,
    validateReferenceAnswerFiles,
    type LoadedReferenceAnswerFile,
    type ReferenceAnswer as SourceReferenceAnswer,
    type ReferenceAnswerValidationMessage,
    type ReferenceAnswerValidationResult,
} from "../reference-answers";
import type { StudentAnswer } from "../strategies";

export type ValidatedReferenceInput = {
    question: QuestionData;
    referenceAnswer: SourceReferenceAnswer;
    candidateAnswer: StudentAnswer;
    sourcePath?: string;
};

export class ReferenceInputError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "ReferenceInputError";
    }
}

export async function loadValidatedReferenceInputs(
    sourcePath: string
): Promise<{
    inputs: ValidatedReferenceInput[];
    validation: ReferenceAnswerValidationResult;
}> {
    const validation = await loadReferenceAnswersForRunner(sourcePath);
    if (validation.errors.length > 0) {
        throw new ReferenceInputError(
            [
                "Reference answers are invalid. No strategy execution was started.",
                formatValidationMessages(validation.errors),
            ].join("\n")
        );
    }

    if (validation.answers.length === 0) {
        throw new ReferenceInputError(
            "No reference answers were found. The runner expects YAML files under experiments/reference-answers/final/ by default."
        );
    }

    const pathByAnswerId = buildPathByAnswerId(validation.files);
    const inputs: ValidatedReferenceInput[] = [];

    for (const referenceAnswer of validation.answers) {
        const question = await getQuestionBySlug(referenceAnswer.questionSlug);
        if (!question) {
            throw new ReferenceInputError(
                `Question disappeared after validation: ${referenceAnswer.questionSlug}`
            );
        }

        inputs.push({
            question,
            referenceAnswer,
            candidateAnswer: referenceAnswerToCandidateAnswer(referenceAnswer, question),
            sourcePath: pathByAnswerId.get(referenceAnswer.id),
        });
    }

    return { inputs, validation };
}

export function referenceAnswerToCandidateAnswer(
    answer: SourceReferenceAnswer,
    question?: QuestionData
): StudentAnswer {
    if (question?.meta.inputConfig?.type === "multi-section" && answer.answerText?.trim()) {
        return {
            kind: "student",
            resposta: JSON.stringify(
                answerTextToMultiSectionResponse(answer.answerText, question),
                null,
                2
            ),
            raciocinio: answer.justification ?? "",
            ...toSupportedLanguage(answer.language),
        };
    }

    return {
        kind: "student",
        resposta: answer.answerText ?? "",
        raciocinio: answer.justification ?? "",
        ...(answer.code !== undefined && { codigo: answer.code }),
        ...toSupportedLanguage(answer.language),
    };
}

function answerTextToMultiSectionResponse(
    answerText: string,
    question: QuestionData
): Record<string, string> {
    const sectionIds = question.meta.inputConfig?.sections?.map((section) => section.id) ?? [];
    const parsedSections = splitMarkdownSections(answerText);
    const result: Record<string, string> = {};

    for (const [index, sectionId] of sectionIds.entries()) {
        result[sectionId] = parsedSections[index] ?? "";
    }

    if (Object.values(result).every((value) => value.trim().length === 0) && sectionIds[0]) {
        result[sectionIds[0]] = answerText.trim();
    }

    return result;
}

function splitMarkdownSections(answerText: string): string[] {
    const sections: string[] = [];
    let current: string[] = [];

    for (const line of answerText.replace(/\r\n/g, "\n").split("\n")) {
        if (/^#{2,6}\s+\S/.test(line)) {
            if (current.join("\n").trim()) {
                sections.push(current.join("\n").trim());
            }
            current = [];
            continue;
        }

        current.push(line);
    }

    if (current.join("\n").trim()) {
        sections.push(current.join("\n").trim());
    }

    return sections;
}

async function loadReferenceAnswersForRunner(
    sourcePath: string
): Promise<ReferenceAnswerValidationResult> {
    if (path.extname(sourcePath).toLowerCase() !== ".json") {
        return loadAndValidateReferenceAnswers(sourcePath);
    }

    const manifest = await loadManifest(sourcePath);
    const files: LoadedReferenceAnswerFile[] = [];
    const loadErrors = [];

    for (const filePath of manifest.files) {
        const loaded = await loadReferenceAnswerFile(filePath);
        files.push(...loaded.files);
        loadErrors.push(...loaded.errors);
    }

    return validateReferenceAnswerFiles(files, { loadErrors });
}

async function loadManifest(manifestPath: string): Promise<{ files: string[] }> {
    const absolutePath = path.resolve(manifestPath);
    let raw: string;
    try {
        raw = await fs.readFile(absolutePath, "utf8");
    } catch (error) {
        throw new ReferenceInputError(
            `Could not read reference answer manifest: ${
                error instanceof Error ? error.message : String(error)
            }`,
            error instanceof Error ? { cause: error } : undefined
        );
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        throw new ReferenceInputError(
            `Reference answer manifest must be valid JSON: ${
                error instanceof Error ? error.message : String(error)
            }`,
            error instanceof Error ? { cause: error } : undefined
        );
    }

    const files = Array.isArray(parsed)
        ? parsed
        : typeof parsed === "object" && parsed !== null && "files" in parsed
          ? (parsed as { files?: unknown }).files
          : undefined;

    if (!Array.isArray(files) || !files.every((item) => typeof item === "string")) {
        throw new ReferenceInputError(
            'Reference answer manifest must be either an array of file paths or an object with a "files" string array.'
        );
    }

    const baseDir = path.dirname(absolutePath);
    return {
        files: files.map((filePath) => path.resolve(baseDir, filePath)),
    };
}

function buildPathByAnswerId(files: LoadedReferenceAnswerFile[]): Map<string, string> {
    const result = new Map<string, string>();

    for (const file of files) {
        for (const answer of file.data.answers) {
            result.set(answer.id, file.path);
        }
    }

    return result;
}

function toSupportedLanguage(language: string | undefined): Pick<StudentAnswer, "language"> {
    if (language === "javascript" || language === "python" || language === "java") {
        return { language };
    }

    return {};
}

function formatValidationMessages(messages: ReferenceAnswerValidationMessage[]): string {
    return messages
        .map((message) => {
            const parts = [message.path, message.questionSlug, message.answerId].filter(Boolean);
            const location = parts.length > 0 ? `${parts.join(" | ")}: ` : "";
            return `- [${message.code}] ${location}${message.message}`;
        })
        .join("\n");
}
