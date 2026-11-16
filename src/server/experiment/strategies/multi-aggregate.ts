import type {
    EvaluationInput,
    EvaluationOutput,
    EvaluationOutputCriterion,
    EvaluationStrategy,
    RawStrategyOutput,
    StrategyFailureResult,
    StrategyResult,
    StrategySuccessResult,
} from "./contracts";
import { sumCostEstimates } from "./cost";
import { runSingleStrategy, type SingleStrategyOptions } from "./single";

export type MultiAggregatePromptVariant = {
    id: string;
    instruction: string;
};

export const DEFAULT_MULTI_AGGREGATE_PROMPT_VARIANTS: MultiAggregatePromptVariant[] = [
    {
        id: "rubric_adherence",
        instruction:
            "Nesta avaliação, priorize a aderência estrita à rubrica. Atribua os scores considerando cuidadosamente os critérios, descritores e pesos definidos. Penalize respostas que pareçam boas de forma geral, mas que não atendam explicitamente ao que o critério avalia. Não use critérios externos à rubrica.",
    },
    {
        id: "textual_evidence",
        instruction:
            "Nesta avaliação, priorize evidências textuais presentes na resposta avaliada. Ao atribuir os scores, considere principalmente o que está explicitamente demonstrado no texto. Evite inferir conhecimento implícito quando ele não estiver sustentado por trechos, argumentos, exemplos ou explicações presentes na resposta.",
    },
    {
        id: "conceptual_coverage",
        instruction:
            "Nesta avaliação, priorize a cobertura conceitual da resposta. Verifique se os conceitos centrais esperados foram abordados de maneira correta e suficiente, mesmo que a organização, redação ou terminologia não sejam ideais. Penalize omissões conceituais relevantes e confusões entre conceitos importantes.",
    },
];

export type MultiAggregateStrategyOptions = SingleStrategyOptions & {
    promptVariants?: MultiAggregatePromptVariant[];
};

type SuccessfulSubcall = {
    index: number;
    result: StrategySuccessResult;
};

type SubcallSummary = {
    callIndex: number;
    promptVariantId: string;
    status: StrategyResult["status"];
    overall?: number;
    errorMessage?: string;
};

export function createMultiAggregateStrategy(
    options: MultiAggregateStrategyOptions = {}
): EvaluationStrategy {
    return {
        id: "multi_aggregate",
        execute(input) {
            return runMultiAggregateStrategy(input, options);
        },
    };
}

export const multiAggregateStrategy = createMultiAggregateStrategy();

