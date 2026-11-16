import type { LLMUsage } from "@/server/llm/types";

import type { StrategyCostEstimate } from "./contracts";

export function usageToCostEstimate(usage: LLMUsage | undefined): StrategyCostEstimate | undefined {
    if (!usage) return undefined;

    const estimate: StrategyCostEstimate = {
        provider: "openrouter",
        ...(typeof usage.promptTokens === "number" && { inputTokens: usage.promptTokens }),
        ...(typeof usage.completionTokens === "number" && {
            outputTokens: usage.completionTokens,
        }),
        ...(typeof usage.totalTokens === "number" && { totalTokens: usage.totalTokens }),
        ...(typeof usage.reasoningTokens === "number" && {
            reasoningTokens: usage.reasoningTokens,
        }),
        ...(typeof usage.cachedTokens === "number" && { cachedTokens: usage.cachedTokens }),
        ...(typeof usage.cacheWriteTokens === "number" && {
            cacheWriteTokens: usage.cacheWriteTokens,
        }),
        ...(typeof usage.costCredits === "number" && {
            costCredits: usage.costCredits,
            providerCostUnit: "credits",
        }),
        ...(typeof usage.upstreamInferenceCost === "number" && {
            upstreamInferenceCost: usage.upstreamInferenceCost,
        }),
    };

    return Object.keys(estimate).length > 1 ? estimate : undefined;
}

export function sumCostEstimates(
    estimates: Array<StrategyCostEstimate | undefined>
): StrategyCostEstimate | undefined {
    const present = estimates.filter((estimate): estimate is StrategyCostEstimate => !!estimate);
    if (present.length === 0) return undefined;

    const summed: StrategyCostEstimate = {
        provider: present.find((estimate) => estimate.provider)?.provider,
        providerCostUnit: present.find((estimate) => estimate.providerCostUnit)?.providerCostUnit,
        ...sumField(present, "inputTokens"),
        ...sumField(present, "outputTokens"),
        ...sumField(present, "totalTokens"),
        ...sumField(present, "reasoningTokens"),
        ...sumField(present, "cachedTokens"),
        ...sumField(present, "cacheWriteTokens"),
        ...sumField(present, "costCredits"),
        ...sumField(present, "upstreamInferenceCost"),
        ...sumField(present, "estimatedUsd"),
    };

    return Object.fromEntries(
        Object.entries(summed).filter(([, value]) => value !== undefined)
    ) as StrategyCostEstimate;
}

function sumField(
    estimates: StrategyCostEstimate[],
    field: keyof StrategyCostEstimate
): Partial<StrategyCostEstimate> {
    const values = estimates
        .map((estimate) => estimate[field])
        .filter((value): value is number => typeof value === "number");

    if (values.length === 0) return {};

    return {
        [field]: roundTo(
            values.reduce((sum, value) => sum + value, 0),
            8
        ),
    };
}

function roundTo(value: number, decimalPlaces: number): number {
    const factor = 10 ** decimalPlaces;
    return Math.round(value * factor) / factor;
}
