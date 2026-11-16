import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

type EvolutionData = {
    attempt: number;
    score: number;
    date: string;
};

type EvolutionChartProps = {
    data: EvolutionData[];
};

export function EvolutionChart({ data }: EvolutionChartProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Evolução de Notas</CardTitle>
                <CardDescription>Progresso ao longo do tempo</CardDescription>
            </CardHeader>
            <CardContent>
                {data.length ? (
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                            <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Line
                                type="monotone"
                                dataKey="score"
                                stroke="hsl(var(--primary))"
                                strokeWidth={2}
                                dot={{ fill: "hsl(var(--primary))" }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
                        Nenhum dado disponível com os filtros selecionados
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
