export function extractSection(content: string, key: string): string {
    const re = new RegExp(
        `<!--\\s*SECTION:${key}\\s*-->([\\s\\S]*?)<!--\\s*/SECTION:${key}\\s*-->`,
        "i"
    );
    const m = content.match(re);
    return m ? m[1].replace(/\r\n/g, "\n").trim() : "";
}

export function extractAllSections(content: string): Record<string, string> {
    const re = /<!--\s*SECTION:([\w:-]+)\s*-->([\s\S]*?)<!--\s*\/SECTION:\1\s*-->/gi;
    const out: Record<string, string> = {};
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
        out[m[1]] = m[2].replace(/\r\n/g, "\n").trim();
    }
    return out;
}
