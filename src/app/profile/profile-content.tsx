"use client";

import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/auth-context";
import { usePreferences } from "@/contexts/preferences-context";
import { SUPPORTED_LANGUAGES, getLanguageLabel, type SupportedLanguage } from "@/lib/question-meta";
import { User, Loader2, Award, Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const languageOptions = SUPPORTED_LANGUAGES;

type UserStats = {
    averageScore: number;
    totalAttempts: number;
    currentStreak: number;
};

export function ProfileContent() {
    const { user } = useAuth();
    const { theme, setTheme, defaultLanguage, setDefaultLanguage } = usePreferences();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<UserStats>({
        averageScore: 0,
        totalAttempts: 0,
        currentStreak: 0,
    });

    const currentTheme = theme ?? "system";

    // Load user basic data (name, email) from backend
    useEffect(() => {
        async function loadUserData() {
            if (!user?.id) {
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch("/api/me");
                if (response.ok) {
                    const data = await response.json();
                    setName(data.user.name || "");
                    setEmail(data.user.email || "");

                    // Carregar estatísticas
                    if (data.stats) {
                        setStats({
                            averageScore: data.stats.averageScore || 0,
                            totalAttempts: data.stats.totalAttempts || 0,
                            currentStreak: data.stats.currentStreak || 0,
                        });
                    }
                }
            } catch (error) {
                console.error("Error loading user data:", error);
                toast.error("Erro ao carregar dados do perfil");
            } finally {
                setIsLoading(false);
            }
        }

        loadUserData();
    }, [user?.id]);

    const handleSaveProfile = async () => {
        // TODO: Implement profile update endpoint
        toast.info("Atualização de perfil será implementada em breve");
    };

    if (isLoading) {
        return (
            <div className="container mx-auto max-w-7xl px-4 py-8">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-7xl px-4 py-8">
            <header className="mb-8 space-y-2">
                <h1 className="text-4xl font-bold">Perfil</h1>
                <p className="text-muted-foreground">Gerencie suas informações e preferências</p>
            </header>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Informações pessoais</CardTitle>
                            <CardDescription>Seus dados de perfil</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-wrap items-center gap-4">
                                <Avatar className="h-20 w-20">
                                    <AvatarFallback className="bg-primary/10 text-primary">
                                        <User className="h-10 w-10" />
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-lg font-semibold">{name || "Usuário"}</p>
                                    <p className="text-sm text-muted-foreground">{email}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="profile-name">Nome</Label>
                                <Input
                                    id="profile-name"
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="profile-email">E-mail</Label>
                                <Input
                                    id="profile-email"
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                />
                            </div>

                            <Button
                                type="button"
                                onClick={handleSaveProfile}
                                className="self-start"
                                aria-label="Salvar alterações do perfil"
                            >
                                Salvar alterações
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Preferências</CardTitle>
                            <CardDescription>
                                Configure sua experiência na plataforma
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="default-language">
                                    Linguagem padrão para questões de código
                                </Label>
                                <Select
                                    value={defaultLanguage}
                                    onValueChange={(value) =>
                                        setDefaultLanguage(value as SupportedLanguage)
                                    }
                                >
                                    <SelectTrigger id="default-language">
                                        <SelectValue placeholder="Selecione uma linguagem" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {languageOptions.map((language) => (
                                            <SelectItem key={language} value={language}>
                                                {getLanguageLabel(language)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Suas alterações são salvas automaticamente
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="theme-preference">Tema</Label>
                                <Select value={currentTheme} onValueChange={setTheme}>
                                    <SelectTrigger id="theme-preference">
                                        <SelectValue placeholder="Escolha um tema" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="light">Claro</SelectItem>
                                        <SelectItem value="dark">Escuro</SelectItem>
                                        <SelectItem value="system">Sistema</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Suas alterações são salvas automaticamente
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <aside className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Estatísticas</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <Award className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">Nota média</span>
                                </div>
                                <span className="font-bold">
                                    {stats.averageScore > 0 ? stats.averageScore.toFixed(1) : "-"}
                                </span>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <Target className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">Total de Tentativas</span>
                                </div>
                                <span className="font-bold">{stats.totalAttempts}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">Streak Atual</span>
                                </div>
                                <span className="font-bold">
                                    {stats.currentStreak > 0
                                        ? `${stats.currentStreak} ${stats.currentStreak === 1 ? "dia" : "dias"}`
                                        : "-"}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </aside>
            </div>
        </div>
    );
}