export async function runMultiAggregateStrategy(
    input: EvaluationInput,
    options: MultiAggregateStrategyOptions = {}
): Promise<StrategyResult> {
    const startedAt = new Date();
    const rawOutputs: RawStrategyOutput[] = [];
    const subcallSummaries: SubcallSummary[] = [];
    const successes: SuccessfulSubcall[] = [];
    const promptVariants = options.promptVariants ?? DEFAULT_MULTI_AGGREGATE_PROMPT_VARIANTS;
    let callCount = 0;
    const costEstimates: StrategyResult["costEstimate"][] = [];

    for (const [variantIndex, promptVariant] of promptVariants.entries()) {
        const index = variantIndex + 1;
        const result = await runSingleStrategy(input, {
            ...options,
            promptVariantInstruction: promptVariant.instruction,
        });
        callCount += result.callCount;
        costEstimates.push(result.costEstimate);
        rawOutputs.push(...withSubcallMetadata(result.rawOutputs, index, promptVariant));

        subcallSummaries.push({
            callIndex: index,
            promptVariantId: promptVariant.id,
            status: result.status,
            ...(result.status === "success" && { overall: result.parsedOutput.overall }),
            ...(result.status !== "success" && { errorMessage: result.errorMessage }),
        });

        if (result.status !== "success") {
            const finishedAt = new Date();
            return buildFailureResult({
                input,
                startedAt,
                finishedAt,
                status: result.status,
                model: result.model,
                callCount,
                rawOutputs,
                errorMessage: result.errorMessage,
                subcallSummaries,
                validSubcallCount: successes.length,
                subcallCount: promptVariants.length,
                costEstimate: sumCostEstimates(costEstimates),
            });
        }

        successes.push({ index, result });
    }

    const aggregate = aggregateSuccessfulOutputs(
        input,
        successes.map((item) => item.result)
    );
    const finishedAt = new Date();

    if (!aggregate.success) {
        return buildFailureResult({
            input,
            startedAt,
            finishedAt,
            status: "schema_error",
            model: successes.at(-1)?.result.model ?? input.model,
            callCount,
            rawOutputs,
            errorMessage: aggregate.errorMessage,
            subcallSummaries,
            validSubcallCount: successes.length,
            subcallCount: promptVariants.length,
            costEstimate: sumCostEstimates(costEstimates),
        });
    }

    return {
        strategy: "multi_aggregate",
        status: "success",
        model: successes.at(-1)?.result.model ?? input.model,
        promptVersion: input.promptVersion,
        questionSlug: getQuestionSlug(input),
        ...getReferenceAnswerId(input),
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        latencyMs: elapsedMs(startedAt, finishedAt),
        callCount,
        rawOutputs,
        ...costEstimateField(sumCostEstimates(costEstimates)),
        parsedOutput: aggregate.output,
        strategyMetadata: {
            aggregationMethod: "mean_by_criterion",
            subcallCount: promptVariants.length,
            validSubcallCount: successes.length,
            criterionScoreStdDev: aggregate.criterionScoreStdDev,
            subcalls: subcallSummaries,
            promptVariants: promptVariants.map((variant, index) => ({
                subcallIndex: index + 1,
                promptVariantId: variant.id,
                promptVariantInstruction: variant.instruction,
            })),
            methodology:
                "A estratégia multi_aggregate executa avaliações independentes da mesma resposta, variando a instrução avaliativa em aderência à rubrica, evidência textual e cobertura conceitual. Os scores finais são agregados por média em nível de critério, e a variabilidade entre chamadas é registrada por meio do desvio padrão.",
        },
    };
}

function aggregateSuccessfulOutputs(
    input: EvaluationInput,
    results: StrategySuccessResult[]
):
    | {
          success: true;
          output: EvaluationOutput;
          criterionScoreStdDev: Record<string, number>;
      }
    | { success: false; errorMessage: string } {
    const baselineCriteria = results[0]?.parsedOutput.criteria;
    if (!baselineCriteria?.length) {
        return { success: false, errorMessage: "No successful outputs to aggregate." };
    }

    const baselineIds = baselineCriteria.map((criterion) => criterion.criterionId);
    for (const result of results.slice(1)) {
        const ids = result.parsedOutput.criteria.map((criterion) => criterion.criterionId);
        if (!sameStringSet(baselineIds, ids)) {
            return {
                success: false,
                errorMessage: "Sub-evaluations returned mismatched criterion ids.",
            };
        }
    }

    const criterionScoreStdDev: Record<string, number> = {};
    const criteria: EvaluationOutputCriterion[] = baselineIds.map((criterionId) => {
        const matchingCriteria = results.map((result) => {
            const criterion = result.parsedOutput.criteria.find(
                (item) => item.criterionId === criterionId
            );
            if (!criterion) {
                throw new Error(`Missing criterion ${criterionId}`);
            }
            return criterion;
        });

        const scores = matchingCriteria.map((criterion) => criterion.score);
        const score = roundTo(mean(scores), 2);
        criterionScoreStdDev[criterionId] = roundTo(standardDeviation(scores), 4);

        const weight =
            matchingCriteria.find((criterion) => criterion.weight !== undefined)?.weight ??
            findRubricWeight(input, criterionId);

        return {
            criterionId,
            score,
            ...(weight !== undefined && { weight }),
            evidence: consolidateText(
                matchingCriteria.map((criterion, index) => ({
                    index: index + 1,
                    value: criterion.evidence,
                }))
            ),
            comment: consolidateText(
                matchingCriteria.map((criterion, index) => ({
                    index: index + 1,
                    value: criterion.comment,
                }))
            ),
        };
    });

    return {
        success: true,
        output: {
            overall: calculateOverall(criteria),
            criteria,
            feedback: consolidateText(
                results.map((result, index) => ({
                    index: index + 1,
                    value: result.parsedOutput.feedback,
                }))
            ),
        },
        criterionScoreStdDev,
    };
}

