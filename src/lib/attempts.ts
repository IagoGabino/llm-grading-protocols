export type Axis = "codeQuality" | "bugFix" | "tests" | "design";
export type Difficulty = "easy" | "intermediate" | "advanced";
export type Language = "javascript" | "python" | "java";

export type AttemptStatus = "completed";

export type Attempt = {
    id: string;
    questionId: string;
    questionTitle: string;
    slug: string;
    axis: Axis;
    difficulty: Difficulty;
    language?: Language;
    score: number;
    date: string;
    status: AttemptStatus;
};

export const axisLabels: Record<Axis, string> = {
    codeQuality: "Qualidade de Código",
    bugFix: "Correção de Bugs",
    tests: "Testes",
    design: "Design e Arquitetura",
};

export const difficultyLabels: Record<Difficulty, string> = {
    easy: "Fácil",
    intermediate: "Intermediário",
    advanced: "Avançado",
};

export const languageLabels: Record<Language, string> = {
    javascript: "JavaScript",
    python: "Python",
    java: "Java",
};
