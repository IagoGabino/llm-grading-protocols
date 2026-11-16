---
id: advanced-integration-tests-repository
slug: advanced-integration-tests-repository
title: Testes — Testes de Integração com Repository Pattern
axis: tests
subtheme: unit_and_integration
difficulty: advanced
promptTemplate: advanced-integration-tests-repository
supportedLanguages: [javascript]
defaultLanguage: javascript
tags: [test_isolation, dependency_injection]
inputConfig:
  type: code
  language: javascript
rubric:
  version: v1
  criteria:
    - id: test_isolation
      name: Isolamento de testes
      weight: 0.30
      description: Implementa setup/teardown adequados, usa transações ou limpeza de banco, garante que testes não interferem entre si.
    - id: fixture_strategy
      name: Estratégia de fixtures
      weight: 0.25
      description: Cria fixtures reutilizáveis para dados de teste, usa factory pattern ou builders, mantém dados consistentes.
    - id: coverage_completeness
      name: Cobertura completa
      weight: 0.20
      description: Testa operações CRUD, transações, casos de erro (violação de constraint, deadlock), e edge cases (duplicação, not found).
    - id: assertions_depth
      name: Profundidade das asserções
      weight: 0.15
      description: Verifica não apenas retorno da função mas estado do banco após operação, timestamps, relações, índices.
    - id: test_organization
      name: Organização e clareza
      weight: 0.10
      description: Usa describe/beforeEach/afterEach apropriadamente, nomes descritivos, comentários quando necessário.
---

<!-- SECTION:statement -->
Você precisa escrever testes de integração para um repositório de pedidos que interage com banco de dados PostgreSQL. O repositório implementa operações CRUD e deve garantir integridade transacional.

**Repository a testar:**

```javascript
// order-repository.js
class OrderRepository {
  constructor(db) {
    this.db = db;
  }

  async create(orderData) {
    const client = await this.db.pool.connect();
    try {
      await client.query('BEGIN');

      const orderResult = await client.query(
        `INSERT INTO orders (customer_id, total, status, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [orderData.customerId, orderData.total, 'pending']
      );

      const order = orderResult.rows[0];

      for (const item of orderData.items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, price)
           VALUES ($1, $2, $3, $4)`,
          [order.id, item.productId, item.quantity, item.price]
        );
      }

      await client.query('COMMIT');
      return order;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(orderId) {
    const result = await this.db.pool.query(
      `SELECT o.*, 
              json_agg(json_build_object(
                'productId', oi.product_id,
                'quantity', oi.quantity,
                'price', oi.price
              )) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.id = $1
       GROUP BY o.id`,
      [orderId]
    );

    return result.rows[0] || null;
  }

  async updateStatus(orderId, newStatus) {
    const result = await this.db.pool.query(
      `UPDATE orders 
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [newStatus, orderId]
    );

    if (result.rows.length === 0) {
      throw new Error('Order not found');
    }

    return result.rows[0];
  }

  async delete(orderId) {
    const client = await this.db.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
      
      const result = await client.query(
        'DELETE FROM orders WHERE id = $1 RETURNING *',
        [orderId]
      );

      await client.query('COMMIT');
      return result.rows.length > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

**Schema do banco (simplificado):**

```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price DECIMAL(10,2) NOT NULL
);
```

**Tarefa:**

Escreva testes de integração que cubram:

1. **Criação de pedido com transação** - deve criar ordem + items atomicamente
2. **Rollback em caso de erro** - deve reverter tudo se um item falhar
3. **Busca por ID com join** - deve retornar ordem com items agregados
4. **Atualização de status** - deve atualizar e retornar erro se não existir
5. **Deleção com cascade** - deve remover ordem e items
6. **Isolamento entre testes** - testes não devem interferir entre si

**Requisitos técnicos:**
- Use banco PostgreSQL real (pode ser container Docker ou in-memory)
- Implemente setup/teardown para isolar testes
- Crie fixtures reutilizáveis para dados de teste
- Verifique estado do banco após operações

Na sua **linha de raciocínio**, explique:
- Como você garante isolamento entre testes
- Por que testes de integração são importantes aqui
- Estratégia de fixtures e dados de teste
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import pg from 'pg';
import { OrderRepository } from './order-repository.js';

const { Pool } = pg;

describe('OrderRepository Integration Tests', () => {
  let pool;
  let repository;

  beforeAll(async () => {
    // TODO: Configure database connection
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL
    });
    
    // TODO: Run migrations or setup schema
  });

  afterAll(async () => {
    // TODO: Close database connection
    await pool.end();
  });

  beforeEach(async () => {
    // TODO: Setup test data / start transaction / clean tables
    repository = new OrderRepository({ pool });
  });

  afterEach(async () => {
    // TODO: Cleanup test data / rollback transaction
  });

  // TODO: Implemente pelo menos 6 testes conforme enunciado
  
  it('deve criar pedido com items em transação', async () => {
    // TODO
  });

  it('deve fazer rollback se criação de item falhar', async () => {
    // TODO
  });

  // TODO: adicione mais testes
});
<!-- /SECTION:template:javascript -->

<!-- SECTION:solution-outline -->
**Solução esperada:**

