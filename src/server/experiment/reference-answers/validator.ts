import path from "node:path";
import { getQuestionBySlug, type QuestionData } from "../../../lib/question-loader";
import {
    flattenReferenceAnswers,
    loadReferenceAnswerFiles,
    type LoadedReferenceAnswerFile,
    type ReferenceAnswerLoadError,
} from "./loader";
import {
    type ReferenceAnswer,
    type ReferenceAnswerProfile,
} from "./schema";

type ValidationSeverity = "error" | "warning";

export type ReferenceAnswerValidationMessage = {
    severity: ValidationSeverity;
    path?: string;
    questionSlug?: string;
    answerId?: string;
    code: string;
    message: string;
};

export type CanonicalAxis = "bugFix" | "codeQuality" | "testing" | "designArchitecture";

export type ReferenceAnswerValidationSummary = {
    filesChecked: number;
    questionsChecked: number;
    answersChecked: number;
    profiles: Record<ReferenceAnswerProfile, number>;
    axes: Partial<Record<CanonicalAxis | string, number>>;
};

export type ReferenceAnswerValidationResult = {
    files: LoadedReferenceAnswerFile[];
    answers: ReferenceAnswer[];
    summary: ReferenceAnswerValidationSummary;
    errors: ReferenceAnswerValidationMessage[];
    warnings: ReferenceAnswerValidationMessage[];
};

type QuestionCache = Map<string, QuestionData | null>;

function createProfileCounts(): Record<ReferenceAnswerProfile, number> {
    return {
        strong: 0,
        medium: 0,
        weak: 0,
        misleading: 0,
    };
}

function pushMessage(
    messages: ReferenceAnswerValidationMessage[],
    severity: ValidationSeverity,
    code: string,
    message: string,
    context: Omit<ReferenceAnswerValidationMessage, "severity" | "code" | "message"> = {}
): void {
    messages.push({
        severity,
        code,
        message,
        ...context,
    });
}

function normalizeAxis(axis: string | undefined): {
    axis?: CanonicalAxis | string;
    normalized: boolean;
} {
    if (!axis) return { normalized: false };
    if (axis === "bugFix" || axis === "codeQuality") return { axis, normalized: false };
    if (axis === "testing") return { axis: "testing", normalized: false };
    if (axis === "designArchitecture") return { axis: "designArchitecture", normalized: false };
    if (axis === "tests") return { axis: "testing", normalized: true };
    if (axis === "design" || axis === "architecture") {
        return { axis: "designArchitecture", normalized: true };
    }
    return { axis, normalized: false };
}

async function getCachedQuestion(
    questionSlug: string,
    cache: QuestionCache
): Promise<QuestionData | null> {
    if (cache.has(questionSlug)) return cache.get(questionSlug) ?? null;
    const question = await getQuestionBySlug(questionSlug);
    cache.set(questionSlug, question);
    return question;
}

function validateProfileMix(
    file: LoadedReferenceAnswerFile,
    errors: ReferenceAnswerValidationMessage[]
): void {
    const counts = createProfileCounts();
    for (const answer of file.data.answers) {
        counts[answer.profile] += 1;
    }

    const weakOrMisleading = counts.weak + counts.misleading;
    const context = { path: file.path, questionSlug: file.data.questionSlug };

    if (file.data.answers.length !== 3) {
        pushMessage(
            errors,
            "error",
            "file.answer_count",
            `Expected exactly 3 answers, found ${file.data.answers.length}.`,
            context
        );
    }

    if (counts.strong !== 1) {
        pushMessage(
            errors,
            "error",
            "file.profile_mix.strong",
            `Expected exactly 1 strong answer, found ${counts.strong}.`,
            context
        );
    }

    if (counts.medium !== 1) {
        pushMessage(
            errors,
            "error",
            "file.profile_mix.medium",
            `Expected exactly 1 medium answer, found ${counts.medium}.`,
            context
        );
    }

    if (weakOrMisleading !== 1) {
        pushMessage(
            errors,
            "error",
            "file.profile_mix.low",
            `Expected exactly 1 weak or misleading answer, found ${weakOrMisleading}.`,
            context
        );
    }
}

