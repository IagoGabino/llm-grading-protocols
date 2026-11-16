---
id: intermediate-distributed-cache-strategy
slug: intermediate-distributed-cache-strategy
title: Design e Arquitetura — Estratégia de Cache Distribuído
axis: architecture
subtheme: scalability_and_performance
difficulty: intermediate
promptTemplate: intermediate-distributed-cache-strategy
supportedLanguages: [none]
tags: [caching, trade_off, eventual_consistency]
inputConfig:
  type: multi-section
  sections:
    - id: arquitetura
      label: "Arquitetura da solução"
      placeholder: "Descreva tecnologias (Redis, Memcached, etc.), topologia (single instance, cluster, sharding) e comunicação entre serviços e cache."
    - id: invalidacao
      label: "Estratégia de invalidação"
      placeholder: "Como garantir que dados no cache estejam sincronizados com a fonte de verdade (banco de dados)? TTL, cache-aside, write-through, etc."
    - id: consistencia
      label: "Garantias de consistência"
      placeholder: "Como lidar com atualizações concorrentes, race conditions e eventual consistency? Considere padrões como cache stampede prevention."
    - id: tradeoffs
      label: "Análise de trade-offs"
      placeholder: "Discuta memória vs latência, custo vs benefício, complexidade operacional, single point of failure e possíveis limitações da solução."
rubric:
  version: v1
  criteria:
    - id: architecture_design
      name: Design da arquitetura
      weight: 0.30
      description: Escolhe tecnologia apropriada (Redis/Memcached), justifica topologia (cluster vs single), define comunicação entre aplicação e cache.
    - id: invalidation_strategy
      name: Estratégia de invalidação
      weight: 0.30
      description: Propõe padrão claro (cache-aside, write-through, write-behind), define TTL adequado, considera invalidação ativa vs passiva.
    - id: consistency_handling
      name: Tratamento de consistência
      weight: 0.25
      description: Aborda race conditions, cache stampede, considera eventual consistency, propõe locks ou strategies de mitigação.
    - id: trade_offs
      name: Análise de trade-offs
      weight: 0.15
      description: Discute memória vs latência, complexidade vs benefício, single point of failure, custo operacional.
---

<!-- SECTION:statement -->
Uma plataforma de e-commerce com alto tráfego (100k requisições/min) sofre com lentidão na listagem de produtos e categorias. O banco de dados relacional está sobrecarregado com queries repetitivas que retornam dados que mudam raramente (catálogo de produtos, estoque agregado por região).

**Cenário atual:**

- **Backend:** 10 instâncias de API (Node.js/Java/Python)
- **Banco de dados:** PostgreSQL (leitura/escrita)
- **Problema:** 80% das queries são repetidas (ex: "listar produtos da categoria X"), latência média de 200ms por query
- **SLA desejado:** latência < 50ms para queries de leitura

**Requisitos da solução de cache:**

1. **Performance:** reduzir latência de leitura para < 50ms
2. **Escalabilidade:** suportar crescimento de tráfego sem degradação
3. **Consistência:** dados no cache devem refletir mudanças no banco em até 5 minutos
4. **Disponibilidade:** cache deve ter alta disponibilidade (99.9%)

**Desafios técnicos:**

- Produtos são atualizados (preço, estoque) por sistemas assíncronos (webhooks de ERP)
- Múltiplas instâncias da API podem escrever no banco simultaneamente
- Dados de estoque mudam frequentemente, mas catálogo (nome, descrição) raramente muda

**Tarefa:**

Projete uma **estratégia de cache distribuído** especificando:

1. **Arquitetura:** tecnologia (Redis, Memcached, etc.), topologia (cluster, sharding), como as instâncias da API se comunicam com o cache
2. **Invalidação:** como garantir que dados no cache sejam atualizados quando o banco muda (TTL, eventos, patterns como cache-aside/write-through)
3. **Consistência:** como lidar com race conditions, cache stampede, e garantir que múltiplas instâncias da API não causem inconsistências

