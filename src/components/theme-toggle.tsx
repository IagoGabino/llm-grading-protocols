"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { usePreferences } from "@/contexts/preferences-context";

type ThemeToggleProps = React.ComponentProps<typeof Button>;

export function ThemeToggle({ className, ...props }: ThemeToggleProps) {
    const { resolvedTheme } = useTheme();
    const { setTheme } = usePreferences();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const iconClasses = "h-5 w-5 transition-all duration-300 ease-in-out";

    const content = (
        <>
            <Sun className={cn(iconClasses, "rotate-0 scale-100 dark:-rotate-90 dark:scale-0")} />
            <Moon
                className={cn(
                    iconClasses,
                    "absolute rotate-90 scale-0 dark:rotate-0 dark:scale-100"
                )}
            />
            <span className="sr-only">Alternar tema</span>
        </>
    );

    if (!mounted) {
        return (
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("relative", className)}
                {...props}
            >
                {content}
            </Button>
        );
    }

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("relative", className)}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Alternar tema"
            {...props}
        >
            {content}
        </Button>
    );
}
