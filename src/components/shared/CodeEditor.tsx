"use client";

import { useMemo, useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type CodeEditorProps = {
    language: string;
    value: string;
    onChange: (value: string) => void;
    height?: number;
};

const DEFAULT_HEIGHT = 520;

export function CodeEditor({
    language,
    value,
    onChange,
    height = DEFAULT_HEIGHT,
}: CodeEditorProps) {
    const { resolvedTheme } = useTheme();
    const theme = resolvedTheme === "dark" ? "vs-dark" : "light";
    const [isFullscreen, setIsFullscreen] = useState(false);

    const editorOptions = useMemo(
        () => ({
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            lineNumbers: "on" as const,
        }),
        []
    );

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    // Fechar tela cheia com ESC
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape" && isFullscreen) {
                setIsFullscreen(false);
            }
        };

        if (isFullscreen) {
            window.addEventListener("keydown", handleEscape);
            // Prevenir scroll da página quando em fullscreen
            document.body.style.overflow = "hidden";
        }

        return () => {
            window.removeEventListener("keydown", handleEscape);
            document.body.style.overflow = "";
        };
    }, [isFullscreen]);

    return (
        <>
            <div
                className={`w-full max-w-full overflow-hidden rounded-lg border bg-card ${
                    isFullscreen ? "fixed inset-0 z-50 rounded-none" : "relative"
                }`}
            >
                <div className="absolute right-2 top-2 z-10">
                    <Button
                        variant="secondary"
                        size="icon"
                        onClick={toggleFullscreen}
                        className="h-8 w-8 shadow-md"
                        title={isFullscreen ? "Sair da tela cheia (Esc)" : "Tela cheia"}
                    >
                        {isFullscreen ? (
                            <Minimize2 className="h-4 w-4" />
                        ) : (
                            <Maximize2 className="h-4 w-4" />
                        )}
                    </Button>
                </div>
                <Editor
                    height={isFullscreen ? "100vh" : height}
                    language={language}
                    theme={theme}
                    value={value}
                    onChange={(nextValue) => onChange(nextValue ?? "")}
                    options={editorOptions}
                />
            </div>
            {isFullscreen && (
                <div
                    className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
                    onClick={toggleFullscreen}
                />
            )}
        </>
    );
}
