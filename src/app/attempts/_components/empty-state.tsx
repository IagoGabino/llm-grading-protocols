import Link from "next/link";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState() {
    return (
        <Card>
            <CardContent className="py-16">
                <div className="flex flex-col items-center justify-center text-center space-y-4">
                    <Target className="h-16 w-16 text-muted-foreground/50" />
                    <div className="space-y-2">
                        <h3 className="text-lg font-semibold">Nenhuma tentativa ainda</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                            Você ainda não resolveu nenhuma questão. Comece agora e acompanhe seu
                            progresso!
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/questions">Explorar Questões</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
