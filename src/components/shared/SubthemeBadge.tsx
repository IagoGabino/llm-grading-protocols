import { getSubthemeLabel } from "@/lib/question-meta";
import { Badge } from "@/components/ui/badge";

type SubthemeBadgeProps = {
    subtheme?: string | null;
    /** Se true, não renderiza nada quando subtheme está ausente (usar quando banco estiver 100% migrado) */
    hideWhenMissing?: boolean;
};

/**
 * Badge para exibir o subtema de uma questão em português.
 *
 * Fallback: quando `subtheme` está ausente, exibe "Subtema não classificado" com opacidade reduzida.
 * Remoção do fallback: quando o banco estiver migrado, passe `hideWhenMissing` ou remova o badge
 * de questões sem subtema — a mudança será localizada aqui.
 */
export function SubthemeBadge({ subtheme, hideWhenMissing = false }: SubthemeBadgeProps) {
    if (!subtheme && hideWhenMissing) return null;

    const isMissing = !subtheme;

    return (
        <Badge
            variant="outline"
            className={
                isMissing
                    ? "border-dashed text-xs font-normal text-muted-foreground"
                    : "text-xs font-normal"
            }
        >
            {getSubthemeLabel(subtheme)}
        </Badge>
    );
}
