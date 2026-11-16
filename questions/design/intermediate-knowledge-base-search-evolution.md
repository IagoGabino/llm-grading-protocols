---
id: intermediate-knowledge-base-search-evolution
slug: intermediate-knowledge-base-search-evolution
title: "Design e Arquitetura — Evolução da Busca Textual em Base de Conhecimento Interna"
axis: architecture
subtheme: scalability_and_performance
difficulty: intermediate
promptTemplate: intermediate-knowledge-base-search-evolution
supportedLanguages: [none]
tags: [full_text_search, search_index, scalability, trade_off, sql_like, elasticsearch]
references:
  - id: ref-1
    title: "PostgreSQL Full Text Search — Official Documentation"
    type: official_docs
    url: "https://www.postgresql.org/docs/current/textsearch.html"
    relevance: 5
    confidence: 5
    supports: [statement, solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Designing Data-Intensive Applications — Martin Kleppmann"
    type: book
    url: null
    relevance: 4
    confidence: 4
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Meilisearch Documentation — Why Meilisearch"
    type: official_docs
    url: "https://www.meilisearch.com/docs"
    relevance: 3
    confidence: 4
    supports: [solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Elasticsearch Guide — Full Text Queries"
    type: official_docs
    url: "https://www.elastic.co/guide/en/elasticsearch/reference/current/full-text-queries.html"
    relevance: 4
    confidence: 4
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
generationMetrics:
  validFormatSelfCheck: true
  rubricCriteriaCount: 4
  referencesSuggested: true
  plannedDifficulty: intermediate
  expectedType: multi-section
  taxonomyFit: strong
inputConfig:
  type: multi-section
  sections:
    - id: diagnostico
      label: "Diagnóstico do problema atual"
      placeholder: "Por que a busca com LIKE '%termo%' degrada com o crescimento da base? Qual é a causa raiz do problema de performance e relevância?"
    - id: proposta
      label: "Proposta de solução arquitetural"
      placeholder: "Qual abordagem você escolhe: full-text search no banco relacional, serviço dedicado de busca, ou uma estratégia híbrida/incremental? Justifique com base nos requisitos e no contexto da equipe."
    - id: indexacao
      label: "Estratégia de indexação e atualização"
      placeholder: "Como o índice de busca será mantido atualizado quando artigos forem criados, editados ou removidos? Como lidar com visibilidade e permissões dos artigos nos resultados?"
    - id: tradeoffs
      label: "Trade-offs e limitações"
      placeholder: "Quais são as principais desvantagens da solução escolhida em termos de complexidade operacional, consistência, custo e capacidade de evolução futura?"
rubric:
  version: v1
  criteria:
    - id: problem_diagnosis
      name: Diagnóstico do gargalo
      weight: 0.25
      description: "Explica por que LIKE '%query%' é ineficiente em escala: impossibilidade de uso de índice B-tree, full table scan, alta CPU em banco relacional. Aponta que o problema é duplo: performance e qualidade dos resultados (sem relevância, sem stemming, sem tolerância a erros)."
    - id: solution_choice
      name: Escolha e justificativa da solução
      weight: 0.30
      description: "Propõe uma solução arquitetural clara — full-text search no banco (ex.: PostgreSQL tsvector/GIN), serviço dedicado (Elasticsearch, OpenSearch, Meilisearch, Typesense) ou abordagem incremental. Justifica a escolha com base no tamanho da base, capacidade operacional da equipe e requisitos de relevância. Não força uma única resposta como correta."
    - id: index_and_sync
      name: Estratégia de indexação e atualização
      weight: 0.30
      description: "Descreve como manter o índice atualizado após criação, edição ou remoção de artigos (trigger no banco, evento via fila, sincronização periódica ou CDC). Aborda visibilidade/permissão: filtragem no momento da busca ou exclusão de artigos não públicos da indexação. Aceita pequena defasagem se justificada."
    - id: tradeoffs_analysis
      name: Análise de trade-offs
      weight: 0.15
      description: "Identifica limitações concretas da solução escolhida: full-text no banco mantém complexidade baixa mas tem relevância limitada e ainda consome o banco principal; serviço dedicado melhora relevância e isola carga mas adiciona infraestrutura e sincronização; abordagem incremental reduz risco mas exige planejamento de migração."
---

<!-- SECTION:statement -->
Uma equipe de engenharia mantém uma **central interna de suporte técnico** com uma base de conhecimento composta por artigos, runbooks e perguntas frequentes. O sistema é usado por analistas e desenvolvedores para encontrar respostas a problemas operacionais e de produto.

**Situação atual:**

A tabela `articles` tem a seguinte estrutura relevante:

| Campo        | Descrição                                                    |
|--------------|--------------------------------------------------------------|
| `id`         | Identificador único do artigo                                |
| `title`      | Título do artigo                                             |
| `body`       | Corpo completo em texto simples ou Markdown                  |
| `tags`       | Lista de tags associadas (ex.: `["deploy", "postgres"]`)     |
| `updatedAt`  | Data da última atualização                                   |
| `visibility` | `public` (todos os usuários) ou `internal` (apenas equipe)   |

A busca atual é executada com a seguinte lógica:

```sql
SELECT id, title, updatedAt
FROM articles
WHERE (title ILIKE '%query%' OR body ILIKE '%query%')
  AND visibility IN ('public', 'internal')
ORDER BY updatedAt DESC
LIMIT 20;
```

**Problema:**

Com o crescimento para aproximadamente **80 mil artigos**, a situação se agravou:

- As consultas com `ILIKE '%query%'` realizam varredura completa da tabela a cada busca.
- Nos horários de pico, o banco relacional apresenta **alta utilização de CPU**, afetando outras operações críticas da plataforma.
- Os resultados **não consideram relevância** — artigos recentes e irrelevantes podem aparecer antes de artigos mais precisos.
- Termos aproximados, variações de conjugação, busca por tags e ordenação por pertinência não são suportados.
- A equipe é composta por **3 a 5 desenvolvedores backend** e não possui especialistas em infraestrutura dedicados.

**Requisitos funcionais (RFs):**

- **RF1:** Buscar artigos por termo textual, cobrindo título, corpo e tags.
- **RF2:** Respeitar a visibilidade do artigo (`public` ou `internal`) nos resultados.
- **RF3:** Ordenar os resultados por relevância e, como critério secundário, por data de atualização.
- **RF4:** Permitir que artigos sejam criados, editados e removidos sem deixar o índice de busca permanentemente desatualizado.

**Requisitos não funcionais (NFRs):**

- **NFR1:** Reduzir a carga de CPU no banco relacional principal durante buscas.
- **NFR2:** Melhorar a latência percebida da busca (atualmente entre 2–5 s em horários de pico).
- **NFR3:** Manter a solução operável por uma equipe pequena, sem dependências críticas de especialistas externos.
- **NFR4:** Aceitar pequena defasagem entre a atualização de um artigo e sua disponibilidade no índice de busca, desde que justificada.
- **NFR5:** Permitir evolução gradual — a solução adotada hoje não deve bloquear melhorias futuras.

**Alternativas a avaliar:**

| Alternativa | Descrição |
|-------------|-----------|
| **Full-text search no banco relacional** | Usar recursos nativos do banco (ex.: `tsvector`, índices GIN no PostgreSQL) para substituir o `LIKE` por uma busca textual mais eficiente |
| **Serviço dedicado de busca** | Introduzir uma solução externa como Elasticsearch, OpenSearch, Meilisearch ou Typesense, mantendo o banco relacional como fonte de verdade |
| **Abordagem incremental (híbrida)** | Começar com full-text no banco para ganhos imediatos, com planejamento explícito de migração para serviço dedicado se necessário |

**Tarefa:**

Avalie as alternativas e proponha uma evolução arquitetural para a busca da base de conhecimento. Sua resposta deve:

1. **Diagnosticar** por que a busca atual com `ILIKE '%query%'` degrada com o crescimento da base.
2. **Propor uma solução arquitetural** justificada com base nos requisitos e no contexto da equipe.
3. **Descrever a estratégia de indexação e atualização** do índice de busca quando artigos mudam.
4. **Discutir trade-offs e limitações** da solução escolhida.

**Não é necessário escrever código. Foque na decisão arquitetural e sua justificativa.**
<!-- /SECTION:statement -->

<!-- SECTION:solution-outline -->
**Essência da solução esperada:**

A resposta deve tomar uma decisão arquitetural clara e justificada. As três alternativas são defensáveis conforme o contexto apresentado; o que diferencia uma resposta forte é a qualidade do diagnóstico, a coerência da escolha com os requisitos e a profundidade na discussão de como manter o índice atualizado e como lidar com permissões e relevância.

---

### Diagnóstico do problema atual

O operador `LIKE '%query%'` (ou `ILIKE` para case-insensitive) é fundamentalmente incompatível com o uso de índices B-tree porque o padrão começa com `%`, forçando o banco a realizar uma **varredura sequencial de toda a tabela** (`seq scan`). Com 80 mil artigos, o campo `body` tende a ser longo, o que multiplica o custo da operação. O efeito é duplo:

1. **Performance:** CPU elevada no banco a cada busca, latência proporcional ao tamanho da tabela — não ao número de resultados.
2. **Qualidade dos resultados:** ordenação apenas por `updatedAt` não reflete pertinência. Sem stemming, ranking, suporte a sinônimos ou tolerância a erros tipográficos, a busca é fraca para uma base de conhecimento real.

Um índice comum (`CREATE INDEX ON articles(title)`) não resolve o problema com `%query%`: só funcionaria para `query%` (prefixo). A solução exige um mecanismo específico para busca textual.

---

### Alternativas e decisões defensáveis

#### Opção A — Full-text search no banco relacional (ex.: PostgreSQL `tsvector` + índice GIN)

**Quando é a melhor escolha:** equipe pequena, orçamento restrito, base de dados ainda gerenciável (~100k documentos), necessidade de ganho imediato sem nova infraestrutura.

**Como funciona no PostgreSQL:**
- Adicionar coluna `search_vector tsvector` computada a partir de `title`, `body` e `tags` com pesos diferentes (ex.: título com peso `A`, tags com peso `B`, corpo com peso `C`).
- Criar índice `GIN` na coluna `search_vector`.
- Manter o vetor atualizado via trigger `BEFORE INSERT OR UPDATE` ou por coluna gerada (`GENERATED ALWAYS AS`).
- Consultar com `search_vector @@ plainto_tsquery('pt', :query) ORDER BY ts_rank(search_vector, ...) DESC`.

**Vantagens:** sem nova infraestrutura, banco continua fonte de verdade, trigger garante consistência imediata, suporte a ranking básico e stemming.

**Limitações:** ainda consome CPU do banco principal (embora muito menos que `LIKE`); ranking é básico comparado a motores dedicados; suporte a typo tolerance e facetas é limitado; escala tem teto prático.

#### Opção B — Serviço dedicado de busca (Elasticsearch, OpenSearch, Meilisearch, Typesense)

**Quando é a melhor escolha:** relevância é crítica para a experiência do usuário, volume deve crescer além de ~200k documentos, equipe aceita custo operacional de um serviço adicional.

**Como funciona:**
- O banco relacional continua como fonte de verdade dos artigos.
- Ao criar/editar/remover um artigo, a aplicação publica um evento em uma fila (ex.: job enfileirado, mensagem em fila de mensagens) ou usa CDC (Change Data Capture) para sincronizar o serviço de busca.
- O serviço de busca indexa `title`, `body` e `tags` com relevância configurável.
- A aplicação consulta o serviço de busca para obter IDs ordenados por relevância e, opcionalmente, busca metadados complementares no banco.

**Vantagens:** relevância muito superior (BM25, typo tolerance, facetas, highlight); desacopla carga do banco principal; escala independentemente.

**Limitações:** nova infraestrutura para operar e monitorar; sincronização é eventual (defasagem entre escrita no banco e disponibilidade na busca); complexidade operacional maior; possíveis custos de hospedagem; necessidade de tratar falhas de sincronização.

#### Opção C — Abordagem incremental (full-text no banco agora, serviço dedicado depois)

**Quando é a melhor escolha:** equipe quer ganho imediato sem comprometer-se com nova infraestrutura, mas reconhece que a solução atual tem teto e planeja evolução.

**Estratégia:** implementar full-text search no banco (Opção A) como intervenção de curto prazo; definir métricas de trigger para migração (ex.: latência acima de X ms, volume acima de Y documentos, satisfação de busca abaixo de Z); planejar a introdução de serviço dedicado quando o threshold for atingido.

**Vantagens:** redução imediata de risco, aprendizado gradual, investimento proporcional à necessidade.

**Limitações:** exige retrabalho parcial na migração; pode criar dívida técnica se o plano de migração não for mantido vivo.

---

### Estratégia de indexação e atualização

O ponto crítico é garantir que o índice de busca reflita o estado atual dos artigos sem exigir sincronização manual. As abordagens aceitáveis são:

| Mecanismo | Quando usar | Consistência | Complexidade |
|-----------|-------------|-------------|--------------|
| **Trigger no banco** (para full-text nativo) | Opção A | Imediata | Baixa |
| **Hook na camada de serviço** (após salvar artigo) | Opções B e C | Eventual (milissegundos a segundos) | Média |
| **Fila de eventos** (job assíncrono de indexação) | Opção B com volume alto | Eventual (segundos a minutos) | Média-alta |
| **Reindexação periódica** (cron de sync) | Fallback, não principal | Eventual (minutos) | Baixa, mas frágil |

**Tratamento de visibilidade/permissões:**
- **Abordagem A (filtro na consulta):** indexar todos os artigos (inclusive `internal`) e filtrar por `visibility` no momento da busca. Mais simples; garante que artigos internos não apareçam para usuários sem permissão.
- **Abordagem B (exclusão do índice):** indexar apenas artigos `public` e manter índice separado para `internal`. Reduz volume, mas complica a sincronização ao mudar visibilidade.
- **Recomendação:** para equipes pequenas, filtro na consulta é mais seguro e simples.

**Remoção de artigos:** ao deletar um artigo, o índice deve ser atualizado para evitar resultados "zumbis". Com trigger, é automático. Com serviço externo, o evento de deleção deve ser propagado explicitamente.

---

### Trade-offs centrais

| Dimensão | Full-text no banco | Serviço dedicado | Incremental |
|----------|-------------------|-----------------|-------------|
| **Complexidade operacional** | Baixa | Alta | Média |
| **Qualidade de relevância** | Média | Alta | Média → Alta |
| **Carga no banco principal** | Reduzida (mas não eliminada) | Eliminada da busca | Reduzida |
| **Consistência do índice** | Imediata (trigger) | Eventual | Imediata → Eventual |
| **Custo de adoção** | Baixo | Médio-alto | Baixo inicial |
| **Teto de escala** | ~200k–500k docs | Milhões de docs | Varia |

Uma resposta fraca lista tecnologias sem critério. Uma resposta forte define a escolha com base nos NFRs (equipe pequena, evolução gradual, redução de carga no banco) e descreve concretamente como manter o índice consistente e como tratar visibilidade.
<!-- /SECTION:solution-outline -->

<!-- REVIEW:metrics -->
{
  "quality": {
    "technicalCorrectness": 5,
    "statementClarity": 5,
    "rubricAlignment": 5,
    "difficultyAlignment": 5
  },
  "compatibility": {
    "promptAlignment": 5,
    "formatValid": true
  },
  "recommendation": "accept",
  "statusAfterReview": "accept",
  "mainIssue": "none",
  "revisionLevelNeeded": "none",
  "suggestedChangedParts": ["none"],
  "referencesStatus": "present"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendacao: accept.

Principais pontos:
- A questao pertence corretamente a architecture/scalability_and_performance: o cenario e concreto, comum em sistemas internos de suporte e centrado em performance e relevancia de busca textual, sem desviar para cache distribuido, CDN ou catalogo generico.
- A dificuldade intermediate esta adequada: exige diagnostico do gargalo de ILIKE/LIKE com wildcard inicial, comparacao pragmatica entre full-text no banco, servico dedicado e evolucao incremental, alem de trade-offs de operacao e consistencia.
- O formato multi-section esta valido, sem template de codigo e sem defaultLanguage; supportedLanguages [none] e adequado para uma questao sem implementacao.
- O enunciado, as secoes de resposta, a rubrica e o solution-outline cobrem os pontos centrais esperados: causa raiz do gargalo, escolha justificada, manutencao do indice, relevancia, permissoes/visibilidade, consistencia e limitacoes.
- O prompt de avaliacao segue o padrao real de prompts/architecture, usa placeholders compativeis com as quatro secoes textuais e reproduz corretamente os ids e pesos da rubrica.
- O solution-outline nao forca Elasticsearch/OpenSearch como unica resposta correta; full-text nativo e abordagem incremental permanecem alternativas validas quando bem justificadas.
- As referencias estao presentes, plausiveis e relevantes, mantendo verificationStatus como suggested_not_verified.
<!-- /REVIEW:comments -->
