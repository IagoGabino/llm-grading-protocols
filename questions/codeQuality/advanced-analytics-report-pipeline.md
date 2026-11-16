---
id: advanced-analytics-report-pipeline
slug: advanced-analytics-report-pipeline
title: "Qualidade de Código — Pipeline Compartilhado de Exportação de Relatórios de Analytics"
axis: codeQuality
subtheme: duplication_and_reuse
difficulty: advanced
promptTemplate: advanced-analytics-report-pipeline
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [dry, template_method, strategy, higher_order_functions, pipeline, refactoring, duplication, analytics, serialization]
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
    title: "Don't Repeat Yourself (DRY) — The Pragmatic Programmer — Hunt & Thomas"
    type: book
    url: null
    relevance: 5
    confidence: 5
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Clean Code: A Handbook of Agile Software Craftsmanship — Robert C. Martin"
    type: book
    url: null
    relevance: 4
    confidence: 5
    supports: [rubric, statement]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Template Method Pattern — Design Patterns: Elements of Reusable Object-Oriented Software"
    type: book
    url: null
    relevance: 4
    confidence: 5
    supports: [solution-outline, rubric]
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
    - id: duplication_identification
      name: Identificação precisa da duplicação e dos pontos de variação
      weight: 0.20
      description: >
        Identifica e nomeia explicitamente as cinco etapas duplicadas nas três funções:
        validação de filtros, filtragem e ordenação dos registros, seleção de campos,
        cálculo de totais e registro de auditoria. Distingue claramente essas etapas
        compartilhadas da única parte variável: a serialização final específica de cada
        formato (CSV, JSON, HTML). Não confunde modularidade local com reutilização real.
    - id: pipeline_extraction
      name: Extração do pipeline comum reutilizável
      weight: 0.35
      description: >
        Extrai as cinco etapas compartilhadas para uma abstração reutilizável (função de
        pipeline, Higher-Order Function, Template Method ou equivalente) que executa
        validação, filtragem, ordenação, seleção de campos, cálculo de totais e auditoria
        de forma centralizada. A abstração recebe ou invoca a serialização específica como
        ponto de variação (callback, Strategy, método hook ou mapa de serializadores),
        sem replicar nenhuma das cinco etapas para cada formato.
    - id: variation_isolation
      name: Preservação dos pontos de variação isolados
      weight: 0.20
      description: >
        A serialização específica de cada formato (CSV, JSON, HTML) permanece isolada
        do pipeline comum, sem vazar lógica de formato para dentro das etapas compartilhadas.
        O pipeline não contém condicionais (if/switch) baseadas no tipo de formato.
        Cada serializador conhece apenas seu formato e não as etapas comuns.
    - id: behavior_preservation
      name: Preservação das assinaturas públicas e do comportamento
      weight: 0.15
      description: >
        As três funções públicas (exportToCsv, exportToJson, exportToHtml) mantêm
        exatamente as mesmas assinaturas do código original (recebem filters e records,
        retornam string no formato correto). Todas as regras de negócio das etapas
        compartilhadas — validação de filtros obrigatórios, filtragem, ordenação ascendente
        por timestamp, seleção de campos, cálculo de totais e auditoria — são preservadas
        com comportamento idêntico ao original.
    - id: reasoning
      name: Justificativa dos trade-offs da abstração escolhida
      weight: 0.10
      description: >
        Explica qual abstração foi escolhida (pipeline comum, Higher-Order Function,
        Template Method, Strategy, mapa de serializadores ou equivalente), por que essa
        escolha elimina a duplicação estrutural sem criar generalização excessiva ou
        obscura, e quais são os trade-offs em relação a alternativas viáveis (ex.:
        uma única função genérica com switch por formato seria falso DRY; uma hierarquia
        de classes profunda seria over-engineering).
---

<!-- SECTION:statement -->
O módulo abaixo exporta relatórios de uso de uma plataforma interna de analytics. Existem três funções públicas — `exportToCsv`, `exportToJson` e `exportToHtml` — cada uma gerando o mesmo relatório em um formato diferente. As funções são funcionais, mas duplicam um pipeline comum de **cinco etapas** idênticas: (1) validação dos filtros obrigatórios, (2) filtragem e ordenação dos registros, (3) seleção dos campos relevantes, (4) cálculo de totais e (5) registro de auditoria. Apenas a **serialização final** muda entre elas.

