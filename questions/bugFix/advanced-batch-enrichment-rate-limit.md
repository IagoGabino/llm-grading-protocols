---
id: advanced-batch-enrichment-rate-limit
slug: advanced-batch-enrichment-rate-limit
title: "Correção de Bug — Enriquecimento em Lote com Rate Limit e Falhas Parciais"
axis: bugFix
subtheme: integration_and_performance
difficulty: advanced
promptTemplate: advanced-batch-enrichment-rate-limit
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [rate_limit, concurrency, batching, partial_failure, http_429, external_api, resilience]
references:
  - id: ref-1
    title: "MDN Web Docs — Promise.allSettled"
    type: official_docs
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled"
    relevance: 4
    confidence: 5
    supports: [statement, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Python asyncio — Semaphore"
    type: official_docs
    url: "https://docs.python.org/3/library/asyncio-sync.html#asyncio.Semaphore"
    relevance: 5
    confidence: 5
    supports: [statement, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Release It! — Design and Deploy Production-Ready Software (Michael T. Nygard)"
    type: book
    url: null
    relevance: 5
    confidence: 4
    supports: [rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Java CompletableFuture — Official Documentation"
    type: official_docs
    url: "https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/CompletableFuture.html"
    relevance: 4
    confidence: 4
    supports: [solution-outline]
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
      name: Diagnóstico técnico do problema
      weight: 0.25
      description: Identifica as duas causas raiz combinadas — chamadas sequenciais desnecessariamente lentas E ausência de controle de concorrência/rate limit — e explica por que a falha elimina todos os resultados parciais (ausência de tratamento por item).
    - id: concurrency_control
      name: Controle de concorrência e rate limit
      weight: 0.30
      description: Implementa concorrência limitada (semáforo, pool de promises ou batching sequencial de N por vez) que reduz latência em relação à versão sequencial sem exceder o rate limit da API. Não aceita Promise.all/gather irrestrito sobre toda a lista nem loop puramente sequencial sem ganho mensurável de throughput.
    - id: partial_failure
      name: Tratamento de falhas parciais e HTTP 429
      weight: 0.25
      description: Registra falha por item sem interromper o lote; trata HTTP 429 com pelo menos uma tentativa de retry após espera (backoff simples aceitável); preserva todos os resultados válidos obtidos antes e depois do erro.
    - id: contract_preservation
      name: Preservação do contrato de saída
      weight: 0.10
      description: "A função retorna exatamente o contrato definido: objeto com lista `enriched` (itens com dados enriquecidos) e lista `errors` (itens que falharam com identificador e motivo). Não lança exceção para falhas parciais; lança apenas para falhas totais de configuração."
    - id: tradeoff_explanation
      name: Justificativa técnica e trade-offs
      weight: 0.10
      description: Discute ao menos dois trade-offs reais da abordagem escolhida — por exemplo, relação entre grau de paralelismo, latência total e pressão na API; risco de retry agressivo com HTTP 429; impacto na ordem dos resultados e como preservá-la se necessário.
---

<!-- SECTION:statement -->
O serviço de validação cadastral da **CadaSync** consulta o diretório corporativo fictício **BrasilCorpAPI** para enriquecer uma lista de empresas com dados públicos (razão social, situação cadastral, endereço e porte). A função `enrichCompanies` recebe uma lista de identificadores de empresa (CNPJs fictícios) e deve retornar os dados enriquecidos de cada uma.

**Contrato esperado da função `enrichCompanies(companyIds)`:**
- Recebe uma lista de identificadores (strings).
- Consulta a BrasilCorpAPI uma vez por identificador (`GET /companies/{id}`).
- Retorna um objeto `{ enriched: [...], errors: [...] }`:
  - `enriched`: lista de objetos `{ id, data }` para cada consulta bem-sucedida.
  - `errors`: lista de objetos `{ id, reason }` para cada consulta que falhou definitivamente.
- **Nunca lança exceção** para falhas parciais; erros por item vão para `errors`.
- Lança exceção apenas em caso de configuração inválida (lista vazia ou nula).
- A BrasilCorpAPI aceita no máximo **10 requisições simultâneas** antes de retornar HTTP 429.
- A ordem dos itens em `enriched` deve corresponder à ordem original da entrada (ou ser documentada como não garantida).

**Comportamento incorreto (bug):**

Para uma lista de 500 empresas:
1. A função faz 500 chamadas HTTP de forma **sequencial** (uma `await` por vez no loop).
2. A execução leva vários minutos para concluir.
3. Após muitas chamadas, a BrasilCorpAPI retorna **HTTP 429 Too Many Requests** (rate limit atingido por acúmulo em janelas de outros clientes).
4. A função lança exceção imediata e **perde todos os resultados parciais** já obtidos.

**Cenário de reprodução:**
```text
[10:02:00.001] Iniciando enriquecimento de 500 empresas...
[10:07:43.812] HTTP 429 Too Many Requests — BrasilCorpAPI
[10:07:43.813] UnhandledError: Request failed with status 429
[10:07:43.814] 0 empresas enriquecidas salvas. 500 empresas perdidas.
```

**Tarefa:**
Corrija o código do template da linguagem escolhida para que o enriquecimento em lote seja eficiente e resiliente. Você pode extrair funções auxiliares, mas deve preservar o contrato público de `enrichCompanies`. Na sua **linha de raciocínio**, explique:

1. **Causa raiz** combinada: por que as chamadas sequenciais são lentas E por que o 429 derruba todo o lote.
2. **Como** você limitou a concorrência para respeitar o rate limit sem voltar ao modelo sequencial puro.
3. **Como** você trata HTTP 429 e erros por item sem interromper o lote inteiro.
4. **Como** você preserva (ou documenta a ausência de) ordem nos resultados.
5. **Trade-offs** da solução: paralelismo vs. pressão na API, complexidade de retry, impacto na latência total.

**Restrições:**
- Não use filas externas, workers de background ou schedulers; a correção deve ocorrer dentro da função `enrichCompanies`.
- Não aceite solução que dispare todas as 500 requisições em paralelo sem limite de concorrência.
- Não aceite solução que abandone o lote inteiro no primeiro erro sem justificativa explícita.
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// company-enrichment.js

const API_BASE_URL = "https://api.brasilcorp.example.com";
const MAX_CONCURRENT = 10; // máximo de requisições simultâneas aceitas pela API

/**
 * Enriquece uma lista de empresas consultando a BrasilCorpAPI.
 *
 * BUGS ATUAIS:
 * - Loop sequencial: await dentro de for...of faz uma chamada por vez (lento para lotes grandes).
 * - Sem controle de concorrência: em lotes maiores, acumula pressão em janelas de rate limit.
 * - Sem tratamento de HTTP 429: lança exceção e perde todos os resultados parciais.
 * - Sem tratamento de falha por item: qualquer erro aborta o lote inteiro.
 *
 * @param {string[]} companyIds - lista de identificadores de empresa
 * @returns {Promise<{ enriched: Array<{id: string, data: object}>, errors: Array<{id: string, reason: string}> }>}
 */
async function enrichCompanies(companyIds) {
  if (!companyIds || companyIds.length === 0) {
    throw new Error("companyIds must be a non-empty array");
  }

  const enriched = [];
  const errors = [];

  // BUG: chamada sequencial — await dentro do loop processa uma empresa por vez
  for (const id of companyIds) {
    const response = await fetch(`${API_BASE_URL}/companies/${id}`);
    // BUG: não verifica status HTTP — HTTP 429 lança exceção não tratada
    const data = await response.json();
    enriched.push({ id, data });
  }

  return { enriched, errors };
}

module.exports = { enrichCompanies, MAX_CONCURRENT };
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# company_enrichment.py
import asyncio
import aiohttp

API_BASE_URL = "https://api.brasilcorp.example.com"
MAX_CONCURRENT = 10  # máximo de requisições simultâneas aceitas pela API


async def enrich_companies(company_ids: list[str]) -> dict:
    """
    Enriquece uma lista de empresas consultando a BrasilCorpAPI.

    BUGS ATUAIS:
    - Loop sequencial: await dentro do for processa uma empresa por vez (lento para lotes grandes).
    - Sem controle de concorrência: sem semáforo ou pool, sem limitação de paralelismo.
    - Sem tratamento de HTTP 429: lança exceção e perde todos os resultados parciais.
    - Sem tratamento de falha por item: qualquer erro aborta o lote inteiro.

    Returns:
        dict com chaves 'enriched' (list[dict]) e 'errors' (list[dict])
    """
    if not company_ids:
        raise ValueError("company_ids must be a non-empty list")

    enriched = []
    errors = []

    async with aiohttp.ClientSession() as session:
        # BUG: chamada sequencial — await dentro do for processa uma empresa por vez
        for company_id in company_ids:
            response = await session.get(f"{API_BASE_URL}/companies/{company_id}")
            # BUG: não verifica status HTTP — HTTP 429 lança exceção não tratada
            data = await response.json()
            enriched.append({"id": company_id, "data": data})

    return {"enriched": enriched, "errors": errors}
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// CompanyEnrichmentService.java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class CompanyEnrichmentService {

    private static final String API_BASE_URL = "https://api.brasilcorp.example.com";
    static final int MAX_CONCURRENT = 10; // máximo de requisições simultâneas aceitas pela API

    private final HttpClient httpClient;

    public CompanyEnrichmentService() {
        this.httpClient = HttpClient.newBuilder().build();
    }

    /**
     * Enriquece uma lista de empresas consultando a BrasilCorpAPI.
     *
     * BUGS ATUAIS:
     * - Loop sequencial: httpClient.send() dentro do for processa uma empresa por vez (lento).
     * - Sem controle de concorrência: sem Semaphore ou pool, sem limitação de paralelismo.
     * - Sem tratamento de HTTP 429: lança exceção e perde todos os resultados parciais.
     * - Sem tratamento de falha por item: qualquer erro aborta o lote inteiro.
     *
     * @param companyIds lista de identificadores de empresa
     * @return mapa com chaves "enriched" (List<Map>) e "errors" (List<Map>)
     */
    public Map<String, List<Map<String, Object>>> enrichCompanies(List<String> companyIds)
            throws Exception {
        if (companyIds == null || companyIds.isEmpty()) {
            throw new IllegalArgumentException("companyIds must be a non-empty list");
        }

        List<Map<String, Object>> enriched = new ArrayList<>();
        List<Map<String, Object>> errors = new ArrayList<>();

        // BUG: chamada sequencial — send() dentro do for processa uma empresa por vez
        for (String id : companyIds) {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(API_BASE_URL + "/companies/" + id))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request, HttpResponse.BodyHandlers.ofString());

            // BUG: não verifica status HTTP — HTTP 429 não é tratado; corpo lido como sucesso
            String body = response.body();
            enriched.add(Map.of("id", id, "data", body));
        }

        return Map.of("enriched", enriched, "errors", errors);
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Causa raiz combinada:**
- O loop processa empresas uma a uma com `await`/`send()` sequencial. Para 500 empresas com latência média de ~300ms por chamada, a execução leva ~150 segundos — vários minutos.
- Não há verificação do status HTTP da resposta. Quando a API retorna HTTP 429, o código tenta desserializar a resposta de erro como se fosse sucesso, ou a exceção propagada aborta todo o lote sem salvar resultados parciais.
- A ausência de try/catch por item faz com que qualquer falha individual (4xx, 5xx, rede) destrua todos os resultados já obtidos.

**Solução esperada — pontos essenciais:**

1. **Concorrência limitada (obrigatório):**
   - JavaScript: processar a lista em janelas de até `MAX_CONCURRENT` promises usando `Promise.allSettled` sobre slices da lista, ou implementar um pool com semáforo manual.
   - Python: usar `asyncio.Semaphore(MAX_CONCURRENT)` para limitar chamadas simultâneas, combinado com `asyncio.gather(*tasks, return_exceptions=True)` ou equivalente.
   - Java: usar `Semaphore(MAX_CONCURRENT)` com `CompletableFuture.supplyAsync` em pool limitado, ou particionar a lista em sublistas e processar cada sublote sequencialmente.
   - **Não aceitar** `Promise.all` / `asyncio.gather` sem limitação sobre toda a lista.
   - **Não aceitar** loop puramente sequencial sem ganho de throughput.

2. **Tratamento de HTTP 429:**
   - Detectar status 429 explicitamente.
   - Aplicar pelo menos uma tentativa de retry após espera simples (backoff fixo ou exponencial mínimo — ex.: 1s).
   - Após esgotar retries, registrar o item em `errors` com `reason: "rate_limit"` sem abortar o lote.

3. **Tratamento de falhas por item:**
   - Envolver cada chamada individual em try/catch (JS/Python/Java).
   - Em caso de erro (rede, 4xx, 5xx, timeout), adicionar `{ id, reason }` em `errors` e continuar o lote.
   - Resultados válidos já obtidos não devem ser descartados.

4. **Preservação do contrato:**
   - Retornar `{ enriched: [...], errors: [...] }` em todos os casos de sucesso parcial.
   - Lançar exceção apenas para entrada inválida (lista nula/vazia).
   - Ordem em `enriched`: pode ser preservada (coletando em array indexado) ou declarada como não garantida; ambas as abordagens são aceitáveis se documentadas.

**Trade-offs esperados na explicação:**
- Aumentar o grau de concorrência reduz latência total, mas aumenta pressão na API e o risco de acionar HTTP 429 com mais frequência.
- Batching sequencial (N por vez) é mais simples e predizível, mas a latência total é `ceil(len/N) * latência_média`.
- Retry com backoff aumenta a latência no pior caso, mas evita loops de erro em cascata.
- Preservar a ordem dos resultados exige coleta indexada (array de tamanho fixo), adicionando alocação; se a ordem não for necessária, append direto em `enriched` é suficiente.
- Soluções sem fila ou worker são limitadas à memória do processo; para lotes acima de dezenas de milhares, a arquitetura deve ser reavaliada (mas isso está fora do escopo desta questão).
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
- A questao pertence claramente a `bugFix/integration_and_performance`: o bug e concreto, reproduzivel por lote grande e ligado a integracao com API externa, latencia, HTTP 429 e perda de resultados parciais.
- A dificuldade esta adequada para `advanced`, pois exige diagnostico combinado, controle explicito de concorrencia ou batching limitado, tratamento de rate limit, falhas parciais, preservacao de contrato e discussao de trade-offs.
- O formato `code` esta coerente, com templates equivalentes em JavaScript, Python e Java representando a mesma tarefa conceitual e o mesmo contrato de saida.
- O enunciado evita transformar a solucao em arquitetura de filas, workers ou sistema distribuido; a correcao esperada fica dentro de `enrichCompanies`.
- A rubrica avalia criterios observaveis: causa raiz, concorrencia limitada/rate limit, HTTP 429 e falhas parciais, contrato de saida e trade-offs.
- O `solution-outline` rejeita explicitamente disparar todas as chamadas em paralelo sem limite e tambem rejeita loop puramente sequencial sem ganho de throughput.
- O prompt de avaliacao segue o padrao real de `prompts/`, usa placeholders compativeis com questao `code` e reproduz corretamente ids e pesos da rubrica.
- As referencias sao plausiveis, conservadoras e permanecem como `suggested_not_verified`.
<!-- /REVIEW:comments -->
