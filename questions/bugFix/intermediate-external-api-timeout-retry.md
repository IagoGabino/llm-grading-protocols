---
id: intermediate-external-api-timeout-retry
slug: intermediate-external-api-timeout-retry
title: Correção de Bug — Integração com API Externa sem Timeout e sem Retry Controlado
axis: bugFix
subtheme: integration_and_performance
difficulty: intermediate
promptTemplate: intermediate-external-api-timeout-retry
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [http_client, timeout, retry, error_handling, external_api, resilience]
references:
  - id: ref-1
    title: "MDN Web Docs — AbortController"
    type: official_docs
    url: "https://developer.mozilla.org/en-US/docs/Web/API/AbortController"
    relevance: 4
    confidence: 4
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Requests documentation — Timeouts"
    type: official_docs
    url: "https://requests.readthedocs.io/en/latest/user/quickstart/#timeouts"
    relevance: 4
    confidence: 4
    supports: [statement, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Java Documentation — HttpRequest timeout"
    type: official_docs
    url: "https://docs.oracle.com/en/java/javase/17/docs/api/java.net.http/java/net/http/HttpRequest.Builder.html#timeout(java.time.Duration)"
    relevance: 4
    confidence: 3
    supports: [statement, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Release It! — Design and Deploy Production-Ready Software (Michael T. Nygard)"
    type: book
    url: null
    relevance: 5
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
      description: Explica que a ausência de timeout deixa a requisição pendente por tempo excessivo e que a falta de verificação de status HTTP e de validação do corpo torna falhas externas silenciosas ou não controladas.
    - id: timeout_fix
      name: Implementação de timeout
      weight: 0.30
      description: "Configura timeout explícito por tentativa na chamada HTTP (AbortController+signal, requests timeout=, HttpClient connectTimeout/request timeout) e trata a exceção de timeout de forma distinta de outros erros."
    - id: error_handling
      name: Tratamento de erros de rede e HTTP
      weight: 0.20
      description: Trata erro de rede, timeout, JSON inválido, ausência da taxa esperada e resposta HTTP 4xx/5xx de forma explícita, lançando erro claro conforme o contrato.
    - id: retry_strategy
      name: Estratégia de retry controlado
      weight: 0.15
      description: "Implementa no máximo uma tentativa extra para falhas transitórias (timeout, erro de rede ou 5xx), com limite fixo, sem loop infinito e sem retry para falhas permanentes como 4xx ou resposta malformada."
    - id: explanation
      name: Justificativa técnica e trade-offs
      weight: 0.10
      description: Explica por que a solução resolve o problema, discute trade-offs da estratégia de retry (latência adicional, idempotência) e quando não usar retry.
---

<!-- SECTION:statement -->
Um serviço interno de enriquecimento de perfil de usuário consulta uma API externa de cotação de moedas para exibir o saldo da conta em moeda local no momento do login. Em produção, quando a API de cotação fica lenta ou retorna erros intermitentes, a requisição de login do usuário fica pendurada por muito tempo — às vezes mais de 30 segundos — ou falha com uma mensagem genérica que não ajuda no diagnóstico.

**Contrato esperado da função `getExchangeRate(fromCurrency, toCurrency)`:**
- Retorna a taxa de câmbio como número em caso de sucesso.
- Lança/rejeita um erro com mensagem descritiva quando a API não responde em até **3 segundos** por tentativa, quando ocorre erro de rede, quando a resposta HTTP é de erro ou quando o corpo não contém a taxa esperada.
- Tenta **uma única vez adicional** antes de desistir em caso de timeout, erro de rede transitório ou HTTP 5xx.
- **Não realiza retry** para erros permanentes, como HTTP 4xx por moeda inválida.
- Nunca retorna `undefined`, `None`, `null`, `NaN` ou engole exceções silenciosamente.

**Comportamento incorreto (bug):**

Quando a API de cotação demora 25 segundos para responder:
1. A função aguarda a resposta sem timeout explícito.
2. O serviço de login fica bloqueado durante esse tempo.
3. Se a API retornar HTTP 503 com corpo de erro, a função tenta ler o corpo como se fosse sucesso e pode retornar valor ausente ou quebrar em outro ponto do fluxo.
4. Não há tentativa controlada de recuperação para erros transitórios.

**Logs observados em produção:**
```text
[09:14:01.003] Consultando cotação USD -> BRL...
[09:14:28.712] TypeError: Cannot read properties of undefined (reading 'BRL')
[09:14:28.713] Login do usuário falhou sem mensagem clara para o cliente
```

**Tarefa:**
Corrija o código do template da linguagem escolhida para tornar a integração resiliente e previsível. Você pode extrair funções auxiliares, mas deve preservar o contrato público da função. Na sua **linha de raciocínio**, explique:
1. **Causa raiz** do problema: por que o sistema fica preso e por que a falha externa vira erro pouco claro.
2. **Como** você configurou o timeout de 3 segundos por tentativa.
3. **Como** você trata timeout, erros de rede, respostas HTTP 4xx/5xx e corpo sem a taxa esperada.
4. **Estratégia de retry**: limite, condição de retry e por que 4xx não deve ser tentado novamente.
5. **Trade-offs** da solução: latência adicional, idempotência da chamada e risco de retry agressivo.

**Cenários de teste sugeridos:**
```text
API lenta:
- mock demora 10s para responder
- esperado: erro de timeout em aproximadamente 3s por tentativa, sem espera indefinida

Erro 503 transitório:
- primeira chamada retorna 503
- segunda chamada retorna 200 com taxa válida
- esperado: retorna a taxa após uma única tentativa adicional

Erro 400 permanente:
- chamada retorna 400
- esperado: erro claro sem retry

Resposta 200 malformada:
- chamada retorna 200 sem rates[toCurrency]
- esperado: erro claro sem retornar valor vazio, sem retry obrigatório
```

A questão não depende de uma API real: use mocks, stubs ou um servidor local falso nos testes.
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// exchange-rate.js

const API_BASE_URL = "https://api.exchangerates.example.com";
const TIMEOUT_MS = 3000;
const MAX_RETRIES = 1;

/**
 * Retorna a taxa de câmbio de fromCurrency para toCurrency.
 *
 * BUGS ATUAIS:
 * - fetch sem timeout explícito;
 * - status HTTP não é verificado;
 * - corpo malformado pode gerar erro genérico ou retorno undefined;
 * - não há retry controlado para falhas transitórias.
 *
 * @param {string} fromCurrency ex.: "USD"
 * @param {string} toCurrency ex.: "BRL"
 * @returns {Promise<number>}
 */
async function getExchangeRate(fromCurrency, toCurrency) {
  const url = `${API_BASE_URL}/latest?base=${fromCurrency}&symbols=${toCurrency}`;

  const response = await fetch(url);
  const data = await response.json();

  return data.rates[toCurrency];
}

module.exports = { getExchangeRate, TIMEOUT_MS, MAX_RETRIES };
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# exchange_rate.py
import requests

API_BASE_URL = "https://api.exchangerates.example.com"
TIMEOUT_SECONDS = 3
MAX_RETRIES = 1

def get_exchange_rate(from_currency: str, to_currency: str) -> float:
    """
    Retorna a taxa de câmbio de from_currency para to_currency.

    BUGS ATUAIS:
    - requests.get sem timeout explícito;
    - status HTTP não é verificado;
    - corpo malformado pode gerar KeyError genérico;
    - não há retry controlado para falhas transitórias.
    """
    url = f"{API_BASE_URL}/latest?base={from_currency}&symbols={to_currency}"

    response = requests.get(url)
    data = response.json()

    return data["rates"][to_currency]
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// ExchangeRateClient.java
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class ExchangeRateClient {

    private static final String API_BASE_URL = "https://api.exchangerates.example.com";
    private static final int TIMEOUT_SECONDS = 3;
    private static final int MAX_RETRIES = 1;

    private final HttpClient httpClient;

    public ExchangeRateClient() {
        // BUG: cliente sem timeout explícito de conexão.
        this.httpClient = HttpClient.newBuilder().build();
    }

    /**
     * Retorna a taxa de câmbio de fromCurrency para toCurrency.
     *
     * BUGS ATUAIS:
     * - request sem timeout explícito;
     * - status HTTP não é verificado;
     * - corpo malformado pode virar NaN ou erro pouco claro;
     * - não há retry controlado para falhas transitórias.
     */
    public double getExchangeRate(String fromCurrency, String toCurrency) throws IOException, InterruptedException {
        String url = API_BASE_URL + "/latest?base=" + fromCurrency + "&symbols=" + toCurrency;

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        return extractRate(response.body(), toCurrency);
    }

    // Parser simplificado para manter o foco da questão em timeout, erros HTTP e retry.
    // Em produção, use uma biblioteca JSON como Jackson ou Gson.
    private double extractRate(String json, String toCurrency) {
        String marker = "\"" + toCurrency + "\":";
        int start = json.indexOf(marker);
        if (start < 0) {
            return Double.NaN;
        }

        start += marker.length();
        int end = start;
        while (end < json.length() && "0123456789.-".indexOf(json.charAt(end)) >= 0) {
            end++;
        }

        return Double.parseDouble(json.substring(start, end));
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Causa raiz:**
- A chamada HTTP não tem timeout explícito. Em JavaScript isso aparece como `fetch()` sem `AbortController`/`signal`; em Python, `requests.get()` sem `timeout=`; em Java, `HttpClient`/`HttpRequest` sem timeout de conexão e de requisição.
- O código trata qualquer resposta como sucesso. Respostas 4xx/5xx e corpos de erro são processados como se contivessem `rates[toCurrency]`, gerando `undefined`, `KeyError`, `NaN` ou mensagens genéricas.
- Falhas transitórias não têm retry controlado, enquanto uma solução ingênua com loop sem limite poderia piorar a latência e pressionar a API externa.

**Solução esperada — pontos essenciais:**

1. **Timeout explícito por tentativa:**
   - JavaScript: usar `AbortController`, passar `signal` ao `fetch` e limpar o timer após a resposta.
   - Python: chamar `requests.get(url, timeout=3)` e capturar `requests.exceptions.Timeout`.
   - Java: configurar `HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3))` e `HttpRequest.newBuilder().timeout(Duration.ofSeconds(3))`, tratando `HttpTimeoutException`.

2. **Tratamento explícito de falhas:**
   - Verificar status HTTP antes de ler a taxa.
   - Tratar 4xx como erro permanente e não realizar retry.
   - Tratar 5xx, timeout e erro de rede como falhas transitórias elegíveis a no máximo uma tentativa adicional.
   - Validar que `rates[toCurrency]` existe e é numérico; se não existir, lançar erro claro em vez de retornar valor vazio.

3. **Retry controlado:**
   - Usar um laço com limite fixo de `MAX_RETRIES = 1`, totalizando no máximo duas tentativas.
   - Não usar retry infinito, recursão sem limite ou retry para todo tipo de erro.
   - Um pequeno delay fixo é aceitável, mas não obrigatório para o nível intermediate.
   - Após esgotar as tentativas, relançar ou encapsular o erro com mensagem descritiva.

4. **Preservação do contrato:**
   - A função deve retornar número válido em sucesso.
   - Em falha, deve lançar/rejeitar erro descritivo.
   - Não deve retornar `undefined`, `None`, `null`, `NaN` ou engolir exceções.

**Trade-offs esperados na explicação:**
- Uma tentativa adicional pode elevar a latência máxima aproximada para 6 segundos no pior caso.
- Retry é adequado aqui porque a consulta GET de cotação é idempotente.
- Circuit breaker, cache de última cotação ou fallback de domínio podem ser mencionados, mas não são exigidos e não substituem timeout + erro explícito + retry limitado.
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
- A questão pertence claramente a `bugFix/integration_and_performance`: o bug é concreto, observável nos logs e rastreável à ausência de timeout, validação de resposta e retry controlado.
- A dificuldade está adequada para `intermediate`, pois exige diagnóstico, correção técnica em cliente HTTP, tratamento explícito de falhas externas e justificativa de trade-offs, sem exigir arquitetura ampla.
- O formato `code` está coerente, com templates equivalentes em JavaScript, Python e Java representando o mesmo bug conceitual e sem depender de API real.
- O contrato esperado da função está claro: retorna número em sucesso, lança/rejeita erro descritivo em falha, aplica timeout de 3 segundos por tentativa e limita retry a uma tentativa adicional para falhas transitórias.
- A rubrica avalia causa raiz, timeout, tratamento de erro, retry controlado e preservação do contrato com pesos consistentes e critérios observáveis.
- O `solution-outline` explica os pontos essenciais sem impor uma implementação única; aceita pequenas variações, como delay fixo opcional.
- O prompt de avaliação segue o padrão real de `prompts/`, usa placeholders compatíveis com questão `code` e reproduz corretamente ids e pesos da rubrica.
- As referências são plausíveis, conservadoras e permanecem como `suggested_not_verified`.
<!-- /REVIEW:comments -->
