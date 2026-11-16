---
id: advanced-event-loop-starvation
slug: advanced-event-loop-starvation
title: Correção de Bug — Event Loop Starvation por Processamento CPU-Bound em Endpoint Assíncrono
axis: bugFix
subtheme: async_issues
difficulty: advanced
promptTemplate: advanced-event-loop-starvation
supportedLanguages: [javascript, python]
defaultLanguage: javascript
tags: [event_loop, cpu_bound, async, concurrency, worker_threads, chunking]
references:
  - id: ref-1
    title: "Node.js Event Loop Documentation — Don't Block the Event Loop"
    type: official_docs
    url: "https://nodejs.org/en/docs/guides/dont-block-the-event-loop"
    relevance: 5
    confidence: 5
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Python asyncio — Developing with asyncio: Running Blocking Code"
    type: official_docs
    url: "https://docs.python.org/3/library/asyncio-dev.html#running-blocking-code"
    relevance: 5
    confidence: 5
    supports: [statement, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Node.js worker_threads — Official Documentation"
    type: official_docs
    url: "https://nodejs.org/api/worker_threads.html"
    relevance: 4
    confidence: 5
    supports: [solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Using Promises and async/await with CPU-Intensive Work"
    type: technical_blog
    url: null
    relevance: 3
    confidence: 3
    supports: [solution-outline]
    verificationStatus: suggested_not_verified
generationMetrics:
  validFormatSelfCheck: true
  rubricCriteriaCount: 4
  referencesSuggested: true
  plannedDifficulty: advanced
  expectedType: code
  taxonomyFit: strong
inputConfig:
  type: code
  language: javascript
rubric:
  version: v1
  criteria:
    - id: root_cause_identification
      name: Identificação da causa raiz
      weight: 0.30
      description: Identifica que o loop síncrono de processamento CPU-bound bloqueia a thread principal (Event Loop), impedindo que o servidor responda a outros requests enquanto o cálculo está em andamento.
    - id: fix_viability
      name: Viabilidade e correção da solução
      weight: 0.40
      description: Propõe e implementa corretamente ao menos uma das soluções válidas — chunking com yield ao event loop (setImmediate/setTimeout em JS ou asyncio.sleep(0) em Python), offloading para Worker Threads / multiprocessing, ou delegação a fila de background. O cálculo financeiro deve ser preservado integralmente.
    - id: tradeoff_justification
      name: Justificativa e trade-offs
      weight: 0.20
      description: Explica os trade-offs da abordagem escolhida — por exemplo, aumento do tempo total da requisição com chunking, complexidade de serialização com workers, ou latência adicional com filas assíncronas.
    - id: code_correctness
      name: Correção sintática e semântica do código
      weight: 0.10
      description: "O código proposto é sintaticamente correto na linguagem escolhida e não introduz novos bugs (ex.: race conditions, dados corrompidos, perda de resultado parcial)."
---

<!-- SECTION:statement -->
O serviço interno de relatórios financeiros da **FinCore** expõe o endpoint `POST /api/reports/heavy-export`. Esse endpoint recebe uma lista de registros contábeis e aplica, sobre cada item, um conjunto de cálculos financeiros pesados: depreciação acelerada, amortização de dívidas, projeção de fluxo de caixa e reconciliação de centavos por diferença de câmbio. O endpoint é marcado como `async`, mas todo o processamento interno ocorre num loop síncrono.

**Comportamento em produção:**

Em testes com 10 registros, o endpoint responde em ~80 ms e tudo funciona normalmente. Ao ser chamado com 100.000 registros corporativos reais, o servidor inteiro congela por 15–30 segundos. Durante esse período, **todas** as outras rotas da API — consultas de saldo, autenticação, health check — ficam sem resposta e dão timeout.

**Reclamações registradas no Slack interno (#on-call):**

```
[09:14:02] alert-bot: /api/health retornou 504 após 30s
[09:14:04] carolina.ops: API totalmente parada, clientes ligando
[09:14:09] marcos.dev: alguém rodou o heavy-export agora?
[09:14:11] carolina.ops: SIM. ETA?
[09:14:15] marcos.dev: aguardando terminar... servidor não responde mais nada
[09:14:47] alert-bot: /api/health OK (endpoint heavy-export concluiu)
```

**Código atual (Node.js / Express):**

```javascript
// routes/reports.js
const express = require('express');
const router = express.Router();

/**
 * Aplica cálculos financeiros complexos a um registro contábil.
 * CPU-bound: sem I/O, puramente matemático.
 */
function computeFinancialMetrics(record) {
  // Depreciação acelerada (soma de dígitos)
  const usefulLife = record.usefulLifeYears || 5;
  const sumOfDigits = (usefulLife * (usefulLife + 1)) / 2;
  let depreciationSchedule = 0;
  for (let y = usefulLife; y >= 1; y--) {
    depreciationSchedule += (y / sumOfDigits) * record.assetValue;
  }

  // Projeção de fluxo de caixa (100 iterações de simulação)
  let cashFlowProjection = record.initialCashFlow;
  for (let i = 0; i < 100; i++) {
    cashFlowProjection *= 1 + record.growthRate / 100;
    cashFlowProjection -= record.fixedCosts;
  }

  // Reconciliação de diferença de câmbio (centavos)
  const fxAdjustment = Math.round(
    (record.foreignAmount * record.exchangeRate - record.localAmount) * 100
  ) / 100;

  return {
    id: record.id,
    depreciationTotal: depreciationSchedule,
    projectedCashFlow: cashFlowProjection,
    fxAdjustment,
  };
}

// ENDPOINT PROBLEMÁTICO
router.post('/api/reports/heavy-export', async (req, res) => {
  const { records } = req.body; // pode conter até 100.000 itens

  // BUG: loop síncrono bloqueia o Event Loop durante toda a duração
  const results = records.map((record) => computeFinancialMetrics(record));

  res.json({ total: results.length, data: results });
});

module.exports = router;
```

**Sintomas visíveis para outros usuários:**

- Requisições simultâneas a qualquer outro endpoint dão timeout enquanto o heavy-export está rodando.
- O Node.js health check (`/api/health`) para de responder durante o processamento.
- Métricas de latência P99 explodem apenas nas janelas em que o relatório é gerado.

**Tarefa:**

Refatore o endpoint para que o processamento pesado **não bloqueie a thread principal**. Na sua **linha de raciocínio**, explique:

1. **Por que** o loop atual bloqueia o Event Loop, mesmo com `async/await` no handler.
2. **Por que** o servidor para de responder a outros requests durante o processamento.
3. **Qual estratégia** você adotou (chunking, worker threads ou background job) e por quê.
4. **Quais trade-offs** sua solução introduz (latência, complexidade, throughput).

> **Restrição:** a lógica de `computeFinancialMetrics` deve ser preservada integralmente. O aluno não pode simplesmente removê-la ou substituí-la por um stub.
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// routes/reports.js
const express = require('express');
const router = express.Router();

/**
 * Aplica cálculos financeiros complexos a um registro contábil.
 * NÃO altere esta função — apenas mova/refatore onde ela é chamada.
 */
function computeFinancialMetrics(record) {
  const usefulLife = record.usefulLifeYears || 5;
  const sumOfDigits = (usefulLife * (usefulLife + 1)) / 2;
  let depreciationSchedule = 0;
  for (let y = usefulLife; y >= 1; y--) {
    depreciationSchedule += (y / sumOfDigits) * record.assetValue;
  }

  let cashFlowProjection = record.initialCashFlow;
  for (let i = 0; i < 100; i++) {
    cashFlowProjection *= 1 + record.growthRate / 100;
    cashFlowProjection -= record.fixedCosts;
  }

  const fxAdjustment = Math.round(
    (record.foreignAmount * record.exchangeRate - record.localAmount) * 100
  ) / 100;

  return {
    id: record.id,
    depreciationTotal: depreciationSchedule,
    projectedCashFlow: cashFlowProjection,
    fxAdjustment,
  };
}

// TODO: Refatore este endpoint para que o loop de processamento não bloqueie
// o Event Loop. Escolha uma das abordagens:
//   A) Chunking com setImmediate/setTimeout para ceder controle ao event loop
//      a cada N iterações.
//   B) Offloading para Worker Threads (módulo worker_threads do Node.js).
//   C) Delegação a uma fila de background (ex.: BullMQ / resposta 202 Accepted).
//
// Preserve o resultado lógico de computeFinancialMetrics para todos os registros.
router.post('/api/reports/heavy-export', async (req, res) => {
  const { records } = req.body;

  // SUBSTITUA a linha abaixo pela sua implementação não-bloqueante:
  const results = records.map((record) => computeFinancialMetrics(record));

  res.json({ total: results.length, data: results });
});

module.exports = router;
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# routes/reports.py
import asyncio
from fastapi import APIRouter, Body
from typing import Any

router = APIRouter()


def compute_financial_metrics(record: dict) -> dict:
    """
    Aplica cálculos financeiros complexos a um registro contábil.
    NÃO altere esta função — apenas mova/refatore onde ela é chamada.
    """
    useful_life = record.get("useful_life_years", 5)
    sum_of_digits = (useful_life * (useful_life + 1)) / 2
    depreciation_schedule = 0.0
    for y in range(useful_life, 0, -1):
        depreciation_schedule += (y / sum_of_digits) * record["asset_value"]

    cash_flow_projection = record["initial_cash_flow"]
    for _ in range(100):
        cash_flow_projection *= 1 + record["growth_rate"] / 100
        cash_flow_projection -= record["fixed_costs"]

    fx_adjustment = round(
        record["foreign_amount"] * record["exchange_rate"] - record["local_amount"], 2
    )

    return {
        "id": record["id"],
        "depreciation_total": depreciation_schedule,
        "projected_cash_flow": cash_flow_projection,
        "fx_adjustment": fx_adjustment,
    }


# TODO: Refatore este endpoint para que o loop de processamento não bloqueie
# o event loop do asyncio. Escolha uma das abordagens:
#   A) Chunking com asyncio.sleep(0) a cada N iterações para ceder controle.
#   B) Offloading para ProcessPoolExecutor / loop.run_in_executor com multiprocessing.
#   C) Delegação a uma fila de background (ex.: Celery / resposta 202 Accepted).
#
# Preserve o resultado lógico de compute_financial_metrics para todos os registros.
@router.post("/api/reports/heavy-export")
async def heavy_export(records: list[dict] = Body(...)):
    # SUBSTITUA a linha abaixo pela sua implementação não-bloqueante:
    results = [compute_financial_metrics(r) for r in records]

    return {"total": len(results), "data": results}
<!-- /SECTION:template:python -->

<!-- SECTION:solution-outline -->
**Causa raiz — por que o `async` não basta:**

- O Event Loop do Node.js (e do asyncio/Python) é single-threaded. Ele processa I/O de forma não-bloqueante, mas **código síncrono/CPU-bound monopoliza a thread** enquanto estiver rodando.
- `async/await` libera a thread apenas em pontos de `await` (I/O, timers). Um `Array.map()` ou `for` síncrono sem nenhum `await` interno não libera a thread em nenhum momento.
- Durante o processamento de 100.000 registros (~15–30 s), o Event Loop fica travado e incapaz de processar qualquer outro callback — incluindo health checks, autenticação e respostas de I/O.

**Solução A — Chunking com yield ao Event Loop:**

```javascript
// Node.js — setImmediate a cada N iterações
router.post('/api/reports/heavy-export', async (req, res) => {
  const { records } = req.body;
  const CHUNK_SIZE = 500;
  const results = [];

  for (let i = 0; i < records.length; i++) {
    results.push(computeFinancialMetrics(records[i]));

    // A cada CHUNK_SIZE itens, cede o controle ao Event Loop
    if ((i + 1) % CHUNK_SIZE === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  res.json({ total: results.length, data: results });
});
```

```python
# Python asyncio — asyncio.sleep(0) a cada N iterações
@router.post("/api/reports/heavy-export")
async def heavy_export(records: list[dict] = Body(...)):
    CHUNK_SIZE = 500
    results = []

    for i, record in enumerate(records):
        results.append(compute_financial_metrics(record))
        if (i + 1) % CHUNK_SIZE == 0:
            await asyncio.sleep(0)  # cede o controle ao event loop

    return {"total": len(results), "data": results}
```

- **Trade-off:** o tempo total da requisição aumenta (overhead de scheduler por chunk), mas outros requests são processados entre os chunks.

**Solução B — Offloading para Worker Thread / Executor:**

```javascript
// Node.js — worker_threads
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// worker.js (arquivo separado)
if (!isMainThread) {
  const results = workerData.records.map(computeFinancialMetrics);
  parentPort.postMessage(results);
}

// No handler (thread principal)
router.post('/api/reports/heavy-export', async (req, res) => {
  const { records } = req.body;
  const results = await new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { records } });
    worker.on('message', resolve);
    worker.on('error', reject);
  });
  res.json({ total: results.length, data: results });
});
```

```python
# Python — ProcessPoolExecutor (evita GIL)
import asyncio
from concurrent.futures import ProcessPoolExecutor

def _process_all(records):
    return [compute_financial_metrics(r) for r in records]

@router.post("/api/reports/heavy-export")
async def heavy_export(records: list[dict] = Body(...)):
    loop = asyncio.get_event_loop()
    with ProcessPoolExecutor() as executor:
        results = await loop.run_in_executor(executor, _process_all, records)
    return {"total": len(results), "data": results}
```

- **Trade-off:** worker threads exigem serialização de dados (postMessage/pickle), adicionam overhead de criação de processo/thread e limitam o compartilhamento de estado.

**Solução C — Background Job (resposta 202 Accepted):**

```javascript
// Node.js — enfileirar e retornar jobId imediatamente
router.post('/api/reports/heavy-export', async (req, res) => {
  const jobId = await reportQueue.add('heavy-export', { records: req.body.records });
  res.status(202).json({ jobId, status: 'queued' });
});

// Worker separado (ex.: BullMQ worker) processa em background
reportQueue.process('heavy-export', async (job) => {
  return job.data.records.map(computeFinancialMetrics);
});
```

- **Trade-off:** o cliente precisa fazer polling ou receber webhook quando o relatório estiver pronto. Muda o contrato da API de síncrono para assíncrono.

**Pontos obrigatórios na resposta do aluno:**

1. Identificar que `async` não torna o loop CPU-bound não-bloqueante.
2. Explicar que o Event Loop fica monopolizado e não processa outros requests.
3. Implementar corretamente ao menos uma das três abordagens acima.
4. Preservar a lógica de `computeFinancialMetrics` integralmente.
5. Discutir ao menos um trade-off relevante da abordagem escolhida.
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
    "promptAlignment": 4,
    "formatValid": true
  },
  "recommendation": "minor_revision",
  "statusAfterReview": "needs_human_review",
  "mainIssue": "prompt",
  "revisionLevelNeeded": "light",
  "suggestedChangedParts": ["rubric", "prompt", "references"],
  "referencesStatus": "weak"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendacao: minor_revision.

Principais pontos:
- A questao esta tecnicamente correta e alinhada ao eixo bugFix, subtema async_issues, dificuldade advanced e linguagens JavaScript/Python. O bug exige compreensao do Event Loop e, no caso Python, permite discutir GIL quando a solucao usa ProcessPoolExecutor/multiprocessing.
- O problema nao e um simples await esquecido: o enunciado e os templates mostram claramente processamento sincrono massivo em loop CPU-bound sobre muitos registros.
- O solution-outline aceita abordagens adequadas: Worker Threads, multiprocessing/ProcessPoolExecutor, chunking com yield ao Event Loop e filas/background jobs. A restricao a JavaScript/Python foi respeitada; Java nao foi incluido.
- Recomenda-se reforcar na rubrica e no prompt de avaliacao que envolver uma funcao puramente sincronica em Promise.all, sem Worker Threads, chunking/yield ou fila externa, nao resolve bloqueio de CPU no Node.js e deve ser penalizado em fix_viability. A ideia ja esta implicita, mas o criterio de atencao pede essa avaliacao explicitamente.
- Recomenda-se tornar o prompt de avaliacao um pouco mais estrito na diferenca conceitual entre concorrencia I/O-bound e trabalho CPU-bound: async/await e Promise.all podem coordenar I/O concorrente, mas nao tornam calculo sincronico paralelo nem liberam a thread principal por si so.
- As referencias oficiais de Node.js sobre Don't Block the Event Loop, worker_threads e asyncio sao plausiveis e relevantes. A referencia tecnica com url null e generica; recomenda-se remover ou substituir por fonte verificavel, mantendo verificacao humana posterior.
<!-- /REVIEW:comments -->
