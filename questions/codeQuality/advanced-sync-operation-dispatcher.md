---
id: advanced-sync-operation-dispatcher
slug: advanced-sync-operation-dispatcher
title: "Qualidade de Código — Dispatcher de Operações de Sincronização Corporativa"
axis: codeQuality
subtheme: design_and_refactoring
difficulty: advanced
promptTemplate: advanced-sync-operation-dispatcher
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [design_patterns, strategy, open_closed_principle, cyclomatic_complexity, refactoring, dispatch_table, polymorphism]
references:
  - id: ref-1
    title: "Design Patterns: Elements of Reusable Object-Oriented Software"
    type: book
    url: null
    relevance: 5
    confidence: 5
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Refactoring: Improving the Design of Existing Code (2nd ed.) — Martin Fowler"
    type: book
    url: null
    relevance: 5
    confidence: 5
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Replace Conditional with Polymorphism — Refactoring Catalog"
    type: technical_blog
    url: "https://refactoring.com/catalog/replaceConditionalWithPolymorphism.html"
    relevance: 5
    confidence: 4
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "The Open-Closed Principle — Robert C. Martin (The Principles of OOD)"
    type: article
    url: null
    relevance: 4
    confidence: 4
    supports: [rubric, statement]
    verificationStatus: suggested_not_verified
generationMetrics:
  validFormatSelfCheck: true
  rubricCriteriaCount: 5
  referencesSuggested: true
  plannedDifficulty: advanced
  expectedType: code
  taxonomyFit: strong
inputConfig:
  type: code
  language: javascript
rubric:
  version: v1
  criteria:
    - id: conditional_elimination
      name: Eliminação da cadeia condicional principal
      weight: 0.30
      description: >
        Substitui a estrutura switch/case ou if/else que discrimina o tipo de operação
        por polimorfismo (Strategy/Command) ou por um mapa de handlers (dispatch table),
        de forma que o processador principal não contenha mais nenhuma bifurcação baseada
        em tipo de operação. A complexidade ciclomática da função/método de entrada
        deve cair para O(1) em relação ao número de operações suportadas.
    - id: handler_encapsulation
      name: Encapsulamento da lógica de cada operação
      weight: 0.25
      description: >
        Cada tipo de operação (ADD_GROUP, REMOVE_PERMISSION, UPDATE_ROLE, SUSPEND_ACCOUNT)
        tem sua regra de negócio isolada em classe, função ou objeto distinto,
        sem que um handler conheça os detalhes dos demais. Nenhuma função auxiliar
        acumula mais de uma regra de operação.
    - id: ocp_adherence
      name: Adesão ao Open-Closed Principle
      weight: 0.25
      description: >
        A estrutura refatorada permite registrar um novo tipo de operação
        sem modificar o processador principal nem nenhum handler existente.
        O aluno demonstra isso no código ou justifica explicitamente como
        a extensão seria feita (ex.: registrar novo handler no mapa/registry).
    - id: behavior_preservation
      name: Preservação do contrato de entrada e saída
      weight: 0.10
      description: >
        A assinatura do método/função de entrada permanece idêntica à do código original
        (recebe lista de operações, retorna lista de resultados com { operationId, status, error? }).
        Todos os comportamentos especificados — iteração sobre o batch, aplicação das regras
        de negócio de cada operação, acumulação de resultado por operação — são preservados.
    - id: reasoning
      name: Justificativa arquitetural
      weight: 0.10
      description: >
        Explica qual padrão de design foi escolhido (Strategy, Command, dispatch table),
        por que ele elimina a complexidade ciclomática, como o OCP é satisfeito e
        quais são os trade-offs em relação ao código procedural original.
---

<!-- SECTION:statement -->
O serviço abaixo processa um payload em lote contendo operações de sincronização de acessos de funcionários corporativos. Cada operação possui um `type` e um `payload` com os dados necessários. A função `processBatch` é funcional, mas é um antipadrão procedural: uma única função com um `switch/case` profundo que mistura a descoberta do tipo de operação com a execução da regra de negócio de cada sincronização, resultando em alta complexidade ciclomática e acoplamento rígido.

**Regras de negócio por tipo de operação (para preservação de comportamento):**

- **`ADD_GROUP`** — Adiciona o funcionário ao grupo indicado (`payload.groupId`) se ele ainda não for membro. Se já for membro, retorna `status: 'skipped'` com `error: 'already_member'`.
- **`REMOVE_PERMISSION`** — Remove a permissão indicada (`payload.permissionKey`) do conjunto de permissões do funcionário. Se a permissão não existir, retorna `status: 'skipped'` com `error: 'permission_not_found'`.
- **`UPDATE_ROLE`** — Atualiza o campo `role` do funcionário para `payload.newRole`. Se `payload.newRole` for nulo ou vazio, retorna `status: 'failed'` com `error: 'invalid_role'`.
- **`SUSPEND_ACCOUNT`** — Marca o funcionário como `active: false` e registra `payload.reason` em `suspensionReason`. Se a conta já estiver inativa, retorna `status: 'skipped'` com `error: 'already_suspended'`.

