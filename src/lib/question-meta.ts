export const SUPPORTED_LANGUAGES = ["javascript", "python", "java"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// ---------------------------------------------------------------------------
// Subtemas — mapeamento id → rótulo em português
// Adicionar novos subtemas aqui conforme a taxonomia crescer
// ---------------------------------------------------------------------------
export const SUBTHEME_LABELS: Record<string, string> = {
    // bugFix
    runtime_errors: "Erros em Tempo de Execução",
    async_issues: "Problemas Assíncronos",
    state_and_lifecycle: "Estado e Ciclo de Vida",
    integration_and_performance: "Integração e Performance",
    // codeQuality
    readability: "Legibilidade",
    modularity: "Modularidade",
    duplication_and_reuse: "Duplicação e Reuso",
    design_and_refactoring: "Design e Refatoração",
    // testing
    unit_and_integration: "Testes Unitários e de Integração",
    test_design: "Design de Testes",
    coverage_and_quality: "Cobertura e Qualidade",
    testability: "Testabilidade",
    // architecture
    api_design: "Design de API",
    system_design: "Design de Sistema",
    scalability_and_performance: "Escalabilidade e Performance",
    architecture_decisions: "Decisões Arquiteturais",
};

// ---------------------------------------------------------------------------
// Tags — mapeamento id → rótulo em português
// Adicionar novas tags aqui conforme o banco crescer
// ---------------------------------------------------------------------------
export const TAG_LABELS: Record<string, string> = {
    // bugFix
    null_undefined: "Null / Undefined",
    memory_leak: "Vazamento de Memória",
    race_condition: "Condição de Corrida",
    exception_handling: "Tratamento de Exceções",
    logic_bug: "Bug de Lógica",
    // codeQuality
    long_function: "Função Longa",
    duplicated_code: "Código Duplicado",
    poor_naming: "Nomenclatura Ruim",
    high_coupling: "Alto Acoplamento",
    code_smell: "Code Smell",
    // testing
    edge_cases: "Casos de Borda",
    mocking: "Mocking",
    coverage_gap: "Lacuna de Cobertura",
    regression: "Regressão",
    test_isolation: "Isolamento de Testes",
    dependency_injection: "Injeção de Dependência",
    stub: "Stub",
    side_effects: "Efeitos Colaterais",
    // architecture
    rest_api: "API REST",
    authentication: "Autenticação",
    caching: "Cache",
    queue: "Fila de Mensagens",
    eventual_consistency: "Consistência Eventual",
    microservices: "Microsserviços",
    trade_off: "Trade-off",
};

// ---------------------------------------------------------------------------
// Eixos — ordem canônica, descrições e ordem canônica dos subtemas
// ---------------------------------------------------------------------------

/** Ordem canônica de exibição dos eixos (progressão pedagógica). */
export const AXIS_ORDER = ["bugFix", "tests", "codeQuality", "architecture"] as const;

/** Descrições breves dos eixos para exibição nos cards de navegação. */
export const AXIS_DESCRIPTIONS: Record<string, string> = {
    bugFix: "Diagnóstico e correção de bugs, identificação de causa raiz e comportamentos inesperados.",
    codeQuality: "Refatoração, legibilidade, modularidade e eliminação de dívida técnica.",
    tests: "Escrita e qualidade de testes: cobertura, estratégias e isolamento de dependências.",
    architecture: "Decisões arquiteturais, design de APIs e estratégias de sistemas distribuídos.",
    design: "Decisões arquiteturais, design de APIs e estratégias de sistemas distribuídos.",
};

/** Ordem canônica dos subtemas por eixo (segue a taxonomia definida). */
export const SUBTHEME_ORDER: Record<string, string[]> = {
    bugFix: ["runtime_errors", "async_issues", "state_and_lifecycle", "integration_and_performance"],
    codeQuality: ["readability", "modularity", "duplication_and_reuse", "design_and_refactoring"],
    tests: ["unit_and_integration", "test_design", "coverage_and_quality", "testability"],
    architecture: ["api_design", "system_design", "scalability_and_performance", "architecture_decisions"],
    design: ["api_design", "system_design", "scalability_and_performance", "architecture_decisions"],
};

/** Descrições breves dos subtemas para exibição nas seções de navegação. */
export const SUBTHEME_DESCRIPTIONS: Record<string, string> = {
    runtime_errors: "Bugs de lógica, valores inesperados e erros em tempo de execução.",
    async_issues: "Condições de corrida, callbacks mal encadeados e problemas de concorrência.",
    state_and_lifecycle: "Vazamentos de memória, estado inconsistente e problemas de ciclo de vida.",
    integration_and_performance: "Erros em integrações externas, timezone, serialização e gargalos.",
    readability: "Nomes ruins, código confuso e estruturas difíceis de ler e manter.",
    modularity: "Responsabilidades misturadas, funções longas e falta de separação de concerns.",
    duplication_and_reuse: "Código repetido, abstrações ausentes e oportunidades de reuso.",
    design_and_refactoring: "Aplicação de padrões de projeto, princípios SOLID e refatorações estruturais.",
    unit_and_integration: "Escrita e estruturação de testes unitários e de integração.",
    test_design: "Estratégia de cobertura, casos de borda e classes de equivalência.",
    coverage_and_quality: "Identificação de lacunas de cobertura e melhoria de suítes existentes.",
    testability: "Refatoração para tornar código testável, mocking e injeção de dependência.",
    api_design: "Design de endpoints REST, contratos, autenticação e versionamento.",
    system_design: "Arquitetura de sistemas, filas, workers e processamento assíncrono.",
    scalability_and_performance: "Cache, sharding, CDN e estratégias de escalabilidade horizontal.",
    architecture_decisions: "Trade-offs, escolha de tecnologias e decisões arquiteturais fundamentais.",
};

const fallbackBadgeClass = "bg-muted text-muted-foreground";

export const AXIS_LABELS: Record<string, string> = {
    codeQuality: "Qualidade de Código",
    bugFix: "Correção de Bugs",
    tests: "Testes",
    design: "Design e Arquitetura",
    architecture: "Design e Arquitetura",
};

export const AXIS_LABELS_SHORT: Record<string, string> = {
    codeQuality: "Qualidade",
    bugFix: "Bugs",
    tests: "Testes",
    design: "Design",
    architecture: "Arquitetura",
};

export const DIFFICULTY_LABELS: Record<string, string> = {
    easy: "Fácil",
    intermediate: "Intermediário",
    hard: "Difícil",
    advanced: "Avançado",
};

export const LANGUAGE_LABELS: Record<string, string> = {
    javascript: "JavaScript",
    python: "Python",
    java: "Java",
};

export const DIFFICULTY_ORDER = ["easy", "intermediate", "hard", "advanced"];

const difficultyColors: Record<string, string> = {
    easy: "bg-success/10 text-success",
    intermediate: "bg-warning/10 text-warning",
    hard: "bg-info/10 text-info",
    advanced: "bg-destructive/10 text-destructive",
};

const axisColors: Record<string, string> = {
    codeQuality: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    bugFix: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
    tests: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
    design: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    architecture: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
};

export function getAxisLabel(axis?: string | null): string {
    if (!axis) return "Eixo desconhecido";
    return AXIS_LABELS[axis] ?? axis;
}

export function getAxisLabelShort(axis?: string | null): string {
    if (!axis) return "Desconhecido";
    return AXIS_LABELS_SHORT[axis] ?? axis;
}

export function getDifficultyLabel(difficulty?: string | null): string {
    if (!difficulty) return "Dificuldade desconhecida";
    return DIFFICULTY_LABELS[difficulty] ?? difficulty;
}

export function getLanguageLabel(language: string): string {
    return LANGUAGE_LABELS[language] ?? language;
}

export function getDifficultyBadgeClass(difficulty?: string | null): string {
    if (!difficulty) return fallbackBadgeClass;
    return difficultyColors[difficulty] ?? fallbackBadgeClass;
}

export function getAxisBadgeClass(axis?: string | null): string {
    if (!axis) return fallbackBadgeClass;
    return axisColors[axis] ?? fallbackBadgeClass;
}

/** Retorna o rótulo em português do subtema. Nunca expõe o identificador técnico cru. */
export function getSubthemeLabel(subtheme?: string | null): string {
    if (!subtheme) return "Subtema não classificado";
    return SUBTHEME_LABELS[subtheme] ?? snakeCaseToTitle(subtheme);
}

/** Retorna a descrição breve do eixo para os cards de navegação. */
export function getAxisDescription(axis?: string | null): string {
    if (!axis) return "";
    return AXIS_DESCRIPTIONS[axis] ?? "";
}

/** Retorna a descrição breve do subtema para as seções de navegação. */
export function getSubthemeDescription(subtheme?: string | null): string {
    if (!subtheme) return "";
    return SUBTHEME_DESCRIPTIONS[subtheme] ?? "";
}

/**
 * Retorna o rótulo em português da tag.
 * Se a tag não estiver no dicionário, converte snake_case para Palavras Com Maiúsculas
 * como fallback legível — nunca expõe o id técnico puro.
 */
export function getTagLabel(tag: string): string {
    return TAG_LABELS[tag] ?? snakeCaseToTitle(tag);
}

/** Converte snake_case para Palavras Com Maiúsculas (fallback para identificadores desconhecidos). */
function snakeCaseToTitle(value: string): string {
    return value
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export function ensureSupportedLanguageCodes(languages?: string[] | null): SupportedLanguage[] {
    if (!languages || languages.length === 0) return [...SUPPORTED_LANGUAGES];
    const normalized = languages.filter((lang): lang is SupportedLanguage =>
        (SUPPORTED_LANGUAGES as readonly string[]).includes(lang)
    );
    return normalized.length > 0 ? normalized : [...SUPPORTED_LANGUAGES];
}
