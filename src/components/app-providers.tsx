"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { ReactNode } from "react";
import { PreferencesProvider } from "@/contexts/preferences-context";

interface AppProvidersProps {
    children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
        >
            <AuthProvider>
                <PreferencesProvider>
                    {children}
                    <Toaster richColors position="top-right" />
                </PreferencesProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