function buildFailureResult({
    input,
    startedAt,
    finishedAt,
    status,
    model,
    callCount,
    rawOutputs,
    errorMessage,
    subcallSummaries,
    validSubcallCount,
    subcallCount,
    costEstimate,
}: {
    input: EvaluationInput;
    startedAt: Date;
    finishedAt: Date;
    status: StrategyFailureResult["status"];
    model: string;
    callCount: number;
    rawOutputs: RawStrategyOutput[];
    errorMessage: string;
    subcallSummaries: SubcallSummary[];
    validSubcallCount: number;
    subcallCount: number;
    costEstimate?: StrategyResult["costEstimate"];
}): StrategyFailureResult {
    return {
        strategy: "multi_aggregate",
        status,
        model,
        promptVersion: input.promptVersion,
        questionSlug: getQuestionSlug(input),
        ...getReferenceAnswerId(input),
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        latencyMs: elapsedMs(startedAt, finishedAt),
        callCount,
        rawOutputs,
        ...costEstimateField(costEstimate),
        errorMessage,
        strategyMetadata: {
            aggregationMethod: "mean_by_criterion",
            subcallCount,
            validSubcallCount,
            subcalls: subcallSummaries,
        },
    };
}

function costEstimateField(
    costEstimate: StrategyResult["costEstimate"]
): { costEstimate?: NonNullable<StrategyResult["costEstimate"]> } {
    return costEstimate ? { costEstimate } : {};
}

function withSubcallMetadata(
    rawOutputs: RawStrategyOutput[],
    callIndex: number,
    promptVariant: MultiAggregatePromptVariant
): RawStrategyOutput[] {
    return rawOutputs.map((rawOutput) => ({
        ...rawOutput,
        callIndex,
        metadata: {
            ...(rawOutput.metadata ?? {}),
            subcallIndex: callIndex,
            promptVariantId: promptVariant.id,
            promptVariantInstruction: promptVariant.instruction,
        },
    }));
}

function sameStringSet(left: string[], right: string[]): boolean {
    if (left.length !== right.length) return false;
    const rightSet = new Set(right);
    return left.every((item) => rightSet.has(item));
}

function findRubricWeight(input: EvaluationInput, criterionId: string): number | undefined {
    return input.question.meta.rubric?.criteria.find((criterion) => criterion.id === criterionId)
        ?.weight;
}

function consolidateText(parts: Array<{ index: number; value?: string }>): string {
    return parts
        .map((part) => ({
            ...part,
            value: part.value?.trim() ?? "",
        }))
        .filter((part) => part.value.length > 0)
        .map((part) => `[Call ${part.index}] ${part.value}`)
        .join("\n\n");
}

function calculateOverall(criteria: EvaluationOutputCriterion[]): number {
    const totalWeight = criteria.reduce((sum, criterion) => sum + (criterion.weight ?? 0), 0);

    if (totalWeight === 0) {
        return roundTo(
            criteria.reduce((sum, criterion) => sum + criterion.score, 0) / criteria.length,
            2
        );
    }

    return roundTo(
        criteria.reduce((sum, criterion) => sum + criterion.score * (criterion.weight ?? 0), 0) /
            totalWeight,
        2
    );
}

function mean(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
    const average = mean(values);
    const variance = mean(values.map((value) => (value - average) ** 2));
    return Math.sqrt(variance);
}

function roundTo(value: number, decimalPlaces: number): number {
    const factor = 10 ** decimalPlaces;
    return Math.round(value * factor) / factor;
}

function getQuestionSlug(input: EvaluationInput): string {
    return input.question.meta.slug ?? input.question.meta.id;
}

function getReferenceAnswerId(input: EvaluationInput): { referenceAnswerId?: string } {
    return input.answer.kind === "reference" ? { referenceAnswerId: input.answer.id } : {};
}

function elapsedMs(startedAt: Date, finishedAt: Date): number {
    return Math.max(0, finishedAt.getTime() - startedAt.getTime());
}
