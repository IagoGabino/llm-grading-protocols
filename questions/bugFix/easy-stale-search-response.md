---
id: easy-stale-search-response
slug: easy-stale-search-response
title: "Correção de Bug — Resposta Assíncrona Antiga Sobrescrevendo Estado de Busca"
axis: bugFix
subtheme: state_and_lifecycle
difficulty: easy
promptTemplate: easy-stale-search-response
supportedLanguages: [javascript]
defaultLanguage: javascript
tags: [stale_closure, async_state, race_condition, lifecycle, fetch, AbortController]
references:
  - id: ref-1
    title: "AbortController — MDN Web Docs"
    type: official_docs
    url: "https://developer.mozilla.org/en-US/docs/Web/API/AbortController"
    relevance: 5
    confidence: 5
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Using the Fetch API — MDN Web Docs"
    type: official_docs
    url: "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch"
    relevance: 4
    confidence: 5
    supports: [statement, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "You Don't Know JS: Async & Performance — Kyle Simpson"
    type: book
    url: null
    relevance: 3
    confidence: 3
    supports: [rubric, solution-outline]
    verificationStatus: suggested_not_verified
generationMetrics:
  validFormatSelfCheck: true
  rubricCriteriaCount: 5
  referencesSuggested: true
  plannedDifficulty: easy
  expectedType: code
  taxonomyFit: strong
inputConfig:
  type: code
  language: javascript
rubric:
  version: v1
  criteria:
    - id: root_cause
      name: Identificação da causa raiz
      weight: 0.30
      description: Identifica que múltiplas requisições assíncronas concorrentes podem resolver fora de ordem, e que a última chamada a `setEmployees` vence independentemente de qual requisição é mais recente.
    - id: functional_fix
      name: Correção funcional para ignorar resposta obsoleta
      weight: 0.35
      description: Implementa mecanismo para descartar ou cancelar respostas de requisições antigas — usando AbortController, flag booleana `let cancelled`, identificador incremental de requisição ou técnica equivalente — garantindo que apenas a resposta mais recente atualize o estado.
    - id: lifecycle_handling
      name: Tratamento do ciclo de vida do componente
      weight: 0.15
      description: Inclui limpeza ao desmontar o componente (ex. `AbortController.abort()` ou `cancelled = true` no retorno da função de efeito), evitando tentativa de atualização de estado em componente desmontado.
    - id: search_preservation
      name: Preservação do comportamento da busca
      weight: 0.10
      description: A busca continua funcionando corretamente para o termo atual após a correção — a lista de funcionários é atualizada quando a requisição mais recente responde.
    - id: explanation
      name: Justificativa técnica
      weight: 0.10
      description: Explica em linguagem clara por que respostas fora de ordem ocorrem e como a correção garante que somente a resposta do termo mais recente atualize a interface.
---

<!-- SECTION:statement -->
O painel administrativo de RH possui uma tela de busca de funcionários. A cada alteração no campo de texto, o componente chama a API `searchEmployees(query)` e atualiza a lista com os resultados retornados.

**Contrato esperado:**
- A lista exibida deve sempre corresponder ao termo de busca digitado mais recentemente.
- Se uma requisição mais antiga terminar depois de uma mais recente, ela **não deve** sobrescrever a lista.
- Se o componente for desmontado antes de a resposta chegar, a atualização de estado não deve ocorrer.

**Comportamento incorreto (bug):**

O usuário digita rapidamente `"ana"` e logo depois `"anapaula"`. A requisição de `"anapaula"` responde primeiro (150 ms) e exibe a lista correta. Pouco depois, a requisição antiga de `"ana"` responde (300 ms) e **sobrescreve a lista com resultados desatualizados**.

```
[Usuário digita: "ana"]        → requisição A disparada (demora 300 ms)
[Usuário digita: "anapaula"]  → requisição B disparada (demora 150 ms)
[150 ms] resposta B chega → lista exibe funcionários de "anapaula" ✅
[300 ms] resposta A chega → lista exibe funcionários de "ana"      ❌ (sobrescrita!)
```

**Tarefa:** Corrija `EmployeeSearch` para que a lista nunca seja atualizada com a resposta de uma requisição obsoleta. Na sua **linha de raciocínio**, explique: (1) por que requisições antigas podem sobrescrever estado mais recente, (2) qual mecanismo você usou para evitar isso e (3) como o ciclo de vida do componente é tratado.

```javascript
// employee-search.js
import { useState, useEffect } from 'react';
import { searchEmployees } from './api';

function EmployeeSearch() {
  const [query, setQuery]       = useState('');
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    if (!query) {
      setEmployees([]);
      return;
    }

    searchEmployees(query).then((results) => {
      setEmployees(results); // ← bug: sem controle de ordem de resposta
    });
  }, [query]);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar funcionário..."
      />
      <ul>
        {employees.map((emp) => (
          <li key={emp.id}>{emp.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default EmployeeSearch;
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// employee-search.js
import { useState, useEffect } from 'react';
import { searchEmployees } from './api';

function EmployeeSearch() {
  const [query, setQuery]         = useState('');
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    if (!query) {
      setEmployees([]);
      return;
    }

    // TODO: adicione um mecanismo para ignorar respostas de requisições antigas.
    // Dica: você pode usar AbortController, uma flag de cancelamento ou um
    // identificador incremental para garantir que apenas a requisição mais
    // recente atualize o estado.

    searchEmployees(query).then((results) => {
      setEmployees(results);
    });

    // TODO: retorne uma função de limpeza que cancele ou invalide a requisição
    // em andamento quando o componente for desmontado ou quando `query` mudar.
  }, [query]);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar funcionário..."
      />
      <ul>
        {employees.map((emp) => (
          <li key={emp.id}>{emp.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default EmployeeSearch;
<!-- /SECTION:template:javascript -->

<!-- SECTION:solution-outline -->
**Causa raiz**
- O `useEffect` dispara uma nova requisição assíncrona a cada mudança de `query`, mas não há nenhum controle de ordenação. Se a requisição de `"ana"` demorar mais que a de `"anapaula"`, ela resolve por último e chama `setEmployees` com dados desatualizados, sobrescrevendo a lista correta.

**Correções aceitas**

*Opção 1 — Flag de cancelamento (mais simples):*
```javascript
useEffect(() => {
  if (!query) { setEmployees([]); return; }

  let cancelled = false;

  searchEmployees(query).then((results) => {
    if (!cancelled) setEmployees(results);
  });

  return () => { cancelled = true; };
}, [query]);
```

*Opção 2 — AbortController (cancela a requisição de rede):*
```javascript
useEffect(() => {
  if (!query) { setEmployees([]); return; }

  const controller = new AbortController();

  searchEmployees(query, { signal: controller.signal })
    .then((results) => setEmployees(results))
    .catch((err) => {
      if (err.name !== 'AbortError') console.error(err);
    });

  return () => controller.abort();
}, [query]);
```

*Opção 3 — Identificador incremental de requisição:*
```javascript
const requestId = useRef(0);

useEffect(() => {
  if (!query) { setEmployees([]); return; }

  const id = ++requestId.current;

  searchEmployees(query).then((results) => {
    if (id === requestId.current) setEmployees(results);
  });
}, [query]);
```

**Pontos essenciais**
1. A correção mínima é uma flag `cancelled` (ou equivalente) dentro do escopo do efeito.
2. O retorno da função de limpeza do `useEffect` é obrigatório para evitar atualização de estado no componente desmontado.
3. `AbortController` é mais idiomático e cancela a requisição de rede; a flag booleana é igualmente válida para esta questão.
4. O comportamento da busca deve ser preservado: quando o termo muda, a requisição mais recente ainda deve atualizar a lista normalmente.

**Casos de borda cobertos pela correção**
- Usuário digita rápido: apenas a última requisição atualiza a lista.
- Componente desmontado antes da resposta: função de limpeza cancela/invalida a atualização.
- Campo de busca limpo: `setEmployees([])` é chamado imediatamente, sem esperar a API.
<!-- /SECTION:solution-outline -->

<!-- REVIEW:metrics -->
{
  "quality": {
    "technicalCorrectness": 4,
    "statementClarity": 5,
    "rubricAlignment": 5,
    "difficultyAlignment": 5
  },
  "compatibility": {
    "promptAlignment": 5,
    "formatValid": true
  },
  "recommendation": "minor_revision",
  "statusAfterReview": "needs_human_review",
  "mainIssue": "technical",
  "revisionLevelNeeded": "light",
  "suggestedChangedParts": ["solution-outline"],
  "referencesStatus": "present"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendação: minor_revision.

Principais pontos:
- A questão pertence a `bugFix/state_and_lifecycle`: o defeito observável é estado incorreto causado por respostas obsoletas, com requisito explícito de cleanup no ciclo de vida. Não se reduz a debounce, performance, qualidade de código ou arquitetura, e é distinta da questão de listeners globais.
- O enunciado torna a corrida reproduzível, deixa claro que somente a busca mais recente pode atualizar a interface e mantém escopo adequado para `easy`, com correção pequena em um `useEffect` JavaScript.
- A rubrica soma 1.0 e avalia, por critérios observáveis, causa raiz, correção funcional, ciclo de vida, preservação da busca e justificativa. O prompt segue o padrão real de `prompts/`, usa placeholders compatíveis com questão `code` e reproduz corretamente os cinco ids e pesos.
- Recomenda-se corrigir apenas a opção de identificador incremental no `solution-outline`. Como escrita, ela não possui cleanup ou proteção contra atualização após desmontagem; além disso, ao limpar `query`, o retorno antecipado não incrementa o identificador, então uma requisição anterior ainda pode repopular a lista. A alternativa deve invalidar a requisição também no cleanup e no caminho de busca vazia, ser combinada com uma proteção de montagem equivalente, ou deixar de ser apresentada como solução completa para este contrato.
- As alternativas com flag de cancelamento e `AbortController` são consistentes com o enunciado e não ampliam a tarefa para gerenciamento avançado de estado, cache ou arquitetura.
- As referências são plausíveis e conservadoras para o tema e permanecem corretamente como `suggested_not_verified`.
<!-- /REVIEW:comments -->
