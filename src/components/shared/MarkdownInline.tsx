"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
    children: string;
    className?: string;
};

/**
 * Componente para renderizar Markdown inline (feedback, evidências, etc.)
 * Mais leve que o Markdown.tsx principal - sem highlight, slugs, ou HTML raw
 */
export function MarkdownInline({ children, className = "" }: Props) {
    return (
        <span className={className}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Inline code - estilo consistente com shadcn
                    code: ({ className, children, ...props }) => {
                        const isInline = !className;
                        return isInline ? (
                            <code
                                className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm"
                                {...props}
                            >
                                {children}
                            </code>
                        ) : (
                            <code className={className} {...props}>
                                {children}
                            </code>
                        );
                    },
                    // Paragrafos - inline sem margem
                    p: ({ children }) => <span>{children}</span>,
                    // Strong - negrito
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    // Links - estilo consistente
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-2 hover:text-primary"
                        >
                            {children}
                        </a>
                    ),
                }}
            >
                {children}
            </ReactMarkdown>
        </span>
    );
}
