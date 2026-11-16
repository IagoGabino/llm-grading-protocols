---
id: advanced-retention-cleanup-modularity
slug: advanced-retention-cleanup-modularity
title: "Qualidade de Código — Modularidade na Rotina de Limpeza por Política de Retenção"
axis: codeQuality
subtheme: modularity
difficulty: advanced
promptTemplate: advanced-retention-cleanup-modularity
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [modularity, single_responsibility, cohesion, retention_policy, audit, tenant, refactoring]
references:
  - id: ref-1
    title: "Clean Code: A Handbook of Agile Software Craftsmanship"
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
    title: "Extract Function — Refactoring Catalog"
    type: technical_blog
    url: "https://refactoring.com/catalog/extractFunction.html"
    relevance: 4
    confidence: 4
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Single Responsibility Principle — Robert C. Martin (The Principles of OOD)"
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
    - id: responsibility_identification
      name: Identificação das responsabilidades misturadas
      weight: 0.20
      description: >
        Reconhece e nomeia explicitamente as responsabilidades acumuladas na função original:
        aplicação da política de retenção (cálculo do limite de data e regras de proteção),
        avaliação de elegibilidade de cada registro, agrupamento por tenant,
        execução da remoção, registro de auditoria e montagem do resumo final.
        Não confunde "quebrar em funções menores" com identificar responsabilidades reais.
    - id: module_decomposition
      name: Decomposição em módulos coesos
      weight: 0.35
      description: >
        Extrai unidades com propósito único e bem definido — por exemplo:
        política de retenção (calcular limite de data e verificar elegibilidade),
        agrupamento por tenant, executor de remoção por tenant,
        registro de auditoria e montagem do resumo.
        Nenhum módulo acumula mais de uma dessas responsabilidades.
        A função orquestradora torna-se fina, delegando cada responsabilidade a um módulo próprio.
    - id: behavior_preservation
      name: Preservação do comportamento e do contrato público
      weight: 0.25
      description: >
        A função `runRetentionCleanup(records, config, deps)` mantém exatamente a mesma
        assinatura e produz o mesmo resultado: registros bloqueados (`locked: true`) ou
        sob `legalHold: true` são sempre ignorados; registros mais antigos que
        `config.retentionDays` dias a partir de `config.referenceDate` e não protegidos
        são removidos; remoções são agrupadas por `tenantId`; auditoria é registrada
        por tenant; o resumo retornado contém `totalRemoved`, `totalSkipped`, `byTenant`
        e `errors`, conforme especificado.
    - id: testability
      name: Testabilidade das unidades extraídas
      weight: 0.10
      description: >
        As unidades extraídas são testáveis de forma isolada: a política de retenção
        pode ser verificada sem dependências externas; a elegibilidade pode ser
        testada por registro individual; o agrupador não depende de remoção ou auditoria;
        o executor de remoção recebe dependência injetada e é testável com substitutos.
    - id: reasoning
      name: Justificativa dos limites dos módulos e trade-offs
      weight: 0.10
      description: >
        Explica quais responsabilidades foram separadas, por que cada módulo extraído é
        coeso, como a testabilidade melhorou e quais são os trade-offs da decomposição
        escolhida em relação a alternativas (ex.: separar auditoria do executor vs. mantê-la
        acoplada; granularidade do módulo de política vs. misturar elegibilidade com agrupamento).
---

<!-- SECTION:statement -->
O módulo abaixo executa a rotina de limpeza de dados antigos de uma plataforma multi-tenant conforme política de retenção configurável. A função `runRetentionCleanup` é funcional, mas concentra em um único bloco: a aplicação da política de retenção, a avaliação de elegibilidade de cada registro, o agrupamento por tenant, a execução da remoção, o registro de auditoria e a montagem do resumo final.

**Regras de negócio (para preservação de comportamento):**

