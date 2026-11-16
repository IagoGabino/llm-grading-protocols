"use client";

import { memo } from "react";
import {
    Radar,
    RadarChart,
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    ResponsiveContainer,
} from "recharts";

type EvaluationRadarProps = {
    data: Array<{ subject: string; score: number; fullMark: number }>;
};

function EvaluationRadarChartComponent({ data }: EvaluationRadarProps) {
    if (!data.length) {
        return (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Sem dados suficientes
            </div>
        );
    }

    const maxMark = Math.max(5, ...data.map((item) => item.fullMark));

    return (
        <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data}>
                <PolarGrid stroke="hsl(var(--muted-foreground)/0.2)" />
                <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                />
                <PolarRadiusAxis
                    angle={90}
                    domain={[0, maxMark]}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--muted-foreground)/0.3)"
                />
                <Radar
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.3}
                />
            </RadarChart>
        </ResponsiveContainer>
    );
}

export const EvaluationRadarChart = memo(EvaluationRadarChartComponent);
