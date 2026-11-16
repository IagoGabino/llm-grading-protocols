---
id: easy-scheduled-posts-async-loop
slug: easy-scheduled-posts-async-loop
title: "Correção de Bug — Publicação de Posts Agendados Retorna Antes das Operações Assíncronas Terminarem"
axis: bugFix
subtheme: async_issues
difficulty: easy
promptTemplate: easy-scheduled-posts-async-loop
supportedLanguages: [javascript, python]
defaultLanguage: javascript
tags: [async_await, forEach, promise_all, asyncio_gather, fire_and_forget, async_loop]
references:
  - id: ref-1
    title: "Promise.all() — MDN Web Docs"
    type: official_docs
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all"
    relevance: 5
    confidence: 5
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Array.prototype.forEach() and async functions — MDN Web Docs"
    type: official_docs
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach"
    relevance: 5
    confidence: 5
    supports: [statement, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "asyncio.gather() — Python Docs"
    type: official_docs
    url: "https://docs.python.org/3/library/asyncio-task.html#asyncio.gather"
    relevance: 5
    confidence: 5
    supports: [statement, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "You Don't Know JS: Async & Performance — Kyle Simpson"
    type: book
    url: null
    relevance: 3
    confidence: 3
    supports: [rubric, solution-outline]
    verificationStatus: suggested_not_verified
generationMetrics:
  validFormatSelfCheck: true
  rubricCriteriaCount: 5
  referencesSuggested: true
  plannedDifficulty: easy
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
      weight: 0.30
      description: "Identifica que `forEach` não aguarda callbacks async — cada iteração inicia uma Promise mas não aguarda sua resolução, fazendo a função retornar `{ published: 0, failed: 0 }` imediatamente, antes de qualquer publicação ser concluída."
    - id: async_fix
      name: Correção do loop assíncrono
      weight: 0.35
      description: Substitui o `forEach` por uma construção que aguarda corretamente todas as Promises — usando `Promise.all` com `map`, `for...of` com `await`, ou equivalente em Python (`asyncio.gather`, laço `async for` com `await`). A correção deve garantir que a função só retorna após todas as publicações terminarem.
    - id: error_handling
      name: Tratamento de erros por item
      weight: 0.20
      description: Trata falhas individuais de publicação de forma explícita — usando `try/catch` por item, `Promise.allSettled`, ou verificando os resultados — para que falhas sejam contabilizadas no resumo sem interromper as demais publicações. Não aceita engolir erros silenciosamente.
    - id: contract_preservation
      name: Preservação do contrato de retorno
      weight: 0.10
      description: "A função corrigida retorna `{ published: number, failed: number }` com os valores corretos após todas as publicações terminarem, preservando o contrato original."
    - id: explanation
      name: Justificativa técnica
      weight: 0.05
      description: Explica em linguagem clara por que `forEach` com async não aguarda as operações e como a correção garante que o retorno só ocorre após todas as publicações terminarem.
---

<!-- SECTION:statement -->
O serviço de comunicados internos da **Cortex** permite que gestores agendem posts para publicação simultânea em diferentes canais (intranet, mural corporativo e e-mail). A função `publishScheduledPosts` recebe a lista de posts agendados, chama `publishToChannel` para cada um e deveria retornar um resumo com quantos foram publicados com sucesso e quantos falharam.

**Contrato esperado:**
- A função deve aguardar a conclusão de **todas** as publicações antes de retornar.
- O resumo `{ published, failed }` deve refletir o resultado real de cada operação.
- Falhas individuais não devem interromper as demais publicações.
- Erros não devem ser silenciados — cada falha deve ser contabilizada em `failed`.

**Comportamento incorreto (bug):**

Ao chamar `publishScheduledPosts(posts)`, a função retorna `{ published: 0, failed: 0 }` imediatamente, como se nenhuma publicação tivesse ocorrido. Alguns segundos depois, as publicações ainda estão sendo processadas em segundo plano. Se uma publicação falha, o erro aparece fora do fluxo esperado (como um `UnhandledPromiseRejection` no Node.js) e não é refletido no resumo.

```
[Chamada]  publishScheduledPosts([post1, post2, post3])
[0 ms]     retorna { published: 0, failed: 0 }   ← ERRADO
[1200 ms]  post1 publicado com sucesso            ← em segundo plano
[1800 ms]  post2 falhou com erro                  ← UnhandledRejection!
[2100 ms]  post3 publicado com sucesso            ← em segundo plano
```

**Tarefa:** Corrija `publishScheduledPosts` para que: (1) aguarde todas as publicações antes de retornar; (2) contabilize corretamente sucessos e falhas; (3) não engula erros silenciosamente. Na sua **linha de raciocínio**, explique: (a) por que o código atual retorna antes das operações terminarem, (b) qual mecanismo você usou para corrigir isso e (c) como os erros individuais são tratados.

**JavaScript:**

```javascript
// post-publisher.js

/**
 * Publica todos os posts agendados nos seus canais.
 * @param {Array<{ id: string, channel: string, content: string }>} posts
 * @returns {Promise<{ published: number, failed: number }>}
 */
async function publishScheduledPosts(posts) {
  let published = 0;
  let failed = 0;

  posts.forEach(async (post) => {       // ← bug: forEach ignora Promises
    try {
      await publishToChannel(post.channel, post.content);
      published++;
    } catch (err) {
      failed++;
    }
  });

  return { published, failed };         // ← retorna antes das publicações terminarem
}
```

**Python:**

```python
import asyncio

async def publish_scheduled_posts(posts):
    """
    Publica todos os posts agendados nos seus canais.
    posts: list of dicts with keys 'id', 'channel', 'content'
    Returns: dict { 'published': int, 'failed': int }
    """
    published = 0
    failed = 0

    for post in posts:
        asyncio.create_task(           # ← bug: cria coroutine sem aguardar
            publish_to_channel(post["channel"], post["content"])
        )

    return {"published": published, "failed": failed}   # ← retorna imediatamente
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// post-publisher.js

/**
 * Publica todos os posts agendados nos seus canais.
 * @param {Array<{ id: string, channel: string, content: string }>} posts
 * @returns {Promise<{ published: number, failed: number }>}
 */
async function publishScheduledPosts(posts) {
  let published = 0;
  let failed = 0;

  // TODO: substitua o forEach por uma construção que aguarde todas as Promises.
  // Dica: considere usar Promise.all com map, ou um laço for...of com await.
  // Trate cada publicação individualmente para que uma falha não cancele as demais.

  posts.forEach(async (post) => {       // ← substitua esta construção
    try {
      await publishToChannel(post.channel, post.content);
      published++;
    } catch (err) {
      failed++;
    }
  });

  return { published, failed };
}

// Simulação da dependência externa (não altere):
async function publishToChannel(channel, content) {
  // publica no canal e resolve ou rejeita conforme disponibilidade
}
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
import asyncio

async def publish_scheduled_posts(posts):
    """
    Publica todos os posts agendados nos seus canais.
    posts: list of dicts with keys 'id', 'channel', 'content'
    Returns: dict { 'published': int, 'failed': int }
    """
    published = 0
    failed = 0

    # TODO: substitua o laço abaixo por uma construção que aguarde todas as coroutines.
    # Dica: considere asyncio.gather com return_exceptions=True, ou um laço async
    # com await e tratamento de exceção por item.

    for post in posts:
        asyncio.create_task(           # ← substitua esta construção
            publish_to_channel(post["channel"], post["content"])
        )

    return {"published": published, "failed": failed}

# Simulação da dependência externa (não altere):
async def publish_to_channel(channel: str, content: str) -> None:
    """Publica o conteúdo no canal indicado. Pode lançar exceção em caso de falha."""
    pass
<!-- /SECTION:template:python -->

<!-- SECTION:solution-outline -->
**Causa raiz**
- Em JavaScript, `forEach` não é "async-aware": cada iteração chama a função async e recebe uma Promise, mas o `forEach` não aguarda nenhuma delas. Assim, o `return { published, failed }` executa imediatamente, antes de qualquer publicação terminar — e os contadores permanecem em zero.
- Em Python, `asyncio.create_task` agenda a coroutine mas não a aguarda. O laço termina instantaneamente e o `return` ocorre antes de qualquer publicação ser concluída. Falhas geram warnings de tarefa não coletada.

**Correções aceitas**

*JavaScript — Opção 1: `Promise.allSettled` com `map` (recomendada para este caso)*
```javascript
async function publishScheduledPosts(posts) {
  const results = await Promise.allSettled(
    posts.map((post) => publishToChannel(post.channel, post.content))
  );

  let published = 0;
  let failed = 0;
  for (const result of results) {
    if (result.status === 'fulfilled') published++;
    else failed++;
  }

  return { published, failed };
}
```

*JavaScript — Opção 2: `for...of` com `await` e `try/catch` por item*
```javascript
async function publishScheduledPosts(posts) {
  let published = 0;
  let failed = 0;

  for (const post of posts) {
    try {
      await publishToChannel(post.channel, post.content);
      published++;
    } catch {
      failed++;
    }
  }

  return { published, failed };
}
```

*Python — Opção 1: `asyncio.gather` com `return_exceptions=True` (recomendada)*
```python
async def publish_scheduled_posts(posts):
    tasks = [publish_to_channel(p["channel"], p["content"]) for p in posts]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    published = sum(1 for r in results if not isinstance(r, BaseException))
    failed = sum(1 for r in results if isinstance(r, BaseException))

    return {"published": published, "failed": failed}
```

*Python — Opção 2: laço com `await` e `try/except` por item*
```python
async def publish_scheduled_posts(posts):
    published = 0
    failed = 0

    for post in posts:
        try:
            await publish_to_channel(post["channel"], post["content"])
            published += 1
        except Exception:
            failed += 1

    return {"published": published, "failed": failed}
```

**Pontos essenciais**
1. O `forEach` não aguarda Promises — `map` + `Promise.all`/`Promise.allSettled` ou `for...of` com `await` são as alternativas corretas em JS.
2. `asyncio.create_task` sem `await` é análogo ao `forEach` com async: dispara a tarefa sem aguardar.
3. `Promise.allSettled` / `asyncio.gather(return_exceptions=True)` são preferidos quando se quer processar todos os itens independentemente de falhas individuais.
4. O contrato de retorno só é preservado se `return` aparecer após o `await` que aguarda todas as operações.
5. Erros individuais devem ser capturados por item (não propagados globalmente), para que o resumo reflita o resultado real de cada publicação.
<!-- /SECTION:solution-outline -->

<!-- REVIEW:metrics -->
{
  "quality": {
    "technicalCorrectness": 4,
    "statementClarity": 5,
    "rubricAlignment": 4,
    "difficultyAlignment": 5
  },
  "compatibility": {
    "promptAlignment": 5,
    "formatValid": true
  },
  "recommendation": "minor_revision",
  "statusAfterReview": "needs_human_review",
  "mainIssue": "technical",
  "revisionLevelNeeded": "light",
  "suggestedChangedParts": ["statement", "rubric"],
  "referencesStatus": "present"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendacao: minor_revision.

Principais pontos:
- A questao pertence claramente a `bugFix/async_issues`: o defeito central e uma funcao que dispara operacoes assincronas em um loop inadequado e retorna o resumo antes de todas terminarem. O escopo nao vira fila, worker, retry avancado, background job ou discussao apenas de performance.
- A dificuldade esta adequada para `easy`: o bug e reproduzivel pelo enunciado e pelos templates, a correcao e pequena, e as alternativas aceitas envolvem `Promise.all`/`Promise.allSettled`, `for...of` com `await`, `asyncio.gather` ou laco com `await`.
- Os templates JavaScript e Python representam a mesma tarefa conceitual e preservam o mesmo contrato `{ published, failed }`. O `solution-outline` aceita tanto execucao sequencial quanto paralela controlada, sem impor uma unica solucao.
- Recomenda-se ajustar levemente o enunciado porque, no template JavaScript, o `try/catch` dentro do callback async captura a rejeicao de `publishToChannel`; portanto a mencao a `UnhandledPromiseRejection` nao e fiel a esse codigo. O resumo ainda retorna cedo e fica incorreto, mas a falha e contabilizada tarde demais, nao necessariamente exposta como rejeicao nao tratada. Em Python, a descricao de tarefa agendada sem coleta de excecao continua plausivel.
- Recomenda-se tambem trocar, na rubrica, a expressao `laco async for com await` por uma formulacao mais geral como laco com `await`, pois `async for` tem significado especifico em Python e nao e necessario para iterar a lista de posts.
- O prompt de avaliacao segue o padrao real de `prompts/`, usa placeholders compativeis com questao `code` e reproduz corretamente os ids e pesos da rubrica. Ele tambem instrui a aceitar mecanismos equivalentes e a verificar tratamento de erro por item.
- As referencias estao presentes, sao plausiveis para o tema e permanecem corretamente como `suggested_not_verified`.
<!-- /REVIEW:comments -->