**Contrato de entrada e saída (imutável — não altere a assinatura):**
- Entrada: `processBatch(operations, db)` — `operations` é uma lista de `{ operationId, type, employeeId, payload }`; `db` é um objeto mapeando `employeeId` → estado do funcionário.
- Saída: lista de `{ operationId, status, error? }` — `status` ∈ `['success', 'skipped', 'failed']`.

**Tarefa:** refatore `processBatch` eliminando a estrutura condicional que discrimina o tipo de operação. Aplique o padrão de design mais adequado (Strategy, Command ou mapa de handlers) de forma que novas operações possam ser suportadas no futuro **sem modificar o processador principal**. **Não altere a assinatura de `processBatch` nem o formato de retorno.** Justifique suas decisões em um **raciocínio separado**.

```javascript
// syncService.js

function processBatch(operations, db) {
  const results = [];

  for (const op of operations) {
    const employee = db[op.employeeId];
    let result;

    switch (op.type) {
      case 'ADD_GROUP': {
        if (!employee.groups) employee.groups = [];
        if (employee.groups.includes(op.payload.groupId)) {
          result = { operationId: op.operationId, status: 'skipped', error: 'already_member' };
        } else {
          employee.groups.push(op.payload.groupId);
          result = { operationId: op.operationId, status: 'success' };
        }
        break;
      }
      case 'REMOVE_PERMISSION': {
        if (!employee.permissions) employee.permissions = [];
        const idx = employee.permissions.indexOf(op.payload.permissionKey);
        if (idx === -1) {
          result = { operationId: op.operationId, status: 'skipped', error: 'permission_not_found' };
        } else {
          employee.permissions.splice(idx, 1);
          result = { operationId: op.operationId, status: 'success' };
        }
        break;
      }
      case 'UPDATE_ROLE': {
        if (!op.payload.newRole || op.payload.newRole.trim() === '') {
          result = { operationId: op.operationId, status: 'failed', error: 'invalid_role' };
        } else {
          employee.role = op.payload.newRole.trim();
          result = { operationId: op.operationId, status: 'success' };
        }
        break;
      }
      case 'SUSPEND_ACCOUNT': {
        if (!employee.active) {
          result = { operationId: op.operationId, status: 'skipped', error: 'already_suspended' };
        } else {
          employee.active = false;
          employee.suspensionReason = op.payload.reason;
          result = { operationId: op.operationId, status: 'success' };
        }
        break;
      }
      default: {
        result = { operationId: op.operationId, status: 'failed', error: 'unknown_operation' };
      }
    }

    results.push(result);
  }

  return results;
}

module.exports = { processBatch };
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// syncService.js

// TODO: defina seus handlers/estratégias para cada tipo de operação aqui.
//       Cada handler deve encapsular exclusivamente a regra de negócio do seu tipo.

// TODO: registre os handlers em um mapa ou registry de forma que processBatch
//       não precise conhecer os tipos de operação diretamente.

/**
 * Processa um lote de operações de sincronização corporativa.
 * @param {Array<{ operationId: string, type: string, employeeId: string, payload: object }>} operations
 * @param {Object.<string, { groups?: string[], permissions?: string[], role?: string, active?: boolean, suspensionReason?: string }>} db
 * @returns {Array<{ operationId: string, status: string, error?: string }>}
 */
function processBatch(operations, db) {
  // TODO: substitua o switch/case por despacho via padrão de design.
  //       Não altere a assinatura nem o formato de retorno.
}

module.exports = { processBatch };
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# sync_service.py
from typing import Any

# TODO: defina seus handlers/estratégias para cada tipo de operação aqui.
#       Cada handler deve encapsular exclusivamente a regra de negócio do seu tipo.

# TODO: registre os handlers em um dicionário ou registry de forma que process_batch
#       não precise conhecer os tipos de operação diretamente.


def process_batch(
    operations: list[dict[str, Any]],
    db: dict[str, dict[str, Any]]
) -> list[dict[str, Any]]:
    """
    Processa um lote de operações de sincronização corporativa.

    Args:
        operations: lista de { operationId, type, employeeId, payload }
        db: mapa employeeId -> estado do funcionário

    Returns:
        lista de { operationId, status, error? }

    TODO: substitua o if/elif por despacho via padrão de design.
          Não altere a assinatura nem o formato de retorno.
    """
    pass
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// SyncService.java
import java.util.*;

public class SyncService {

    // TODO: defina interfaces/classes de handler para cada tipo de operação.
    //       Cada implementação deve encapsular exclusivamente sua regra de negócio.

    // TODO: registre os handlers em um Map ou registry de forma que processBatch
    //       não contenha condicionais baseadas em tipo de operação.

    /**
     * Processa um lote de operações de sincronização corporativa.
     *
     * @param operations lista de operações: cada Map contém "operationId", "type",
     *                   "employeeId" e "payload" (Map<String, Object>)
     * @param db         mapa de employeeId para o estado do funcionário (Map<String, Object>)
     * @return lista de resultados: cada Map contém "operationId", "status" e opcionalmente "error"
     *
     * NÃO altere esta assinatura nem o formato de retorno.
     */
    public List<Map<String, Object>> processBatch(
            List<Map<String, Object>> operations,
            Map<String, Map<String, Object>> db) {

        // TODO: substitua o switch/case por despacho via padrão de design.
        return new ArrayList<>();
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Problema central no código original:** o `switch/case` em `processBatch` concentra o despacho e a lógica de negócio de todas as operações em um único bloco. Cada novo tipo de operação exige modificar `processBatch`, violando o OCP e aumentando a complexidade ciclomática linearmente.

**Padrão recomendado — Strategy com dispatch table (mapa de handlers):**

- Definir uma interface/tipo de handler: `(op, employee) → { status, error? }`.
- Criar um handler por tipo de operação:
  - `addGroupHandler` — verifica membership e insere no grupo.
  - `removePermissionHandler` — localiza e remove a permissão; retorna `skipped` se ausente.
  - `updateRoleHandler` — valida e aplica `newRole`; retorna `failed` se inválido.
  - `suspendAccountHandler` — verifica `active` e aplica suspensão; retorna `skipped` se já inativo.
- Registrar os handlers num mapa: `{ ADD_GROUP: addGroupHandler, REMOVE_PERMISSION: ..., ... }`.
- `processBatch` passa a ser um orquestrador sem condicionais de tipo:
  ```
  para cada op:
    handler = registry[op.type] ?? unknownHandler
    result  = handler(op, db[op.employeeId])
    results.push({ operationId: op.operationId, ...result })
  ```
- Adicionar nova operação no futuro: criar um novo handler e registrá-lo no mapa — sem tocar em `processBatch` nem nos handlers existentes.

**Alternativa equivalente (Command):** encapsular cada operação em uma classe com método `execute(employee, payload)` e usar um registry de classes por tipo; aceitar essa abordagem como equivalente ao Strategy.

**Preservação obrigatória do contrato:**
- `processBatch(operations, db)` → `Array<{ operationId, status, error? }>` (inalterado).
- Todas as quatro regras de negócio (ADD_GROUP, REMOVE_PERMISSION, UPDATE_ROLE, SUSPEND_ACCOUNT) com seus casos de skip/failed continuam idênticas.
- O handler `default`/`unknown_operation` deve ser mantido ou equivalente.
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
Recomendação: accept.

Principais pontos:
- A questão está fortemente alinhada a `codeQuality/design_and_refactoring`: o foco é substituir despacho procedural por Strategy, Command, polimorfismo ou dispatch table, com preservação explícita do Open-Closed Principle, não apenas extrair funções privadas.
- A dificuldade `advanced` está adequada, pois exige uma abstração arquitetural local, separação de handlers por operação, registro dinâmico e justificativa dos trade-offs do desenho escolhido.
- O formato é compatível com questão `code`, com templates coerentes para JavaScript, Python e Java e assinatura de entrada preservada em cada linguagem.
- O código inicial apresenta deliberadamente alta complexidade ciclomática por `switch/case`, mistura despacho com regras de negócio e deixa claro o acoplamento ao conjunto atual de operações.
- As operações de negócio estão suficientemente claras e observáveis: `ADD_GROUP`, `REMOVE_PERMISSION`, `UPDATE_ROLE`, `SUSPEND_ACCOUNT` e o caso de operação desconhecida têm comportamento esperado descrito.
- Os templates das três linguagens permitem soluções orientadas a objetos ou funcionais avançadas, como interfaces/classes de handlers, objetos Strategy, funções registradas em mapa ou Command.
- A rubrica penaliza corretamente respostas que apenas reorganizam o `switch/case` em funções auxiliares, especialmente pelos critérios `conditional_elimination`, `handler_encapsulation` e `ocp_adherence`.
- O `solution-outline` aponta para Strategy, Command e dispatch table de forma compatível com o enunciado, sem restringir indevidamente soluções equivalentes.
- O prompt de avaliação segue o padrão real de `prompts/`, usa placeholders compatíveis com `inputConfig.type: code` e reproduz corretamente os ids e pesos da rubrica.
- As referências são plausíveis para o tema e permanecem corretamente marcadas como `suggested_not_verified`, sem URLs inventadas ou tratadas como verificadas.
<!-- /REVIEW:comments -->
