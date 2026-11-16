import fs from "node:fs/promises";
import path from "node:path";
import {
    DEFAULT_REFERENCE_ANSWERS_DIR,
    loadAndValidateReferenceAnswers,
    referenceAnswerProfiles,
    relativeMessagePath,
    type ReferenceAnswerValidationMessage,
} from "../src/server/experiment/reference-answers";

const CANONICAL_AXES = ["bugFix", "codeQuality", "testing", "designArchitecture"] as const;

function displayPath(filePath: string): string {
    const relative = path.relative(process.cwd(), path.resolve(filePath));
    return relative || filePath;
}

function formatMessage(message: ReferenceAnswerValidationMessage): string {
    const parts = [
        message.path ? relativeMessagePath(message.path) : undefined,
        message.questionSlug,
        message.answerId,
    ].filter(Boolean);

    const location = parts.length > 0 ? `${parts.join(" | ")}: ` : "";
    return `- [${message.code}] ${location}${message.message}`;
}

async function defaultPathIsMissing(sourcePath: string): Promise<boolean> {
    try {
        await fs.stat(sourcePath);
        return false;
    } catch {
        return true;
    }
}

async function main(): Promise<void> {
    const requestedPath = process.argv[2];
    const sourcePath = requestedPath ?? DEFAULT_REFERENCE_ANSWERS_DIR;
    const usingDefaultPath = !requestedPath;

    console.log("Reference answers validation");
    console.log("");
    console.log(`Path: ${displayPath(sourcePath)}`);
    console.log("");

    if (usingDefaultPath && (await defaultPathIsMissing(sourcePath))) {
        console.log("Default drafts folder does not exist yet.");
        console.log("Create YAML drafts under experiments/reference-answers/drafts/ or pass a path.");
        console.log("");
        console.log("Files checked: 0");
        console.log("Questions checked: 0");
        console.log("Answers checked: 0");
        console.log("");
        console.log("Errors: 0");
        console.log("Warnings: 0");
        return;
    }

    const result = await loadAndValidateReferenceAnswers(sourcePath);

    console.log(`Files checked: ${result.summary.filesChecked}`);
    console.log(`Questions checked: ${result.summary.questionsChecked}`);
    console.log(`Answers checked: ${result.summary.answersChecked}`);
    console.log("");

    if (result.summary.filesChecked === 0 && result.errors.length === 0) {
        console.log("No YAML files found at this path.");
        console.log("");
    }

    const axisEntries = CANONICAL_AXES.map((axis) => [axis, result.summary.axes[axis] ?? 0] as const);
    const hasAxisData = Object.values(result.summary.axes).some((count) => (count ?? 0) > 0);
    if (hasAxisData) {
        console.log("By axis:");
        for (const [axis, count] of axisEntries) {
            console.log(`- ${axis}: ${count}`);
        }

        for (const [axis, count] of Object.entries(result.summary.axes)) {
            if (!CANONICAL_AXES.includes(axis as (typeof CANONICAL_AXES)[number])) {
                console.log(`- ${axis}: ${count}`);
            }
        }
        console.log("");
    }

    console.log(result.summary.filesChecked === 1 ? "Profiles:" : "By profile:");
    for (const profile of referenceAnswerProfiles) {
        console.log(`- ${profile}: ${result.summary.profiles[profile]}`);
    }
    console.log("");

    console.log(`Errors: ${result.errors.length}`);
    console.log(`Warnings: ${result.warnings.length}`);

    if (result.errors.length > 0) {
        console.log("");
        console.log("Error details:");
        for (const error of result.errors) {
            console.log(formatMessage(error));
        }
    }

    if (result.warnings.length > 0) {
        console.log("");
        console.log("Warning details:");
        for (const warning of result.warnings) {
            console.log(formatMessage(warning));
        }
    }

    if (result.errors.length > 0) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error("Reference answers validation failed unexpectedly.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
