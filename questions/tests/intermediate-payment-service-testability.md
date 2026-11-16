---
id: intermediate-payment-service-testability
slug: intermediate-payment-service-testability
title: Testes — Testabilidade de Serviço de Pagamento com Dependências Externas
axis: tests
subtheme: testability
difficulty: intermediate
promptTemplate: intermediate-payment-service-testability
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [mocking, dependency_injection, test_isolation, stub, side_effects]
inputConfig:
  type: code
  language: javascript
rubric:
  version: v1
  criteria:
    - id: dependency_isolation
      name: Isolamento de dependências externas
      weight: 0.35
      description: Usa mocks/stubs para substituir gateway de pagamento e repositório, garantindo que testes não façam chamadas reais a serviços externos.
    - id: behavior_coverage
      name: Cobertura de comportamentos relevantes
      weight: 0.30
      description: Testa caminho feliz (pagamento aprovado), falha no gateway (recusado), falha técnica (exceção), e atualização correta de status no repositório.
    - id: assertion_precision
      name: Precisão das asserções
      weight: 0.20
      description: Verifica não só o retorno da função, mas também o que foi chamado (gateway e repositório) com os argumentos corretos, e o que NÃO deve ser chamado em caso de erro.
    - id: test_structure
      name: Estrutura e clareza dos testes
      weight: 0.15
      description: Usa setup/teardown adequados (beforeEach para reset dos mocks), nomeia testes de forma descritiva, organiza com describe/it ou equivalente.
---

<!-- SECTION:statement -->
Um serviço de pagamento (`PaymentService`) processa cobranças chamando um gateway externo e persiste o resultado no banco de dados. O código funciona em produção, mas é difícil de testar porque as dependências externas são instanciadas internamente — qualquer teste executa chamadas reais ao gateway e ao banco.

**Código atual (com problema de testabilidade):**

```javascript
// payment-service.js
const { StripeGateway } = require('./stripe-gateway');
const { OrderRepository } = require('./order-repository');

class PaymentService {
  constructor() {
    // Dependências instanciadas internamente — impossível substituir em testes
    this.gateway = new StripeGateway(process.env.STRIPE_SECRET_KEY);
    this.orderRepo = new OrderRepository(process.env.DATABASE_URL);
  }

  async processPayment(orderId, amount, cardToken) {
    // 1. Tenta cobrar no gateway externo
    const charge = await this.gateway.charge({
      amount,
      currency: 'BRL',
      source: cardToken,
    });

    if (charge.status === 'succeeded') {
      // 2. Atualiza status do pedido no banco
      await this.orderRepo.updateStatus(orderId, 'paid', charge.id);
      return { success: true, chargeId: charge.id };
    } else {
      // 3. Registra recusa
      await this.orderRepo.updateStatus(orderId, 'payment_failed', null);
      return { success: false, reason: charge.declineReason };
    }
  }
}

module.exports = { PaymentService };
```

**Contratos das dependências externas:**

```javascript
// gateway.charge(payload) retorna:
// { status: 'succeeded', id: 'ch_xyz' }   — pagamento aprovado
// { status: 'declined', declineReason: 'insufficient_funds' } — recusado
// Pode lançar Error('Gateway timeout') — falha técnica

// orderRepo.updateStatus(orderId, status, chargeId) retorna: void
```

**Tarefa:**

Refatore o `PaymentService` para torná-lo testável por injeção de dependências e escreva uma suíte de testes unitários cobrindo:

1. **Caminho feliz:** gateway aprova → repositório recebe `'paid'` e o `chargeId` → retorna `{ success: true, chargeId }`.
2. **Pagamento recusado:** gateway retorna `declined` → repositório recebe `'payment_failed'` e `null` → retorna `{ success: false, reason }`.
3. **Falha técnica no gateway:** gateway lança exceção → repositório **não é chamado** → erro é propagado.

Na sua **linha de raciocínio**, explique:
- Por que o código original dificulta testes e como a refatoração resolve isso.
- Por que é importante verificar o que o repositório *não* é chamado no caso de erro.
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// payment-service.js
// TODO: refatore o construtor para receber dependências por injeção
export class PaymentService {
  constructor(/* TODO: receba gateway e orderRepo como parâmetros */) {
    // TODO
  }

  async processPayment(orderId, amount, cardToken) {
    // TODO: implemente mantendo a lógica original
  }
}

// payment-service.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentService } from './payment-service.js';

describe('PaymentService.processPayment', () => {
  let gateway;
  let orderRepo;
  let service;

  beforeEach(() => {
    // TODO: crie mocks para gateway e orderRepo, instancie PaymentService com eles
  });

  it('aprova pagamento e atualiza pedido como paid', async () => {
    // TODO
  });

  it('registra recusa quando gateway declina', async () => {
    // TODO
  });

  it('não chama repositório quando gateway lança exceção', async () => {
    // TODO
  });
});
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# payment_service.py
# TODO: refatore __init__ para receber dependências por injeção
class PaymentService:
    def __init__(self):  # TODO: adicione parâmetros gateway e order_repo
        pass  # TODO

    async def process_payment(self, order_id: str, amount: int, card_token: str) -> dict:
        # TODO: implemente mantendo a lógica original
        pass