**Regras do pipeline compartilhado (devem ser preservadas integralmente):**

- **Validação:** `filters.startDate` e `filters.endDate` são obrigatórios; se ausentes, lança `Error('filters.startDate and filters.endDate are required')`.
- **Filtragem:** mantém somente registros cujo `record.date` está entre `filters.startDate` e `filters.endDate` (ambos inclusivos). Se `filters.userId` for fornecido, mantém apenas registros com `record.userId === filters.userId`.
- **Ordenação:** ordena os registros filtrados em ordem ascendente por `record.timestamp`.
- **Seleção de campos:** projeta cada registro para `{ userId, action, date, duration }` — descartando quaisquer outros campos.
- **Cálculo de totais:** computa `totalRecords` (contagem dos registros filtrados) e `totalDuration` (soma de `duration` de todos os registros filtrados).
- **Auditoria:** chama `auditLog.record({ exportedAt: new Date().toISOString(), format: '<formato>', filters, totalRecords })` antes de retornar.

**Serialização específica por formato (o único ponto de variação):**
- `exportToCsv(filters, records)` — retorna os registros projetados como string CSV (`userId,action,date,duration` + uma linha por registro) com um rodapé `# Total records: N | Total duration: Ns`.
- `exportToJson(filters, records)` — retorna um JSON string com `{ exportedAt, filters, totalRecords, totalDuration, records: [...] }`.
- `exportToHtml(filters, records)` — retorna uma string HTML com tabela dos registros e um parágrafo de totais (`<p>Total records: N | Total duration: Ns</p>`).

**Contrato público (imutável — não altere as assinaturas):**
- `exportToCsv(filters, records)` → string CSV
- `exportToJson(filters, records)` → string JSON
- `exportToHtml(filters, records)` → string HTML

**Tarefa:** refatore o módulo abaixo. Extraia o pipeline comum (validação, filtragem, ordenação, seleção de campos, cálculo de totais e auditoria) para **uma abstração reutilizável** e mantenha cada serializador isolado como ponto de variação. **Não altere as assinaturas das três funções públicas.** Justifique suas decisões em um **raciocínio separado**, incluindo os trade-offs da abstração escolhida.

```javascript
// reportExporter.js

function exportToCsv(filters, records) {
  if (!filters.startDate || !filters.endDate) {
    throw new Error('filters.startDate and filters.endDate are required');
  }

  let filtered = records.filter(r =>
    r.date >= filters.startDate && r.date <= filters.endDate &&
    (filters.userId == null || r.userId === filters.userId)
  );
  filtered.sort((a, b) => a.timestamp - b.timestamp);

  const projected = filtered.map(r => ({ userId: r.userId, action: r.action, date: r.date, duration: r.duration }));
  const totalRecords = projected.length;
  const totalDuration = projected.reduce((sum, r) => sum + r.duration, 0);

  auditLog.record({ exportedAt: new Date().toISOString(), format: 'csv', filters, totalRecords });

  const header = 'userId,action,date,duration';
  const rows = projected.map(r => `${r.userId},${r.action},${r.date},${r.duration}`).join('\n');
  const footer = `# Total records: ${totalRecords} | Total duration: ${totalDuration}s`;
  return `${header}\n${rows}\n${footer}`;
}

function exportToJson(filters, records) {
  if (!filters.startDate || !filters.endDate) {
    throw new Error('filters.startDate and filters.endDate are required');
  }

  let filtered = records.filter(r =>
    r.date >= filters.startDate && r.date <= filters.endDate &&
    (filters.userId == null || r.userId === filters.userId)
  );
  filtered.sort((a, b) => a.timestamp - b.timestamp);

  const projected = filtered.map(r => ({ userId: r.userId, action: r.action, date: r.date, duration: r.duration }));
  const totalRecords = projected.length;
  const totalDuration = projected.reduce((sum, r) => sum + r.duration, 0);

  auditLog.record({ exportedAt: new Date().toISOString(), format: 'json', filters, totalRecords });

  const exportedAt = new Date().toISOString();
  return JSON.stringify({ exportedAt, filters, totalRecords, totalDuration, records: projected });
}

