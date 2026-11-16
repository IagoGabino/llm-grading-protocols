---
id: easy-pagination-fix
slug: easy-pagination-fix
title: Correção de Bug — Erro de Indexação na Paginação
axis: bugFix
subtheme: runtime_errors
difficulty: easy
promptTemplate: easy-pagination-fix
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [logic_bug]
inputConfig:
  type: code
  language: javascript
rubric:
  version: v1
  criteria:
    - id: root_cause
      name: Identificação da causa raiz
      weight: 0.35
      description: Aponta claramente o erro de indexação (0 vs 1) e o cálculo incorreto de totalPages (floor em vez de ceil), relacionando aos exemplos.
    - id: functional_fix
      name: Correção funcional
      weight: 0.35
      description: Ajusta start = (page - 1) * pageSize, usa Math.ceil para totalPages e aplica clamping de page em [1, totalPages], tratando lista vazia.
    - id: edge_cases
      name: Casos de borda
      weight: 0.15
      description: Considera items vazio, page fora dos limites e pageSize maior que total.
    - id: explanation
      name: Justificativa clara
      weight: 0.10
      description: Explica por que o resultado agora condiz com o contrato/expectativa e evita regressões.
    - id: code_quality
      name: Qualidade do código
      weight: 0.05
      description: Nomes diretos, sem duplicação; cálculos autoexplicativos.
---

<!-- SECTION:statement -->
A paginação está retornando itens da página errada e calculando o total de páginas de forma incorreta. Em coleções com tamanho não múltiplo do pageSize, a última página some ou vem vazia; na primeira página, os itens começam deslocados. O comportamento esperado é página 1 começar no primeiro item e o total de páginas considerar páginas parciais.

**Funcionalidade esperada:**  
A função deve paginar uma lista de usuários, retornando:
- `items`: os itens da página pedida;
- `total`: quantidade total de itens;
- `totalPages`: número total de páginas (arredondando para cima);
- `page`: a página atual (mínimo 1, máximo `totalPages`).

**Contrato esperado:**
- A numeração de página **começa em 1** (padrão na API do produto);
- Se `page` for menor que 1, usar 1; se for maior que `totalPages`, usar `totalPages`.

**Comportamento incorreto (bug):** com os seguintes dados:
```javascript
const users = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));
const pageSize = 3;
```

- **Caso A** — `page = 1`  
  **Saída atual (incorreta)**: `items` começa em `{ id: 4 }`  
  **Saída esperada**: `items = [{id:1},{id:2},{id:3}]`

- **Caso B** — `page = 4`  
  **Saída atual (incorreta)**: `totalPages = 3` e `items = []`  
  **Saída esperada**: `totalPages = 4` e `items = [{id:10}]`

**Tarefa:** Corrija o código para respeitar o contrato: página **1‑indexada**, `totalPages` com **arredondamento para cima**, e **clamping** de `page` para `[1, totalPages]`. Na sua **linha de raciocínio**, explique a **causa raiz** e **como a correção resolve** (detalhe a fórmula do deslocamento/offset e o cálculo de `totalPages`).

```javascript
// pagination.js
function paginate(items, page, pageSize) {
  if (!Array.isArray(items)) throw new Error('items deve ser array');
  if (typeof pageSize !== 'number' || pageSize <= 0) throw new Error('pageSize inválido');

  const total = items.length;

  const totalPages = Math.floor(total / pageSize);

  const start = page * pageSize;
  const end = start + pageSize;

  const slice = items.slice(start, end);
  return { items: slice, total, totalPages, page };
}

module.exports = { paginate };
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// pagination.js
export function paginate(items, page, pageSize) {
  if (!Array.isArray(items)) throw new Error("items deve ser array");
  if (typeof pageSize !== "number" || pageSize <= 0) throw new Error("pageSize inválido");

  // TODO: ajuste o deslocamento e o total de páginas de acordo com o enunciado.
  return {
    items: [],
    total: items.length,
    totalPages: 0,
    page: Math.max(1, Number(page) || 1),
  };
}
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# pagination.py
from math import ceil
from typing import Any, Dict, List

def paginate(items: List[Any], page: int, page_size: int) -> Dict[str, Any]:
    if not isinstance(items, list):
        raise TypeError("items deve ser lista")
    if not isinstance(page_size, int) or page_size <= 0:
        raise ValueError("page_size inválido")

    # TODO: ajuste o deslocamento e o total de páginas de acordo com o enunciado.
    total = len(items)
    return {"items": [], "total": total, "totalPages": 0, "page": max(1, int(page or 1))}
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// Pagination.java
import java.util.List;

public class Pagination {
    public static <T> Page<T> paginate(List<T> items, int page, int pageSize) {
        if (items == null) {
            throw new IllegalArgumentException("items deve ser uma lista");
        }
        if (pageSize <= 0) {
            throw new IllegalArgumentException("pageSize inválido");
        }

        // TODO: ajuste o deslocamento e o total de páginas de acordo com o enunciado.
        return new Page<>(List.of(), items.size(), 0, Math.max(1, page));
    }

    public record Page<T>(List<T> items, int total, int totalPages, int page) {}
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Causa raiz**
- **Indexação incorreta:** `start = page * pageSize` assume 0‑based; o contrato é 1‑based. Resultado: página 1 salta os primeiros `pageSize` itens.
- **`totalPages` incorreto:** `Math.floor(total / pageSize)` descarta páginas parciais (10 itens, pageSize 3 → 3, quando o correto é 4).

**Lógica incorreta adicional**
- Ausência de **clamping** de `page` para `[1, totalPages]`.
- Lista vazia não tratada (decisão: `totalPages = 0`, `items = []`, `page = 1` para retorno estável/documentado).

**Correção necessária**
- `const totalPages = Math.ceil(total / pageSize);`
- `const clampedPage = totalPages > 0 ? Math.max(1, Math.min(page, totalPages)) : 1;`
- `const start = (clampedPage - 1) * pageSize; const end = start + pageSize;`

**Ganhos**
- Respeito ao contrato 1‑based, alinhamento aos exemplos, previsibilidade em bordas, e legibilidade dos cálculos.
<!-- /SECTION:solution-outline -->