# test_payment_service.py
import pytest
from unittest.mock import AsyncMock, MagicMock

# from payment_service import PaymentService


class TestPaymentService:
    def setup_method(self):
        # TODO: crie mocks para gateway e order_repo, instancie PaymentService com eles
        pass

    @pytest.mark.asyncio
    async def test_aprova_pagamento_e_atualiza_status(self):
        # TODO
        pass

    @pytest.mark.asyncio
    async def test_registra_recusa_quando_gateway_declina(self):
        # TODO
        pass

    @pytest.mark.asyncio
    async def test_nao_chama_repositorio_quando_gateway_falha(self):
        # TODO
        pass
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// PaymentService.java
// TODO: refatore o construtor para receber dependências por injeção
public class PaymentService {
    // TODO: declare campos para gateway e orderRepo

    public PaymentService() {
        // TODO: receba dependências por parâmetro
    }

    public PaymentResult processPayment(String orderId, int amount, String cardToken)
            throws Exception {
        // TODO: implemente mantendo a lógica original
        return null;
    }

    public record PaymentResult(boolean success, String chargeId, String reason) {}
}

// PaymentServiceTest.java
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class PaymentServiceTest {
    private PaymentGateway gateway;
    private OrderRepository orderRepo;
    private PaymentService service;

    @BeforeEach
    void setUp() {
        // TODO: crie mocks com Mockito, instancie PaymentService com eles
    }

    @Test
    void aprovaPagamentoEAtualizaPedidoComoPaid() throws Exception {
        // TODO
    }

    @Test
    void registraRecusaQuandoGatewayDeclina() throws Exception {
        // TODO
    }

    @Test
    void naoAtualizaRepositorioQuandoGatewayLancaExcecao() {
        // TODO
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Por que o código original é difícil de testar:**
- `this.gateway` e `this.orderRepo` são criados dentro do construtor: não há como substituí-los por versões falsas sem alterar o código ou usar técnicas invasivas (monkey-patching).
- Qualquer teste instanciando `PaymentService` da forma original faria chamadas reais ao Stripe e ao banco.

**Refatoração: injeção de dependências via construtor**

```javascript
class PaymentService {
  constructor(gateway, orderRepo) {
    this.gateway = gateway;
    this.orderRepo = orderRepo;
  }

  async processPayment(orderId, amount, cardToken) {
    const charge = await this.gateway.charge({ amount, currency: 'BRL', source: cardToken });

    if (charge.status === 'succeeded') {
      await this.orderRepo.updateStatus(orderId, 'paid', charge.id);
      return { success: true, chargeId: charge.id };
    } else {
      await this.orderRepo.updateStatus(orderId, 'payment_failed', null);
      return { success: false, reason: charge.declineReason };
    }
  }
}
```

**Testes essenciais (Vitest/Jest):**

```javascript
describe('PaymentService.processPayment', () => {
  let gateway;
  let orderRepo;
  let service;

  beforeEach(() => {
    gateway = { charge: vi.fn() };
    orderRepo = { updateStatus: vi.fn().mockResolvedValue(undefined) };
    service = new PaymentService(gateway, orderRepo);
  });

  it('aprova pagamento e atualiza pedido como paid', async () => {
    gateway.charge.mockResolvedValue({ status: 'succeeded', id: 'ch_abc' });

    const result = await service.processPayment('order-1', 5000, 'tok_visa');

    expect(result).toEqual({ success: true, chargeId: 'ch_abc' });
    expect(orderRepo.updateStatus).toHaveBeenCalledWith('order-1', 'paid', 'ch_abc');
  });

  it('registra recusa quando gateway declina', async () => {
    gateway.charge.mockResolvedValue({ status: 'declined', declineReason: 'insufficient_funds' });

    const result = await service.processPayment('order-2', 3000, 'tok_decline');

    expect(result).toEqual({ success: false, reason: 'insufficient_funds' });
    expect(orderRepo.updateStatus).toHaveBeenCalledWith('order-2', 'payment_failed', null);
  });

  it('não chama repositório quando gateway lança exceção', async () => {
    gateway.charge.mockRejectedValue(new Error('Gateway timeout'));

    await expect(service.processPayment('order-3', 1000, 'tok_err')).rejects.toThrow('Gateway timeout');
    expect(orderRepo.updateStatus).not.toHaveBeenCalled();
  });
});
```

**Por que verificar `not.toHaveBeenCalled` no caso de erro:**
- Garante que o serviço não persiste um estado inválido quando a operação falha na etapa de I/O.
- Sem essa asserção, um bug que chame `updateStatus` com dados incoerentes após exceção passaria despercebido.

**Pontos essenciais para avaliação:**
1. Construtor refatorado para receber `gateway` e `orderRepo` como parâmetros.
2. Mocks criados no `beforeEach` (ou `setUp`) e resetados entre testes.
3. Asserção sobre o retorno da função **e** sobre os argumentos passados ao repositório.
4. Asserção negativa (`not.toHaveBeenCalled`) no teste de falha técnica.
5. Justificativa que conecta injeção de dependência → substituição por mock → isolamento de efeitos externos.
<!-- /SECTION:solution-outline -->