**Não é necessário escrever código, foque no design da solução.**
<!-- /SECTION:statement -->

<!-- SECTION:solution-outline -->
**Solução esperada:**

### 1. Arquitetura da Solução

#### Tecnologia Escolhida: **Redis Cluster**

**Justificativa:**

| Critério | Redis | Memcached |
|----------|-------|-----------|
| **Estruturas de dados** |  Hash, Set, List, Sorted Set | Apenas key-value string |
| **Persistência** |  RDB/AOF (opcional) | Apenas memória |
| **Pub/Sub** |  Suporta invalidação via eventos | Não suporta |
| **Clustering nativo** |  Redis Cluster (sharding automático) | Requer proxy (Twemproxy) |
| **Performance** | ~100k ops/s por node | ~150k ops/s (mais rápido) |

**Escolha:** Redis Cluster pela flexibilidade (pub/sub para invalidação, estruturas de dados ricas, persistência opcional para warm restart).

---

#### Topologia: **Redis Cluster (3 masters + 3 replicas)**

```
                    ┌─────────────┐
                    │  API (10x)  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼────┐  ┌───▼────┐  ┌───▼────┐
         │ Redis   │  │ Redis  │  │ Redis  │  Masters
         │ Master1 │  │Master2 │  │Master3 │  (sharding por hash slot)
         └────┬────┘  └───┬────┘  └───┬────┘
              │           │            │
         ┌────▼────┐  ┌───▼────┐  ┌───▼────┐
         │ Replica │  │Replica │  │Replica │  Replicas
         │    1    │  │   2    │  │   3    │  (leitura + failover)
         └─────────┘  └────────┘  └────────┘
```

**Características:**

- **Sharding:** Redis distribui keys automaticamente entre 3 masters (16384 hash slots)
- **Replicação:** cada master tem 1 replica (read scaling + alta disponibilidade)
- **Failover:** se master falhar, replica é promovida automaticamente
- **Capacidade:** 3 nodes × 64GB RAM = 192GB total

---

#### Comunicação API ↔ Cache

**Padrão:** Cache-Aside (Lazy Loading)

```
API recebe requisição GET /produtos/categoria/123
  │
  ├─ 1. Tentar ler do Redis: GET "products:cat:123"
  │    ├─ HIT → retornar dados (latência ~5ms)
  │    └─ MISS → ir para passo 2
  │
  ├─ 2. Query no PostgreSQL: SELECT * FROM products WHERE category_id = 123
  │    └─ Latência ~200ms
  │
  └─ 3. Salvar no Redis: SET "products:cat:123" <dados> EX 300 (TTL 5min)
       └─ Retornar dados
```

**Cliente Redis nas APIs:**
- Node.js: `ioredis` com suporte a cluster
- Java: `Lettuce` ou `Jedis`
- Python: `redis-py` com `RedisCluster`

**Configuração de conexão:**
```javascript
const Redis = require('ioredis');
const cluster = new Redis.Cluster([
  { host: 'redis-master1', port: 6379 },
  { host: 'redis-master2', port: 6379 },
  { host: 'redis-master3', port: 6379 }
], {
  enableReadyCheck: true,
  retryStrategy: (times) => Math.min(times * 50, 2000) // retry com backoff
});
```

---

### 2. Estratégia de Invalidação

#### Problema: Dados Mudam com Frequências Diferentes

| Tipo de Dado | Frequência de Mudança | TTL Ideal |
|--------------|----------------------|-----------|
| **Catálogo (nome, descrição)** | Raramente (1x/semana) | 1 hora |
| **Preço** | Médio (várias vezes/dia) | 5 minutos |
| **Estoque** | Alto (a cada venda) | 1 minuto |
| **Categorias** | Muito raro (1x/mês) | 24 horas |

#### Estratégias Combinadas:

**A. Cache-Aside + TTL (padrão para reads)**

