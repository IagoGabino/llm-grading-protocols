import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { extractAllSections } from "./sections";
import { validateQuestionMeta, type QuestionMeta } from "./question-meta-schema";

export type { QuestionMeta };

export type QuestionData = {
    meta: QuestionMeta;
    sections: Record<string, string>;
    templates: Record<string, string>;
};

export type QuestionCard = Pick<QuestionMeta, "id" | "title" | "difficulty" | "axis"> & {
    slug: string;
    summary: string;
    subtheme?: string;
    tags?: string[];
};

const ROOT = process.cwd();
const QUESTIONS_DIR = path.join(ROOT, "questions");

export async function listMarkdownFiles(dir: string): Promise<string[]> {
    const out: string[] = [];
    async function walk(d: string) {
        const entries = await fs.readdir(d, { withFileTypes: true });
        for (const e of entries) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) {
                // Ignorar pasta de arquivamento — questões arquivadas não aparecem na plataforma
                if (e.name === "archived") continue;
                await walk(p);
            } else if (e.isFile() && p.endsWith(".md")) out.push(p);
        }
    }
    await walk(dir);
    return out;
}

export async function listQuestions(): Promise<
    Array<Pick<QuestionMeta, "id" | "title" | "difficulty" | "axis"> & { slug: string }>
> {
    const files = await listMarkdownFiles(QUESTIONS_DIR);
    const items: Array<{
        slug: string;
        id: string;
        title: string;
        difficulty?: string;
        axis?: string;
    }> = [];
    for (const file of files) {
        const raw = await fs.readFile(file, "utf8");
        const { data } = matter(raw);
        const meta = data as QuestionMeta;
        const filenameSlug = path.basename(file, ".md");
        const slug = meta.slug || meta.id || filenameSlug;
        items.push({
            slug,
            id: meta.id ?? filenameSlug,
            title: meta.title ?? filenameSlug,
            difficulty: meta.difficulty,
            axis: meta.axis,
        });
    }
    // ordena por eixo e dificuldade só pra ficar bonito
    return items.sort((a, b) =>
        `${a.axis}:${a.difficulty}:${a.title}`.localeCompare(`${b.axis}:${b.difficulty}:${b.title}`)
    );
}

function buildSummaryFromSections(sections: Record<string, string>): string {
    const source = sections.summary || sections.statement || "";
    if (!source) return "Resumo indisponível no momento.";
    const withoutCode = source.replace(/```[\s\S]*?```/g, " ");
    const withoutHtml = withoutCode.replace(/<[^>]+>/g, " ");
    const withoutMd = withoutHtml.replace(/[#>*_`~-]+/g, " ");
    const condensed = withoutMd.replace(/\s+/g, " ").trim();
    if (!condensed) return "Resumo indisponível no momento.";
    const limit = 200;
    return condensed.length > limit ? `${condensed.slice(0, limit - 1).trimEnd()}...` : condensed;
}

export async function listQuestionCards(): Promise<QuestionCard[]> {
    const files = await listMarkdownFiles(QUESTIONS_DIR);
    const items: QuestionCard[] = [];
    for (const file of files) {
        const raw = await fs.readFile(file, "utf8");
        const parsed = matter(raw);
        const meta = validateQuestionMeta(parsed.data);
        const filenameSlug = path.basename(file, ".md");
        const slug = meta.slug || meta.id || filenameSlug;
        const { sections } = splitSectionsAndTemplates(extractAllSections(parsed.content));
        items.push({
            slug,
            id: meta.id ?? filenameSlug,
            title: meta.title ?? filenameSlug,
            difficulty: meta.difficulty,
            axis: meta.axis,
            subtheme: meta.subtheme,
            tags: meta.tags,
            summary: buildSummaryFromSections(sections),
        });
    }
    const difficultyOrder: Record<string, number> = {
        easy: 0,
        intermediate: 1,
        advanced: 2,
    };
    return items.sort((a, b) => {
        const axisCompare = (a.axis ?? "").localeCompare(b.axis ?? "");
        if (axisCompare !== 0) return axisCompare;

        const subthemeCompare = (a.subtheme ?? "").localeCompare(b.subtheme ?? "");
        if (subthemeCompare !== 0) return subthemeCompare;

        const difficultyCompare =
            (difficultyOrder[a.difficulty ?? ""] ?? 99) -
            (difficultyOrder[b.difficulty ?? ""] ?? 99);
        if (difficultyCompare !== 0) return difficultyCompare;

        return (a.title ?? "").localeCompare(b.title ?? "");
    });
}

export async function getQuestionBySlug(slug: string): Promise<QuestionData | null> {
    const files = await listMarkdownFiles(QUESTIONS_DIR);
    for (const file of files) {
        const raw = await fs.readFile(file, "utf8");
        const parsed = matter(raw);
        const meta = validateQuestionMeta(parsed.data);
        const filenameSlug = path.basename(file, ".md");
        const currentSlug = meta.slug || meta.id || filenameSlug;
        if (currentSlug === slug) {
            const { sections, templates } = splitSectionsAndTemplates(
                extractAllSections(parsed.content)
            );
            return { meta: { ...meta, slug: currentSlug }, sections, templates };
        }
    }
    return null;
}

function splitSectionsAndTemplates(allSections: Record<string, string>): {
    sections: Record<string, string>;
    templates: Record<string, string>;
} {
    const sections: Record<string, string> = {};
    const templates: Record<string, string> = {};
    for (const [key, value] of Object.entries(allSections)) {
        const [prefix, suffix] = key.split(":");
        if (prefix === "template" && suffix) {
            templates[suffix] = value;
        } else {
            sections[key] = value;
        }
    }
    return { sections, templates };
}