function exportToHtml(filters, records) {
  if (!filters.startDate || !filters.endDate) {
    throw new Error('filters.startDate and filters.endDate are required');
  }

  let filtered = records.filter(r =>
    r.date >= filters.startDate && r.date <= filters.endDate &&
    (filters.userId == null || r.userId === filters.userId)
  );
  filtered.sort((a, b) => a.timestamp - b.timestamp);

  const projected = filtered.map(r => ({ userId: r.userId, action: r.action, date: r.date, duration: r.duration }));
  const totalRecords = projected.length;
  const totalDuration = projected.reduce((sum, r) => sum + r.duration, 0);

  auditLog.record({ exportedAt: new Date().toISOString(), format: 'html', filters, totalRecords });

  const rows = projected.map(r =>
    `<tr><td>${r.userId}</td><td>${r.action}</td><td>${r.date}</td><td>${r.duration}</td></tr>`
  ).join('\n');
  return `<table><thead><tr><th>userId</th><th>action</th><th>date</th><th>duration</th></tr></thead><tbody>\n${rows}\n</tbody></table>\n<p>Total records: ${totalRecords} | Total duration: ${totalDuration}s</p>`;
}

module.exports = { exportToCsv, exportToJson, exportToHtml };
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// reportExporter.js

// TODO: extraia o pipeline comum (validação, filtragem, ordenação, seleção de campos,
//       cálculo de totais e auditoria) para uma abstração reutilizável.
//       O ponto de variação — a serialização específica de cada formato — deve ser
//       passado como parâmetro (callback, objeto serializador ou equivalente).
//       O pipeline NÃO deve conter condicionais baseadas no formato de saída.

// TODO: implemente cada serializador (csv, json, html) de forma isolada,
//       conhecendo apenas seu formato — sem lógica de pipeline dentro deles.

/**
 * Exporta relatório de uso em formato CSV.
 * @param {{ startDate: string, endDate: string, userId?: string }} filters
 * @param {Array<{ userId: string, action: string, date: string, duration: number, timestamp: number, [key: string]: any }>} records
 * @returns {string} string no formato CSV
 * NÃO altere esta assinatura.
 */
function exportToCsv(filters, records) {
  // TODO: use o pipeline comum extraído com o serializador CSV.
}

/**
 * Exporta relatório de uso em formato JSON.
 * @param {{ startDate: string, endDate: string, userId?: string }} filters
 * @param {Array<{ userId: string, action: string, date: string, duration: number, timestamp: number, [key: string]: any }>} records
 * @returns {string} string JSON
 * NÃO altere esta assinatura.
 */
function exportToJson(filters, records) {
  // TODO: use o pipeline comum extraído com o serializador JSON.
}

/**
 * Exporta relatório de uso em formato HTML.
 * @param {{ startDate: string, endDate: string, userId?: string }} filters
 * @param {Array<{ userId: string, action: string, date: string, duration: number, timestamp: number, [key: string]: any }>} records
 * @returns {string} string HTML
 * NÃO altere esta assinatura.
 */
function exportToHtml(filters, records) {
  // TODO: use o pipeline comum extraído com o serializador HTML.
}

module.exports = { exportToCsv, exportToJson, exportToHtml };
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# report_exporter.py
from typing import Any

# TODO: extraia o pipeline comum (validação, filtragem, ordenação, seleção de campos,
#       cálculo de totais e auditoria) para uma abstração reutilizável.
#       O ponto de variação — a serialização específica de cada formato — deve ser
#       passado como parâmetro (callable, objeto serializador ou equivalente).
#       O pipeline NÃO deve conter condicionais baseadas no formato de saída.

# TODO: implemente cada serializador (csv, json, html) de forma isolada,
#       conhecendo apenas seu formato — sem lógica de pipeline dentro deles.


def export_to_csv(filters: dict[str, Any], records: list[dict[str, Any]]) -> str:
    """
    Exporta relatório de uso em formato CSV.

    Args:
        filters: { 'startDate': str, 'endDate': str, 'userId'?: str }
        records: lista de registros de uso

    Returns:
        string no formato CSV

    NÃO altere esta assinatura.
    TODO: use o pipeline comum extraído com o serializador CSV.
    """
    pass