- API tenta ler do cache
- Se MISS, busca no DB e salva no cache com TTL
- **Vantagem:** simples, tolerante a falhas (se Redis cair, ainda funciona)
- **Desvantagem:** primeiro acesso após expiração é lento (cold cache)

**B. Write-Through para Escritas Críticas (estoque)**

Quando estoque muda:
```
API recebe POST /produtos/123/estoque (atualizar para 50 unidades)
  │
  ├─ 1. Atualizar PostgreSQL: UPDATE products SET stock = 50 WHERE id = 123
  │
  └─ 2. Invalidar cache: DEL "product:123" OU atualizar diretamente
       └─ SET "product:123:stock" 50 EX 60
```

**Vantagem:** cache sempre sincronizado com banco após escritas  
**Desvantagem:** adiciona latência na escrita (~10ms Redis)

**C. Invalidação via Eventos (para webhooks de ERP)**

Sistema externo atualiza preços:
```
ERP webhook → API /webhook/price-update
  │
  ├─ 1. Atualizar banco: UPDATE products SET price = X WHERE id = Y
  │
  └─ 2. Publicar evento Redis Pub/Sub:
       PUBLISH "invalidate:product:Y" "price_updated"
```

Instâncias da API escutam eventos:
```javascript
cluster.subscribe('invalidate:product:*', (message, channel) => {
  const productId = channel.split(':')[2];
  cluster.del(`product:${productId}`); // invalida cache local
});
```

**Vantagem:** invalidação instantânea em todas as instâncias da API  
**Desvantagem:** requer gerenciamento de subscribers

---

#### Padrão de Keys no Redis

```
# Produto individual
product:{id}              → Hash com todos os campos
product:{id}:stock        → String com estoque (TTL curto)

# Lista de produtos por categoria
products:cat:{categoryId} → List ou Set com IDs (TTL médio)

# Agregações
stock:region:{regionId}   → Hash com estoque por produto (TTL curto)
```

---

### 3. Garantias de Consistência

#### Problema 1: **Cache Stampede** (Thundering Herd)

**Cenário:** TTL de `products:cat:123` expira → 1000 requisições simultâneas → todas fazem query no DB.

**Solução: Lock Distribuído com Redis**

```javascript
async function getProductsByCategory(categoryId) {
  const cacheKey = `products:cat:${categoryId}`;
  const lockKey = `lock:${cacheKey}`;
  
  // Tentar ler do cache
  let data = await redis.get(cacheKey);
  if (data) return JSON.parse(data);
  
  // Cache MISS → adquirir lock
  const lockAcquired = await redis.set(lockKey, '1', 'NX', 'EX', 10); // 10s timeout
  
  if (lockAcquired) {
    try {
      // Apenas esta thread faz query no DB
      data = await db.query('SELECT * FROM products WHERE category_id = ?', [categoryId]);
      await redis.set(cacheKey, JSON.stringify(data), 'EX', 300);
      return data;
    } finally {
      await redis.del(lockKey);
    }
  } else {
    // Outras threads esperam e retentam ler do cache
    await sleep(100);
    return getProductsByCategory(categoryId); // retry
  }
}
```

**Alternativa: Probabilistic Early Expiration (PER)**

Renovar cache antes do TTL expirar com probabilidade:
```javascript
const timeLeft = await redis.ttl(cacheKey);
const delta = 30; // janela de renovação (30s)
const beta = 1; // fator de agressividade

if (timeLeft < delta * beta * Math.log(Math.random())) {
  // Renovar cache antes de expirar
  refreshCacheInBackground(cacheKey);
}
```

---

#### Problema 2: **Race Condition em Atualizações Concorrentes**

**Cenário:** API 1 e API 2 atualizam produto 123 simultaneamente.

```
Tempo  API 1                      API 2                      Cache
0s     UPDATE price = 100         -                          -
0.1s   -                          UPDATE price = 120         -
0.2s   SET product:123 (price=100) -                           100
0.3s   -                          SET product:123 (price=120)  120
```

