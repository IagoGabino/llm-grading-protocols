import { useState, useMemo } from "react";

type MultiSectionConfig = {
    id: string;
    label: string;
    placeholder?: string;
};

type UseQuestionFormProps = {
    inputConfig?: unknown;
};

/**
 * Hook para gerenciar formulários de questões com múltiplas seções
 */
export function useQuestionForm({ inputConfig }: UseQuestionFormProps) {
    const [formValues, setFormValues] = useState<Record<string, string>>({});
    const [justification, setJustification] = useState("");

    // Extrair seções do inputConfig
    const multiSections = useMemo<MultiSectionConfig[]>(() => {
        if (!inputConfig || typeof inputConfig !== "object") {
            return [];
        }
        const candidates = (inputConfig as { sections?: unknown }).sections;
        if (!Array.isArray(candidates)) return [];

        const items = candidates as unknown[];
        const mapped = items.map((section) => {
            if (!section || typeof section !== "object") return null;
            const { id, label, placeholder } = section as Record<string, unknown>;
            const safeId = typeof id === "string" ? id : undefined;
            const safeLabel = typeof label === "string" ? label : undefined;
            if (!safeId || !safeLabel) return null;

            const s: MultiSectionConfig = {
                id: safeId,
                label: safeLabel,
                placeholder: typeof placeholder === "string" ? placeholder : undefined,
            };
            return s;
        });
        return mapped.filter((s): s is MultiSectionConfig => s !== null);
    }, [inputConfig]);

    const updateFormValue = (sectionId: string, value: string) => {
        setFormValues((prev) => ({ ...prev, [sectionId]: value }));
    };

    return {
        formValues,
        justification,
        multiSections,
        updateFormValue,
        setJustification,
    };
}
