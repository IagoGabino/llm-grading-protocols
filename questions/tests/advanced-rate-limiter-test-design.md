---
id: advanced-rate-limiter-test-design
slug: advanced-rate-limiter-test-design
title: "Testes — Design de Suíte para Rate Limiter com Janela Temporal"
axis: tests
subtheme: test_design
difficulty: advanced
promptTemplate: advanced-rate-limiter-test-design
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [test_design, fake_clock, boundary_testing, time_control, rate_limiting, user_isolation, regression]
references:
  - id: ref-1
    title: "xUnit Test Patterns: Refactoring Test Code — Gerard Meszaros"
    type: book
    url: null
    relevance: 5
    confidence: 4
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Growing Object-Oriented Software, Guided by Tests — Freeman & Pryce"
    type: book
    url: null
    relevance: 4
    confidence: 4
    supports: [statement, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Jest Docs — Timer Mocks"
    type: official_docs
    url: "https://jestjs.io/docs/timer-mocks"
    relevance: 4
    confidence: 5
    supports: [solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "The Art of Unit Testing — Roy Osherove"
    type: book
    url: null
    relevance: 4
    confidence: 3
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
    - id: gap_identification
      name: Identificação das lacunas da suíte inicial
      weight: 0.20
      description: O aluno enumera explicitamente os cenários ausentes na suíte inicial — falta de teste de bloqueio ao exceder o limite, ausência de teste de reset após expiração da janela, ausência de teste de isolamento entre usuários distintos e ausência de teste na borda temporal exata (requisição no instante t=60s).
    - id: boundary_and_window_coverage
      name: Cobertura de bordas temporais e janela
      weight: 0.30
      description: A suíte ampliada cobre a borda de início de janela, o instante exatamente em t=60s (dentro ou fora, conforme a semântica definida), o instante t=60s+1 (nova janela), e o comportamento de reset após a expiração — todos os testes passam sem depender de tempo real.
    - id: deterministic_time_control
      name: Controle determinístico do tempo
      weight: 0.25
      description: Os testes usam exclusivamente o parâmetro `now` injetável (ou fake clock equivalente) para simular avanço temporal — nenhum teste usa `sleep`, `setTimeout` real ou `Date.now()` diretamente; o tempo avança apenas por manipulação explícita no código de teste.
    - id: user_isolation
      name: Isolamento entre usuários e entre testes
      weight: 0.15
      description: Existe pelo menos um teste que verifica que requisições de `userId-A` não consomem cota de `userId-B`; cada teste começa com estado limpo (nova instância do limiter ou reset explícito), garantindo independência.
    - id: regression_justification
      name: Justificativa de proteção contra regressões
      weight: 0.10
      description: O aluno explica por que os testes adicionados protegem contra regressões concretas — por exemplo, que um bug de off-by-one na borda da janela seria capturado pelo teste de fronteira, ou que um bug de estado compartilhado entre usuários seria capturado pelo teste de isolamento.
---

<!-- SECTION:statement -->
Você trabalha em um serviço de API interna. A equipe implementou um módulo `RateLimiter` que limita quantas requisições cada usuário pode fazer dentro de uma janela deslizante de **60 segundos**, com um máximo de **3 requisições por usuário**.

**Contrato do módulo (não altere este arquivo):**

```javascript
// src/RateLimiter.js
class RateLimiter {
  constructor(maxRequests = 3, windowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this._log = new Map(); // userId → [timestamp, ...]
  }

  /**
   * Verifica se a requisição do usuário é permitida.
   * @param {string} userId  - identificador do usuário
   * @param {number} now     - timestamp em ms (injetável para testes)
   * @returns {boolean}      - true se permitida, false se bloqueada
   */
  allow(userId, now = Date.now()) {
    const windowStart = now - this.windowMs;

    // Remove entradas fora da janela atual
    const timestamps = (this._log.get(userId) || []).filter(
      (ts) => ts > windowStart
    );

    if (timestamps.length >= this.maxRequests) {
      this._log.set(userId, timestamps);
      return false;
    }

    timestamps.push(now);
    this._log.set(userId, timestamps);
    return true;
  }
}

module.exports = RateLimiter;
```

> **Semântica da borda temporal:** uma requisição com timestamp `ts` é considerada **dentro** da janela se `ts > now - windowMs`. Portanto, uma requisição feita exatamente em `t = windowStart` (ou seja, `ts === now - windowMs`) **não** está mais na janela e não é contada.

**Suíte de testes inicial (incompleta):**

```javascript
// test/rateLimiter.test.js
const RateLimiter = require('../src/RateLimiter');

describe('RateLimiter', () => {
  test('permite a primeira requisição de um usuário', () => {
    const limiter = new RateLimiter();
    const result = limiter.allow('user-1', 1000);
    expect(result).toBe(true);
  });
});
```

**Problemas observados na suíte atual:**

- Há apenas um teste: caminho feliz da primeira requisição.
- Não há teste de bloqueio quando o limite é atingido.
- Não há teste de reset após a janela expirar.
- Não há teste de isolamento: dois usuários distintos nunca são testados juntos.
- A borda temporal (exatamente em `t = windowStart`) nunca é verificada.
- Nenhum teste usa relógio controlado; a suíte não demonstra como controlar o tempo.

**Sua tarefa:**

1. **Identifique** as lacunas da suíte inicial descritas acima (pode ser em comentário ou na justificativa textual).
2. **Escreva** testes que cubram, no mínimo:
   - Caminho feliz: 3 requisições permitidas dentro da janela.
   - Bloqueio: a 4ª requisição é recusada dentro da mesma janela.
   - Reset após janela: após `windowMs` milissegundos, o usuário pode fazer novas requisições.
   - Borda exata: requisição no instante `ts === now - windowMs` — verifique se está dentro ou fora conforme a semântica definida.
   - Isolamento: requisições de `user-A` não afetam a cota de `user-B`.
3. **Controle o tempo** exclusivamente via parâmetro `now` — não use `sleep`, `Date.now()` real nem timers reais.
4. **Justifique** por que cada grupo de testes protege contra uma regressão concreta.
5. **Evite** testes frágeis baseados em tempo real ou dependência de ordem de execução.

Entregue **duas coisas**:
1. O **arquivo de testes ampliado** com os novos casos de teste.
2. Uma **justificativa** cobrindo: (a) lacunas identificadas; (b) como o controle de `now` elimina a dependência de tempo real; (c) qual regressão cada grupo de testes previne.
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// test/rateLimiter.test.js
const RateLimiter = require('../src/RateLimiter');

describe('RateLimiter', () => {
  // TODO: declare variáveis compartilhadas aqui, se necessário

  // --- Caminho feliz ---
  test('permite a primeira requisição de um usuário', () => {
    const limiter = new RateLimiter();
    expect(limiter.allow('user-1', 1000)).toBe(true);
  });

  // TODO: adicione teste — 3 requisições consecutivas dentro da janela são permitidas

  // --- Bloqueio ao exceder o limite ---
  // TODO: adicione teste — a 4ª requisição dentro da janela é bloqueada

  // --- Reset após expiração da janela ---
  // TODO: adicione teste — após windowMs ms, o usuário pode fazer novas requisições

  // --- Borda temporal ---
  // TODO: adicione teste — requisição exatamente em ts === now - windowMs
  //       (verifique a semântica: está dentro ou fora da janela?)

  // --- Isolamento entre usuários ---
  // TODO: adicione teste — requisições de user-A não consomem cota de user-B
});
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# test_rate_limiter.py
import unittest


# Módulo sob teste (não altere)
class RateLimiter:
    def __init__(self, max_requests=3, window_ms=60_000):
        self.max_requests = max_requests
        self.window_ms = window_ms
        self._log = {}  # user_id → [timestamp, ...]

    def allow(self, user_id: str, now: int) -> bool:
        """
        Verifica se a requisição do usuário é permitida.
        Semântica da borda: ts > now - window_ms (estritamente maior).
        """
        window_start = now - self.window_ms
        timestamps = [ts for ts in self._log.get(user_id, []) if ts > window_start]

        if len(timestamps) >= self.max_requests:
            self._log[user_id] = timestamps
            return False

        timestamps.append(now)
        self._log[user_id] = timestamps
        return True


class TestRateLimiter(unittest.TestCase):

    # --- Caminho feliz ---
    def test_permite_primeira_requisicao(self):
        limiter = RateLimiter()
        self.assertTrue(limiter.allow('user-1', 1000))

    # TODO: adicione teste — 3 requisições dentro da janela são todas permitidas

    # --- Bloqueio ao exceder o limite ---
    # TODO: adicione teste — a 4ª requisição dentro da janela é bloqueada (retorna False)

    # --- Reset após expiração da janela ---
    # TODO: adicione teste — após window_ms ms, o usuário pode fazer novas requisições
    #       Dica: avance `now` em vez de usar time.sleep()

    # --- Borda temporal ---
    # TODO: adicione teste — requisição com ts == now - window_ms
    #       (verifique a semântica: deve retornar True ou False?)

    # --- Isolamento entre usuários ---
    # TODO: adicione teste — cota de user-a não afeta cota de user-b


if __name__ == '__main__':
    unittest.main()
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// RateLimiterTest.java
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.util.*;

// Módulo sob teste — não altere
class RateLimiter {
    private final int maxRequests;
    private final long windowMs;
    private final Map<String, List<Long>> log = new HashMap<>();

    public RateLimiter(int maxRequests, long windowMs) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }

    /**
     * Verifica se a requisição do usuário é permitida.
     * Semântica da borda: ts > now - windowMs (estritamente maior).
     *
     * @param userId identificador do usuário
     * @param now    timestamp em ms (injetável para testes)
     * @return true se permitida, false se bloqueada
     */
    public boolean allow(String userId, long now) {
        long windowStart = now - windowMs;
        List<Long> timestamps = new ArrayList<>();
        for (long ts : log.getOrDefault(userId, Collections.emptyList())) {
            if (ts > windowStart) timestamps.add(ts);
        }
        if (timestamps.size() >= maxRequests) {
            log.put(userId, timestamps);
            return false;
        }
        timestamps.add(now);
        log.put(userId, timestamps);
        return true;
    }
}

class RateLimiterTest {
    private RateLimiter limiter;

    @BeforeEach
    void setUp() {
        // Instância nova garante estado limpo por teste
        limiter = new RateLimiter(3, 60_000L);
    }

    // --- Caminho feliz ---
    @Test
    void permitePrimeiraRequisicao() {
        assertTrue(limiter.allow("user-1", 1000L));
    }

    // TODO: adicione teste — 3 requisições dentro da janela são todas permitidas

    // --- Bloqueio ao exceder o limite ---
    // TODO: adicione teste — a 4ª requisição dentro da janela é bloqueada (retorna false)

    // --- Reset após expiração da janela ---
    // TODO: adicione teste — após windowMs ms, o usuário pode fazer novas requisições
    //       Dica: avance o parâmetro `now`, não use Thread.sleep()

    // --- Borda temporal ---
    // TODO: adicione teste — requisição com ts == now - windowMs
    //       (verifique a semântica: deve retornar true ou false?)

    // --- Isolamento entre usuários ---
    // TODO: adicione teste — cota de userA não afeta cota de userB
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Lacunas da suíte inicial**

1. Sem teste de bloqueio (a 4ª chamada dentro da janela não é verificada).
2. Sem teste de reset: o estado após expiração da janela não é coberto.
3. Sem verificação da borda temporal exata (`ts === now - windowMs`).
4. Sem teste de isolamento entre usuários distintos.
5. A única chamada existente não demonstra controle determinístico do tempo.

**Testes esperados e suas justificativas**

**Caminho feliz — 3 requisições permitidas:**
```javascript
test('permite até 3 requisições dentro da janela', () => {
  const limiter = new RateLimiter(3, 60_000);
  const t = 0;
  expect(limiter.allow('user-1', t)).toBe(true);
  expect(limiter.allow('user-1', t + 1)).toBe(true);
  expect(limiter.allow('user-1', t + 2)).toBe(true);
});
```
*Protege contra regressão: se `maxRequests` for aplicado antes de adicionar a requisição ao log, a 3ª seria bloqueada incorretamente.*

**Bloqueio na 4ª requisição:**
```javascript
test('bloqueia a 4ª requisição dentro da janela', () => {
  const limiter = new RateLimiter(3, 60_000);
  const t = 0;
  limiter.allow('user-1', t);
  limiter.allow('user-1', t + 1);
  limiter.allow('user-1', t + 2);
  expect(limiter.allow('user-1', t + 3)).toBe(false);
});
```
*Protege contra regressão: bug de off-by-one que permitisse `maxRequests + 1` chamadas.*

**Reset após expiração da janela:**
```javascript
test('permite novas requisições após a janela expirar', () => {
  const limiter = new RateLimiter(3, 60_000);
  const t = 0;
  limiter.allow('user-1', t);
  limiter.allow('user-1', t + 1);
  limiter.allow('user-1', t + 2);
  // Avança para além da janela
  const tNew = t + 60_001;
  expect(limiter.allow('user-1', tNew)).toBe(true);
});
```
*Protege contra regressão: log que nunca descarta entradas antigas, bloqueando o usuário para sempre.*

**Borda temporal exata (`ts === windowStart`):**
```javascript
test('requisição exatamente em ts === now - windowMs está fora da janela', () => {
  const limiter = new RateLimiter(3, 60_000);
  const t0 = 0;
  // 3 requisições na janela [0 .. 60_000)
  limiter.allow('user-1', t0);
  limiter.allow('user-1', t0 + 1);
  limiter.allow('user-1', t0 + 2);
  // now = 60_000: windowStart = 0; ts=0 → 0 > 0 é false → descartado
  expect(limiter.allow('user-1', 60_000)).toBe(true); // 1 slot livre
});
```
*Protege contra regressão: comparação `>=` em vez de `>` que manteria entradas expiradas e bloquearia o usuário antes do esperado.*

**Isolamento entre usuários:**
```javascript
test('cota de user-A não afeta user-B', () => {
  const limiter = new RateLimiter(3, 60_000);
  const t = 0;
  // Esgota cota de user-A
  limiter.allow('user-A', t);
  limiter.allow('user-A', t + 1);
  limiter.allow('user-A', t + 2);
  expect(limiter.allow('user-A', t + 3)).toBe(false);
  // user-B ainda tem cota completa
  expect(limiter.allow('user-B', t + 3)).toBe(true);
});
```
*Protege contra regressão: contador global em vez de por usuário, que bloquearia todos quando um único usuário atingisse o limite.*

**Controle determinístico do tempo**

- Todos os testes passam o parâmetro `now` explicitamente.
- Nenhum teste usa `sleep`, `Date.now()` real, `time.sleep()` ou `Thread.sleep()`.
- O avanço temporal é feito somando valores inteiros a uma constante base.
- Isso garante que os testes sejam determinísticos, rápidos e independentes de relógio do SO.

**Isolamento entre testes**

- JavaScript/Python: cria nova instância do `RateLimiter` em cada teste (variável local).
- Java: `@BeforeEach` instancia `new RateLimiter(3, 60_000L)` antes de cada teste.
- Nenhum teste depende de estado deixado por outro.
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
- A questao pertence corretamente a tests/test_design: o foco e projetar e complementar uma suite de testes para comportamento temporal, limites de chamadas, isolamento por usuario e regressao, sem exigir refatoracao de testabilidade ou desenho arquitetural.
- A dificuldade advanced e adequada porque exige raciocinio sobre janela deslizante, limite exato, descarte de timestamps expirados, fronteira temporal e independencia entre usuarios e entre testes.
- O formato code esta valido, com templates coerentes para JavaScript, Python e Java, todos preservando a mesma tarefa e a mesma semantica de borda baseada em `ts > now - windowMs`.
- O modulo permite teste deterministico por meio do parametro `now`, e o enunciado desencoraja explicitamente `sleep`, relogio real, timers reais e dependencia de ordem de execucao.
- A rubrica e observavel e cobre lacunas da suite inicial, cenario feliz, bloqueio ao exceder limite, reset da janela, borda temporal, controle deterministico do tempo, isolamento por usuario e justificativa de regressao.
- O solution-outline permanece contido em design de testes de rate limiter local; nao desvia para Redis, rate limiting distribuido ou arquitetura.
- O prompt de avaliacao segue o padrao dos prompts de questoes code, usa placeholders compativeis, reproduz corretamente ids e pesos da rubrica e orienta a avaliacao para os cenarios centrais.
- As referencias estao presentes e plausiveis para testes deterministas e design de suites, permanecendo corretamente como suggested_not_verified.
<!-- /REVIEW:comments -->