**Problema:** Cache pode ficar com valor desatualizado se ordem de escrita for invertida.

**Solução 1: Write-Through com Version Stamp**

Incluir `updated_at` no cache e verificar antes de sobrescrever:
```javascript
const dbProduct = await db.query('SELECT *, updated_at FROM products WHERE id = 123');

const cached = await redis.hgetall('product:123');
if (cached.updated_at && cached.updated_at > dbProduct.updated_at) {
  return; // Não sobrescrever com dado mais antigo
}

await redis.hset('product:123', dbProduct);
```

**Solução 2: Invalidar em Vez de Atualizar**

Mais simples e seguro:
```javascript
// Após atualizar DB, apenas invalida cache
await db.query('UPDATE products SET price = ? WHERE id = ?', [newPrice, productId]);
await redis.del(`product:${productId}`); // Próximo read vai buscar versão atualizada
```

---

#### Problema 3: **Eventual Consistency com Réplicas Redis**

**Cenário:** Master aceita escrita, mas replica ainda não replicou → read de replica retorna valor antigo.

**Mitigação:**

1. **Leituras do master para dados críticos:**
   ```javascript
   // Forçar leitura do master (não da replica)
   const data = await redis.call('GET', cacheKey, { preferMaster: true });
   ```

2. **Wait for Replication:**
   ```javascript
   await redis.set('product:123', data);
   await redis.wait(1, 1000); // Espera 1 replica confirmar em até 1s
   ```

3. **Aceitar eventual consistency:**
   - Para catálogo de produtos, delay de 1-2s na replicação é aceitável
   - Para estoque crítico, ler sempre do banco ou usar write-through no master

---

### 4. Análise de Trade-offs

| Aspecto | Decisão | Trade-off |
|---------|---------|-----------|
| **Redis vs Memcached** | Redis | Mais complexo, mas pub/sub e estruturas avançadas compensam |
| **Cluster vs Single Instance** | Cluster | Mais complexidade operacional, mas escalável e tolerante a falhas |
| **Cache-Aside vs Write-Through** | Híbrido | Cache-aside para reads, write-through para estoque crítico |
| **TTL curto vs longo** | Diferenciado | TTL curto (1min) para estoque, longo (1h) para catálogo |
| **Invalidação ativa vs passiva** | Passiva (TTL) + ativa (pub/sub) | Pub/sub adiciona complexidade mas melhora consistência |
| **Persistência Redis** | Desabilitada | Menos overhead, warm restart não é crítico (cache rebuild rápido) |

**Custos operacionais:**
- **Memória:** 3 masters × 64GB = ~$500/mês em cloud
- **Latência:** 5ms (cache) vs 200ms (DB) → **redução de 97.5%**
- **Throughput DB:** redução de 80% nas queries → economiza em escalabilidade vertical do Postgres

**Single Point of Failure:**
- Com Redis Cluster + replicas, não há SPOF
- Se cluster inteiro cair, aplicação funciona (degradação de performance)

---

### Resumo da Solução

 **Redis Cluster (3 masters + 3 replicas)** para alta disponibilidade e sharding  
 **Cache-aside** para reads + **write-through** para estoque crítico  
 **TTL diferenciado** por tipo de dado (1min a 1h)  
 **Invalidação via pub/sub** para atualizações de webhooks  
 **Lock distribuído** para prevenir cache stampede  
 **Version stamping** ou invalidação simples para evitar race conditions  
 **Leitura de replicas** para escalar reads, master para writes  

**Resultado esperado:**
- Latência de leitura: 5-10ms (vs 200ms sem cache)
- Hit rate esperado: ~85% (dado que 80% das queries são repetitivas)
- Redução de carga no DB: ~80%
- SLA de 99.9% atingido com failover automático
<!-- /SECTION:solution-outline -->
