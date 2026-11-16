---
id: intermediate-order-api-tests
slug: intermediate-order-api-tests
title: Testes — API REST de Criação de Pedidos
axis: tests
subtheme: unit_and_integration
difficulty: intermediate
promptTemplate: intermediate-order-api-tests
supportedLanguages: [javascript]
defaultLanguage: javascript
tags: [mocking, test_isolation]
inputConfig:
  type: code
  language: javascript
rubric:
  version: v1
  criteria:
    - id: coverage_scenarios
      name: Cobertura de cenários
      weight: 0.35
      description: Testa casos de sucesso, validação de campos obrigatórios, validação de tipos, limites de valores e comportamento com dependências.
    - id: mocking_strategy
      name: Estratégia de mocks
      weight: 0.25
      description: Isola unidade sob teste mockando dependências externas (repositório, serviço de pagamento) adequadamente.
    - id: assertions_quality
      name: Qualidade das asserções
      weight: 0.20
      description: Asserções específicas e completas (verifica status code, estrutura de resposta, mensagens de erro, chamadas a mocks).
    - id: test_organization
      name: Organização e nomenclatura
      weight: 0.10
      description: Usa describe/it com nomes descritivos, agrupa testes relacionados, setup/teardown quando necessário.
    - id: edge_cases
      name: Casos de borda
      weight: 0.10
      description: Testa valores limites (quantidade zero/negativa, preço zero), campos opcionais, arrays vazios.
---

<!-- SECTION:statement -->
Você precisa escrever testes para uma API REST de criação de pedidos. A API valida dados, calcula total, verifica estoque e registra o pedido no banco.

**Endpoint a testar:**
```
POST /api/orders
Body: {
  "customerId": string (obrigatório),
  "items": [
    { "productId": string, "quantity": number, "price": number }
  ] (obrigatório, min 1 item),
  "shippingAddress": string (obrigatório)
}

Response 201:
{
  "orderId": string,
  "total": number,
  "status": "pending"
}

Response 400: { "error": string }
Response 409: { "error": "Produto X fora de estoque" }
```

**Regras de negócio:**
1. `customerId` deve ser string não vazia
2. `items` deve ter pelo menos 1 item
3. Cada item deve ter `productId` (string), `quantity` (número > 0) e `price` (número >= 0)
4. `shippingAddress` deve ser string não vazia
5. Sistema verifica estoque via `inventoryService.checkStock(productId, quantity)`
6. Pedido é salvo via `orderRepository.create(order)`
7. Total é calculado somando `quantity * price` de cada item

**Código da API (simplificado):**
```javascript
class OrderAPI {
  constructor(orderRepository, inventoryService) {
    this.orderRepository = orderRepository;
    this.inventoryService = inventoryService;
  }

  async createOrder(req, res) {
    const { customerId, items, shippingAddress } = req.body;

    // Validações
    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({ error: 'customerId é obrigatório' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items deve ter pelo menos 1 item' });
    }

    for (const item of items) {
      if (!item.productId || typeof item.quantity !== 'number' || item.quantity <= 0) {
        return res.status(400).json({ error: 'Item inválido' });
      }
      if (typeof item.price !== 'number' || item.price < 0) {
        return res.status(400).json({ error: 'Preço inválido' });
      }
    }

    if (!shippingAddress || typeof shippingAddress !== 'string') {
      return res.status(400).json({ error: 'shippingAddress é obrigatório' });
    }

    // Verificar estoque
    for (const item of items) {
      const available = await this.inventoryService.checkStock(item.productId, item.quantity);
      if (!available) {
        return res.status(409).json({ error: `Produto ${item.productId} fora de estoque` });
      }
    }

    // Calcular total
    const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    // Criar pedido
    const order = await this.orderRepository.create({
      customerId,
      items,
      shippingAddress,
      total,
      status: 'pending'
    });

    return res.status(201).json({
      orderId: order.id,
      total: order.total,
      status: order.status
    });
  }
}
```

**Tarefa:**
Escreva **pelo menos 6 testes** cobrindo:
1. Caso de sucesso (pedido válido criado)
2. Validação de `customerId` ausente
3. Validação de `items` vazio
4. Validação de `quantity` inválida (zero ou negativa)
5. Produto fora de estoque
6. Cálculo correto do total

**Use mocks** para `orderRepository` e `inventoryService`.

Na sua **linha de raciocínio**, explique:
- Por que você escolheu esses cenários
- Como os mocks isolam a unidade sob teste
- Quais outros cenários seriam importantes em produção

<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
import { jest } from '@jest/globals';

