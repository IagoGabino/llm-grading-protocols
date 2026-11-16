import { Bug, Code2, Layers, TestTube } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AxisCardProps = {
    axisId: string;
    label: string;
    description: string;
    questionCount: number;
    onClick: () => void;
};

const axisBorderColors: Record<string, string> = {
    bugFix: "border-l-rose-500",
    codeQuality: "border-l-violet-500",
    tests: "border-l-sky-500",
    architecture: "border-l-emerald-500",
    design: "border-l-emerald-500",
};

const axisIconColors: Record<string, string> = {
    bugFix: "text-rose-500",
    codeQuality: "text-violet-500",
    tests: "text-sky-500",
    architecture: "text-emerald-500",
    design: "text-emerald-500",
};

const axisIcons: Record<string, typeof Bug> = {
    bugFix: Bug,
    codeQuality: Code2,
    tests: TestTube,
    architecture: Layers,
    design: Layers,
};

export function AxisCard({ axisId, label, description, questionCount, onClick }: AxisCardProps) {
    const Icon = axisIcons[axisId] ?? Layers;
    const iconColor = axisIconColors[axisId] ?? "text-muted-foreground";
    const borderColor = axisBorderColors[axisId] ?? "border-l-border";

    return (
        <Card
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick();
                }
            }}
            className={cn(
                "cursor-pointer border-l-4 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                borderColor
            )}
        >
            <CardHeader className="space-y-3 pb-3">
                <Icon className={cn("h-6 w-6", iconColor)} />
                <CardTitle className="text-lg">{label}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">
                    {questionCount} {questionCount === 1 ? "questão" : "questões"}
                </p>
            </CardContent>
        </Card>
    );
}
