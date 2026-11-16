---
id: intermediate-readability-discount-eligibility
slug: intermediate-readability-discount-eligibility
title: Qualidade de Código — Elegibilidade de Desconto para Cliente VIP
axis: codeQuality
subtheme: readability
difficulty: intermediate
promptTemplate: intermediate-readability-discount-eligibility
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [readability, nested_conditionals, naming, extract_function, business_rules]
references:
  - id: ref-1
    title: "Refactoring: Improving the Design of Existing Code (2nd ed.) — Martin Fowler"
    type: book
    url: null
    relevance: 5
    confidence: 4
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Clean Code: A Handbook of Agile Software Craftsmanship — Robert C. Martin"
    type: book
    url: null
    relevance: 4
    confidence: 4
    supports: [rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Replace Nested Conditional with Guard Clauses — Refactoring Catalog"
    type: technical_blog
    url: "https://refactoring.com/catalog/replaceNestedConditionalWithGuardClauses.html"
    relevance: 4
    confidence: 3
    supports: [statement, solution-outline]
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
    - id: naming_clarity
      name: Clareza dos nomes
      weight: 0.25
      description: "Variáveis, parâmetros e funções auxiliares recebem nomes que revelam intenção; elimina abreviações e nomes genéricos (d, fl, c, tmp)."
    - id: conditional_simplification
      name: Simplificação do fluxo condicional
      weight: 0.30
      description: "Reduz profundidade de condicionais aninhadas usando guard clauses, early return ou decomposição de predicados nomeados; o fluxo principal fica linear e legível."
    - id: function_extraction
      name: Extração de funções auxiliares
      weight: 0.20
      description: "Isola verificações ou cálculos coesos em funções menores com nome descritivo (ex.: isVipEligible, calculateLoyaltyBonus), sem duplicar lógica."
    - id: behavior_preservation
      name: Preservação de comportamento
      weight: 0.15
      description: "A refatoração não altera os valores calculados nem as condições de elegibilidade; edge cases (compras = 0, tier inválido, sem histórico) continuam com o mesmo resultado."
    - id: reasoning
      name: Justificativa / linha de raciocínio
      weight: 0.10
      description: "Explica quais problemas de legibilidade foram corrigidos, quais técnicas foram aplicadas e por que as decisões tomadas facilitam leitura e manutenção futura."
---

<!-- SECTION:statement -->
A função abaixo determina o percentual de desconto a aplicar no próximo pedido de um cliente de e-commerce com base em seu histórico de compras e nível de fidelidade. O código é funcional, mas extremamente difícil de ler: usa nomes de uma letra, condicionais profundamente aninhadas e mistura verificações de elegibilidade com o cálculo do desconto em uma única função densa.

**Regras de negócio (para preservação de comportamento):**
- Um cliente é **VIP** se `tier === 'vip'` **ou** se `purchases >= 10`.
- Um cliente é **elegível para desconto de lealdade** se for VIP **e** tiver `monthsActive >= 6`.
- O **desconto base** depende do nível:
  - `'vip'`: **15%**
  - `'gold'`: **10%**
  - qualquer outro: **5%**
- Se elegível para desconto de lealdade, soma-se um **bônus de lealdade**:
  - Se `monthsActive >= 24`: bônus = **8%**
  - Se `monthsActive >= 12`: bônus = **5%**
  - Caso contrário (entre 6 e 11): bônus = **2%**
- Se o cliente **não** for VIP e tiver `purchases === 0`, retorna **0** (sem desconto).
- O desconto total máximo é **20%**; valores acima são truncados para **20**.

**Tarefa:** refatore a função abaixo para melhorar sua legibilidade. Foque em nomear variáveis e funções de forma descritiva, reduzir a profundidade de condicionais aninhadas e extrair funções auxiliares coesas. **Não altere o comportamento.** Apresente suas decisões e justificativas numa **linha de raciocínio separada**.

```javascript
// discount.js
function calc(c) {
  let d = 0;
  if (c) {
    if (c.t === 'vip' || c.p >= 10) {
      if (c.t === 'vip') { d = 15; }
      else if (c.t === 'gold') { d = 10; }
      else { d = 5; }
      if (c.ma >= 6) {
        let fl = 0;
        if (c.ma >= 24) { fl = 8; }
        else if (c.ma >= 12) { fl = 5; }
        else { fl = 2; }
        d += fl;
      }
    } else {
      if (c.t === 'gold') { d = 10; }
      else { d = 5; }
      if (c.p === 0) { d = 0; }
    }
    if (d > 20) { d = 20; }
  }
  return d;
}

module.exports = { calc };
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// discount.js

/**
 * Retorna o percentual de desconto (0–20) para o próximo pedido do cliente.
 * @param {{ t: string, p: number, ma: number }} customer
 *   t  = tier ('vip' | 'gold' | outro)
 *   p  = número de compras realizadas
 *   ma = meses como cliente ativo
 * @returns {number}
 */
export function calculateDiscount(customer) {
  if (!customer) return 0;

  // TODO: refatore preservando as regras descritas no enunciado.
  // Dica: extraia funções auxiliares com nomes que revelem intenção
  //       e reduza a profundidade das condicionais.
  return 0;
}
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# discount.py
from typing import Optional


def calculate_discount(customer: Optional[dict]) -> float:
    """
    Retorna o percentual de desconto (0–20) para o próximo pedido do cliente.

    customer keys:
        t  (str)  — tier: 'vip' | 'gold' | outro
        p  (int)  — número de compras realizadas
        ma (int)  — meses como cliente ativo

    TODO: refatore preservando as regras descritas no enunciado.
    Dica: extraia funções auxiliares com nomes que revelem intenção
          e reduza a profundidade das condicionais.
    """
    if not customer:
        return 0.0

    return 0.0
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// DiscountCalculator.java
public class DiscountCalculator {

    /**
     * Retorna o percentual de desconto (0–20) para o próximo pedido do cliente.
     *
     * @param customer objeto com tier (String), purchases (int) e monthsActive (int)
     * @return percentual de desconto
     *
     * TODO: refatore preservando as regras descritas no enunciado.
     * Dica: extraia métodos auxiliares com nomes que revelem intenção
     *       e reduza a profundidade das condicionais.
     */
    public int calculateDiscount(Customer customer) {
        if (customer == null) return 0;

        return 0;
    }

    public static class Customer {
        public String tier;      // 'vip' | 'gold' | outro
        public int purchases;    // número de compras realizadas
        public int monthsActive; // meses como cliente ativo
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
Problemas de legibilidade identificados: **nomes de uma letra** (`c`, `d`, `fl`, `t`, `p`, `ma`), **condicionais profundamente aninhadas** (até 4 níveis), **mistura de verificação de elegibilidade com cálculo do desconto**, **guard clause ausente** para o caso `customer === null`.

Técnicas sugeridas: **renomear variáveis e parâmetros** para nomes que revelem intenção, **extrair predicados nomeados** (`isVipCustomer`, `isLoyaltyEligible`), **extrair funções de cálculo** (`getBaseDiscount`, `getLoyaltyBonus`), **substituir condicionais aninhadas por guard clauses / early return**, **introduzir constante** `MAX_DISCOUNT = 20`.

Pontos essenciais da solução:
- `isVipCustomer(customer)` → `customer.tier === 'vip' || customer.purchases >= 10`.
- `isLoyaltyEligible(customer)` → `isVipCustomer(customer) && customer.monthsActive >= 6`.
- `getBaseDiscount(tier)` → tabela `{ vip: 15, gold: 10 }` com fallback 5.
- `getLoyaltyBonus(monthsActive)` → guard clauses: `>= 24 → 8`, `>= 12 → 5`, else `2`.
- Fluxo principal:
  1. Guard: se `!isVipCustomer` e `purchases === 0`, retorna `0`.
  2. Calcula `baseDiscount` pelo tier.
  3. Se `isLoyaltyEligible`, soma `loyaltyBonus`.
  4. Retorna `Math.min(total, MAX_DISCOUNT)`.
- **Preservar comportamento**: clientes `gold` não-VIP com `purchases > 0` recebem 10%; `purchases === 0` sem ser VIP recebem 0; desconto máximo é 20.
<!-- /SECTION:solution-outline -->

<!-- REVIEW:metrics -->
{
  "quality": {
    "technicalCorrectness": 3,
    "statementClarity": 4,
    "rubricAlignment": 4,
    "difficultyAlignment": 4
  },
  "compatibility": {
    "promptAlignment": 4,
    "formatValid": true
  },
  "recommendation": "minor_revision",
  "statusAfterReview": "needs_human_review",
  "mainIssue": "technical",
  "revisionLevelNeeded": "light",
  "suggestedChangedParts": ["statement", "template", "solution-outline", "prompt"],
  "referencesStatus": "present"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendação: minor_revision.

Principais pontos:
- A questão pertence ao eixo `codeQuality` e ao subtema `readability`: a tarefa avalia melhoria de nomes, redução de condicionais aninhadas, extração de auxiliares coesas e preservação de comportamento.
- A dificuldade está adequada para `intermediate`, pois exige refatoração pequena, mas com várias regras de negócio e cuidado com casos de borda.
- O formato geral da questão e do prompt segue os padrões reais de `questions/` e `prompts/`: frontmatter, `inputConfig.type: code`, templates por linguagem, rubrica com pesos somando 1.0, `solution-outline` e JSON esperado no prompt estão presentes.
- O principal problema recuperável é a inconsistência de contrato entre enunciado, templates, prompt e `solution-outline`: o código original usa campos abreviados (`t`, `p`, `ma`), o template Java usa `tier`, `purchases`, `monthsActive`, e o `solution-outline` assume os nomes completos. Isso pode levar estudantes em linguagens diferentes a resolverem tarefas ligeiramente diferentes.
- O prompt também pede penalização por abreviações como `t`, `p` e `ma`; isso é adequado para variáveis locais, mas ambíguo se esses nomes forem parte do contrato de entrada nos templates JavaScript/Python. Recomenda-se explicitar se a refatoração deve mapear os campos legados para nomes internos claros ou se o contrato de entrada será alterado para os nomes completos em todas as linguagens.
- A rubrica permanece focada em legibilidade e não transforma a questão em modularidade ampla, design/refactoring ou bug fix. O critério de extração de funções está proporcional e subordinado à legibilidade.
- O enunciado deixa claro que o comportamento deve ser preservado, incluindo regras de negócio e teto de desconto.
- O `solution-outline` é coerente com a rubrica, mas deve ser ajustado para refletir exatamente o mesmo contrato de dados escolhido para JavaScript, Python e Java.
- As referências são plausíveis, conservadoras e permanecem com `verificationStatus: suggested_not_verified`, sem tratá-las como verificadas.
<!-- /REVIEW:comments -->
