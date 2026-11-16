---
id: intermediate-cache-race-condition
slug: intermediate-cache-race-condition
title: Correção de Bug — Race Condition em Sistema de Cache
axis: bugFix
subtheme: async_issues
difficulty: intermediate
promptTemplate: intermediate-cache-race-condition
supportedLanguages: [javascript, python]
defaultLanguage: javascript
tags: [race_condition, caching, exception_handling]
inputConfig:
  type: code
  language: javascript
rubric:
  version: v1
  criteria:
    - id: root_cause
      name: Identificação da causa raiz
      weight: 0.30
      description: Explica claramente a race condition entre verificação de cache e escrita, demonstrando entendimento do problema de concorrência.
    - id: functional_fix
      name: Correção funcional
      weight: 0.35
      description: Implementa solução que previne múltiplas chamadas simultâneas ao backend para mesma chave (usando promise caching ou lock).
    - id: edge_cases
      name: Casos de borda e tratamento de erros
      weight: 0.15
      description: Trata erro na chamada ao backend, limpeza de cache em caso de falha, e evita cache de promises rejeitadas.
    - id: explanation
      name: Justificativa técnica
      weight: 0.15
      description: Explica por que a solução resolve o problema e menciona trade-offs (ex - memória, complexidade).
    - id: code_quality
      name: Qualidade do código
      weight: 0.05
      description: Código limpo, sem duplicação, fácil de entender.
---

<!-- SECTION:statement -->
Um sistema de cache para dados de usuários está gerando múltiplas requisições desnecessárias ao backend quando vários clientes solicitam o mesmo dado simultaneamente. Em ambiente de produção com alta concorrência, isso causa sobrecarga no banco de dados.

**Funcionalidade esperada:**  
A função `getCachedUser` deve:
- Retornar dados do cache se existirem e forem válidos (TTL não expirado);
- Buscar do backend apenas quando o cache estiver vazio ou expirado;
- **Prevenir múltiplas chamadas simultâneas ao backend para a mesma chave** (race condition).

**Comportamento incorreto (bug):**

Quando 3 requisições simultâneas pedem `userId = 42`:
1. Todas verificam o cache → não encontram dados
2. Todas chamam `fetchUserFromDB(42)` **simultaneamente**
3. Resultado: 3 queries ao banco para o mesmo usuário

**Logs observados em produção:**
```
[10:23:45.123] Cache miss para userId=42
[10:23:45.125] Cache miss para userId=42  
[10:23:45.127] Cache miss para userId=42
[10:23:45.890] DB query: SELECT * FROM users WHERE id=42 (3x executado)
```

**Comportamento esperado:**
- Primeira requisição: cache miss → busca no DB → armazena no cache
- Requisições simultâneas: esperam pela primeira resolver e reutilizam o resultado

**Tarefa:** 
Corrija o código para eliminar a race condition. Na sua **linha de raciocínio**, explique:
1. **Por que** a race condition ocorre (análise do timing entre threads/promises)
2. **Como** sua solução resolve o problema
3. **Trade-offs** da abordagem escolhida (memória, complexidade, etc.)

```javascript
// user-cache.js
class UserCache {
  constructor(ttl = 60000) {
    this.cache = new Map();
    this.ttl = ttl;
  }

  async getCachedUser(userId) {
    const cached = this.cache.get(userId);
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      console.log(`Cache hit para userId=${userId}`);
      return cached.data;
    }

    console.log(`Cache miss para userId=${userId}`);
    const userData = await fetchUserFromDB(userId);
    
    this.cache.set(userId, {
      data: userData,
      timestamp: Date.now()
    });

    return userData;
  }
}

async function fetchUserFromDB(userId) {
  // Simula chamada ao banco (200-500ms de latência)
  console.log(`DB query: SELECT * FROM users WHERE id=${userId}`);
  await new Promise(resolve => setTimeout(resolve, 200));
  return { id: userId, name: `User ${userId}`, email: `user${userId}@example.com` };
}

module.exports = { UserCache };
```

**Cenário de teste sugerido:**
```javascript
const cache = new UserCache();
// Simular 3 requisições simultâneas
Promise.all([
  cache.getCachedUser(42),
  cache.getCachedUser(42),
  cache.getCachedUser(42)
]);
// Deve resultar em apenas 1 query ao DB
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// user-cache.js
export class UserCache {
  constructor(ttl = 60000) {
    this.cache = new Map();
    this.ttl = ttl;
    // TODO: adicione estrutura para controlar promises em andamento
  }

  async getCachedUser(userId) {
    // TODO: implemente lógica que evita múltiplas chamadas simultâneas ao backend
    // Dica: verifique se já existe uma promise em andamento para esta chave
    return null;
  }
}
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# user_cache.py
import asyncio
import time
from typing import Any, Dict, Optional


class UserCache:
    def __init__(self, ttl: int = 60000):
        self.cache: Dict[int, Dict[str, Any]] = {}
        self.ttl = ttl
        # TODO: adicione estrutura para controlar tasks em andamento

    async def get_cached_user(self, user_id: int) -> Optional[Dict[str, Any]]:
        # TODO: implemente lógica que evita múltiplas chamadas simultâneas ao backend
        # Dica: verifique se já existe uma coroutine em andamento para esta chave
        return None
<!-- /SECTION:template:python -->

<!-- SECTION:solution-outline -->
**Causa raiz:**
- **Race condition clássica:** intervalo entre verificação do cache (`if cached`) e início da chamada ao backend permite que múltiplas promises/threads verifiquem "cache vazio" antes que a primeira complete.
- **Timing crítico:** em ambiente assíncrono, entre o `cache.get()` e o `fetchUserFromDB()`, outras execuções paralelas também verificam o cache e encontram vazio.

**Solução — Promise Caching (abordagem recomendada):**

```javascript
class UserCache {
  constructor(ttl = 60000) {
    this.cache = new Map();
    this.pending = new Map(); // <-- armazena promises em andamento
    this.ttl = ttl;
  }

  async getCachedUser(userId) {
    // 1. Verificar cache válido
    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }

    // 2. Verificar se já existe promise em andamento
    if (this.pending.has(userId)) {
      console.log(`Aguardando promise existente para userId=${userId}`);
      return this.pending.get(userId);
    }

    // 3. Criar nova promise e armazená-la
    const promise = this._fetchAndCache(userId);
    this.pending.set(userId, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      // 4. Limpar promise ao completar (sucesso ou erro)
      this.pending.delete(userId);
    }
  }

  async _fetchAndCache(userId) {
    console.log(`Cache miss para userId=${userId}`);
    const userData = await fetchUserFromDB(userId);
    this.cache.set(userId, { data: userData, timestamp: Date.now() });
    return userData;
  }
}
```

**Pontos essenciais:**
1. **Map `pending`** para rastrear promises em andamento
2. Verificar `pending` antes de iniciar nova chamada ao backend
3. Compartilhar a mesma promise entre requisições simultâneas
4. Limpar `pending` após resolução (finally block) para evitar memory leak
5. Tratar erro: se `fetchUserFromDB` falhar, não cachear a promise rejeitada

**Trade-offs:**
- **Memória:** Map adicional (`pending`) com referências a promises
- **Complexidade:** lógica de sincronização adiciona camada de indireção
- **Benefício:** reduz drasticamente carga no backend sob alta concorrência

**Solução alternativa (mutex/lock):** usar biblioteca de lock async, mas adiciona dependência e complexidade.
<!-- /SECTION:solution-outline -->