- **Política de retenção:** o limite de data é calculado subtraindo `config.retentionDays` dias de `config.referenceDate`. Registros com `createdAt` anterior ao limite são candidatos a remoção.
- **Elegibilidade:** um registro é elegível para remoção somente se `createdAt` for anterior ao limite de retenção **E** `locked !== true` **E** `legalHold !== true`. Registros que falham em qualquer dessas condições são ignorados (skipped).
- **Agrupamento:** os registros elegíveis devem ser agrupados por `tenantId` antes de executar as remoções.
- **Execução:** para cada tenant, chamar `deps.remover(tenantId, ids)` com a lista de ids elegíveis daquele tenant. Se `deps.remover` lançar erro, o tenant é registrado em `errors` com a mensagem de erro; os demais tenants continuam sendo processados.
- **Auditoria:** após cada tentativa por tenant (bem-sucedida ou não), chamar `deps.audit(tenantId, { removed, skipped, error? })` com as contagens daquele tenant.
- **Resumo:** retornar `{ totalRemoved, totalSkipped, byTenant, errors }` onde `byTenant` é um mapa de `tenantId → { removed, skipped }` apenas para tenants com tentativa bem-sucedida, e `errors` é uma lista de `{ tenantId, message }`.

**Contrato público (imutável — não altere a assinatura):**
- `runRetentionCleanup(records, config, deps)` → `{ totalRemoved, totalSkipped, byTenant, errors }`
  - `records`: lista de objetos com `{ id, tenantId, createdAt: Date, type, locked, legalHold }`.
  - `config`: objeto com `{ retentionDays: number, referenceDate: Date }`.
  - `deps`: objeto com `{ remover(tenantId, ids): void, audit(tenantId, summary): void }`.

**Tarefa:** refatore `runRetentionCleanup` extraindo módulos coesos que separem claramente: a política de retenção (cálculo do limite e verificação de elegibilidade), o agrupamento por tenant, a execução de remoção por tenant, o registro de auditoria e a montagem do resumo. **Não altere o comportamento** descrito acima nem a assinatura pública. Justifique suas decisões de modularização em um **raciocínio separado**, incluindo os trade-offs da decomposição escolhida.

