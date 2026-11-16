"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    useRef,
    type ReactNode,
} from "react";

import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/question-meta";
import { useAuth } from "./auth-context";
import { toast } from "sonner";
import { useTheme } from "next-themes";

type Theme = "light" | "dark" | "system";

type PreferencesContextValue = {
    defaultLanguage: SupportedLanguage;
    setDefaultLanguage: (language: SupportedLanguage) => void;
    showHints: boolean;
    setShowHints: (show: boolean) => void;
    theme: Theme;
    setTheme: (theme: Theme) => void;
};

const STORAGE_KEY = "preferences:v1";

const DEFAULT_PREFERENCES: PreferencesContextValue = {
    defaultLanguage: SUPPORTED_LANGUAGES[0],
    setDefaultLanguage: () => {},
    showHints: true,
    setShowHints: () => {},
    theme: "system",
    setTheme: () => {},
};

type StoredPreferences = {
    defaultLanguage?: SupportedLanguage;
    showHints?: boolean;
    theme?: Theme;
};

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated, user } = useAuth();
    const { theme: nextTheme, setTheme: setNextTheme } = useTheme();
    const [defaultLanguage, setDefaultLanguageState] = useState<SupportedLanguage>(
        SUPPORTED_LANGUAGES[0]
    );
    const [showHints, setShowHintsState] = useState<boolean>(true);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastUserIdRef = useRef<string | null>(null);
    const isLoadingThemeRef = useRef<boolean>(false);

    // Load preferences when auth state changes
    useEffect(() => {
        async function loadPreferences() {
            const currentUserId = user?.id || null;

            // If user changed (login/logout), load preferences
            if (currentUserId !== lastUserIdRef.current) {
                lastUserIdRef.current = currentUserId;

                if (isAuthenticated && currentUserId) {
                    // Load from backend when authenticated
                    try {
                        const response = await fetch("/api/preferences");
                        if (response.ok) {
                            const data = await response.json();
                            if (
                                data.defaultLanguage &&
                                SUPPORTED_LANGUAGES.includes(data.defaultLanguage)
                            ) {
                                setDefaultLanguageState(data.defaultLanguage);
                            }
                            if (typeof data.showHints === "boolean") {
                                setShowHintsState(data.showHints);
                            }
                            // Sync theme from backend to next-themes
                            if (data.theme && ["light", "dark", "system"].includes(data.theme)) {
                                isLoadingThemeRef.current = true;
                                setNextTheme(data.theme);
                                // Reset flag after a small delay to allow next-themes to update
                                setTimeout(() => {
                                    isLoadingThemeRef.current = false;
                                }, 100);
                            }
                        }
                    } catch (error) {
                        console.error("Failed to load preferences from backend:", error);
                        loadFromLocalStorage();
                    }
                } else {
                    // Load from localStorage when not authenticated
                    loadFromLocalStorage();
                }
            }
        }

        function loadFromLocalStorage() {
            if (typeof window === "undefined") return;
            try {
                const raw = window.localStorage.getItem(STORAGE_KEY);
                if (!raw) return;
                const parsed = JSON.parse(raw) as StoredPreferences;
                if (
                    parsed.defaultLanguage &&
                    SUPPORTED_LANGUAGES.includes(parsed.defaultLanguage)
                ) {
                    setDefaultLanguageState(parsed.defaultLanguage);
                }
                if (typeof parsed.showHints === "boolean") {
                    setShowHintsState(parsed.showHints);
                }
            } catch {
                // Ignore invalid storage payloads
            }
        }

        loadPreferences();
    }, [isAuthenticated, user?.id, setNextTheme]);

    // Save preferences with debounce
    const savePreferences = useCallback(
        async (prefs: StoredPreferences) => {
            // Clear existing timeout
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }

            // Save to localStorage immediately (for instant feedback)
            if (typeof window !== "undefined") {
                try {
                    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
                } catch (error) {
                    console.error("Failed to save to localStorage:", error);
                }
            }

            // Debounced save to backend (only if authenticated)
            if (isAuthenticated && user?.id) {
                saveTimeoutRef.current = setTimeout(async () => {
                    try {
                        const response = await fetch("/api/preferences", {
                            method: "PUT",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify(prefs),
                        });

                        if (!response.ok) {
                            throw new Error("Failed to save preferences");
                        }
                    } catch (error) {
                        console.error("Failed to save preferences to backend:", error);
                        toast.error("Erro ao salvar preferências no servidor");
                    }
                }, 2000); // 2 second debounce
            }
        },
        [isAuthenticated, user?.id]
    );

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    const setDefaultLanguage = useCallback(
        (language: SupportedLanguage) => {
            setDefaultLanguageState(language);
            savePreferences({
                defaultLanguage: language,
                showHints,
                theme: (nextTheme as Theme) || "system",
            });
        },
        [showHints, nextTheme, savePreferences]
    );

    const setShowHints = useCallback(
        (visible: boolean) => {
            setShowHintsState(visible);
            savePreferences({
                defaultLanguage,
                showHints: visible,
                theme: (nextTheme as Theme) || "system",
            });
        },
        [defaultLanguage, nextTheme, savePreferences]
    );

    const setTheme = useCallback(
        (theme: Theme) => {
            setNextTheme(theme);
            savePreferences({
                defaultLanguage,
                showHints,
                theme,
            });
        },
        [defaultLanguage, showHints, setNextTheme, savePreferences]
    );

    const value = useMemo<PreferencesContextValue>(
        () => ({
            defaultLanguage,
            setDefaultLanguage,
            showHints,
            setShowHints,
            theme: (nextTheme as Theme) || "system",
            setTheme,
        }),
        [defaultLanguage, setDefaultLanguage, setShowHints, showHints, nextTheme, setTheme]
    );

    return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
    const context = useContext(PreferencesContext);
    if (!context) {
        throw new Error("usePreferences must be used within PreferencesProvider");
    }
    return context;
}

export { DEFAULT_PREFERENCES };
