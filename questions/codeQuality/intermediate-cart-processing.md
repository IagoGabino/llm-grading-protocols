---
id: intermediate-cart-processing
slug: intermediate-cart-processing
title: Qualidade de Código — Processamento de Carrinho
axis: codeQuality
subtheme: design_and_refactoring
difficulty: intermediate
promptTemplate: intermediate-cart-processing
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [duplicated_code, long_function, code_smell]
inputConfig:
  type: code
  language: javascript
rubric:
  version: v1
  criteria:
    - id: problems
      name: Identificação dos problemas
      weight: 0.25
      description: Reconhece função longa, responsabilidades misturadas, números mágicos e repetições desnecessárias.
    - id: decomposition
      name: Qualidade da decomposição
      weight: 0.30
      description: Separa claramente descontos, impostos e frete; normaliza dados (cupom/categoria) para evitar ramificações repetidas.
    - id: extensibility
      name: Extensibilidade
      weight: 0.15
      description: Organiza regras em estruturas simples (como tabela de descontos por categoria) sem acoplamento excessivo.
    - id: behavior_preservation
      name: Preservação de comportamento
      weight: 0.15
      description: Mantém os mesmos resultados (inclui ambas as grafias de 'eletrônicos').
    - id: clarity
      name: Clareza do código resultante
      weight: 0.10
      description: Nomes, concisão de funções, eliminação de repetição.
    - id: reasoning
      name: Justificativa / linha de raciocínio
      weight: 0.05
      description: Explica escolhas e benefícios para testes.
---

<!-- SECTION:statement -->
O módulo abaixo calcula o valor total de um carrinho aplicando descontos por categoria e cupom, calcula impostos e define frete. O código é funcional, mas concentra muitas responsabilidades, o que dificulta testes e evolução de regras.

**Regras de negócio (para preservação de comportamento):**
- **Descontos por categoria:**
  - LIVROS: **5%**
  - ELETRÔNICOS (aceitar `'ELETRONICS'` e `'ELECTRONICS'`): **2%**
- **Cupom:**
  - `'BLACKFRIDAY'`: **10%** sobre o subtotal do item
- **Impostos:** **12%** sobre o total após descontos; se estado = `'MG'`, somar **5** fixos.
- **Frete:** `express ? 30 : 15`.

**Tarefa:** identifique problemas e aplique refatoração para separar responsabilidades (cálculo de descontos, impostos e frete; normalização de entrada), reduzindo complexidade **sem alterar o comportamento**. Justifique decisões numa **linha de raciocínio separada**.

```javascript
// cart.js
function processCart(cart) {
  if (!cart || !cart.items || cart.items.length === 0) {
    throw new Error('Carrinho inválido');
  }

  let total = 0;

  for (let i = 0; i < cart.items.length; i++) {
    const item = cart.items[i];
    const subtotal = item.price * item.qty;
    total += subtotal;

    // descontos por categoria
    if (item.category === 'LIVROS') {
      total -= subtotal * 0.05;
    } else if (item.category === 'ELETRONICS' || item.category === 'ELECTRONICS') {
      total -= subtotal * 0.02;
    }

    // cupom (uppercase repetido em vários lugares possíveis)
    if (cart.coupon && cart.coupon.toUpperCase() === 'BLACKFRIDAY') {
      total -= subtotal * 0.10;
    }
  }

  // impostos
  let taxes = total * 0.12;
  if (cart.address && cart.address.state === 'MG') {
    taxes += 5;
  }

  // frete
  const shipping = cart.express ? 30 : 15;

  return { total, taxes, shipping, grandTotal: total + taxes + shipping };
}

module.exports = { processCart };
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// cart.js
export function processCart(cart) {
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    throw new Error("Carrinho inválido");
  }

  // TODO: separe responsabilidades preservando o comportamento descrito no enunciado.
  return { total: 0, taxes: 0, shipping: 0, grandTotal: 0 };
}
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# cart.py
from typing import Any, Dict, List


def process_cart(cart: Dict[str, Any]) -> Dict[str, float]:
    items: List[Dict[str, Any]] = cart.get("items", []) if cart else []
    if not items:
        raise ValueError("Carrinho inválido")

    # TODO: separe responsabilidades preservando o comportamento descrito no enunciado.
    return {"total": 0.0, "taxes": 0.0, "shipping": 0.0, "grand_total": 0.0}
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// CartProcessor.java
import java.util.List;
import java.util.Map;

public class CartProcessor {
    public CartTotals processCart(Map<String, Object> cart) {
        if (cart == null || !(cart.get("items") instanceof List) || ((List<?>) cart.get("items")).isEmpty()) {
            throw new IllegalArgumentException("Carrinho inválido");
        }

        // TODO: separe responsabilidades preservando o comportamento descrito no enunciado.
        return new CartTotals(0.0, 0.0, 0.0);
    }

    public record CartTotals(double total, double taxes, double shipping) {
        public double grandTotal() {
            return total + taxes + shipping;
        }
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
Smells identificados: **função longa**, **responsabilidades misturadas**, **números mágicos**, **repetição desnecessária**.

Técnicas sugeridas: **extrair funções** (descontos, impostos, frete), **introduzir constantes simbólicas** (alíquotas, fretes, percentuais), **normalizar entrada** (cupom e categoria em um único ponto), **substituir condicionais por tabela de consulta** (descontos por categoria).

Pontos essenciais da solução:
- `calcularDescontos(items, cupomNormalizado, tabelaDescontos)`.
- `calcularImpostos(total, estado)` (12% + adicional fixo se MG).
- `calcularFrete(express)` com constantes `FRETE_EXPRESS = 30`, `FRETE_PADRAO = 15`.
- **Preservar comportamento**: aceitar `'ELETRONICS'` e `'ELECTRONICS'`; aplicar cupom por item conforme o código atual; ordem das operações igual (descontos → impostos → frete).
- Ganhos: testabilidade por unidade, redução de erros por repetição, clareza.
- Discussão: manter cupom por item para preservar comportamento, mas mencionar trade-off de negócio.
<!-- /SECTION:solution-outline -->