def export_to_json(filters: dict[str, Any], records: list[dict[str, Any]]) -> str:
    """
    Exporta relatório de uso em formato JSON.

    Args:
        filters: { 'startDate': str, 'endDate': str, 'userId'?: str }
        records: lista de registros de uso

    Returns:
        string JSON

    NÃO altere esta assinatura.
    TODO: use o pipeline comum extraído com o serializador JSON.
    """
    pass


def export_to_html(filters: dict[str, Any], records: list[dict[str, Any]]) -> str:
    """
    Exporta relatório de uso em formato HTML.

    Args:
        filters: { 'startDate': str, 'endDate': str, 'userId'?: str }
        records: lista de registros de uso

    Returns:
        string HTML

    NÃO altere esta assinatura.
    TODO: use o pipeline comum extraído com o serializador HTML.
    """
    pass
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// ReportExporter.java
import java.util.*;
import java.util.stream.*;

public class ReportExporter {

    // TODO: extraia o pipeline comum (validação, filtragem, ordenação, seleção de campos,
    //       cálculo de totais e auditoria) para um método ou classe reutilizável.
    //       O ponto de variação — a serialização específica de cada formato — deve ser
    //       recebido como parâmetro (interface funcional, Strategy, método hook ou equivalente).
    //       O pipeline NÃO deve conter condicionais baseadas no formato de saída.

    // TODO: implemente cada serializador (CSV, JSON, HTML) de forma isolada,
    //       conhecendo apenas seu formato — sem lógica de pipeline dentro deles.

    /**
     * Exporta relatório de uso em formato CSV.
     *
     * @param filters mapa com chaves "startDate" (String), "endDate" (String) e
     *                opcionalmente "userId" (String)
     * @param records lista de registros de uso; cada Map contém pelo menos
     *                "userId", "action", "date", "duration" (Number) e "timestamp" (long)
     * @return string no formato CSV
     *
     * NÃO altere esta assinatura.
     */
    public String exportToCsv(Map<String, Object> filters, List<Map<String, Object>> records) {
        // TODO: use o pipeline comum extraído com o serializador CSV.
        return "";
    }

    /**
     * Exporta relatório de uso em formato JSON.
     *
     * @param filters mapa com chaves "startDate" (String), "endDate" (String) e
     *                opcionalmente "userId" (String)
     * @param records lista de registros de uso
     * @return string JSON
     *
     * NÃO altere esta assinatura.
     */
    public String exportToJson(Map<String, Object> filters, List<Map<String, Object>> records) {
        // TODO: use o pipeline comum extraído com o serializador JSON.
        return "";
    }

