---
id: easy-refactor-shipping
slug: easy-refactor-shipping
title: Qualidade de Código — Cálculo de Frete Internacional
axis: codeQuality
subtheme: duplication_and_reuse
difficulty: easy
promptTemplate: easy-refactor-shipping
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [duplicated_code, code_smell]
inputConfig:
  type: code
  language: javascript
rubric:
  version: v1
  criteria:
    - id: problems
      name: Identificação dos problemas
      weight: 0.30
      description: Reconhece condicionais encadeadas, duplicação de lógica e números mágicos.
    - id: refactor_quality
      name: Qualidade da refatoração proposta
      weight: 0.30
      description: Reduz duplicação, facilita inclusão de novos países e torna regras explícitas.
    - id: behavior_preservation
      name: Preservação de comportamento
      weight: 0.15
      description: Mantém resultados iguais para os mesmos inputs, incluindo express.
    - id: code_clarity
      name: Clareza do código resultante
      weight: 0.10
      description: Nomes significativos, constantes explícitas, fluxo simples.
    - id: reasoning
      name: Justificativa / linha de raciocínio
      weight: 0.15
      description: Explica escolhas, trade offs e como a solução melhora manutenção.
---

<!-- SECTION:statement -->

Uma loja calcula o frete de pedidos internacionais conforme o país e o peso (kg), com opção de entrega expressa. O código funciona, mas ficou difícil de manter à medida que novos países foram entrando.

**Regras de negócio (para preservação de comportamento):**
- EUA (**US**): tarifa por kg = **5**, taxa base = **10**
- Brasil (**BR**): tarifa por kg = **8**, taxa base = **20**
- Alemanha (**DE**): tarifa por kg = **6**, taxa base = **12**
- Outros países: tarifa por kg = **10**, taxa base = **25**
- Se **express** estiver ativo, somar **30** ao valor calculado.

**Tarefa:** identifique problemas no código e aplique técnicas conhecidas de refatoração para melhorar a legibilidade e facilidade de evolução, **sem alterar o comportamento**. Apresente suas decisões e justificativas numa **linha de raciocínio separada**.

```javascript
function calculateShipping(order) {
  const country = order.address.country;
  const weight = order.weight; // kg

  if (country === "US") {
    let base = weight * 5 + 10;
    if (order.express) base += 30;
    return base;
  } else if (country === "BR") {
    let base = weight * 8 + 20;
    if (order.express) base += 30;
    return base;
  } else if (country === "DE") {
    let base = weight * 6 + 12;
    if (order.express) base += 30;
    return base;
  } else {
    let base = weight * 10 + 25;
    if (order.express) base += 30;
    return base;
  }
}

module.exports = { calculateShipping };
```

<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// shipping.js
export function calculateShipping(order) {
  if (!order) {
    throw new Error("order é obrigatório");
  }

  // TODO: refatore mantendo as regras descritas no enunciado.
  return 0;
}
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# shipping.py
from typing import Any, Dict


def calculate_shipping(order: Dict[str, Any]) -> float:
    if not order:
        raise ValueError("order é obrigatório")

    # TODO: refatore mantendo as regras descritas no enunciado.
    return 0.0
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// ShippingCalculator.java
public class ShippingCalculator {
    public double calculateShipping(Order order) {
        if (order == null) {
            throw new IllegalArgumentException("order é obrigatório");
        }

        // TODO: refatore mantendo as regras descritas no enunciado.
        return 0.0;
    }

    public static class Order {
        public Address address;
        public double weight;
        public boolean express;
    }

    public static class Address {
        public String country;
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->

Smells identificados: **condicionais encadeadas**, **duplicação de código**, **números mágicos**.

Técnicas sugeridas: **substituir condicional por tabela de consulta**, **introduzir constantes simbólicas**, **remover duplicação** (aplicar sobretaxa _express_ em um único ponto).

Pontos essenciais da solução:

- Tabela `{ US: {rate: 5, base: 10}, BR: {rate: 8, base: 20}, DE: {rate: 6, base: 12}, DEFAULT: {rate: 10, base: 25} }`.
- Cálculo comum: `valor = peso * rate + base`; se `express`, soma 30.
- Caminho padrão para países não mapeados.
- Argumentar ganhos: legibilidade, menor risco de divergência entre ramos, facilidade de extensão.
<!-- /SECTION:solution-outline -->
