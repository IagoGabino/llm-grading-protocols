---
id: intermediate-orderstatus-tests
slug: intermediate-orderstatus-tests
title: Testes — Suíte para Validador de Transições de Status de Pedido
axis: tests
subtheme: coverage_and_quality
difficulty: intermediate
promptTemplate: intermediate-orderstatus-tests
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [edge_cases, coverage_gap]
inputConfig:
  type: code
  language: javascript
rubric:
  version: v1
  criteria:
    - id: coverage_essential
      name: Cobertura essencial
      weight: 0.40
      description: Cobre caminhos felizes, limite de 24h, estados terminais e idempotência.
    - id: test_quality
      name: Qualidade dos testes
      weight: 0.25
      description: Asserts claros, dados mínimos, controle de tempo via injeção de now, organização com describe/it.
    - id: strategy_justification
      name: Justificativa da estratégia
      weight: 0.25
      description: Explica classes de equivalência e valor de fronteira (24h), relacionando aos riscos principais.
    - id: maintainability
      name: Manutenibilidade
      weight: 0.10
      description: Helpers simples, nomes descritivos, independência entre testes.
---

<!-- SECTION:statement -->
Entregue **duas coisas**:

1. Uma **suíte de testes unitários (Jest, unittest ou JUnit)** para o módulo abaixo, **completando** o arquivo de teste fornecido.  
2. Uma **justificativa da estratégia de teste** (sua **linha de raciocínio**), explicando como os casos cobrem:
   - **Caminhos felizes** (transições válidas comuns),
   - **Um limite temporal** (regra de 24h),
   - **Estados terminais**,
   - **Idempotência** (mesmo estado).

Foque em cobrir bem **poucos cenários essenciais** (qualidade > quantidade).

Regras de negócio:

- Estados: `CREATED`, `PAID`, `SHIPPED`, `DELIVERED`, `CANCELLED`.
- Transições válidas:
  - `CREATED → PAID | CANCELLED`
  - `PAID → SHIPPED | CANCELLED` (**cancelar é permitido até 24h inclusive** após `paidAt`)
  - `SHIPPED → DELIVERED`
- `DELIVERED` e `CANCELLED` são **terminais**.
- **Idempotência**: transitar para o mesmo estado retorna `{ ok: true }`.
- Entradas inválidas retornam `{ ok: false, reason: 'entrada inválida' }`.

**Código a ser testado (JavaScript)**

```javascript
// src/OrderStatus.js
const STATES = {
  CREATED: 'CREATED',
  PAID: 'PAID',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
};

const TERMINAL = new Set([STATES.DELIVERED, STATES.CANCELLED]);

function hoursDiff(later, earlier) {
  return (later.getTime() - earlier.getTime()) / 36e5;
}

/**
 * @param {{ status: string, paidAt?: Date }} order
 * @param {string} targetState
 * @param {Date} [now]
 * @returns {{ ok: boolean, reason?: string }}
 */
function canTransition(order, targetState, now = new Date()) {
  if (!order || !order.status || !targetState) {
    return { ok: false, reason: 'entrada inválida' };
  }
  const current = order.status;

  if (current === targetState) return { ok: true };
  if (TERMINAL.has(current)) return { ok: false, reason: 'estado terminal' };

  const allowed = {
    [STATES.CREATED]: new Set([STATES.PAID, STATES.CANCELLED]),
    [STATES.PAID]: new Set([STATES.SHIPPED, STATES.CANCELLED]),
    [STATES.SHIPPED]: new Set([STATES.DELIVERED]),
  }[current] || new Set();

  if (!allowed.has(targetState)) return { ok: false, reason: 'transição inválida' };

  // Regra de tempo: PAID -> CANCELLED até 24h (inclusive)
  if (current === STATES.PAID && targetState === STATES.CANCELLED) {
    if (!(order.paidAt instanceof Date)) return { ok: false, reason: 'paidAt ausente/ inválido' };
    if (hoursDiff(now, order.paidAt) > 24) return { ok: false, reason: 'janela de cancelamento expirada' };
  }

  return { ok: true };
}

module.exports = { STATES, canTransition };
```

**Arquivo de teste (Jest)**

```javascript
// test/OrderStatus.test.js
const { STATES, canTransition } = require('../src/OrderStatus');

describe('OrderStatus.canTransition', () => {
  test('CREATED -> PAID (feliz)', () => {
    const order = { status: STATES.CREATED };
    expect(canTransition(order, STATES.PAID)).toEqual({ ok: true });
  });

  // Complete a suíte a partir daqui
});
```

**Sua tarefa:**
- Completar a suíte cobrindo **poucos, porém essenciais** casos.
- Na **linha de raciocínio**, justificar **a estratégia**: por que esses casos são suficientes para dar confiança (caminhos felizes, limite de 24h, terminais e idempotência).

<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// test/OrderStatus.test.js
import { STATES, canTransition } from "../src/OrderStatus"

describe("OrderStatus.canTransition", () => {
  it("CREATED -> PAID (feliz)", () => {
    const order = { status: STATES.CREATED }
    expect(canTransition(order, STATES.PAID)).toEqual({ ok: true })
  })

  // TODO: adicione os demais cenários essenciais descritos no enunciado.
})
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# test_order_status.py
import unittest

# from order_status import STATES, can_transition


class OrderStatusTest(unittest.TestCase):
    def test_created_para_paid(self):
        order = {"status": "CREATED"}
        self.assertEqual(can_transition(order, "PAID"), {"ok": True})

    # TODO: adicione os demais cenários essenciais descritos no enunciado.


if __name__ == "__main__":
    unittest.main()
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// OrderStatusTest.java
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

public class OrderStatusTest {
    @Test
    void createdParaPaidFeliz() {
        Order order = new Order("CREATED");
        assertThat(OrderStatus.canTransition(order, "PAID")).isEqualTo(new TransitionResult(true, null));
    }

    // TODO: adicione os demais cenários essenciais descritos no enunciado.
}

record TransitionResult(boolean ok, String reason) {}

record Order(String status) {}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Categorias mínimas de casos**

- **Felizes**
  - `CREATED → PAID`
  - `PAID → SHIPPED`
  - `SHIPPED → DELIVERED`
- **Limite temporal (24h)**
  - `PAID → CANCELLED` com `paidAt` **exatamente 24h** atrás → **permite**
  - `PAID → CANCELLED` com `paidAt` **25h** atrás → **nega**
- **Terminal**
  - De `DELIVERED` para qualquer outro → **nega** (razão: `estado terminal`)
- **Idempotência**
  - `PAID → PAID` → **permite**

**Argumentos para a justificativa**
- **Classes de equivalência**: transições **permitidas** vs **proibidas**; estados **terminais** vs **não‑terminais**.
- **Valor de fronteira**: **24h** testado nos dois lados (igual e maior) garante que a comparação `> 24` está correta.
- **Determinismo**: uso de `now` fixo e `paidAt = now - (horas * 60 * 60 * 1000)` evita flakiness.
- **Confiança com poucos testes**: cada caso cobre uma regra central; evita redundância sem perder sinal.
<!-- /SECTION:solution-outline -->
