---
id: easy-project-status-badge-refactoring
slug: easy-project-status-badge-refactoring
title: "Qualidade de Código — Refatoração do Badge de Status de Projeto"
axis: codeQuality
subtheme: design_and_refactoring
difficulty: easy
promptTemplate: easy-project-status-badge-refactoring
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [refactoring, lookup_table, configuration_table, conditionals, design, extensibility, project_status]
references:
  - id: ref-1
    title: "Refactoring: Improving the Design of Existing Code (2nd ed.) — Martin Fowler"
    type: book
    url: null
    relevance: 5
    confidence: 5
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Replace Conditional with Lookup Table — Refactoring Catalog (Fowler)"
    type: technical_blog
    url: "https://refactoring.com/catalog/replaceConditionalWithLookupTable.html"
    relevance: 5
    confidence: 3
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Clean Code: A Handbook of Agile Software Craftsmanship — Robert C. Martin"
    type: book
    url: null
    relevance: 4
    confidence: 5
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
    - id: centralization
      name: Centralização das regras em estrutura de dados
      weight: 0.35
      description: "Substitui as condicionais por uma tabela, dicionário, mapa ou constante equivalente que associa cada status ao seu objeto de apresentação (label, color, sortOrder). As regras de apresentação deixam de estar espalhadas no corpo da função e passam a residir em um único ponto de definição."
    - id: behavior_preservation
      name: Preservação do comportamento
      weight: 0.30
      description: "A função refatorada retorna exatamente os mesmos objetos que o código original para cada status: planned → {label:'Planejado', color:'gray', sortOrder:1}, in_progress → {label:'Em andamento', color:'blue', sortOrder:2}, blocked → {label:'Bloqueado', color:'red', sortOrder:3}, done → {label:'Concluído', color:'green', sortOrder:4}, cancelled → {label:'Cancelado', color:'dark', sortOrder:5}. O fallback para status desconhecido também é preservado: {label:'Desconhecido', color:'gray', sortOrder:99}."
    - id: fallback_clarity
      name: Clareza do fallback para status desconhecido
      weight: 0.15
      description: "O tratamento de status desconhecido está explícito e centralizado: o retorno padrão deve ser declarado de forma clara (ex.: valor padrão no acesso à tabela, ou verificação explícita após consulta), sem ficar escondido em um ramo else genérico ou duplicado."
    - id: reasoning
      name: Justificativa de manutenibilidade e evolução
      weight: 0.15
      description: "Explica por que a tabela de configuração facilita adicionar um novo status no futuro (ex.: apenas inserir uma entrada na tabela) e por que o código original era difícil de manter (regras espalhadas em condicionais repetitivas)."
    - id: simplicity
      name: Simplicidade da solução
      weight: 0.05
      description: "A refatoração permanece focada e proporcional à dificuldade easy: sem decomposição excessiva em múltiplas funções desnecessárias, sem introduzir padrões de projeto formais (Strategy, Command etc.) nem classes complexas além do que a tarefa requer."
---

<!-- SECTION:statement -->
O painel interno de acompanhamento de projetos exibe um **badge** para cada projeto, com uma label de exibição, uma cor e uma ordem de classificação. A função abaixo retorna essas três informações dado um status de projeto. O código é funcional, mas usa uma cadeia de `if/else` que espalha as regras de apresentação pelo corpo da função, tornando difícil adicionar um novo status sem mexer em múltiplos trechos.

**Regras de apresentação (para preservação de comportamento):**

| Status       | label          | color   | sortOrder |
|--------------|----------------|---------|-----------|
| `planned`    | `Planejado`    | `gray`  | `1`       |
| `in_progress`| `Em andamento` | `blue`  | `2`       |
| `blocked`    | `Bloqueado`    | `red`   | `3`       |
| `done`       | `Concluído`    | `green` | `4`       |
| `cancelled`  | `Cancelado`    | `dark`  | `5`       |
| desconhecido | `Desconhecido` | `gray`  | `99`      |

**Tarefa:** refatore a função abaixo substituindo a cadeia de `if/else` por uma tabela, dicionário, mapa ou constante equivalente que centralize todas as regras de apresentação em um único ponto. A lógica de apresentação e o fallback para status desconhecido devem ser preservados. Apresente sua refatoração e justifique a decisão em um **raciocínio separado**.

