---
id: intermediate-feature-flag-isolation
slug: intermediate-feature-flag-isolation
title: Testes — Isolamento de Testes e Correção de Flaky Tests por Vazamento de Estado
axis: tests
subtheme: test_design
difficulty: intermediate
promptTemplate: intermediate-feature-flag-isolation
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [test_isolation, shared_state, flaky_tests, lifecycle_hooks, singleton, teardown]
references:
  - id: ref-1
    title: "Jest Docs — Setup and Teardown"
    type: official_docs
    url: "https://jestjs.io/docs/setup-teardown"
    relevance: 5
    confidence: 5
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "JUnit 5 User Guide — Test Instance Lifecycle"
    type: official_docs
    url: "https://junit.org/junit5/docs/current/user-guide/#writing-tests-test-instance-lifecycle"
    relevance: 4
    confidence: 5
    supports: [statement, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "xUnit Test Patterns: Refactoring Test Code — Gerard Meszaros"
    type: book
    url: null
    relevance: 5
    confidence: 4
    supports: [statement, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Python unittest — setUp and tearDown"
    type: official_docs
    url: "https://docs.python.org/3/library/unittest.html#unittest.TestCase.setUp"
    relevance: 4
    confidence: 5
    supports: [solution-outline]
    verificationStatus: suggested_not_verified
generationMetrics:
  validFormatSelfCheck: true
  rubricCriteriaCount: 4
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
    - id: root_cause_diagnosis
      name: Diagnóstico da causa raiz
      weight: 0.30
      description: Identifica explicitamente o vazamento de estado compartilhado (Shared State) como causa dos Flaky Tests — explica por que o "Test A", ao não limpar o Singleton, contamina o "Test B".
    - id: teardown_implementation
      name: Implementação do mecanismo de teardown/reset
      weight: 0.35
      description: Introduz o hook de limpeza correto do framework (afterEach/tearDown/@AfterEach ou equivalente beforeEach que reseta o estado), restaurando o FeatureFlagManager ao estado inicial antes ou após cada teste.
    - id: determinism
      name: Determinismo e independência da ordem de execução
      weight: 0.25
      description: A suíte refatorada passa de forma determinística independentemente da ordem de execução dos testes — ambos passam quando rodados isoladamente e quando rodados em sequência em qualquer ordem.
    - id: conceptual_justification
      name: Justificativa conceitual
      weight: 0.10
      description: Articula, ainda que brevemente, por que o isolamento de testes é um princípio essencial e como o hook escolhido o garante.
---

<!-- SECTION:statement -->
Você recebe a suíte de testes abaixo que valida um `FeatureFlagManager` — uma classe que armazena configurações de feature flags **em memória como estado global** (padrão Singleton).

A suíte apresenta um problema clássico de **Flaky Test**: quando os testes são executados individualmente, ambos passam. Quando a suíte roda completa, o **Test B falha de forma intermitente** dependendo da ordem de execução.

**Classe sob teste (não altere este arquivo):**

```javascript
// src/FeatureFlagManager.js
class FeatureFlagManager {
  constructor() {
    this._flags = {};
  }

  set(flag, value) {
    this._flags[flag] = value;
  }

  isEnabled(flag) {
    return this._flags[flag] === true;
  }

  reset() {
    this._flags = {};
  }
}

// Singleton — instância global compartilhada
const instance = new FeatureFlagManager();
module.exports = instance;
```

**Suíte de testes com problema (JavaScript/Jest):**

```javascript
// test/featureFlags.test.js
const featureFlags = require('../src/FeatureFlagManager');

describe('FeatureFlagManager', () => {
  test('Test A — NEW_UI ativa altera comportamento do sistema', () => {
    featureFlags.set('NEW_UI', true);
    expect(featureFlags.isEnabled('NEW_UI')).toBe(true);
    // Estado: NEW_UI = true — NÃO é limpo após o teste
  });

  test('Test B — comportamento padrão sem flags ativas', () => {
    // Espera que NEW_UI esteja false (estado inicial)
    expect(featureFlags.isEnabled('NEW_UI')).toBe(false);
  });
});
```

**Comportamento observado:**
- Rodando apenas o **Test B**: ✅ passa.
- Rodando apenas o **Test A**: ✅ passa.
- Rodando **a suíte completa** (Test A → Test B): ❌ Test B falha — `NEW_UI` ainda é `true`.

**Sua tarefa:**

Refatore **somente o arquivo de testes** para corrigir o Flaky Test. A classe `FeatureFlagManager` **não deve ser alterada**.

Entregue **duas coisas**:

1. O **arquivo de testes corrigido**, introduzindo o mecanismo adequado de limpeza de estado do framework.
2. Uma **justificativa** explicando: (a) por que o problema ocorre; (b) qual hook você usou e por quê; (c) como a solução garante que a ordem de execução não afete o resultado.
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// test/featureFlags.test.js
const featureFlags = require('../src/FeatureFlagManager');

describe('FeatureFlagManager', () => {
  // TODO: adicione aqui o hook de ciclo de vida adequado para limpar o estado entre testes

  test('Test A — NEW_UI ativa altera comportamento do sistema', () => {
    featureFlags.set('NEW_UI', true);
    expect(featureFlags.isEnabled('NEW_UI')).toBe(true);
  });

  test('Test B — comportamento padrão sem flags ativas', () => {
    expect(featureFlags.isEnabled('NEW_UI')).toBe(false);
  });
});
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# test_feature_flags.py
import unittest

# Classe sob teste (não altere)
class FeatureFlagManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._flags = {}
        return cls._instance

    def set(self, flag, value):
        self._flags[flag] = value

    def is_enabled(self, flag):
        return self._flags.get(flag) is True

    def reset(self):
        self._flags = {}


feature_flags = FeatureFlagManager()


class TestFeatureFlagManager(unittest.TestCase):
    # TODO: adicione aqui o método de ciclo de vida adequado para limpar o estado entre testes

    def test_a_new_ui_ativa_altera_comportamento(self):
        feature_flags.set('NEW_UI', True)
        self.assertTrue(feature_flags.is_enabled('NEW_UI'))
        # Estado: NEW_UI = True — NÃO é limpo após o teste

    def test_b_comportamento_padrao_sem_flags(self):
        # Espera que NEW_UI esteja False (estado inicial)
        self.assertFalse(feature_flags.is_enabled('NEW_UI'))


if __name__ == '__main__':
    unittest.main()
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// FeatureFlagManagerTest.java
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

// Classe sob teste — não altere
class FeatureFlagManager {
    private static final FeatureFlagManager INSTANCE = new FeatureFlagManager();
    private final java.util.Map<String, Boolean> flags = new java.util.HashMap<>();

    private FeatureFlagManager() {}

    public static FeatureFlagManager getInstance() { return INSTANCE; }

    public void set(String flag, boolean value) { flags.put(flag, value); }

    public boolean isEnabled(String flag) { return flags.getOrDefault(flag, false); }

    public void reset() { flags.clear(); }
}

class FeatureFlagManagerTest {
    private final FeatureFlagManager featureFlags = FeatureFlagManager.getInstance();

    // TODO: adicione aqui o método de ciclo de vida adequado para limpar o estado entre testes

    @Test
    void testA_newUiAtivaAlteraComportamento() {
        featureFlags.set("NEW_UI", true);
        assertTrue(featureFlags.isEnabled("NEW_UI"));
        // Estado: NEW_UI = true — NÃO é limpo após o teste
    }

    @Test
    void testB_comportamentoPadraoSemFlagsAtivas() {
        // Espera que NEW_UI esteja false (estado inicial)
        assertFalse(featureFlags.isEnabled("NEW_UI"));
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Causa raiz do Flaky Test**

- `FeatureFlagManager` é um Singleton — existe uma única instância compartilhada por toda a JVM/processo/runtime.
- O **Test A** chama `featureFlags.set('NEW_UI', true)` e não invoca `reset()` ao final.
- O **Test B** assume estado inicial (`NEW_UI = false`), mas ao rodar após Test A, o estado mutado permanece → `isEnabled('NEW_UI')` retorna `true` → falha.

**Solução: hook de teardown após cada teste**

Introduzir um bloco de limpeza executado **após cada teste** (não apenas no início da suíte):

```javascript
// JavaScript (Jest)
afterEach(() => {
  featureFlags.reset();
});
```

```python
# Python (unittest)
def tearDown(self):
    feature_flags.reset()
```

```java
// Java (JUnit 5)
@AfterEach
void tearDown() {
    featureFlags.reset();
}
```

Alternativa equivalente: usar `beforeEach`/`setUp`/`@BeforeEach` para reset — o efeito prático é o mesmo (estado limpo antes de cada teste).

**Por que `afterEach` é suficiente e por que a ordem não importa mais**

- Com o teardown, ao final do **Test A** o estado é resetado → **Test B** começa sempre com `NEW_UI = false`.
- A suíte é determinística em qualquer ordem: Test B → Test A também passa porque cada teste parte de um estado limpo.
- **Princípio de Test Isolation**: cada teste deve ser capaz de rodar em qualquer ordem sem depender de side effects de outros testes.

**Pontos essenciais para avaliação:**
1. O candidato nomeou "estado compartilhado" ou "Singleton" ou "vazamento de estado" como causa raiz.
2. Introduziu `afterEach`/`tearDown`/`@AfterEach` (ou `beforeEach` equivalente) corretamente.
3. A chamada a `reset()` (ou equivalente) está dentro do hook — não fora.
4. Justificou que a ordem de execução não afeta o resultado após a correção.
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
- A questao contem claramente o antipadrao esperado: estado global/Singleton mutado por um teste e nao limpo antes do teste seguinte, produzindo Flaky Test por Shared State.
- A rubrica recompensa adequadamente hooks de ciclo de vida, com peso central para afterEach/tearDown/@AfterEach ou equivalentes beforeEach/setUp/@BeforeEach, e nao incentiva reset manual isolado dentro de cada teste.
- O solution-outline sugere explicitamente a limpeza do estado nas tres linguagens esperadas: JavaScript/Jest, Python/unittest e Java/JUnit 5.
- O prompt de avaliacao orienta o avaliador a procurar Shared State, Singleton sem cleanup, Flaky Tests e Test Isolation na justificativa textual do aluno.
- A questao permanece contida e focada em design do fluxo de testes, sem exigir bibliotecas complexas de mock ou infraestrutura adicional.
- As referencias estao presentes e plausiveis para apoiar a questao, mantendo verificacao humana posterior.
<!-- /REVIEW:comments -->
