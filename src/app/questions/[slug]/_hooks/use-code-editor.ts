import { useState, useMemo, useEffect } from "react";
import { type SupportedLanguage, SUPPORTED_LANGUAGES } from "@/lib/question-meta";
import { usePreferences } from "@/contexts/preferences-context";

const DEFAULT_TEMPLATES: Record<SupportedLanguage, string> = {
    javascript: `// Escreva sua solução em JavaScript
export function solve(input) {
  // TODO: implemente a lógica
  return null
}
`,
    python: `# Escreva sua solução em Python
def solve(input):
    # TODO: implemente a lógica
    return None
`,
    java: `// Escreva sua solução em Java
public class Solution {
    public Object solve(Object input) {
        // TODO: implemente a lógica
        return null;
    }
}
`,
};

type UseCodeEditorProps = {
    templates: Record<SupportedLanguage, string>;
    supportedLanguages: SupportedLanguage[];
    defaultLanguage?: string;
};

export function useCodeEditor({
    templates,
    supportedLanguages,
    defaultLanguage,
}: UseCodeEditorProps) {
    const { defaultLanguage: preferredLanguage, setDefaultLanguage } = usePreferences();

    // Merge templates with defaults
    const fullTemplates = useMemo(() => {
        const map: Record<SupportedLanguage, string> = {} as Record<SupportedLanguage, string>;
        for (const language of SUPPORTED_LANGUAGES) {
            map[language] = templates[language] ?? DEFAULT_TEMPLATES[language];
        }
        return map;
    }, [templates]);

    // Determine initial language
    const initialLanguage = useMemo(() => {
        if (preferredLanguage && supportedLanguages.includes(preferredLanguage)) {
            return preferredLanguage;
        }
        if (defaultLanguage && supportedLanguages.includes(defaultLanguage as SupportedLanguage)) {
            return defaultLanguage as SupportedLanguage;
        }
        return supportedLanguages[0] ?? SUPPORTED_LANGUAGES[0];
    }, [preferredLanguage, defaultLanguage, supportedLanguages]);

    const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(initialLanguage);
    const [codeByLanguage, setCodeByLanguage] =
        useState<Record<SupportedLanguage, string>>(fullTemplates);

    useEffect(() => {
        setSelectedLanguage(initialLanguage);
    }, [initialLanguage]);

    const handleCodeChange = (value: string) => {
        setCodeByLanguage((prev) => ({
            ...prev,
            [selectedLanguage]: value,
        }));
    };

    const handleLanguageChange = (value: string) => {
        const nextLanguage = value as SupportedLanguage;
        setSelectedLanguage(nextLanguage);
        setDefaultLanguage(nextLanguage);
    };

    const currentCode = codeByLanguage[selectedLanguage] ?? "";

    return {
        selectedLanguage,
        codeByLanguage,
        currentCode,
        handleCodeChange,
        handleLanguageChange,
    };
}
