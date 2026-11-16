---
id: easy-library-fine-coverage-quality
slug: easy-library-fine-coverage-quality
title: "Testes — Qualidade de Cobertura em Função de Multa por Atraso na Devolução"
axis: tests
subtheme: coverage_and_quality
difficulty: easy
promptTemplate: easy-library-fine-coverage-quality
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [coverage_gap, weak_assertions, edge_cases, boundary_conditions, fine_calculation]
references:
  - id: ref-1
    title: "The Art of Unit Testing, 3rd Edition"
    type: book
    url: null
    relevance: 5
    confidence: 4
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Martin Fowler — Test Coverage"
    type: technical_blog
    url: "https://martinfowler.com/bliki/TestCoverage.html"
    relevance: 5
    confidence: 5
    supports: [statement, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "xUnit Test Patterns — Gerard Meszaros"
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
  plannedDifficulty: easy
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
      description: "Identifica explicitamente as lacunas da suíte original: ausência de teste para devolução no prazo (daysLate <= 0), usuário isento, multa máxima e o fato de o único assert existente cobrir apenas o caminho feliz simples."
    - id: scenario_coverage
      name: Cobertura de cenários relevantes
      weight: 0.30
      description: "Inclui testes para: (1) caso comum com multa calculada (caminho feliz), (2) devolução no prazo (daysLate <= 0 → 0), (3) usuário isento (isExemptUser = true → 0), (4) multa que atinge o teto máximo de 50, (5) daysLate = 0 como limite exato."
    - id: assertion_quality
      name: Qualidade dos asserts
      weight: 0.25
      description: "Asserts verificam o valor numérico retornado de forma objetiva (ex.: assertEqual(resultado, 0), toBe(50)), não apenas se o resultado é truthy ou non-null. Evita asserts que passariam com qualquer número positivo."
    - id: boundary_and_special_cases
      name: Casos de borda e regras especiais
      weight: 0.15
      description: "Cobre pelo menos dois cenários de borda ou regra especial: daysLate = 0, multa exatamente no limite (resultado = 50), ou combinação de usuário isento com atraso positivo."
    - id: coverage_justification
      name: Justificativa da melhoria de cobertura
      weight: 0.10
      description: "Explica, mesmo que brevemente, por que cada cenário adicionado aumenta a confiança na função — especialmente por que testar apenas o caso feliz deixa as regras de isenção e de teto sem verificação."
---

<!-- SECTION:statement -->
## Contexto

O sistema interno de uma biblioteca registra empréstimos de equipamentos (câmeras, tripés, notebooks). Quando um equipamento é devolvido com atraso, o sistema calcula a multa usando a função `calculateFine`. A suíte de testes atual possui **apenas um teste**, cobrindo somente o caso feliz de atraso comum.

**Contratos da função:**

- `calculateFine(daysLate, isExemptUser, dailyFine)` retorna um número.
- Se `daysLate <= 0` → multa é `0` (devolução no prazo ou antecipada).
- Se `isExemptUser` for `true` → multa é `0` (usuário isento, independente do atraso).
- Caso contrário → multa = `daysLate * dailyFine`.
- A multa máxima é `50`: se o cálculo ultrapassar `50`, retorna `50`.

**Código a ser testado (JavaScript):**

```javascript
// src/calculateFine.js
/**
 * @param {number} daysLate      - dias de atraso (0 ou negativo = no prazo)
 * @param {boolean} isExemptUser - true se o usuário tem isenção de multa
 * @param {number} dailyFine     - valor da multa por dia (R$)
 * @returns {number} valor da multa a cobrar
 */
function calculateFine(daysLate, isExemptUser, dailyFine) {
  if (daysLate <= 0) return 0;
  if (isExemptUser) return 0;
  const fine = daysLate * dailyFine;
  return fine > 50 ? 50 : fine;
}

module.exports = { calculateFine };
```

**Suíte de testes atual (com problemas de cobertura):**

```javascript
// test/calculateFine.test.js
const { calculateFine } = require('../src/calculateFine');

describe('calculateFine', () => {
  test('calcula multa para atraso comum', () => {
    expect(calculateFine(3, false, 2)).toBe(6);
  });
});
```

> **Atenção:** a suíte atual executa apenas o caminho feliz de atraso com multiplicação simples. As regras de devolução no prazo, isenção de usuário e teto máximo de multa nunca são verificadas.

**Sua tarefa:**

1. **Identifique** as lacunas da suíte atual: quais cenários essenciais não são cobertos.
2. **Melhore a suíte de testes** adicionando casos que cubram:
   - Devolução no prazo (`daysLate = 0`).
   - Usuário isento com atraso positivo (`isExemptUser = true`).
   - Multa que atinge o teto máximo de 50.
   - Pelo menos um caso de borda adicional à sua escolha.
3. Use **asserts objetivos** que verifiquem o valor numérico retornado.
4. **Explique brevemente** por que os testes adicionados aumentam a confiança na função.
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// test/calculateFine.test.js
const { calculateFine } = require('../src/calculateFine');

describe('calculateFine', () => {
  // Teste existente (não remova)
  test('calcula multa para atraso comum', () => {
    expect(calculateFine(3, false, 2)).toBe(6);
  });

  // TODO: adicione testes para os cenários listados no enunciado
  // Sugestão de organização:
  // test('devolução no prazo não gera multa', ...)
  // test('usuário isento não paga multa mesmo com atraso', ...)
  // test('multa não ultrapassa o teto de 50', ...)
  // test('caso de borda: ...', ...)
});

/*
 * Linha de raciocínio (escreva abaixo como comentário):
 *
 * TODO: explique quais lacunas a suíte original tinha e como os novos
 * testes aumentam a confiança na função calculateFine.
 */
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# test_calculate_fine.py
import unittest

# Função disponível no escopo:
def calculate_fine(days_late: int, is_exempt_user: bool, daily_fine: float) -> float:
    if days_late <= 0:
        return 0
    if is_exempt_user:
        return 0
    fine = days_late * daily_fine
    return 50 if fine > 50 else fine


class CalculateFineTest(unittest.TestCase):
    # Teste existente (mantenha)
    def test_calcula_multa_para_atraso_comum(self):
        self.assertEqual(calculate_fine(3, False, 2), 6)

    # TODO: adicione os demais cenários descritos no enunciado
    # def test_devolucao_no_prazo_nao_gera_multa(self): ...
    # def test_usuario_isento_nao_paga_multa(self): ...
    # def test_multa_nao_ultrapassa_teto(self): ...
    # def test_caso_de_borda(self): ...


if __name__ == '__main__':
    unittest.main()

# Linha de raciocínio (escreva como comentário):
# TODO: explique quais lacunas a suíte original tinha e como os novos
# testes aumentam a confiança na função calculate_fine.
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// CalculateFineTest.java
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

// Função disponível no escopo:
// class CalculateFine {
//   static double calculateFine(int daysLate, boolean isExemptUser, double dailyFine) { ... }
// }

public class CalculateFineTest {

    // Teste existente (mantenha)
    @Test
    void calculaMultaParaAtrasoComum() {
        assertEquals(6.0, CalculateFine.calculateFine(3, false, 2.0));
    }

    // TODO: adicione os demais cenários descritos no enunciado.
    // @Test void devolucaoNoPrazoNaoGeraMulta() { ... }
    // @Test void usuarioIsentoNaoPagaMulta() { ... }
    // @Test void multaNaoUltrapassaTeto() { ... }
    // @Test void casoDeBorda() { ... }
}

/*
 * Linha de raciocínio (escreva como comentário):
 *
 * TODO: explique quais lacunas a suíte original tinha e como os novos
 * testes aumentam a confiança na função calculateFine.
 */

// Implementação auxiliar para compilar:
class CalculateFine {
    static double calculateFine(int daysLate, boolean isExemptUser, double dailyFine) {
        if (daysLate <= 0) return 0;
        if (isExemptUser) return 0;
        double fine = daysLate * dailyFine;
        return fine > 50 ? 50 : fine;
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Lacunas da suíte original**

- Apenas 1 teste, cobrindo somente a multiplicação simples (caminho feliz).
- A regra `daysLate <= 0 → 0` nunca é verificada: um bug que sempre retornasse `daysLate * dailyFine` passaria.
- A regra `isExemptUser → 0` nunca é verificada: remover essa condição da função não quebraria nenhum teste.
- A regra do teto de 50 nunca é verificada: um bug que retornasse `daysLate * dailyFine` sem cap passaria em todos os testes.

**Cenários mínimos que a suíte melhorada deve incluir**

- **Devolução no prazo:** `calculateFine(0, false, 2)` → `0`; `calculateFine(-1, false, 5)` → `0`.
- **Usuário isento com atraso positivo:** `calculateFine(5, true, 10)` → `0`.
- **Multa exatamente no limite:** `calculateFine(5, false, 10)` → `50` (5×10=50).
- **Multa acima do teto:** `calculateFine(10, false, 10)` → `50` (10×10=100, cortado a 50).
- **Caso comum (já existia):** `calculateFine(3, false, 2)` → `6`.

**Por que os asserts objetivos aumentam a confiança**

- `toBe(0)` / `assertEqual(resultado, 0)` detecta imediatamente se a regra de isenção foi quebrada, o que `toBeTruthy()` ou ausência de assert não detectaria.
- Testar o teto máximo com um valor acima e um exatamente no limite garante que o `> 50` não foi trocado por `>= 50` por engano.
- Testar `isExemptUser = true` com `daysLate > 0` garante que a condição de isenção é avaliada antes da multiplicação.

**Sobre cobertura e qualidade**

- Cobertura de linhas mede se cada linha foi executada, não se cada ramo de decisão foi testado nas duas direções.
- Um único teste de caminho feliz pode dar 50% de cobertura de linhas mas deixar todas as regras de negócio críticas sem validação.
- A suíte melhorada cobre todos os quatro ramos da função (`daysLate <= 0`, `isExemptUser`, `fine > 50`, caminho feliz), aumentando a confiança real no comportamento.
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
- A questao pertence corretamente a `tests/coverage_and_quality`: o foco e identificar lacunas de uma suite inicial fraca e melhorar a cobertura com cenarios que exercitam regras de negocio simples.
- A dificuldade `easy` esta adequada. A tarefa exige adicionar testes diretos para caminhos e bordas essenciais, com asserts objetivos e uma justificativa breve, sem exigir mutation testing, ferramenta avancada de cobertura ou mocks.
- O formato `code` esta valido, e os templates de JavaScript, Python e Java representam o mesmo contrato: manter o teste existente, adicionar casos para devolucao no prazo, usuario isento, teto de multa e bordas simples, e explicar a melhoria de confianca.
- A questao apresenta uma funcao simples e uma suite inicial claramente insuficiente, sem transformar a tarefa em reimplementacao da funcao.
- As regras de negocio sao explicitas e avaliaveis: `daysLate <= 0` retorna 0, usuario isento retorna 0, caso comum multiplica dias por multa diaria, e o resultado e limitado a 50.
- A rubrica e observavel e bem alinhada ao enunciado: avalia identificacao das lacunas, cobertura de cenarios essenciais, qualidade dos asserts, bordas/regras especiais e justificativa da melhoria.
- O `solution-outline` e consistente com uma questao easy e permanece em testes unitarios simples, sem ferramentas ou tecnicas avancadas.
- O prompt de avaliacao segue o padrao real de `prompts/` para questoes `code`, usa placeholders compativeis (`enunciado`, `rubrica`, `pontos_esperados`, `codigo`, `raciocinio`) e reproduz corretamente os ids e pesos da rubrica.
- As referencias sao plausiveis e conservadoras para qualidade de testes e cobertura, permanecendo corretamente como `suggested_not_verified`.
<!-- /REVIEW:comments -->