function validateFileIdentity(
    file: LoadedReferenceAnswerFile,
    errors: ReferenceAnswerValidationMessage[]
): void {
    const pathParts = file.path.split(/[\\/]+/);
    if (pathParts.includes("examples")) {
        return;
    }

    if (file.filenameSlug !== file.data.questionSlug) {
        pushMessage(
            errors,
            "error",
            "file.slug_filename_mismatch",
            `Filename slug "${file.filenameSlug}" does not match questionSlug "${file.data.questionSlug}".`,
            { path: file.path, questionSlug: file.data.questionSlug }
        );
    }
}

function validateDuplicateIdsWithinFile(
    file: LoadedReferenceAnswerFile,
    errors: ReferenceAnswerValidationMessage[]
): void {
    const seen = new Set<string>();
    for (const answer of file.data.answers) {
        if (seen.has(answer.id)) {
            pushMessage(
                errors,
                "error",
                "file.duplicate_answer_id",
                `Duplicate answer id "${answer.id}" in the same file.`,
                { path: file.path, questionSlug: file.data.questionSlug, answerId: answer.id }
            );
        }
        seen.add(answer.id);
    }
}

function expectedOverallRange(profile: ReferenceAnswerProfile): [number, number] {
    if (profile === "strong") return [4.0, 5.0];
    if (profile === "medium") return [2.5, 3.9];
    return [0.5, 2.9];
}

function validateExpectedOverallRange(
    answer: ReferenceAnswer,
    path: string,
    warnings: ReferenceAnswerValidationMessage[]
): void {
    const [min, max] = expectedOverallRange(answer.profile);
    if (answer.expectedOverall < min || answer.expectedOverall > max) {
        pushMessage(
            warnings,
            "warning",
            "answer.expected_overall_profile_range",
            `${answer.profile} answer has expectedOverall ${answer.expectedOverall}, outside the approximate ${min}-${max} range.`,
            { path, questionSlug: answer.questionSlug, answerId: answer.id }
        );
    }
}

function validateWeightedOverall(
    answer: ReferenceAnswer,
    question: QuestionData,
    filePath: string,
    warnings: ReferenceAnswerValidationMessage[]
): void {
    const criteria = question.meta.rubric?.criteria ?? [];
    if (criteria.length === 0 || !criteria.every((criterion) => typeof criterion.weight === "number")) {
        return;
    }

    const totalWeight = criteria.reduce((sum, criterion) => sum + (criterion.weight ?? 0), 0);
    if (totalWeight <= 0) return;

    const expectedScores = new Map(
        answer.expectedCriteria.map((criterion) => [criterion.criterionId, criterion.expectedScore])
    );

    const missingScore = criteria.some(
        (criterion) => !criterion.id || !expectedScores.has(criterion.id)
    );
    if (missingScore) return;

    const weighted = criteria.reduce((sum, criterion) => {
        const score = expectedScores.get(criterion.id ?? "") ?? 0;
        return sum + score * (criterion.weight ?? 0);
    }, 0);
    const calculated = weighted / totalWeight;
    const diff = Math.abs(calculated - answer.expectedOverall);

    if (diff > 0.25) {
        pushMessage(
            warnings,
            "warning",
            "answer.expected_overall_weighted_mismatch",
            `expectedOverall ${answer.expectedOverall} differs from weighted criteria score ${calculated.toFixed(
                2
            )} by ${diff.toFixed(2)}.`,
            { path: filePath, questionSlug: answer.questionSlug, answerId: answer.id }
        );
    }
}

