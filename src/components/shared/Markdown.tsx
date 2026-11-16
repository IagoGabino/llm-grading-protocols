"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";

type Props = { children: string };

export default function Markdown({ children }: Props) {
    return (
        <div className="prose prose-zinc dark:prose-invert max-w-none break-words overflow-x-auto">
            <ReactMarkdown
                // GFM + HTML seguro + slugs em títulos + links âncora + highlight
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[
                    rehypeRaw,
                    rehypeSlug,
                    [rehypeAutolinkHeadings, { behavior: "wrap" }],
                    [rehypeHighlight, { detect: true }],
                ]}
            >
                {children}
            </ReactMarkdown>
        </div>
    );
}
