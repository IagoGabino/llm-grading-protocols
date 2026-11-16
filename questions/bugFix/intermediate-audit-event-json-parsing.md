---
id: intermediate-audit-event-json-parsing
slug: intermediate-audit-event-json-parsing
title: "Correção de Bug — Parsing Inseguro de JSON em Processamento em Lote de Eventos de Auditoria"
axis: bugFix
subtheme: runtime_errors
difficulty: intermediate
promptTemplate: intermediate-audit-event-json-parsing
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [json_parsing, batch_processing, error_handling, partial_results, audit_events, runtime_error]
references:
  - id: ref-1
    title: "JSON.parse() — MDN Web Docs"
    type: official_docs
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse"
    relevance: 5
    confidence: 5
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Python json module — Python Docs"
    type: official_docs
    url: "https://docs.python.org/3/library/json.html"
    relevance: 5
    confidence: 5
    supports: [statement, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Jackson ObjectMapper — Baeldung Guide"
    type: technical_blog
    url: "https://www.baeldung.com/jackson-object-mapper-tutorial"
    relevance: 4
    confidence: 3
    supports: [statement, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Release It! — Design and Deploy Production-Ready Software (Michael T. Nygard)"
    type: book
    url: null
    relevance: 4
    confidence: 4
    supports: [rubric, solution-outline]
    verificationStatus: suggested_not_verified
generationMetrics:
  validFormatSelfCheck: true
  rubricCriteriaCount: 5
  referencesSuggested: true
  plannedDifficulty: intermediate
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
      weight: 0.25
      description: Identifica que o parsing de JSON é feito sem tratamento de exceção dentro do loop, fazendo com que um único evento com metadata malformado interrompa todo o processamento em lote e descarte os resultados de eventos válidos já processados ou ainda não processados.
    - id: parsing_fix
      name: Tratamento explícito de erro de parsing
      weight: 0.30
      description: Envolve o parsing de JSON em bloco try/catch (JS/Java) ou try/except com json.JSONDecodeError (Python) especificamente para capturar erro de parsing — não usando catch genérico sem discriminação — e continua o loop após o erro.
    - id: partial_processing
      name: Preservação do processamento parcial
      weight: 0.20
      description: Eventos com metadata válido continuam sendo processados normalmente, independentemente de quantos eventos inválidos existam no lote; a função não descarta resultados já acumulados.
    - id: error_recording
      name: Registro claro de erros por item
      weight: 0.15
      description: Eventos inválidos são registrados em uma lista de erros com pelo menos eventId e a mensagem ou motivo do erro de parsing, sem silenciar o problema nem relançar a exceção globalmente.
    - id: explanation
      name: Justificativa técnica e contrato de saída
      weight: 0.10
      description: Explica por que o isolamento de erro por item é necessário em processamento em lote e confirma que o formato de retorno (processed + errors) é preservado mesmo quando todos os eventos são inválidos ou todos são válidos.
---

<!-- SECTION:statement -->
Um serviço interno coleta eventos de auditoria emitidos por diferentes sistemas da empresa — aplicações web, CLIs e serviços de backend. Cada evento possui um campo `metadata` que chega como string JSON e deve ser parseado para objeto antes do processamento.

Em produção, quando um único evento chega com `metadata` malformado (por exemplo, truncado ou corrompido durante a transmissão), o processamento **inteiro** do lote falha com exceção de parsing. Nenhum resultado é retornado — nem para os eventos válidos que vieram antes ou depois do evento problemático.

**Contrato esperado da função `processAuditEvents(events)`:**
- Recebe uma lista de eventos. Cada evento possui os campos: `id` (string), `type` (string), `timestamp` (string ISO-8601) e `metadata` (string JSON).
- Para cada evento com `metadata` válido: parseia o JSON e inclui o evento (com `metadata` já como objeto) na lista `processed`.
- Para cada evento com `metadata` malformado: registra `{ eventId, reason }` na lista `errors` e continua processando os demais.
- Retorna sempre o objeto `{ processed: [...], errors: [...] }`, mesmo que todos os eventos sejam inválidos (retorna `processed: []`) ou que nenhum seja inválido (retorna `errors: []`).
- **Nunca** lança exceção para o chamador — erros de parsing são capturados por item.

**Comportamento incorreto (bug):**

```javascript
// Lote com 3 eventos — o segundo tem metadata malformado
const events = [
  { id: "evt-001", type: "login", timestamp: "2024-06-01T10:00:00Z", metadata: '{"ip":"192.168.1.1","device":"browser"}' },
  { id: "evt-002", type: "export", timestamp: "2024-06-01T10:01:00Z", metadata: "{invalid json" },
  { id: "evt-003", type: "logout", timestamp: "2024-06-01T10:02:00Z", metadata: '{"ip":"192.168.1.1"}' },
];

processAuditEvents(events);
// ❌ SyntaxError: Unexpected token 'i', "{invalid json" is not valid JSON
// Nenhum resultado retornado — nem evt-001 nem evt-003 foram incluídos em processed
```

**Saída esperada para o lote acima:**
```json
{
  "processed": [
    { "id": "evt-001", "type": "login", "timestamp": "2024-06-01T10:00:00Z", "metadata": { "ip": "192.168.1.1", "device": "browser" } },
    { "id": "evt-003", "type": "logout", "timestamp": "2024-06-01T10:02:00Z", "metadata": { "ip": "192.168.1.1" } }
  ],
  "errors": [
    { "eventId": "evt-002", "reason": "metadata inválido: <mensagem do erro de parsing>" }
  ]
}
```

**Tarefa:**
Corrija o código do template da linguagem escolhida para que o processamento em lote seja resiliente a eventos com `metadata` malformado. Na sua **linha de raciocínio**, explique:
1. **Causa raiz**: por que um único evento malformado derruba todo o lote.
2. **Como** você isolou o tratamento de erro por item sem silenciar o problema.
3. **Como** o processamento dos eventos válidos é preservado.
4. **Como** os eventos inválidos são registrados e por que o formato de saída é mantido.
5. **Por que** capturar somente o erro de parsing (e não todos os erros genericamente) é a decisão correta aqui.
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// audit-events.js

/**
 * Processa um lote de eventos de auditoria.
 *
 * BUG ATUAL:
 * - JSON.parse lança SyntaxError se metadata for inválido.
 * - Essa exceção não é capturada, interrompendo o loop inteiro.
 * - Eventos válidos antes e depois do evento problemático são perdidos.
 *
 * @param {Array<{ id: string, type: string, timestamp: string, metadata: string }>} events
 * @returns {{ processed: Array<object>, errors: Array<{ eventId: string, reason: string }> }}
 */
function processAuditEvents(events) {
  const processed = [];
  const errors = [];

  for (const event of events) {
    const parsedMetadata = JSON.parse(event.metadata); // ❌ lança SyntaxError se inválido
    processed.push({ ...event, metadata: parsedMetadata });
  }

  return { processed, errors };
}

module.exports = { processAuditEvents };
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# audit_events.py
import json
from typing import TypedDict, Any

class AuditEvent(TypedDict):
    id: str
    type: str
    timestamp: str
    metadata: str  # JSON string — pode estar malformado

class ProcessingError(TypedDict):
    eventId: str
    reason: str

class ProcessingResult(TypedDict):
    processed: list[dict[str, Any]]
    errors: list[ProcessingError]


def process_audit_events(events: list[AuditEvent]) -> ProcessingResult:
    """
    Processa um lote de eventos de auditoria.

    BUG ATUAL:
    - json.loads lança json.JSONDecodeError se metadata for inválido.
    - A exceção não é capturada, interrompendo o loop inteiro.
    - Eventos válidos antes e depois do evento problemático são perdidos.
    """
    processed = []
    errors = []

    for event in events:
        parsed_metadata = json.loads(event["metadata"])  # ❌ lança JSONDecodeError se inválido
        processed.append({**event, "metadata": parsed_metadata})

    return {"processed": processed, "errors": errors}
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// AuditEventProcessor.java
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class AuditEventProcessor {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public record AuditEvent(String id, String type, String timestamp, String metadata) {}

    public record ProcessingError(String eventId, String reason) {}

    public record ProcessingResult(
        List<Map<String, Object>> processed,
        List<ProcessingError> errors
    ) {}

    /**
     * Processa um lote de eventos de auditoria.
     *
     * BUG ATUAL:
     * - MAPPER.readValue lança JsonProcessingException se metadata for inválido.
     * - A exceção não é capturada, interrompendo o loop inteiro.
     * - Eventos válidos antes e depois do evento problemático são perdidos.
     */
    public ProcessingResult processAuditEvents(List<AuditEvent> events) throws Exception {
        List<Map<String, Object>> processed = new ArrayList<>();
        List<ProcessingError> errors = new ArrayList<>();

        for (AuditEvent event : events) {
            // ❌ lança JsonProcessingException se metadata for inválido
            @SuppressWarnings("unchecked")
            Map<String, Object> parsedMetadata = MAPPER.readValue(event.metadata(), Map.class);

            processed.add(Map.of(
                "id", event.id(),
                "type", event.type(),
                "timestamp", event.timestamp(),
                "metadata", parsedMetadata
            ));
        }

        return new ProcessingResult(processed, errors);
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Causa raiz:**
- O parsing de JSON é chamado diretamente dentro do loop, sem nenhum tratamento de exceção. Quando `JSON.parse` (JS), `json.loads` (Python) ou `MAPPER.readValue` (Java) encontra uma string malformada, lança uma exceção (`SyntaxError`, `json.JSONDecodeError`, `JsonProcessingException`) que propaga para fora do loop e encerra toda a função sem retornar nada.

**Solução esperada — pontos essenciais:**

1. **Isolar o parsing por item:**
   - JavaScript: envolver `JSON.parse(event.metadata)` em `try { ... } catch (e) { ... }` dentro do loop.
   - Python: usar `try: json.loads(...) except json.JSONDecodeError as e: ...` dentro do loop.
   - Java: usar `try { MAPPER.readValue(...) } catch (JsonProcessingException e) { ... }` dentro do loop.
   - Em todos os casos, capturar especificamente o erro de parsing — não usar `catch (Exception e)` genérico sem discriminação.

2. **Preservar o processamento parcial:**
   - Após capturar o erro do item problemático, o loop deve continuar com o próximo evento.
   - Eventos já adicionados a `processed` antes do erro não devem ser descartados.

3. **Registrar o erro por item:**
   - Adicionar `{ eventId: event.id, reason: "metadata inválido: " + e.message }` (ou equivalente) à lista `errors`.
   - Não silenciar o erro (não usar catch vazio ou apenas comentário).
   - Não relançar a exceção globalmente.

4. **Preservar o contrato de saída:**
   - A função retorna sempre `{ processed, errors }`.
   - Se todos os eventos forem inválidos: `processed = []`, `errors` com todos os IDs e motivos.
   - Se nenhum for inválido: `errors = []`, `processed` com todos os eventos processados.
   - A assinatura pública não deve mudar.

**Por que não capturar tudo genericamente:**
- Capturar `catch (e) {}` sem discriminação ocultaria bugs de lógica genuínos (acesso a campos inexistentes no evento, erros de tipo etc.) que devem propagar normalmente.
- O único erro esperado e controlável aqui é o de parsing de JSON; os demais devem seguir como exceções não tratadas para facilitar o diagnóstico.

**Casos cobertos pela solução:**
- Lote com 1 evento inválido no meio: os demais são processados normalmente.
- Lote inteiramente inválido: retorna `processed: []` com todos os IDs em `errors`.
- Lote inteiramente válido: retorna `errors: []` com todos os eventos em `processed`.
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
- A questao pertence corretamente a `bugFix/runtime_errors`: o defeito central e um erro de execucao reproduzivel causado por parsing inseguro de JSON dentro de processamento em lote, sem virar arquitetura de pipeline, fila, streaming ou observabilidade.
- A dificuldade `intermediate` esta adequada: a correcao exige isolar o erro por item, preservar processamento parcial, manter o contrato `{ processed, errors }` e justificar por que o tratamento deve ser especifico para erro de parsing.
- O formato `code` esta valido e os templates JavaScript, Python e Java representam a mesma tarefa e o mesmo bug conceitual. O exemplo de entrada problematica e a saida esperada tornam o comportamento esperado objetivo.
- A rubrica avalia criterios observaveis: causa raiz, tratamento explicito do parsing, continuidade do lote, registro de erros por item e justificativa tecnica. Os pesos somam 1.0 e os ids/pesos batem com o prompt de avaliacao.
- O prompt segue o padrao real de `prompts/`, usa placeholders compativeis com questao `code` e reforca os pontos centrais sem aceitar solucao que apenas ignore eventos invalidos ou capture excecoes genericamente sem discriminacao.
- As referencias estao presentes e plausiveis para apoiar a questao, permanecendo como `suggested_not_verified` para verificacao humana posterior.
<!-- /REVIEW:comments -->
