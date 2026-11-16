"use client";

// import { Link } from 'react-router-dom';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code2, Lightbulb, TrendingUp, CheckCircle, Linkedin, Github } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

export default function Welcome() {
    const { isAuthenticated } = useAuth();

    return (
        <div className="min-h-screen">
            {/* Hero Section */}
            <section className="container mx-auto max-w-7xl px-4 py-20 text-center">
                <div className="flex justify-center mb-6">
                    <div className="bg-primary/10 p-4 rounded-full">
                        <Code2 className="h-12 w-12 text-primary" />
                    </div>
                </div>
                <h1 className="text-5xl font-bold tracking-tight mb-6">
                    Engenharia de Software na Prática
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                    Resolva questões reais de refatoração, correção de bugs, testes e arquitetura.
                    Receba avaliações estruturadas por IA para evoluir de forma consistente.
                </p>
                <div className="flex gap-4 justify-center">
                    <Button size="lg" asChild>
                        {/* <Link to="/questions">Explorar Questões</Link> */}
                        <Link href="/questions">Explorar Questões</Link>
                    </Button>
                    {!isAuthenticated && (
                        <Button size="lg" variant="outline" asChild>
                            <Link href="/login">Entrar</Link>
                        </Button>
                    )}
                </div>
            </section>

            {/* Features */}
            <section className="container mx-auto max-w-7xl px-4 py-16">
                <div className="grid md:grid-cols-3 gap-8">
                    <Card className="bg-card border-border">
                        <CardHeader>
                            <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                                <CheckCircle className="h-6 w-6 text-primary" />
                            </div>
                            <CardTitle>Prática Focada em Engenharia de Software</CardTitle>
                            <CardDescription>
                                Trabalhe em problemas reais envolvendo refatoração, correção de
                                bugs, teste de código e decisões arquiteturais.
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    <Card className="bg-card border-border">
                        <CardHeader>
                            <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                                <Lightbulb className="h-6 w-6 text-primary" />
                            </div>
                            <CardTitle>Avaliação Estruturada por IA</CardTitle>
                            <CardDescription>
                                Receba notas por critério, evidências textuais e feedback claro
                                baseado em rubricas profissionais.
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    <Card className="bg-card border-border">
                        <CardHeader>
                            <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                                <TrendingUp className="h-6 w-6 text-primary" />
                            </div>
                            <CardTitle>Acompanhe Seu Progresso</CardTitle>
                            <CardDescription>
                                Veja seu histórico de tentativas e identifique padrões de melhoria
                                ao longo do tempo.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t mt-20 bg-background">
                <div className="container mx-auto max-w-7xl px-4 py-8 flex flex-col items-center">
                    <div className="flex gap-6 mb-3">
                        <a
                            href="https://linkedin.com/in/iagogabino"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="LinkedIn"
                            className="hover:text-primary transition-colors"
                        >
                            <Linkedin className="h-7 w-7" />
                        </a>
                        <a
                            href="https://github.com/IagoGabino/"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="GitHub"
                            className="hover:text-primary transition-colors"
                        >
                            <Github className="h-7 w-7" />
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
