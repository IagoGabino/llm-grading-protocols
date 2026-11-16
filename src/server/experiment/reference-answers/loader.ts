import fs from "node:fs/promises";
import path from "node:path";
import { parseDocument } from "yaml";
import {
    referenceAnswerFileSchema,
    type ReferenceAnswer,
    type ReferenceAnswerFile,
} from "./schema";

export const DEFAULT_REFERENCE_ANSWERS_DIR = path.join(
    process.cwd(),
    "experiments",
    "reference-answers",
    "drafts"
);

export type LoadedReferenceAnswerFile = {
    path: string;
    filenameSlug: string;
    data: ReferenceAnswerFile;
};

export type ReferenceAnswerLoadError = {
    path: string;
    message: string;
};

export type ReferenceAnswerLoadResult = {
    sourcePath: string;
    files: LoadedReferenceAnswerFile[];
    errors: ReferenceAnswerLoadError[];
};

function isYamlFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === ".yaml" || ext === ".yml";
}

function formatSchemaError(error: unknown): string {
    if (typeof error !== "object" || error === null || !("issues" in error)) {
        return "YAML does not match the reference answer file schema.";
    }

    const issues = (error as { issues?: Array<{ path: Array<string | number>; message: string }> })
        .issues;

    if (!issues || issues.length === 0) {
        return "YAML does not match the reference answer file schema.";
    }

    return issues
        .map((issue) => {
            const issuePath = issue.path.length > 0 ? issue.path.join(".") : "<root>";
            return `${issuePath}: ${issue.message}`;
        })
        .join("; ");
}

export async function loadReferenceAnswerFile(
    filePath: string
): Promise<ReferenceAnswerLoadResult> {
    const absolutePath = path.resolve(filePath);
    const result: ReferenceAnswerLoadResult = {
        sourcePath: absolutePath,
        files: [],
        errors: [],
    };

    if (!isYamlFile(absolutePath)) {
        return result;
    }

    let raw: string;
    try {
        raw = await fs.readFile(absolutePath, "utf8");
    } catch (error) {
        result.errors.push({
            path: absolutePath,
            message: `Could not read YAML file: ${error instanceof Error ? error.message : String(error)}`,
        });
        return result;
    }

    try {
        const document = parseDocument(raw, { prettyErrors: false });
        if (document.errors.length > 0) {
            result.errors.push({
                path: absolutePath,
                message: `Invalid YAML: ${document.errors.map((error) => error.message).join("; ")}`,
            });
            return result;
        }

        const parsed = referenceAnswerFileSchema.safeParse(document.toJSON());
        if (!parsed.success) {
            result.errors.push({
                path: absolutePath,
                message: formatSchemaError(parsed.error),
            });
            return result;
        }

        result.files.push({
            path: absolutePath,
            filenameSlug: path.basename(absolutePath, path.extname(absolutePath)),
            data: parsed.data,
        });
    } catch (error) {
        result.errors.push({
            path: absolutePath,
            message: `Invalid YAML: ${error instanceof Error ? error.message : String(error)}`,
        });
    }

    return result;
}

export async function loadReferenceAnswerFiles(
    sourcePath = DEFAULT_REFERENCE_ANSWERS_DIR
): Promise<ReferenceAnswerLoadResult> {
    const absolutePath = path.resolve(sourcePath);
    const result: ReferenceAnswerLoadResult = {
        sourcePath: absolutePath,
        files: [],
        errors: [],
    };

    let stats;
    try {
        stats = await fs.stat(absolutePath);
    } catch (error) {
        result.errors.push({
            path: absolutePath,
            message: `Path does not exist or cannot be read: ${
                error instanceof Error ? error.message : String(error)
            }`,
        });
        return result;
    }

    if (stats.isFile()) {
        return loadReferenceAnswerFile(absolutePath);
    }

    if (!stats.isDirectory()) {
        result.errors.push({
            path: absolutePath,
            message: "Path is neither a YAML file nor a directory.",
        });
        return result;
    }

    let entries;
    try {
        entries = await fs.readdir(absolutePath, { withFileTypes: true });
    } catch (error) {
        result.errors.push({
            path: absolutePath,
            message: `Could not read directory: ${error instanceof Error ? error.message : String(error)}`,
        });
        return result;
    }

    const yamlFiles = entries
        .filter((entry) => entry.isFile() && isYamlFile(entry.name))
        .map((entry) => path.join(absolutePath, entry.name))
        .sort((a, b) => a.localeCompare(b));

    for (const yamlFile of yamlFiles) {
        const loaded = await loadReferenceAnswerFile(yamlFile);
        result.files.push(...loaded.files);
        result.errors.push(...loaded.errors);
    }

    return result;
}

export function flattenReferenceAnswers(files: LoadedReferenceAnswerFile[]): ReferenceAnswer[] {
    return files.flatMap((file) =>
        file.data.answers.map((answer) => ({
            ...answer,
            questionSlug: file.data.questionSlug,
        }))
    );
}

export async function loadReferenceAnswers(
    sourcePath = DEFAULT_REFERENCE_ANSWERS_DIR
): Promise<ReferenceAnswerLoadResult & { answers: ReferenceAnswer[] }> {
    const result = await loadReferenceAnswerFiles(sourcePath);
    return {
        ...result,
        answers: flattenReferenceAnswers(result.files),
    };
}