function validateCriteriaAgainstRubric(
    answer: ReferenceAnswer,
    question: QuestionData,
    filePath: string,
    errors: ReferenceAnswerValidationMessage[]
): void {
    const criteria = question.meta.rubric?.criteria;
    if (!criteria || criteria.length === 0) {
        pushMessage(
            errors,
            "error",
            "question.rubric_missing",
            "Referenced question has no rubric criteria.",
            { path: filePath, questionSlug: answer.questionSlug, answerId: answer.id }
        );
        return;
    }

    const rubricCriterionIds = criteria.map((criterion) => criterion.id).filter(Boolean) as string[];
    if (rubricCriterionIds.length !== criteria.length) {
        pushMessage(
            errors,
            "error",
            "question.rubric_criterion_id_missing",
            "Referenced question has at least one rubric criterion without an id.",
            { path: filePath, questionSlug: answer.questionSlug, answerId: answer.id }
        );
        return;
    }

    const expectedIds = answer.expectedCriteria.map((criterion) => criterion.criterionId);
    const expectedIdSet = new Set(expectedIds);
    if (expectedIdSet.size !== expectedIds.length) {
        pushMessage(
            errors,
            "error",
            "answer.duplicate_expected_criterion",
            "Answer repeats one or more expectedCriteria criterionId values.",
            { path: filePath, questionSlug: answer.questionSlug, answerId: answer.id }
        );
    }

    const rubricIdSet = new Set(rubricCriterionIds);
    const missing = rubricCriterionIds.filter((criterionId) => !expectedIdSet.has(criterionId));
    const extra = expectedIds.filter((criterionId) => !rubricIdSet.has(criterionId));

    if (missing.length > 0) {
        pushMessage(
            errors,
            "error",
            "answer.expected_criteria_missing",
            `Missing rubric criterion ids: ${missing.join(", ")}.`,
            { path: filePath, questionSlug: answer.questionSlug, answerId: answer.id }
        );
    }

    if (extra.length > 0) {
        pushMessage(
            errors,
            "error",
            "answer.expected_criteria_extra",
            `Unknown criterion ids not present in the rubric: ${extra.join(", ")}.`,
            { path: filePath, questionSlug: answer.questionSlug, answerId: answer.id }
        );
    }
}

function validateQuestionCompatibility(
    answer: ReferenceAnswer,
    question: QuestionData,
    filePath: string,
    errors: ReferenceAnswerValidationMessage[],
    warnings: ReferenceAnswerValidationMessage[]
): void {
    if (answer.language) {
        const supportedLanguages = question.meta.supportedLanguages;
        if (!supportedLanguages || supportedLanguages.length === 0) {
            pushMessage(
                warnings,
                "warning",
                "question.supported_languages_missing",
                `Cannot verify language "${answer.language}" because the question has no supportedLanguages metadata.`,
                { path: filePath, questionSlug: answer.questionSlug, answerId: answer.id }
            );
        } else if (!supportedLanguages.includes(answer.language)) {
            pushMessage(
                errors,
                "error",
                "answer.language_unsupported",
                `Language "${answer.language}" is not listed in question supportedLanguages: ${supportedLanguages.join(
                    ", "
                )}.`,
                { path: filePath, questionSlug: answer.questionSlug, answerId: answer.id }
            );
        }
    }

    const inputType = question.meta.inputConfig?.type ?? "code";
    const hasCodeCompatibleContent = Boolean(answer.code?.trim() || answer.justification?.trim());
    const hasTextualContent = Boolean(answer.answerText?.trim() || answer.justification?.trim());

    if (inputType === "code" && !hasCodeCompatibleContent) {
        pushMessage(
            errors,
            "error",
            "answer.code_content_missing",
            "Code question answers must include code and/or justification.",
            { path: filePath, questionSlug: answer.questionSlug, answerId: answer.id }
        );
    }

    if (inputType === "multi-section" && !hasTextualContent) {
        pushMessage(
            errors,
            "error",
            "answer.text_content_missing",
            "Multi-section question answers must include answerText or textual justification.",
            { path: filePath, questionSlug: answer.questionSlug, answerId: answer.id }
        );
    }
}

async function validateAgainstQuestionBank(
    file: LoadedReferenceAnswerFile,
    errors: ReferenceAnswerValidationMessage[],
    warnings: ReferenceAnswerValidationMessage[],
    axes: Partial<Record<CanonicalAxis | string, number>>,
    questionCache: QuestionCache
): Promise<void> {
    let question: QuestionData | null;
    try {
        question = await getCachedQuestion(file.data.questionSlug, questionCache);
    } catch (error) {
        pushMessage(
            errors,
            "error",
            "question.load_failed",
            `Could not load referenced question: ${
                error instanceof Error ? error.message : String(error)
            }`,
            { path: file.path, questionSlug: file.data.questionSlug }
        );
        return;
    }

    if (!question) {
        pushMessage(
            errors,
            "error",
            "question.not_found",
            `No question found with slug "${file.data.questionSlug}".`,
            { path: file.path, questionSlug: file.data.questionSlug }
        );
        return;
    }

    const { axis, normalized } = normalizeAxis(question.meta.axis);
    if (axis) {
        axes[axis] = (axes[axis] ?? 0) + 1;
        if (normalized) {
            pushMessage(
                warnings,
                "warning",
                "question.axis_normalized",
                `Question axis "${question.meta.axis}" was reported as canonical axis "${axis}".`,
                { path: file.path, questionSlug: file.data.questionSlug }
            );
        }
    } else {
        pushMessage(
            warnings,
            "warning",
            "question.axis_missing",
            "Referenced question has no axis metadata for distribution reporting.",
            { path: file.path, questionSlug: file.data.questionSlug }
        );
    }

    const answers = file.data.answers.map((answer) => ({
        ...answer,
        questionSlug: file.data.questionSlug,
    }));

    for (const answer of answers) {
        validateCriteriaAgainstRubric(answer, question, file.path, errors);
        validateQuestionCompatibility(answer, question, file.path, errors, warnings);
        validateExpectedOverallRange(answer, file.path, warnings);
        validateWeightedOverall(answer, question, file.path, warnings);
    }
}

