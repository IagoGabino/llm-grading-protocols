---
id: intermediate-job-queue-architecture
slug: intermediate-job-queue-architecture
title: Design e Arquitetura — Sistema de Processamento Assíncrono com Filas
axis: architecture
subtheme: system_design
difficulty: intermediate
promptTemplate: intermediate-job-queue-architecture
supportedLanguages: [none]
tags: [queue, trade_off]
inputConfig:
  type: multi-section
  sections:
    - id: componentes
      label: "Componentes e responsabilidades"
      placeholder: "Descreva os componentes principais (API, fila, workers, storage) e suas responsabilidades."
    - id: fluxo
      label: "Fluxo de processamento"
      placeholder: "Explique o fluxo desde o enqueue até o processamento e atualização de status."
    - id: escalabilidade
      label: "Estratégia de escalabilidade"
      placeholder: "Como o sistema escala para lidar com picos de carga? Como jobs são distribuídos entre workers?"
    - id: tradeoffs
      label: "Trade-offs e limitações"
      placeholder: "Identifique pelo menos 2 trade-offs da arquitetura proposta e possíveis melhorias."
rubric:
  version: v1
  criteria:
    - id: components_clarity
      name: Clareza dos componentes
      weight: 0.25
      description: Identifica API/producer, fila de mensagens, workers/consumers, storage de jobs e suas responsabilidades.
    - id: processing_flow
      name: Fluxo de processamento
      weight: 0.25
      description: Descreve corretamente enqueue → dequeue → processamento → atualização de status, incluindo tratamento de falhas.
    - id: scalability_strategy
      name: Estratégia de escalabilidade
      weight: 0.25
      description: Propõe escalabilidade horizontal de workers, distribuição de carga via fila, e considera worker pools ou auto-scaling.
    - id: tradeoffs_awareness
      name: Consciência de trade-offs
      weight: 0.15
      description: Reconhece limitações (duplicação de jobs, perda de mensagens, latência eventual) e propõe mitigações.
    - id: technical_depth
      name: Profundidade técnica
      weight: 0.10
      description: Usa vocabulário apropriado (at-least-once, idempotência, dead-letter queue, retry policy) e demonstra entendimento de sistemas distribuídos.
---

<!-- SECTION:statement -->
Uma plataforma de e-commerce precisa processar tarefas assíncronas de longa duração: geração de relatórios, envio de emails em massa, processamento de imagens de produtos e sincronização com sistemas externos. Atualmente, essas tarefas são processadas de forma síncrona na mesma thread da requisição HTTP, causando timeouts e má experiência do usuário.

**Requisitos funcionais (RFs):**
- **RF1:** Permitir enfileirar jobs via API REST (`POST /jobs`) com tipo, payload e prioridade
- **RF2:** Processar jobs de forma assíncrona e paralela (múltiplos workers)
- **RF3:** Permitir consulta de status do job (`GET /jobs/:id`) retornando: `pending`, `processing`, `completed`, `failed`
- **RF4:** Suportar retry automático de jobs que falharem (máximo 3 tentativas)
- **RF5:** Jobs com prioridade `high` devem ser processados antes de jobs `normal`

**Requisitos não funcionais (NFRs):**
- **NFR1: Escalabilidade horizontal:** adicionar workers deve aumentar throughput de processamento
- **NFR2: Resiliência:** falha de um worker não deve bloquear outros jobs nem perder jobs em processamento
- **NFR3: Observabilidade:** sistema deve permitir monitorar taxa de processamento, jobs em cada estado e tempo médio de execução
- **NFR4: Simplicidade operacional:** preferir soluções que equipe pequena consiga operar (evitar complexidade excessiva)

**Restrições:**
- Infraestrutura inicial: 1 servidor de aplicação + 1 servidor de banco de dados + 1 servidor de fila
- Budget: preferir tecnologias open-source (Redis, RabbitMQ, PostgreSQL, etc.)
- Equipe: 2 desenvolvedores backend, sem especialistas em infraestrutura

**Tarefa:**
Projete uma **arquitetura de alto nível** para este sistema. Descreva:

1. **Componentes e responsabilidades:** Quais são os componentes principais? O que cada um faz?

2. **Fluxo de processamento:** Como um job flui desde a criação até a conclusão? Inclua tratamento de falhas e retries.

3. **Estratégia de escalabilidade:** Como o sistema escala para lidar com picos de carga (ex: Black Friday)? Como jobs são distribuídos entre workers?

4. **Trade-offs e limitações:** Identifique pelo menos 2 trade-offs da sua arquitetura e como você os mitigaria.

<!-- /SECTION:statement -->