describe('OrderAPI.createOrder', () => {
  let orderAPI;
  let mockRepository;
  let mockInventoryService;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // TODO: configure os mocks e a instância do OrderAPI
    mockRepository = {
      create: jest.fn()
    };
    mockInventoryService = {
      checkStock: jest.fn()
    };
    
    mockReq = { body: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  it('deve criar pedido válido com sucesso', async () => {
    // TODO: implemente o teste
  });

  it('deve retornar 400 quando customerId estiver ausente', async () => {
    // TODO: implemente o teste
  });

  // TODO: adicione pelo menos mais 4 testes conforme o enunciado
});
<!-- /SECTION:template:javascript -->

<!-- SECTION:solution-outline -->
**Solução esperada:**

```javascript
import { jest } from '@jest/globals';
import { OrderAPI } from './order-api.js';

describe('OrderAPI.createOrder', () => {
  let orderAPI;
  let mockRepository;
  let mockInventoryService;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn()
    };
    mockInventoryService = {
      checkStock: jest.fn()
    };
    orderAPI = new OrderAPI(mockRepository, mockInventoryService);
    
    mockReq = { body: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  it('deve criar pedido válido com sucesso', async () => {
    mockReq.body = {
      customerId: 'customer-123',
      items: [
        { productId: 'prod-1', quantity: 2, price: 50 },
        { productId: 'prod-2', quantity: 1, price: 100 }
      ],
      shippingAddress: 'Rua A, 123'
    };

    mockInventoryService.checkStock.mockResolvedValue(true);
    mockRepository.create.mockResolvedValue({
      id: 'order-456',
      total: 200,
      status: 'pending'
    });

    await orderAPI.createOrder(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({
      orderId: 'order-456',
      total: 200,
      status: 'pending'
    });
    expect(mockInventoryService.checkStock).toHaveBeenCalledTimes(2);
    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ total: 200 })
    );
  });

  it('deve retornar 400 quando customerId estiver ausente', async () => {
    mockReq.body = {
      items: [{ productId: 'prod-1', quantity: 1, price: 50 }],
      shippingAddress: 'Rua A, 123'
    };

    await orderAPI.createOrder(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'customerId é obrigatório'
    });
  });

  it('deve retornar 400 quando items estiver vazio', async () => {
    mockReq.body = {
      customerId: 'customer-123',
      items: [],
      shippingAddress: 'Rua A, 123'
    };

    await orderAPI.createOrder(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'items deve ter pelo menos 1 item'
    });
  });

  it('deve retornar 400 quando quantity for zero', async () => {
    mockReq.body = {
      customerId: 'customer-123',
      items: [{ productId: 'prod-1', quantity: 0, price: 50 }],
      shippingAddress: 'Rua A, 123'
    };

    await orderAPI.createOrder(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Item inválido' });
  });

  it('deve retornar 409 quando produto estiver fora de estoque', async () => {
    mockReq.body = {
      customerId: 'customer-123',
      items: [{ productId: 'prod-1', quantity: 5, price: 50 }],
      shippingAddress: 'Rua A, 123'
    };

    mockInventoryService.checkStock.mockResolvedValue(false);

    await orderAPI.createOrder(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(409);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Produto prod-1 fora de estoque'
    });
  });

  it('deve calcular total corretamente', async () => {
    mockReq.body = {
      customerId: 'customer-123',
      items: [
        { productId: 'prod-1', quantity: 3, price: 25 },
        { productId: 'prod-2', quantity: 2, price: 40 }
      ],
      shippingAddress: 'Rua A, 123'
    };

    mockInventoryService.checkStock.mockResolvedValue(true);
    mockRepository.create.mockResolvedValue({
      id: 'order-789',
      total: 155, // 3*25 + 2*40 = 75 + 80 = 155
      status: 'pending'
    });

    await orderAPI.createOrder(mockReq, mockRes);

    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ total: 155 })
    );
  });
});
```

**Justificativa:**
- **Cenários escolhidos:** cobrem caminho feliz, validações de campos obrigatórios, validação de tipos/limites, verificação de dependência externa (estoque) e cálculo de lógica de negócio (total).
- **Mocks:** isolam a API das dependências reais (banco e serviço de inventário), permitindo testar apenas a lógica da API sem efeitos colaterais.
- **Outros cenários importantes:** validação de `price` negativo, `shippingAddress` vazia, múltiplos produtos com um fora de estoque, timeout em chamadas externas, validação de tipos (items não é array).

**Estratégia de testes:**
- **Unit tests:** validações e lógica interna
- **Integration tests (futuro):** testar com banco real em ambiente de teste
- **Boundary values:** zero, negativo, string vazia
- **Equivalence classes:** item válido vs. inválido, estoque disponível vs. indisponível
<!-- /SECTION:solution-outline -->