function validateGlobalUniqueness(
    files: LoadedReferenceAnswerFile[],
    errors: ReferenceAnswerValidationMessage[]
): void {
    const questionSlugs = new Map<string, string>();
    const answerIds = new Map<string, string>();

    for (const file of files) {
        const previousQuestionPath = questionSlugs.get(file.data.questionSlug);
        if (previousQuestionPath && previousQuestionPath !== file.path) {
            pushMessage(
                errors,
                "error",
                "global.duplicate_question_slug",
                `questionSlug "${file.data.questionSlug}" appears in multiple files: ${previousQuestionPath} and ${file.path}.`,
                { path: file.path, questionSlug: file.data.questionSlug }
            );
        }
        questionSlugs.set(file.data.questionSlug, file.path);

        for (const answer of file.data.answers) {
            const previousAnswerPath = answerIds.get(answer.id);
            if (previousAnswerPath && previousAnswerPath !== file.path) {
                pushMessage(
                    errors,
                    "error",
                    "global.duplicate_answer_id",
                    `Answer id "${answer.id}" appears in multiple files: ${previousAnswerPath} and ${file.path}.`,
                    { path: file.path, questionSlug: file.data.questionSlug, answerId: answer.id }
                );
            }
            answerIds.set(answer.id, file.path);
        }
    }
}

function loadErrorsToMessages(
    loadErrors: ReferenceAnswerLoadError[]
): ReferenceAnswerValidationMessage[] {
    return loadErrors.map((error) => ({
        severity: "error",
        path: error.path,
        code: "loader.error",
        message: error.message,
    }));
}

export async function validateReferenceAnswerFiles(
    files: LoadedReferenceAnswerFile[],
    options: { loadErrors?: ReferenceAnswerLoadError[] } = {}
): Promise<ReferenceAnswerValidationResult> {
    const errors = loadErrorsToMessages(options.loadErrors ?? []);
    const warnings: ReferenceAnswerValidationMessage[] = [];
    const axes: Partial<Record<CanonicalAxis | string, number>> = {};
    const profiles = createProfileCounts();
    const questionCache: QuestionCache = new Map();

    for (const file of files) {
        validateFileIdentity(file, errors);
        validateDuplicateIdsWithinFile(file, errors);
        validateProfileMix(file, errors);

        for (const answer of file.data.answers) {
            profiles[answer.profile] += 1;
        }

        await validateAgainstQuestionBank(file, errors, warnings, axes, questionCache);
    }

    validateGlobalUniqueness(files, errors);

    const answers = flattenReferenceAnswers(files);
    const questionSlugs = new Set(files.map((file) => file.data.questionSlug));

    return {
        files,
        answers,
        summary: {
            filesChecked: files.length,
            questionsChecked: questionSlugs.size,
            answersChecked: answers.length,
            profiles,
            axes,
        },
        errors,
        warnings,
    };
}

export async function validateReferenceAnswers(
    files: LoadedReferenceAnswerFile[],
    options: { loadErrors?: ReferenceAnswerLoadError[] } = {}
): Promise<ReferenceAnswerValidationResult> {
    return validateReferenceAnswerFiles(files, options);
}

export async function loadAndValidateReferenceAnswers(
    sourcePath?: string
): Promise<ReferenceAnswerValidationResult> {
    const loaded = await loadReferenceAnswerFiles(sourcePath);
    return validateReferenceAnswerFiles(loaded.files, { loadErrors: loaded.errors });
}

export function relativeMessagePath(messagePath: string): string {
    return path.relative(process.cwd(), messagePath) || messagePath;
}