<!-- SECTION:solution-outline -->
**Essência da solução esperada:**

### Abordagem A — Fila Redis + Workers Node.js

**Componentes:**
1. **API REST (Producer):** recebe jobs via POST, valida, persiste no DB, publica na fila Redis
2. **Redis (Message Broker):** fila de mensagens com suporte a prioridade (sorted sets ou listas múltiplas)
3. **Workers (Consumers):** processos separados que consomem jobs da fila, executam processamento e atualizam status no DB
4. **PostgreSQL:** armazena metadata de jobs (id, tipo, status, resultado, timestamps, tentativas)
5. **Dead Letter Queue (DLQ):** fila secundária para jobs que excederam retries

**Fluxo de processamento:**

```
Cliente → POST /jobs → API valida → Salva no DB (status: pending) 
                                   ↓
                          Publica no Redis (fila por prioridade)
                                   ↓
Worker 1,2,3 → BLPOP/ZPOP → Job → Atualiza status: processing
                                   ↓
                          Executa processamento
                          ↓                    ↓
                    Sucesso                 Falha
                      ↓                        ↓
            Status: completed         Incrementa tentativas
            Salva resultado           ↓                    ↓
                                tentativas < 3      tentativas >= 3
                                    ↓                       ↓
                            Re-enqueue          Move para DLQ
                            (backoff exp.)      Status: failed
```

**Escalabilidade:**
- **Horizontal:** adicionar workers aumenta throughput proporcionalmente (até limite da fila)
- **Distribuição:** Redis garante que cada mensagem é consumida por apenas 1 worker (BLPOP atômico)
- **Auto-scaling:** monitorar tamanho da fila e escalar workers automaticamente (Kubernetes HPA ou similar)
- **Prioridade:** usar duas filas separadas (`jobs:high`, `jobs:normal`) ou sorted set com score baseado em prioridade

**Trade-offs e mitigações:**

1. **At-least-once delivery (possível duplicação):**
   - **Trade-off:** worker pode crashar após processar mas antes de ACK → job reprocessado
   - **Mitigação:** implementar processamento idempotente (job handlers devem ser idempotentes ou usar dedupe por job ID)

2. **Perda de jobs em caso de crash do Redis:**
   - **Trade-off:** Redis em memória pode perder jobs se crashar
   - **Mitigação:** habilitar AOF (Append-Only File) ou usar Redis Cluster, ou considerar RabbitMQ com persistência

3. **Latência eventual no status:**
   - **Trade-off:** status no DB pode estar desatualizado por milissegundos
   - **Mitigação:** aceitável para este caso de uso; se crítico, usar pub/sub para notificações em tempo real

4. **Single point of failure (Redis único):**
   - **Trade-off:** se Redis cair, sistema para
   - **Mitigação:** Redis Sentinel para HA ou migrar para RabbitMQ com clustering

**Observabilidade:**
- Métricas: tamanho da fila, taxa de processamento (jobs/s), tempo médio de execução, taxa de erro
- Logs estruturados por job ID
- Dashboard: Grafana + Prometheus

---

### Abordagem B — RabbitMQ + Workers + PostgreSQL

**Diferenças principais:**
- **RabbitMQ** em vez de Redis: melhor garantias de entrega (ack/nack), DLQ nativo, suporte a prioridade
- **Fluxo similar** mas com prefetch para limitar jobs por worker
- **Trade-off:** RabbitMQ mais complexo de operar que Redis, mas mais robusto para casos críticos

**Escolha entre A e B:**
- **Caso de uso atual (relatórios, emails):** Abordagem A (Redis) suficiente, mais simples
- **Caso crítico (transações financeiras):** Abordagem B (RabbitMQ) para melhor garantia de entrega

---

### Pontos essenciais para pontuação máxima:

1. **Separação clara:** producer (API) vs. consumer (workers) vs. broker (fila) vs. storage (DB)
2. **Fluxo de retry:** incrementar tentativas, backoff exponencial, DLQ após limite
3. **Escalabilidade:** workers horizontais + fila como distribuidor de carga
4. **Idempotência:** reconhecer problema de duplicação e propor handlers idempotentes
5. **Vocabulário técnico:** at-least-once, idempotência, backoff, DLQ, ACK, prefetch
6. **Alternativas válidas:** Bull (biblioteca Node.js sobre Redis), BullMQ, Celery (Python), Sidekiq (Ruby)

**Solução NÃO aceita:**
- Polling do banco (ineficiente, não escala)
- Cron jobs (não é fila de mensagens)
- Fila em memória (perde jobs em restart)
<!-- /SECTION:solution-outline -->
