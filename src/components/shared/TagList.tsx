import { getTagLabel } from "@/lib/question-meta";
import { Badge } from "@/components/ui/badge";

type TagListProps = {
    tags?: string[] | null;
    /**
     * Máximo de tags visíveis antes de exibir "+N".
     * Padrão: undefined = mostrar todas.
     */
    maxVisible?: number;
    /** Tamanho compacto para uso em cards de listagem */
    compact?: boolean;
};

/**
 * Lista de tags de uma questão exibidas em português.
 * Tags desconhecidas recebem fallback legível automático (snake_case → Palavras Com Maiúsculas).
 * Retorna null quando não há tags — não renderiza nada.
 */
export function TagList({ tags, maxVisible, compact = false }: TagListProps) {
    if (!tags || tags.length === 0) return null;

    const visible = maxVisible !== undefined ? tags.slice(0, maxVisible) : tags;
    const overflow = maxVisible !== undefined ? tags.length - maxVisible : 0;

    return (
        <div className="flex flex-wrap gap-1.5">
            {visible.map((tag) => (
                <Badge
                    key={tag}
                    variant="secondary"
                    className={
                        compact
                            ? "px-1.5 py-0 text-[11px] font-normal"
                            : "px-2 py-0.5 text-xs font-normal"
                    }
                >
                    {getTagLabel(tag)}
                </Badge>
            ))}
            {overflow > 0 && (
                <Badge
                    variant="secondary"
                    className={
                        compact
                            ? "px-1.5 py-0 text-[11px] font-normal text-muted-foreground"
                            : "px-2 py-0.5 text-xs font-normal text-muted-foreground"
                    }
                >
                    +{overflow}
                </Badge>
            )}
        </div>
    );
}
