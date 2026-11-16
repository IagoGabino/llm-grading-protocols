---
id: advanced-audit-serialization-runtime-error
slug: advanced-audit-serialization-runtime-error
title: "Correção de Bug — Serialização Insegura de Payload de Auditoria Derrubando o Fluxo Principal"
axis: bugFix
subtheme: runtime_errors
difficulty: advanced
promptTemplate: advanced-audit-serialization-runtime-error
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [json_serialization, circular_reference, audit_log, runtime_error, error_isolation, safe_projection]
references:
  - id: ref-1
    title: "JSON.stringify() — MDN Web Docs"
    type: official_docs
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify"
    relevance: 5
    confidence: 5
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Python json module — Encoder and JSONEncoder.default"
    type: official_docs
    url: "https://docs.python.org/3/library/json.html#json.JSONEncoder"
    relevance: 5
    confidence: 5
    supports: [statement, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Jackson ObjectMapper — Handling Circular References (Baeldung)"
    type: technical_blog
    url: "https://www.baeldung.com/jackson-bidirectional-relationships-and-infinite-recursion"
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
  plannedDifficulty: advanced
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
      description: Identifica que a serialização do payload de auditoria falha porque o objeto inclui dados não serializáveis (referência circular, objeto de request bruto ou valor especial), e que essa exceção não tratada propaga para fora da função de atualização, derrubando o fluxo principal mesmo quando a regra de negócio foi executada com sucesso.
    - id: safe_projection
      name: Sanitização ou projeção explícita do payload de auditoria
      weight: 0.30
      description: Constrói explicitamente um objeto de auditoria com apenas campos seguros e serializáveis — como organizationId, actorId, changedFields, timestamp e valores primitivos — antes de chamar o serializador, sem incluir o objeto bruto de request, referências circulares ou tipos não serializáveis. Não aceita apenas capturar e ignorar silenciosamente a falha de serialização como solução.
    - id: flow_isolation
      name: Isolamento da falha de auditoria do fluxo principal
      weight: 0.25
      description: A operação de atualização de configuração continua sendo executada e retorna sucesso mesmo quando o registro de auditoria falha. A falha de auditoria é isolada (bloco try/catch ou equivalente) sem ocultar completamente o problema — deve haver ao menos um log ou registro de que a auditoria falhou, sem relançar a exceção para o chamador.
    - id: useful_audit
      name: Preservação de auditoria útil
      weight: 0.10
      description: O registro de auditoria corrigido preserva campos informativos suficientes para rastreabilidade — organizationId, actorId, changedFields (lista de chaves alteradas ou diff simplificado), timestamp e, opcionalmente, valores anteriores e novos quando forem primitivos simples.
    - id: tradeoff_explanation
      name: Justificativa técnica e trade-offs
      weight: 0.10
      description: Explica os trade-offs da abordagem adotada — por exemplo, o que se perde ao excluir o contexto completo do request, o risco de silenciar falhas de auditoria de forma opaca, e por que isolar auditoria do fluxo principal é preferível a falhar a operação inteira.
---

<!-- SECTION:statement -->
O serviço administrativo da **OrgManager** expõe o endpoint `PATCH /api/organizations/:id/settings`. Esse endpoint atualiza as configurações de uma organização e, em seguida, grava uma entrada de auditoria com o payload antigo, o payload novo, o usuário responsável e metadados da requisição.

**Comportamento em produção:**

Em desenvolvimento e em requests simples, o endpoint funciona normalmente. Em produção, certos updates passaram a retornar HTTP 500 — mesmo quando a configuração foi atualizada com sucesso no banco de dados. O time de suporte percebeu que o erro ocorre apenas quando requests chegam com objetos de contexto mais ricos (middleware de autenticação injetando dados no objeto `req`, referência ao objeto de conexão do banco etc.).

**Log de erro registrado em produção:**

```
TypeError: Converting circular structure to JSON
    at JSON.stringify (<anonymous>)
    at AuditService.record (audit.service.js:18)
    at OrgSettingsService.updateSettings (org-settings.service.js:34)
    at POST /api/organizations/:id/settings
```

**Fluxo atual (Node.js):**

```javascript
// org-settings.service.js
const db = require('./db');
const auditService = require('./audit.service');

async function updateSettings(orgId, newSettings, requestContext) {
  // 1. Busca configurações atuais
  const org = await db.organizations.findById(orgId);
  const oldSettings = org.settings;

  // 2. Aplica a atualização — FUNCIONA CORRETAMENTE
  await db.organizations.updateSettings(orgId, newSettings);

  // 3. Registra auditoria — BUG: inclui requestContext com referência circular
  await auditService.record({
    organizationId: orgId,
    actorId: requestContext.user.id,
    oldPayload: oldSettings,
    newPayload: newSettings,
    context: requestContext,       // ❌ contém referência circular (req → res → req)
    timestamp: new Date().toISOString(),
  });

  return { success: true, settings: newSettings };
}
```

```javascript
// audit.service.js
async function record(auditEntry) {
  const serialized = JSON.stringify(auditEntry); // ❌ lança TypeError: circular structure
  await db.auditLog.insert({ payload: serialized });
}
```

**Cenário de reprodução:**

```javascript
// O requestContext gerado pelo middleware de autenticação
// cria referência circular: req.context.request === req
const requestContext = {
  user: { id: 'usr-42', role: 'admin' },
  requestId: 'req-abc-123',
  request: circularRef, // ← referência circular ao objeto Express req
};

await updateSettings('org-99', { maxUsers: 200 }, requestContext);
// ❌ TypeError: Converting circular structure to JSON
// A configuração FOI atualizada no banco, mas a API retorna 500
```

**Contrato esperado após a correção:**

- A atualização de configuração deve ser concluída com sucesso e retornar `{ success: true, settings: newSettings }` independentemente de falhas de auditoria.
- O registro de auditoria deve conter apenas campos seguros e serializáveis: `organizationId`, `actorId`, `changedFields` (lista de chaves alteradas), `timestamp`, e opcionalmente `oldPayload` / `newPayload` quando forem valores primitivos ou objetos simples sem referências circulares.
- Se a auditoria falhar mesmo após a sanitização, a falha deve ser registrada em log (com ao menos o `organizationId` e o motivo), mas não deve derrubar a resposta da API.
- O sistema **não** deve silenciar completamente todas as falhas de auditoria sem nenhuma observabilidade.

**Tarefa:**

Corrija o código do template da linguagem escolhida para que a serialização de auditoria seja segura e o fluxo principal não seja derrubado por falhas nesse registro. Na sua **linha de raciocínio**, explique:

1. **Causa raiz**: por que a serialização falha e como isso derruba o fluxo principal.
2. **Como** você sanitizou ou projetou o objeto de auditoria para ser seguro.
3. **Quais campos** foram preservados e por que eles são suficientes para rastreabilidade.
4. **Como** você isolou a falha de auditoria sem ocultar completamente o problema.
5. **Quais trade-offs** existem entre robustez, perda de detalhe de contexto e visibilidade de erros de auditoria.

> **Restrição:** a lógica de atualização de configuração (`db.organizations.updateSettings`) não deve ser alterada. A correção deve estar na sanitização do payload de auditoria e no isolamento da falha, não na remoção da auditoria.
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// org-settings.service.js
const db = require('./db');
const auditService = require('./audit.service');

/**
 * Atualiza as configurações de uma organização e registra auditoria.
 *
 * BUG ATUAL:
 * - requestContext pode conter referência circular (req → res → req).
 * - auditService.record passa o contexto bruto para JSON.stringify.
 * - JSON.stringify lança TypeError ao encontrar referência circular.
 * - O erro propaga para updateSettings e derruba a resposta da API,
 *   mesmo que a atualização no banco tenha sido concluída com sucesso.
 *
 * @param {string} orgId
 * @param {object} newSettings
 * @param {{ user: { id: string, role: string }, requestId: string, [key: string]: any }} requestContext
 * @returns {Promise<{ success: boolean, settings: object }>}
 */
async function updateSettings(orgId, newSettings, requestContext) {
  const org = await db.organizations.findById(orgId);
  const oldSettings = org.settings;

  // NÃO altere esta linha — a atualização deve continuar como está
  await db.organizations.updateSettings(orgId, newSettings);

  // TODO: corrija o registro de auditoria abaixo para que:
  // (1) o payload passado para auditService.record seja seguro para serialização;
  // (2) uma falha de auditoria não derrube o fluxo principal;
  // (3) falhas de auditoria tenham observabilidade mínima (ex.: console.error ou logger).
  await auditService.record({
    organizationId: orgId,
    actorId: requestContext.user.id,
    oldPayload: oldSettings,
    newPayload: newSettings,
    context: requestContext,       // ❌ pode conter referência circular
    timestamp: new Date().toISOString(),
  });

  return { success: true, settings: newSettings };
}

module.exports = { updateSettings };

// ---

// audit.service.js

/**
 * Grava uma entrada de auditoria serializada no banco.
 *
 * BUG ATUAL:
 * - JSON.stringify lança TypeError se auditEntry contiver referência circular
 *   ou valores não serializáveis (funções, Symbols, objetos de socket etc.).
 *
 * @param {object} auditEntry
 */
async function record(auditEntry) {
  // TODO: corrija esta função para que a serialização seja segura.
  // Opção A: projete/sanitize o objeto antes de serializar.
  // Opção B: use um replacer ou biblioteca segura (ex.: safe-json-stringify).
  // Em qualquer caso: não engula o erro silenciosamente sem nenhum log.
  const serialized = JSON.stringify(auditEntry); // ❌ lança TypeError com estruturas circulares
  await db.auditLog.insert({ payload: serialized });
}

module.exports = { record };
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# org_settings_service.py
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Simulação de camada de banco de dados
class db:
    class organizations:
        @staticmethod
        async def find_by_id(org_id: str) -> dict:
            # retorna organização com configurações atuais
            ...

        @staticmethod
        async def update_settings(org_id: str, new_settings: dict) -> None:
            # persiste as novas configurações
            ...

    class audit_log:
        @staticmethod
        async def insert(payload: str) -> None:
            # insere entrada de auditoria serializada
            ...


class AuditService:
    """
    BUG ATUAL em record():
    - json.dumps lança TypeError ou ValueError se audit_entry contiver
      objetos não serializáveis (ex.: instâncias de Request do framework,
      referências circulares via __dict__, tipos como datetime sem serializer,
      ou valores especiais como float('inf')).
    - A exceção propaga para update_settings e derruba a resposta da API.
    """

    @staticmethod
    async def record(audit_entry: dict) -> None:
        # TODO: corrija esta função para que a serialização seja segura.
        # Opção A: projete/sanitize o dict antes de json.dumps.
        # Opção B: use default= no json.dumps para tipos não serializáveis.
        # Em qualquer caso: não engula o erro silenciosamente sem nenhum log.
        serialized = json.dumps(audit_entry)  # ❌ lança TypeError/ValueError com tipos inválidos
        await db.audit_log.insert(serialized)


async def update_settings(org_id: str, new_settings: dict, request_context: dict) -> dict:
    """
    Atualiza as configurações de uma organização e registra auditoria.

    BUG ATUAL:
    - request_context pode conter objetos não serializáveis (instância de Request,
      objetos de conexão, valores especiais como float('inf'), referências circulares
      via __dict__ de objetos do framework).
    - AuditService.record passa o contexto bruto para json.dumps.
    - json.dumps lança TypeError/ValueError ao encontrar tipo não serializável.
    - O erro propaga e derruba a resposta, mesmo que a atualização tenha sido concluída.

    NÃO altere a chamada a db.organizations.update_settings.
    """
    org = await db.organizations.find_by_id(org_id)
    old_settings = org["settings"]

    # NÃO altere esta linha
    await db.organizations.update_settings(org_id, new_settings)

    # TODO: corrija o registro de auditoria abaixo para que:
    # (1) somente campos seguros sejam passados para AuditService.record;
    # (2) uma falha de auditoria não derrube o fluxo principal;
    # (3) falhas de auditoria tenham observabilidade mínima (ex.: logger.error).
    await AuditService.record({
        "organizationId": org_id,
        "actorId": request_context["user"]["id"],
        "oldPayload": old_settings,
        "newPayload": new_settings,
        "context": request_context,          # ❌ pode conter objetos não serializáveis
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return {"success": True, "settings": new_settings}
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// OrgSettingsService.java
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Serviço de atualização de configurações de uma organização.
 *
 * BUG ATUAL:
 * - buildAuditEntry inclui o requestContext bruto no payload de auditoria.
 * - O requestContext pode conter objetos do framework (HttpServletRequest,
 *   referências circulares via proxies de segurança ou ORM, tipos sem serializer
 *   registrado no ObjectMapper).
 * - ObjectMapper.writeValueAsString lança JsonProcessingException ao serializar
 *   objetos não serializáveis ou com referências circulares.
 * - A exceção propaga de recordAudit para updateSettings e derruba a API,
 *   mesmo que a atualização no banco tenha sido concluída com sucesso.
 */
public class OrgSettingsService {

    private static final Logger logger = LoggerFactory.getLogger(OrgSettingsService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final OrgRepository orgRepository;
    private final AuditLogRepository auditLogRepository;

    public OrgSettingsService(OrgRepository orgRepository, AuditLogRepository auditLogRepository) {
        this.orgRepository = orgRepository;
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * Atualiza as configurações de uma organização e registra auditoria.
     * NÃO altere a chamada a orgRepository.updateSettings.
     *
     * @param orgId          identificador da organização
     * @param newSettings    novos valores a persistir
     * @param requestContext contexto da requisição — pode conter objetos não serializáveis
     * @return mapa com { success: true, settings: newSettings }
     */
    public Map<String, Object> updateSettings(
            String orgId,
            Map<String, Object> newSettings,
            Map<String, Object> requestContext
    ) throws Exception {

        Organization org = orgRepository.findById(orgId);
        Map<String, Object> oldSettings = org.getSettings();

        // NÃO altere esta linha
        orgRepository.updateSettings(orgId, newSettings);

        // TODO: corrija o registro de auditoria abaixo para que:
        // (1) somente campos seguros sejam passados para recordAudit;
        // (2) uma falha de auditoria não derrube o fluxo principal;
        // (3) falhas de auditoria tenham observabilidade mínima (ex.: logger.warn/error).
        recordAudit(orgId, oldSettings, newSettings, requestContext);

        return Map.of("success", true, "settings", newSettings);
    }

    /**
     * BUG ATUAL em recordAudit():
     * - buildAuditEntry inclui requestContext bruto.
     * - MAPPER.writeValueAsString lança JsonProcessingException com objetos
     *   não serializáveis (referência circular, HttpServletRequest, proxies JPA etc.).
     * - A exceção propaga para updateSettings e derruba a API.
     *
     * TODO: corrija esta função para que:
     * (1) o payload de auditoria contenha apenas campos seguros e serializáveis;
     * (2) falhas residuais de serialização sejam isoladas com try/catch;
     * (3) falhas de auditoria sejam registradas em log sem relançar para o chamador.
     */
    private void recordAudit(
            String orgId,
            Map<String, Object> oldSettings,
            Map<String, Object> newSettings,
            Map<String, Object> requestContext
    ) throws Exception {

        Map<String, Object> auditEntry = buildAuditEntry(orgId, oldSettings, newSettings, requestContext);

        // ❌ lança JsonProcessingException se auditEntry contiver tipos não serializáveis
        String serialized = MAPPER.writeValueAsString(auditEntry);
        auditLogRepository.insert(serialized);
    }

    private Map<String, Object> buildAuditEntry(
            String orgId,
            Map<String, Object> oldSettings,
            Map<String, Object> newSettings,
            Map<String, Object> requestContext
    ) {
        Map<String, Object> entry = new HashMap<>();
        entry.put("organizationId", orgId);
        entry.put("actorId", ((Map<?, ?>) requestContext.get("user")).get("id"));
        entry.put("oldPayload", oldSettings);
        entry.put("newPayload", newSettings);
        entry.put("context", requestContext);   // ❌ pode conter objetos não serializáveis
        entry.put("timestamp", Instant.now().toString());
        return entry;
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Causa raiz:**

- O objeto `requestContext` (ou equivalente no framework) frequentemente contém referências que não podem ser serializadas para JSON: referência circular (`req → res → req` no Express, proxies de segurança do Spring, instâncias de `HttpServletRequest` no Java, `__dict__` de objetos do framework no Python), valores especiais (`NaN`, `Infinity`, `undefined`/`None` com serializers padrão), objetos de socket ou conexão de banco.
- Quando `JSON.stringify` (JS), `json.dumps` (Python) ou `ObjectMapper.writeValueAsString` (Java) encontra esses tipos, lança exceção (`TypeError` / `JsonProcessingException`).
- Como o código atual não isola a chamada de auditoria, a exceção propaga pela call stack e derruba o handler da API — mesmo que a operação de negócio (`db.organizations.updateSettings`) já tenha sido concluída com sucesso.

**Solução esperada — dois eixos independentes:**

**Eixo 1 — Sanitização/projeção explícita do payload:**

- Construir explicitamente um objeto de auditoria com apenas campos seguros, em vez de passar o `requestContext` bruto:

```javascript
// JavaScript — projeção explícita
const safeAuditEntry = {
  organizationId: orgId,
  actorId: requestContext.user?.id,
  changedFields: Object.keys(newSettings),
  oldPayload: oldSettings,   // assumindo que settings são primitivos/objetos simples
  newPayload: newSettings,
  requestId: requestContext.requestId,
  timestamp: new Date().toISOString(),
};
await auditService.record(safeAuditEntry);
```

```python
# Python — projeção explícita
safe_audit_entry = {
    "organizationId": org_id,
    "actorId": request_context["user"]["id"],
    "changedFields": list(new_settings.keys()),
    "oldPayload": old_settings,
    "newPayload": new_settings,
    "requestId": request_context.get("requestId"),
    "timestamp": datetime.now(timezone.utc).isoformat(),
}
await AuditService.record(safe_audit_entry)
```

```java
// Java — buildSafeAuditEntry projetado
Map<String, Object> safeEntry = new HashMap<>();
safeEntry.put("organizationId", orgId);
safeEntry.put("actorId", ((Map<?, ?>) requestContext.get("user")).get("id"));
safeEntry.put("changedFields", new ArrayList<>(newSettings.keySet()));
safeEntry.put("oldPayload", oldSettings);
safeEntry.put("newPayload", newSettings);
safeEntry.put("requestId", requestContext.get("requestId"));
safeEntry.put("timestamp", Instant.now().toString());
```

**Eixo 2 — Isolamento da falha de auditoria do fluxo principal:**

```javascript
// JavaScript — try/catch isolado, com log mínimo
try {
  await auditService.record(safeAuditEntry);
} catch (err) {
  console.error('[audit] falha ao registrar auditoria', {
    organizationId: orgId,
    error: err.message,
  });
  // não relança — o fluxo principal já completou com sucesso
}
return { success: true, settings: newSettings };
```

```python
# Python — try/except isolado
try:
    await AuditService.record(safe_audit_entry)
except Exception as err:
    logger.error("[audit] falha ao registrar auditoria: %s (org=%s)", err, org_id)
    # não relança
return {"success": True, "settings": new_settings}
```

```java
// Java — try/catch isolado
try {
    recordAudit(orgId, oldSettings, newSettings, requestContext);
} catch (Exception e) {
    logger.error("[audit] falha ao registrar auditoria: orgId={}, erro={}", orgId, e.getMessage());
    // não relança
}
return Map.of("success", true, "settings", newSettings);
```

**Trade-offs a discutir:**

- **Perda de detalhe vs. estabilidade:** excluir o `requestContext` completo significa perder headers, IP e outros dados de contexto que poderiam ser úteis em investigações. O trade-off é deliberado — campos críticos de rastreabilidade (`organizationId`, `actorId`, `requestId`, `changedFields`) são preservados.
- **Isolamento vs. transparência:** capturar a exceção de auditoria e logar (sem relançar) garante que a API responda com sucesso, mas pode mascarar falhas sistêmicas no serviço de auditoria se o log não for monitorado. Solução intermediária: capturar mas emitir métrica ou alerta.
- **Captura genérica vs. seletiva:** capturar `Exception` genericamente no bloco de auditoria é aceitável aqui porque o escopo é limitado e explícito (só o bloco de auditoria), diferente de capturar genericamente em todo o handler. Contudo, o aluno deve reconhecer o risco de mascarar bugs latentes se o catch for muito abrangente.

**O que NÃO é aceitável como correção:**
- Remover completamente o registro de auditoria.
- Capturar a exceção e silenciar sem nenhum log ou observabilidade.
- Mover o `JSON.stringify` para dentro de um try/catch sem sanitizar o objeto — a referência circular continuará causando erro; apenas a propagação muda.
<!-- /SECTION:solution-outline -->

<!-- REVIEW:metrics -->
{
  "quality": {
    "technicalCorrectness": 4,
    "statementClarity": 4,
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
  "suggestedChangedParts": ["statement", "template", "solution-outline"],
  "referencesStatus": "present"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendacao: minor_revision.

Principais pontos:
- A questao pertence corretamente a bugFix/runtime_errors: o erro de runtime e claro, ligado a serializacao insegura de payload de auditoria, e o enunciado diferencia bem a atualizacao principal do registro de auditoria.
- A dificuldade advanced esta adequada porque a resposta exige causa raiz, projecao explicita de payload, preservacao de auditoria util, isolamento da falha e discussao de trade-offs, sem transformar o problema em arquitetura de logging ou compliance.
- O formato code esta valido e os templates de JavaScript, Python e Java representam o mesmo problema conceitual. A reproducao em JavaScript poderia ser levemente ajustada para construir explicitamente a referencia circular, pois o exemplo usa `circularRef` sem mostrar sua inicializacao.
- Ha uma pequena imprecisao tecnica nos trechos Python/solution-outline sobre valores especiais: `None` e serializavel como `null`, e `json.dumps(float("inf"))` por padrao emite `Infinity` em vez de lancar erro, salvo configuracoes como `allow_nan=False`. Recomenda-se calibrar essa parte sem mudar a ideia central de objetos nao serializaveis e referencias circulares.
- A rubrica e forte: avalia causa raiz, sanitizacao/serializacao, auditoria util, isolamento da falha e justificativa. Os pesos somam 1.0 e os criterios sao observaveis.
- O prompt de avaliacao segue o padrao real de prompts code, usa placeholders compativeis (`enunciado`, `rubrica`, `pontos_esperados`, `codigo`, `raciocinio`) e reproduz corretamente ids e pesos da rubrica.
- As referencias estao presentes, plausiveis e alinhadas ao tema, mantendo `suggested_not_verified`; nao foram tratadas como verificadas.
<!-- /REVIEW:comments -->
