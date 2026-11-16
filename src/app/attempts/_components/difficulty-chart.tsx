import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type DifficultyData = {
    name: string;
    value: number;
};

type DifficultyChartProps = {
    data: DifficultyData[];
};

export function DifficultyChart({ data }: DifficultyChartProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Distribuição por Dificuldade</CardTitle>
                <CardDescription>Número de questões resolvidas</CardDescription>
            </CardHeader>
            <CardContent>
                {data.some((item) => item.value > 0) ? (
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
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