    /**
     * Exporta relatório de uso em formato HTML.
     *
     * @param filters mapa com chaves "startDate" (String), "endDate" (String) e
     *                opcionalmente "userId" (String)
     * @param records lista de registros de uso
     * @return string HTML
     *
     * NÃO altere esta assinatura.
     */
    public String exportToHtml(Map<String, Object> filters, List<Map<String, Object>> records) {
        // TODO: use o pipeline comum extraído com o serializador HTML.
        return "";
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Partes duplicadas identificadas no código original (pipeline comum):**
- Validação dos filtros obrigatórios (`startDate`, `endDate`).
- Filtragem dos registros por intervalo de datas e userId opcional.
- Ordenação ascendente por `timestamp`.
- Projeção (seleção de campos) para `{ userId, action, date, duration }`.
- Cálculo de totais: `totalRecords` e `totalDuration`.
- Registro de auditoria via `auditLog.record(...)`.

**Único ponto de variação (não deve entrar no pipeline):**
- Serialização final: CSV, JSON ou HTML. Cada formato conhece apenas sua serialização.

**Abstrações recomendadas:**

- **JavaScript — Higher-Order Function com callback de serialização:**
  ```
  function runExportPipeline(filters, records, format, serialize) {
    // validação, filtragem, ordenação, projeção, totais, auditoria
    return serialize(projected, totalRecords, totalDuration, filters);
  }

  function exportToCsv(filters, records) {
    return runExportPipeline(filters, records, 'csv', (rows, total, dur) => { /* csv */ });
  }
  ```

- **Python — função de pipeline com callable de serialização:**
  ```
  def run_export_pipeline(filters, records, fmt, serialize):
      # validação, filtragem, ordenação, projeção, totais, auditoria
      return serialize(projected, total_records, total_duration, filters)

  def export_to_csv(filters, records):
      return run_export_pipeline(filters, records, 'csv', _serialize_csv)
  ```

- **Java — método de template com interface funcional (ou Strategy):**
  ```
  @FunctionalInterface
  interface ReportSerializer {
      String serialize(List<Map<String,Object>> rows, int total, long duration, Map<String,Object> filters);
  }

  private String runExportPipeline(Map<String,Object> filters,
                                   List<Map<String,Object>> records,
                                   String format,
                                   ReportSerializer serializer) { ... }

  public String exportToCsv(Map<String,Object> filters, List<Map<String,Object>> records) {
      return runExportPipeline(filters, records, "csv", this::serializeCsv);
  }
  ```

**Alternativas equivalentes aceitas:**
- Mapa de serializadores por formato (`{ csv: fn, json: fn, html: fn }`) chamado pelo pipeline.
- Strategy com interface `Serializer` e implementações `CsvSerializer`, `JsonSerializer`, `HtmlSerializer`.
- Template Method com classe base abstrata e método `serialize()` nas subclasses.

**O que NÃO é aceito como solução adequada:**
- Pipeline com `if/switch` baseado no formato dentro da função comum (falso DRY).
- Extração das cinco etapas em funções privadas usadas em cada exportador separadamente (apenas modularidade local, não reutilização real — a duplicação estrutural persiste).
- Hierarquia de classes profunda que adiciona complexidade sem benefício claro.

**Preservação obrigatória do contrato:**
- `exportToCsv(filters, records)`, `exportToJson(filters, records)`, `exportToHtml(filters, records)` — assinaturas inalteradas.
- Validação idêntica (mesma mensagem de erro), filtragem, ordenação, projeção, totais e auditoria com comportamento idêntico ao original.
- Cada formato gera exatamente o mesmo output que gerava nas funções originais.
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
- A questão está corretamente enquadrada em `codeQuality/duplication_and_reuse`: o problema central é eliminar duplicação estrutural de um pipeline repetido em três exportadores, não apenas melhorar modularidade local ou redesenhar uma arquitetura ampla de relatórios.
- A dificuldade `advanced` está adequada, pois a resposta precisa reconhecer várias etapas compartilhadas, preservar contratos públicos, isolar serializadores como pontos de variação e justificar trade-offs de abstração sem transformar o exercício em overengineering.
- O formato é compatível com questão `code`, com `inputConfig.type: code`, templates coerentes para JavaScript, Python e Java, e a mesma tarefa de refatoração representada nas três linguagens.
- O código inicial contém duplicação relevante e observável: validação de filtros, filtragem, ordenação, projeção de campos, cálculo de totais e auditoria aparecem repetidos nas três funções, enquanto CSV, JSON e HTML mantêm diferenças legítimas de serialização.
- O enunciado deixa claro que as assinaturas públicas e o comportamento devem ser preservados, incluindo mensagem de erro, filtros, ordenação, campos projetados, totais, auditoria e formato de saída.
- A tarefa exige uma abstração reutilizável para o pipeline comum, mas aceita implementações equivalentes como Higher-Order Function, callable, Strategy, Template Method ou mapa de serializadores, sem impor um padrão único como resposta correta.
- Os pontos de variação por formato estão claros e a rubrica avalia critérios observáveis: identificação da duplicação, qualidade da abstração, isolamento da variação, preservação de comportamento e justificativa técnica.
- O `solution-outline` é consistente com o enunciado: aceita alternativas equivalentes, rejeita falso DRY com `if/switch` por formato no pipeline e também rejeita hierarquias profundas sem benefício claro.
- O prompt de avaliação segue o padrão real de `prompts/`, usa placeholders compatíveis com questão `code` e reproduz corretamente os ids e pesos da rubrica.
- As referências são plausíveis e conservadoras para o tema, permanecendo corretamente como `suggested_not_verified`.
<!-- /REVIEW:comments -->
