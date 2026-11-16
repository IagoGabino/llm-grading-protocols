---
id: intermediate-n-plus-one-queries
slug: intermediate-n-plus-one-queries
title: Correção de Bug — N+1 Queries em Listagem de Faturas com Dados de Cliente
axis: bugFix
subtheme: integration_and_performance
difficulty: intermediate
promptTemplate: intermediate-n-plus-one-queries
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [n_plus_one, batching, sql, performance, hashmap, database]
references:
  - id: ref-1
    title: "Use The Index, Luke — N+1 Query Problem"
    type: technical_blog
    url: "https://use-the-index-luke.com/sql/join/nested-loops-join-n1-problem"
    relevance: 5
    confidence: 4
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "High Performance MySQL (Baron Schwartz et al.)"
    type: book
    url: null
    relevance: 4
    confidence: 4
    supports: [rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "SQL IN Clause — W3Schools SQL Tutorial"
    type: technical_blog
    url: "https://www.w3schools.com/sql/sql_in.asp"
    relevance: 3
    confidence: 5
    supports: [statement, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Designing Data-Intensive Applications (Martin Kleppmann)"
    type: book
    url: null
    relevance: 4
    confidence: 4
    supports: [rubric, solution-outline]
    verificationStatus: suggested_not_verified
generationMetrics:
  validFormatSelfCheck: true
  rubricCriteriaCount: 4
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
    - id: root_cause
      name: Identificação da causa raiz
      weight: 0.25
      description: Explica claramente que o loop realiza uma query por fatura (N queries) somada à query inicial, totalizando N+1 idas ao banco, e por que isso degrada a performance.
    - id: batching_fix
      name: Implementação de batching com IN
      weight: 0.35
      description: Extrai os customer_ids únicos das faturas e executa exatamente uma query usando cláusula IN (ou equivalente) para buscar todos os clientes de uma vez, reduzindo o total de queries para 2.
    - id: memory_join
      name: Associação em memória com complexidade O(N)
      weight: 0.25
      description: Constrói um dicionário/mapa de customer_id para customer e usa esse mapa para atribuir o cliente a cada fatura em O(N), sem loops aninhados (find/filter dentro de map/for) que gerariam O(N²).
    - id: contract_preservation
      name: Preservação do contrato de saída
      weight: 0.15
      description: A função retorna exatamente o mesmo formato que o código original — lista de faturas com a propriedade customer preenchida — sem alterar a assinatura pública nem omitir campos.
---

<!-- SECTION:statement -->
Um endpoint de listagem de faturas retorna as últimas 100 faturas junto com os dados completos do cliente associado a cada uma. Em produção, a rota de listagem está causando lentidão severa: o tempo de resposta chega a vários segundos e o banco de dados registra centenas de queries a cada requisição.

**Contrato esperado da função `getInvoicesWithCustomers()`:**
- Retorna uma lista de objetos fatura, onde cada objeto possui uma propriedade `customer` com os dados completos do cliente associado.
- Deve realizar exatamente **2 queries** ao banco: uma para buscar as faturas e uma para buscar todos os clientes relevantes em lote.
- A associação entre faturas e clientes deve ser feita em memória com complexidade **O(N)** usando um dicionário/mapa.
- Deve preservar o mesmo formato de retorno do código original.

**Comportamento incorreto (bug):**

Para uma listagem de 100 faturas:
1. Uma query busca as 100 faturas.
2. Para **cada** fatura, uma nova query busca o cliente correspondente.
3. Resultado: **101 queries** ao banco de dados para uma única requisição HTTP.

**Logs observados em produção:**
```text
[14:02:01.010] SELECT * FROM invoices ORDER BY date DESC LIMIT 100  → 100 rows
[14:02:01.045] SELECT * FROM customers WHERE id = 7
[14:02:01.051] SELECT * FROM customers WHERE id = 23
[14:02:01.058] SELECT * FROM customers WHERE id = 7   ← id repetido!
... (97 queries adicionais)
[14:02:04.201] Response sent — 3191ms
```

**Tarefa:**
Corrija o código do template da linguagem escolhida para eliminar o problema de N+1 queries. Você pode adicionar funções auxiliares, mas deve preservar a assinatura pública de `getInvoicesWithCustomers`. Na sua **linha de raciocínio**, explique:
1. **Causa raiz** do problema: por que o loop gera N+1 queries.
2. **Como** você extraiu os `customer_id`s únicos e executou a query em lote.
3. **Como** você construiu a estrutura de mapa para associar clientes às faturas.
4. **Por que** o mapa garante complexidade O(N) em vez de O(N²).

**Cenários de teste sugeridos:**
```text
Caso 1 — Sem repetição de cliente:
- 3 faturas com customer_id distintos (1, 2, 3)
- esperado: 2 queries; cada fatura tem customer preenchido corretamente

Caso 2 — Com repetição de cliente:
- 3 faturas onde duas compartilham o mesmo customer_id (1, 1, 2)
- esperado: 2 queries (IN com apenas 2 ids únicos); clientes associados corretamente

Caso 3 — Lista vazia:
- nenhuma fatura retornada
- esperado: retorna lista vazia; segunda query não é executada (ou é equivalente a IN ())
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// invoice-service.js

/**
 * Mock de acesso ao banco de dados.
 * db.query(sql, params) retorna uma Promise com o array de linhas resultante.
 */
const db = {
  query: async (sql, params = []) => {
    // Implementação interna omitida — assume conexão real ao banco.
    console.log("DB QUERY:", sql, params);
    return [];
  },
};

/**
 * Retorna as últimas 100 faturas com os dados do cliente associado.
 *
 * BUG ATUAL: executa N+1 queries ao banco de dados.
 * Corrija para usar exatamente 2 queries com batching (cláusula IN)
 * e associação em memória via Map.
 *
 * @returns {Promise<Array<{id, amount, date, customer_id, customer: Object}>>}
 */
async function getInvoicesWithCustomers() {
  const invoices = await db.query(
    "SELECT * FROM invoices ORDER BY date DESC LIMIT 100"
  );

  for (const invoice of invoices) {
    const rows = await db.query(
      "SELECT * FROM customers WHERE id = ?",
      [invoice.customer_id]
    );
    invoice.customer = rows[0];
  }

  return invoices;
}

module.exports = { getInvoicesWithCustomers };
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# invoice_service.py
from typing import Any

# Mock de acesso ao banco de dados.
# db.query(sql, params) retorna uma lista de dicionários com as linhas resultantes.
class Db:
    def query(self, sql: str, params: list = []) -> list[dict[str, Any]]:
        # Implementação interna omitida — assume conexão real ao banco.
        print(f"DB QUERY: {sql} {params}")
        return []

db = Db()


def get_invoices_with_customers() -> list[dict[str, Any]]:
    """
    Retorna as últimas 100 faturas com os dados do cliente associado.

    BUG ATUAL: executa N+1 queries ao banco de dados.
    Corrija para usar exatamente 2 queries com batching (cláusula IN)
    e associação em memória via dicionário.
    """
    invoices = db.query(
        "SELECT * FROM invoices ORDER BY date DESC LIMIT 100"
    )

    for invoice in invoices:
        rows = db.query(
            "SELECT * FROM customers WHERE id = %s",
            [invoice["customer_id"]]
        )
        invoice["customer"] = rows[0] if rows else None

    return invoices
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// InvoiceService.java
import java.util.*;

public class InvoiceService {

    /**
     * Mock de acesso ao banco de dados.
     * db.query(sql, params) retorna uma List<Map<String, Object>> com as linhas resultantes.
     */
    static class Db {
        public List<Map<String, Object>> query(String sql, Object... params) {
            // Implementação interna omitida — assume conexão real ao banco.
            System.out.printf("DB QUERY: %s %s%n", sql, Arrays.toString(params));
            return Collections.emptyList();
        }
    }

    private final Db db = new Db();

    /**
     * Retorna as últimas 100 faturas com os dados do cliente associado.
     *
     * BUG ATUAL: executa N+1 queries ao banco de dados.
     * Corrija para usar exatamente 2 queries com batching (cláusula IN)
     * e associação em memória via HashMap.
     *
     * @return lista de faturas, cada uma com a chave "customer" preenchida
     */
    public List<Map<String, Object>> getInvoicesWithCustomers() {
        List<Map<String, Object>> invoices = db.query(
            "SELECT * FROM invoices ORDER BY date DESC LIMIT 100"
        );

        for (Map<String, Object> invoice : invoices) {
            Object customerId = invoice.get("customer_id");
            List<Map<String, Object>> rows = db.query(
                "SELECT * FROM customers WHERE id = ?",
                customerId
            );
            invoice.put("customer", rows.isEmpty() ? null : rows.get(0));
        }

        return invoices;
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Causa raiz:**
- O loop `for` faz uma chamada a `db.query` a cada iteração. Para 100 faturas, isso gera 100 queries individuais de cliente mais a query inicial de faturas, totalizando 101 queries (N+1). O problema é agravado quando múltiplos clientes se repetem entre as faturas, pois o mesmo cliente pode ser buscado mais de uma vez.

**Solução esperada — pontos essenciais:**

1. **Executar a query de faturas** normalmente:
   ```sql
   SELECT * FROM invoices ORDER BY date DESC LIMIT 100
   ```

2. **Extrair `customer_id`s únicos** das faturas usando um Set/conjunto para evitar duplicatas:
   - JavaScript: `const ids = [...new Set(invoices.map(i => i.customer_id))]`
   - Python: `ids = list({inv["customer_id"] for inv in invoices})`
   - Java: coleta em `Set<Object>` e converte para lista

3. **Executar uma única query em lote (batching com IN):**
   ```sql
   SELECT * FROM customers WHERE id IN (?, ?, ...)
   ```
   - A lista de placeholders deve corresponder ao número de ids únicos.
   - Tratar o caso de lista vazia para não executar query com `IN ()`.

4. **Construir um mapa `customer_id → customer`** para acesso O(1):
   - JavaScript: `const map = new Map(customers.map(c => [c.id, c]))`
   - Python: `customer_map = {c["id"]: c for c in customers}`
   - Java: `Map<Object, Map<String,Object>>` populado com loop simples

5. **Atribuir o cliente a cada fatura** usando o mapa:
   - JavaScript: `invoice.customer = map.get(invoice.customer_id)`
   - Python: `invoice["customer"] = customer_map.get(invoice["customer_id"])`
   - Java: `invoice.put("customer", customerMap.get(invoice.get("customer_id")))`

**Por que O(N) e não O(N²):**
- Usar `find`/`filter` dentro de um `map`/`for` sobre a lista de clientes a cada fatura seria O(N²): para cada uma das N faturas, percorre até N clientes.
- Com o mapa, cada lookup é O(1) (amortizado), tornando o passo de associação O(N) no total.

**Preservação do contrato:**
- A função deve continuar retornando a lista de faturas com a propriedade `customer` preenchida em cada objeto, sem alterar a assinatura pública nem remover campos existentes.
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
Recomendação: accept.

Principais pontos:
- A questão foca claramente o problema de N+1 queries em acesso ao banco: há uma query inicial de faturas seguida de uma query por fatura para buscar clientes.
- Os templates usam acesso genérico por `db.query`/DAO e SQL parametrizado, sem depender de `.populate()` ou outro recurso mágico de ORM.
- O `solution-outline` exige batching com `IN (...)`, extração de IDs únicos e construção de dicionário/mapa em memória para associar clientes às faturas em O(N).
- A rubrica penaliza explicitamente soluções com `find`/`filter`/loop aninhado durante a associação, evitando trocar gargalo de I/O por custo O(N²) em memória.
- O prompt de avaliação está alinhado à rubrica e instrui o juiz a verificar tanto a query em lote quanto a estratégia algorítmica de indexação por mapa.
- O enunciado não solicita alteração no banco, criação de índice ou substituição por JOIN; a solução esperada é corretamente delimitada como batching em duas queries.
- As referências estão presentes e plausíveis para apoiar o tema, mantendo o status de sugestão não verificada.
<!-- /REVIEW:comments -->
