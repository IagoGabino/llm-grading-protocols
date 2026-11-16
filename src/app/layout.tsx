import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./markdown-theme.css";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import { Header } from "@/components/layout/Header";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Plataforma de Prática - Engenharia de Software",
    description:
        "Aprimore suas habilidades com questões reais de refatoração, bugs, testes e arquitetura.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="pt-BR" suppressHydrationWarning>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                <AppProviders>
                    <Header />
                    {children}
                </AppProviders>
            </body>
        </html>
    );
}
