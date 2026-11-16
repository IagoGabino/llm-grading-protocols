import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
    label: string;
    href?: string;
};

type BreadcrumbProps = {
    items: BreadcrumbItem[];
};

export function Breadcrumb({ items }: BreadcrumbProps) {
    if (!items.length) return null;

    return (
        <nav className="mb-6 flex items-center space-x-2 text-sm text-muted-foreground">
            {items.map((item, index) => {
                const isLast = index === items.length - 1;
                const content =
                    item.href && !isLast ? (
                        <Link href={item.href} className="transition-colors hover:text-foreground">
                            {item.label}
                        </Link>
                    ) : (
                        <span className={isLast ? "text-foreground" : undefined}>{item.label}</span>
                    );

                return (
                    <span key={`${item.label}-${index}`} className="flex items-center space-x-2">
                        {index > 0 ? <ChevronRight className="h-4 w-4" /> : null}
                        {content}
                    </span>
                );
            })}
        </nav>
    );
}