```javascript
// retentionCleanup.js

function runRetentionCleanup(records, config, deps) {
  const limitDate = new Date(config.referenceDate);
  limitDate.setDate(limitDate.getDate() - config.retentionDays);

  let totalRemoved = 0;
  let totalSkipped = 0;
  const byTenant = {};
  const errors = [];

  // agrupar por tenant, separando elegíveis de ignorados
  const groups = {};
  for (const record of records) {
    if (!groups[record.tenantId]) {
      groups[record.tenantId] = { eligible: [], skipped: 0 };
    }
    const isExpired = record.createdAt < limitDate;
    const isProtected = record.locked === true || record.legalHold === true;
    if (isExpired && !isProtected) {
      groups[record.tenantId].eligible.push(record.id);
    } else {
      groups[record.tenantId].skipped += 1;
      totalSkipped += 1;
    }
  }

  // executar remoção por tenant, registrar auditoria e acumular resumo
  for (const [tenantId, group] of Object.entries(groups)) {
    const ids = group.eligible;
    const skipped = group.skipped;
    try {
      deps.remover(tenantId, ids);
      totalRemoved += ids.length;
      byTenant[tenantId] = { removed: ids.length, skipped };
      deps.audit(tenantId, { removed: ids.length, skipped });
    } catch (err) {
      errors.push({ tenantId, message: err.message });
      deps.audit(tenantId, { removed: 0, skipped, error: err.message });
    }
  }

  return { totalRemoved, totalSkipped, byTenant, errors };
}

module.exports = { runRetentionCleanup };
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// retentionCleanup.js

// TODO: extraia módulos coesos para:
//   - política de retenção (cálculo do limite de data e verificação de elegibilidade por registro)
//   - agrupamento dos registros elegíveis por tenant
//   - execução de remoção por tenant (com tratamento de erro individual)
//   - registro de auditoria por tenant
//   - montagem do resumo final
// Preserve exatamente o comportamento e a assinatura descritos no enunciado.

/**
 * Executa a rotina de limpeza de dados antigos conforme política de retenção.
 * @param {Array<{ id: string, tenantId: string, createdAt: Date, type: string, locked: boolean, legalHold: boolean }>} records
 * @param {{ retentionDays: number, referenceDate: Date }} config
 * @param {{ remover(tenantId: string, ids: string[]): void, audit(tenantId: string, summary: object): void }} deps
 * @returns {{ totalRemoved: number, totalSkipped: number, byTenant: object, errors: Array<{ tenantId: string, message: string }> }}
 * NÃO altere esta assinatura.
 */
function runRetentionCleanup(records, config, deps) {
  // TODO: use seus módulos extraídos aqui
}

module.exports = { runRetentionCleanup };
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# retention_cleanup.py
from datetime import date, timedelta
from typing import Any

# TODO: extraia módulos coesos para:
#   - política de retenção (cálculo do limite de data e verificação de elegibilidade por registro)
#   - agrupamento dos registros elegíveis por tenant
#   - execução de remoção por tenant (com tratamento de erro individual)
#   - registro de auditoria por tenant
#   - montagem do resumo final
# Preserve exatamente o comportamento e a assinatura descritos no enunciado.


def run_retention_cleanup(records: list[dict[str, Any]], config: dict[str, Any], deps: dict[str, Any]) -> dict[str, Any]:
    """
    Executa a rotina de limpeza de dados antigos conforme política de retenção.

    Args:
        records: lista de dicts com { id, tenant_id, created_at: date, type, locked, legal_hold }.
        config: dict com { retention_days: int, reference_date: date }.
        deps: dict com { 'remover': callable(tenant_id, ids), 'audit': callable(tenant_id, summary) }.

    Returns:
        dict com { total_removed, total_skipped, by_tenant, errors }

    NÃO altere esta assinatura.
    TODO: use seus módulos extraídos aqui.
    """
    pass
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// RetentionCleanup.java
import java.time.LocalDate;
import java.util.*;
import java.util.function.BiConsumer;

public class RetentionCleanup {

    // TODO: extraia métodos (ou classes auxiliares) coesos para:
    //   - política de retenção (cálculo do limite de data e verificação de elegibilidade por registro)
    //   - agrupamento dos registros elegíveis por tenant
    //   - execução de remoção por tenant (com tratamento de erro individual)
    //   - registro de auditoria por tenant
    //   - montagem do resumo final
    // Preserve exatamente o comportamento e a assinatura descritos no enunciado.

    public record RetentionRecord(
        String id,
        String tenantId,
        LocalDate createdAt,
        String type,
        boolean locked,
        boolean legalHold
    ) {}

    public record RetentionConfig(int retentionDays, LocalDate referenceDate) {}

    public record CleanupSummary(
        int totalRemoved,
        int totalSkipped,
        Map<String, Map<String, Integer>> byTenant,
        List<Map<String, String>> errors
    ) {}

    public interface Remover {
        void remove(String tenantId, List<String> ids);
    }

    public interface Auditor {
        void audit(String tenantId, Map<String, Object> summary);
    }

    /**
     * Executa a rotina de limpeza de dados antigos conforme política de retenção.
     *
     * @param records lista de registros de atividade
     * @param config  configuração com retentionDays e referenceDate
     * @param remover dependência de remoção por tenant
     * @param auditor dependência de auditoria por tenant
     * @return resumo com totalRemoved, totalSkipped, byTenant e errors
     *
     * NÃO altere esta assinatura.
     */
    public CleanupSummary runRetentionCleanup(
            List<RetentionRecord> records,
            RetentionConfig config,
            Remover remover,
            Auditor auditor) {
        // TODO: use seus métodos extraídos aqui
        return null;
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Responsabilidades identificadas no código original:**
- Cálculo do limite de data de retenção (política).
- Avaliação de elegibilidade de cada registro (expirado + não protegido).
- Agrupamento dos registros por `tenantId` (elegíveis vs. ignorados).
- Execução da remoção por tenant via `deps.remover` com tratamento de erro individual.
- Registro de auditoria por tenant via `deps.audit`.
- Acumulação e montagem do resumo final (`totalRemoved`, `totalSkipped`, `byTenant`, `errors`).

**Módulos esperados:**

- `computeRetentionLimit(config)` — recebe `config` e retorna a data-limite; não conhece registros.
- `isEligible(record, limitDate)` — verifica se um único registro é candidato a remoção (expirado, não bloqueado, sem legalHold); testável com qualquer combinação de campos.
- `groupByTenant(records, limitDate)` — recebe a lista de registros e a data-limite; retorna mapa de `tenantId → { eligible: [ids], skipped: number }` sem executar remoção nem auditoria.
- `executeRemovalForTenant(tenantId, group, deps)` — chama `deps.remover`, trata erro, registra `deps.audit` e retorna `{ removed, skipped, error? }` para aquele tenant.
- `buildSummary(results)` — recebe lista de resultados por tenant e monta o objeto final `{ totalRemoved, totalSkipped, byTenant, errors }`.
- `runRetentionCleanup(records, config, deps)` — orquestrador fino que chama os módulos acima em sequência.

**Preservação de comportamento obrigatória:**
- `locked: true` ou `legalHold: true` → sempre ignorado, independente de `createdAt`.
- `createdAt < limitDate` e não protegido → elegível para remoção.
- Erro em `deps.remover` para um tenant não interrompe os demais tenants.
- `deps.audit` é chamado para todo tenant que teve tentativa (com ou sem erro).
- `byTenant` contém apenas tenants com remoção bem-sucedida; `errors` lista tenants com falha.

**Ganhos esperados:** cada módulo é testável isoladamente sem dependências externas; `runRetentionCleanup` torna-se um orquestrador de chamadas; a política de retenção pode ser alterada sem tocar no agrupador ou no executor; o executor pode ser substituído por um simulador nos testes sem alterar a lógica de agrupamento ou auditoria.

**Trade-offs aceitáveis:** manter `executeRemovalForTenant` e auditoria no mesmo método (coesão de operação por tenant vs. separação absoluta de concerns); colocar `buildSummary` inline no orquestrador quando o resumo for trivial. O que não é aceito: função orquestradora que ainda mistura cálculo de elegibilidade com agrupamento ou remoção.
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
- A questao esta corretamente enquadrada em `codeQuality/modularity`: o foco e separar responsabilidades acumuladas em uma rotina funcional, sem transformar a tarefa em arquitetura, scheduler, banco real, filas ou microsservicos.
- A dificuldade `advanced` esta adequada, pois a refatoracao exige preservar um contrato publico com politica de retencao, elegibilidade, agrupamento por tenant, remocao com erro isolado, auditoria e resumo final.
- O formato e compativel com questao `code`, com `inputConfig.type: code`, templates para JavaScript, Python e Java, rubrica com pesos somando 1.0 e `solution-outline` presente.
- O codigo inicial e funcional, mas monolitico de forma realista: mistura calculo da politica, classificacao dos registros, agrupamento, chamada de dependencia externa, tratamento de erro, auditoria e acumulacao do retorno.
- O enunciado deixa explicito que o comportamento e o contrato publico devem ser preservados, incluindo a assinatura publica e as regras de registros protegidos, erros por tenant, auditoria e composicao do resumo.
- As responsabilidades misturadas estao claras e a tarefa exige decomposicao em unidades coesas; nao e resolvivel apenas com renomeacao ou extracao cosmetica de uma funcao pequena.
- Os templates das tres linguagens representam a mesma tarefa e as mesmas regras de dominio em convencoes idiomaticas de cada linguagem.
- A rubrica avalia criterios observaveis: identificacao das responsabilidades, decomposicao coesa, preservacao de comportamento, testabilidade das unidades e justificativa dos limites dos modulos.
- O prompt de avaliacao segue o padrao real de `prompts/`, usa placeholders compativeis com questao `code` e reproduz corretamente os ids e pesos da rubrica.
- As referencias sao plausiveis e conservadoras para modularidade e refatoracao, permanecendo corretamente como `suggested_not_verified`.
<!-- /REVIEW:comments -->