```javascript
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import pg from 'pg';
import { OrderRepository } from './order-repository.js';

const { Pool } = pg;

// Fixtures reutilizáveis
const createOrderFixture = (overrides = {}) => ({
  customerId: 123,
  total: 100.00,
  items: [
    { productId: 1, quantity: 2, price: 30.00 },
    { productId: 2, quantity: 1, price: 40.00 }
  ],
  ...overrides
});

describe('OrderRepository Integration Tests', () => {
  let pool;
  let repository;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL || 'postgresql://localhost/test_db'
    });

    // Criar schema se necessário
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        price DECIMAL(10,2) NOT NULL
      )
    `);
  });

  afterAll(async () => {
    await pool.query('DROP TABLE IF EXISTS order_items CASCADE');
    await pool.query('DROP TABLE IF EXISTS orders CASCADE');
    await pool.end();
  });

  beforeEach(async () => {
    repository = new OrderRepository({ pool });
    // Limpar tabelas antes de cada teste
    await pool.query('TRUNCATE orders, order_items RESTART IDENTITY CASCADE');
  });

  it('deve criar pedido com items em transação', async () => {
    const orderData = createOrderFixture();

    const order = await repository.create(orderData);

    expect(order).toMatchObject({
      customer_id: 123,
      total: '100.00',
      status: 'pending'
    });
    expect(order.id).toBeDefined();
    expect(order.created_at).toBeDefined();

    // Verificar items no banco
    const itemsResult = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [order.id]
    );
    expect(itemsResult.rows).toHaveLength(2);
  });

  it('deve fazer rollback se criação de item falhar', async () => {
    const invalidOrderData = createOrderFixture({
      items: [
        { productId: 1, quantity: -1, price: 30.00 } // quantity negativa viola CHECK
      ]
    });

    await expect(repository.create(invalidOrderData)).rejects.toThrow();

    // Verificar que NADA foi inserido (rollback funcionou)
    const ordersResult = await pool.query('SELECT * FROM orders');
    expect(ordersResult.rows).toHaveLength(0);
  });

  it('deve buscar pedido com items agregados', async () => {
    const orderData = createOrderFixture();
    const created = await repository.create(orderData);

    const found = await repository.findById(created.id);

    expect(found).toMatchObject({
      id: created.id,
      customer_id: 123,
      status: 'pending'
    });
    expect(found.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: 1, quantity: 2 }),
        expect.objectContaining({ productId: 2, quantity: 1 })
      ])
    );
  });

  it('deve retornar null para ID inexistente', async () => {
    const result = await repository.findById(99999);
    expect(result).toBeNull();
  });

  it('deve atualizar status de pedido existente', async () => {
    const orderData = createOrderFixture();
    const created = await repository.create(orderData);

    const updated = await repository.updateStatus(created.id, 'completed');

    expect(updated.status).toBe('completed');
    expect(updated.updated_at).not.toEqual(created.updated_at);
  });

  it('deve lançar erro ao atualizar pedido inexistente', async () => {
    await expect(
      repository.updateStatus(99999, 'completed')
    ).rejects.toThrow('Order not found');
  });

  it('deve deletar pedido e items em cascata', async () => {
    const orderData = createOrderFixture();
    const created = await repository.create(orderData);

    const deleted = await repository.delete(created.id);

    expect(deleted).toBe(true);

    // Verificar que foi removido
    const found = await repository.findById(created.id);
    expect(found).toBeNull();

    // Verificar que items também foram removidos
    const itemsResult = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [created.id]
    );
    expect(itemsResult.rows).toHaveLength(0);
  });

  it('deve retornar false ao deletar pedido inexistente', async () => {
    const deleted = await repository.delete(99999);
    expect(deleted).toBe(false);
  });

  it('testes devem ser isolados (não interferir entre si)', async () => {
    // Criar pedido no teste anterior não deve afetar este teste
    const allOrders = await pool.query('SELECT * FROM orders');
    expect(allOrders.rows).toHaveLength(0); // Limpo por beforeEach
  });
});
```

**Pontos essenciais:**

1. **Isolamento:** `TRUNCATE` no `beforeEach` garante banco limpo para cada teste
2. **Fixtures:** função `createOrderFixture` permite customização e reutilização
3. **Verificação de estado:** testes consultam banco diretamente para verificar efeitos
4. **Cobertura de transações:** testa rollback em caso de erro
5. **Edge cases:** ID inexistente, constraint violations, cascade delete
6. **Setup/Teardown:** schema criado no `beforeAll`, dropado no `afterAll`

**Justificativa:**

- **Por que integração:** testa interação real com banco, incluindo transações SQL, constraints e índices que mocks não capturam
- **Isolamento:** `TRUNCATE` é mais rápido que `DELETE` e reinicia sequences
- **Fixtures:** factory pattern facilita criar dados variados mantendo consistência
- **Alternativas:** usar transações por teste (BEGIN no beforeEach, ROLLBACK no afterEach) é mais rápido mas pode mascarar bugs de commit

**Melhorias possíveis:**
- Container Docker para banco de teste (Testcontainers)
- Migrations via Prisma/Knex em vez de SQL inline
- Geração de dados com Faker.js para testes de carga
- Paralelização com pool de bancos isolados
<!-- /SECTION:solution-outline -->