```javascript
// projectStatusBadge.js
function getStatusBadge(status) {
  if (status === 'planned') {
    return { label: 'Planejado', color: 'gray', sortOrder: 1 };
  } else if (status === 'in_progress') {
    return { label: 'Em andamento', color: 'blue', sortOrder: 2 };
  } else if (status === 'blocked') {
    return { label: 'Bloqueado', color: 'red', sortOrder: 3 };
  } else if (status === 'done') {
    return { label: 'Concluído', color: 'green', sortOrder: 4 };
  } else if (status === 'cancelled') {
    return { label: 'Cancelado', color: 'dark', sortOrder: 5 };
  } else {
    return { label: 'Desconhecido', color: 'gray', sortOrder: 99 };
  }
}

module.exports = { getStatusBadge };
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// projectStatusBadge.js

// TODO: centralize as regras de apresentação em uma tabela, dicionário ou constante.
//       A função getStatusBadge deve consultar essa estrutura em vez de usar if/else.

/**
 * Retorna o badge de apresentação para um status de projeto.
 * @param {string} status - status do projeto
 * @returns {{ label: string, color: string, sortOrder: number }}
 */
function getStatusBadge(status) {
  // TODO: implemente aqui a versão refatorada, preservando todos os retornos
  //       descritos no enunciado, incluindo o fallback para status desconhecido.
  return { label: 'Desconhecido', color: 'gray', sortOrder: 99 };
}

module.exports = { getStatusBadge };
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# project_status_badge.py


# TODO: centralize as regras de apresentação em uma tabela, dicionário ou constante.
#       A função get_status_badge deve consultar essa estrutura em vez de usar if/elif.


def get_status_badge(status: str) -> dict:
    """
    Retorna o badge de apresentação para um status de projeto.

    Args:
        status: status do projeto (ex.: 'planned', 'in_progress', 'blocked', 'done', 'cancelled')

    Returns:
        dict com as chaves 'label', 'color' e 'sort_order'.
        Para status desconhecido: {'label': 'Desconhecido', 'color': 'gray', 'sort_order': 99}

    TODO: implemente aqui a versão refatorada, preservando todos os retornos
          descritos no enunciado, incluindo o fallback para status desconhecido.
    """
    return {'label': 'Desconhecido', 'color': 'gray', 'sort_order': 99}
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// ProjectStatusBadge.java
public class ProjectStatusBadge {

    // TODO: centralize as regras de apresentação em um Map, enum com atributos
    //       ou constante equivalente. O método getStatusBadge deve consultar
    //       essa estrutura em vez de usar if/else ou switch.

    /**
     * Retorna o badge de apresentação para um status de projeto.
     *
     * @param status status do projeto (ex.: "planned", "in_progress", "blocked", "done", "cancelled")
     * @return StatusBadge com label, color e sortOrder.
     *         Para status desconhecido: label="Desconhecido", color="gray", sortOrder=99.
     *
     * TODO: implemente aqui a versão refatorada, preservando todos os retornos
     *       descritos no enunciado, incluindo o fallback para status desconhecido.
     */
    public StatusBadge getStatusBadge(String status) {
        return new StatusBadge("Desconhecido", "gray", 99);
    }

    public record StatusBadge(String label, String color, int sortOrder) {}
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Problema identificado:** a cadeia `if/else` replica o mesmo padrão estrutural para cada status, espalhando `label`, `color` e `sortOrder` em trechos distintos do corpo da função. Adicionar um novo status exige inserir um novo bloco `else if` no meio da função, sem um ponto único de consulta.

**Refatoração esperada — tabela/mapa de configuração:**

- Criar uma constante (objeto literal, dicionário, `Map` ou array de configurações) que associe cada status ao seu conjunto de atributos `{ label, color, sortOrder }`.
- A função passa a fazer uma única consulta nessa estrutura.
- O fallback para status desconhecido é declarado explicitamente: como valor padrão no acesso à tabela (`STATUS_BADGES[status] ?? UNKNOWN_BADGE`) ou como retorno após verificar ausência na tabela.

**Exemplo de estrutura esperada (JavaScript):**
```javascript
const STATUS_BADGES = {
  planned:     { label: 'Planejado',    color: 'gray',  sortOrder: 1  },
  in_progress: { label: 'Em andamento', color: 'blue',  sortOrder: 2  },
  blocked:     { label: 'Bloqueado',    color: 'red',   sortOrder: 3  },
  done:        { label: 'Concluído',    color: 'green', sortOrder: 4  },
  cancelled:   { label: 'Cancelado',    color: 'dark',  sortOrder: 5  },
};
const UNKNOWN_BADGE = { label: 'Desconhecido', color: 'gray', sortOrder: 99 };

function getStatusBadge(status) {
  return STATUS_BADGES[status] ?? UNKNOWN_BADGE;
}
```

**Preservação obrigatória:** todos os seis retornos especificados (cinco status + fallback) devem continuar produzindo exatamente os mesmos valores que o código original.

**Ganho esperado na justificativa:** adicionar um novo status (`archived`, `on_hold` etc.) requer apenas inserir uma nova entrada na tabela, sem alterar a função; o código original exigiria inserir um novo bloco `else if` dentro do corpo da função.
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
    "promptAlignment": 4,
    "formatValid": true
  },
  "recommendation": "minor_revision",
  "statusAfterReview": "needs_human_review",
  "mainIssue": "format",
  "revisionLevelNeeded": "light",
  "suggestedChangedParts": ["template", "prompt"],
  "referencesStatus": "present"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendação: minor_revision.

Principais pontos:
- A questão pertence adequadamente a codeQuality/design_and_refactoring: a tarefa não é apenas melhorar legibilidade, mas substituir condicionais repetitivas por uma estrutura de dados centralizada que reduz dispersão de regras e melhora evolução.
- A dificuldade easy está bem calibrada, pois exige uma refatoração simples por tabela, mapa, dicionário ou constante equivalente, sem padrão de projeto formal, arquitetura pesada ou classes complexas.
- O enunciado explicita os status, labels, cores, sortOrder e fallback, e deixa claro que o comportamento deve ser preservado. A rubrica também cobre centralização, preservação de comportamento, fallback, justificativa e simplicidade com critérios observáveis.
- Os templates JavaScript e Java estão coerentes com o contrato `sortOrder`, mas o template Python usa a chave `sort_order` no docstring e no retorno inicial, enquanto o enunciado, a rubrica, o solution-outline e o prompt de avaliação cobram `sortOrder`. Recomenda-se alinhar esse contrato entre as três linguagens ou ajustar explicitamente o prompt para aceitar a convenção Python, evitando penalização indevida de respostas em Python.
- O prompt de avaliação segue o padrão real de prompts para questões code, usa placeholders compatíveis e reproduz corretamente os ids e pesos da rubrica. O único ajuste recomendado é refletir a decisão sobre `sortOrder` versus `sort_order` para a linguagem Python.
- As referências estão presentes, plausíveis e relevantes para refatoração por tabela de consulta, mantendo `verificationStatus: suggested_not_verified`.
<!-- /REVIEW:comments -->
