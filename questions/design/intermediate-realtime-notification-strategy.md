---
id: intermediate-realtime-notification-strategy
slug: intermediate-realtime-notification-strategy
title: Design e Arquitetura — Estratégia de Notificações em Tempo Real para Edição Colaborativa
axis: architecture
subtheme: architecture_decisions
difficulty: intermediate
type: multi-section
promptTemplate: intermediate-realtime-notification-strategy
supportedLanguages: [none]
tags: [real_time, websocket, sse, trade_off, polling, collaboration]
references:
  - id: ref-1
    title: "Server-Sent Events — Living Standard (WHATWG)"
    type: official_docs
    url: "https://html.spec.whatwg.org/multipage/server-sent-events.html"
    relevance: 5
    confidence: 5
    supports: [statement, solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "The WebSocket Protocol (RFC 6455)"
    type: standard
    url: "https://datatracker.ietf.org/doc/html/rfc6455"
    relevance: 5
    confidence: 5
    supports: [statement, solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Designing Data-Intensive Applications — Martin Kleppmann"
    type: book
    url: null
    relevance: 4
    confidence: 4
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
generationMetrics:
  validFormatSelfCheck: true
  rubricCriteriaCount: 4
  referencesSuggested: true
  plannedDifficulty: intermediate
  expectedType: multi-section
  taxonomyFit: strong
revisionMetrics:
  quality:
    technicalCorrectness: 4
    statementClarity: 5
    rubricAlignment: 5
    difficultyAlignment: 4
  compatibility:
    promptAlignment: 4
    formatValid: true
  recommendationBeforeCorrection: minor_revision
  statusAfterCorrection: accept
  mainIssue: format
  revisionLevel: light
  changedParts: [frontmatter, solution-outline, prompt, references]
  referencesStatus: present
inputConfig:
  type: multi-section
  sections:
    - id: alternativas
      label: "Alternativas consideradas"
      placeholder: "Descreva as abordagens técnicas que você avaliou (polling, SSE, WebSocket, híbrida) e por que cada uma é ou não adequada para este cenário."
    - id: decisao
      label: "Decisão e justificativa"
      placeholder: "Qual abordagem você escolheu? Justifique com base nos requisitos funcionais e não funcionais do problema."
    - id: tradeoffs
      label: "Trade-offs e limitações"
      placeholder: "Quais são as principais desvantagens da solução escolhida? O que foi sacrificado em relação às alternativas descartadas?"
    - id: falhas
      label: "Tolerância a falhas e usuários offline"
      placeholder: "Como a solução lida com quedas de conexão, reconexão automática e entrega de notificações a usuários que estavam offline?"
rubric:
  version: v1
  criteria:
    - id: alternatives_comparison
      name: Comparação entre alternativas
      weight: 0.30
      description: "Apresenta e compara de forma objetiva as quatro abordagens (polling, SSE, WebSocket, híbrida), destacando características técnicas relevantes como direção do canal, suporte a reconexão nativa, overhead de protocolo e maturidade."
    - id: decision_justification
      name: Clareza e justificativa da decisão
      weight: 0.30
      description: "Escolhe uma abordagem clara, inclusive híbrida se bem delimitada, e a justifica explicitamente com base nos RFs (notificação de eventos, suporte a offline) e NFRs (baixa latência percebida, escalabilidade gradual, simplicidade operacional)."
    - id: tradeoffs_awareness
      name: Consciência de trade-offs
      weight: 0.25
      description: "Identifica limitações concretas da solução escolhida (ex.: SSE é unidirecional; WebSocket exige infraestrutura stateful; polling impõe latência e carga desnecessária) e reconhece o que foi sacrificado."
    - id: resilience_strategy
      name: Estratégia de resiliência e offline
      weight: 0.15
      description: "Propõe mecanismo para lidar com desconexões (reconnect automático, backoff, keep-alive) e para entregar notificações perdidas a usuários que retornam (event store, timestamp de última sincronização ou similar)."
---

<!-- SECTION:statement -->
Uma startup está construindo uma **plataforma colaborativa de edição de documentos**. Múltiplos usuários podem abrir e editar o mesmo documento simultaneamente. A equipe precisa notificar os usuários conectados sobre eventos gerados por outros colaboradores — sem precisar sincronizar o conteúdo completo do documento em tempo real.

**Eventos que devem ser notificados:**

- `comentario_criado` — um colaborador adicionou um comentário ao documento
- `usuario_entrou` / `usuario_saiu` — um colaborador abriu ou fechou o documento
- `documento_atualizado` — o documento foi salvo com novas alterações

**Requisitos funcionais (RFs):**

- **RF1:** Usuários ativos no mesmo documento devem receber notificações de eventos relevantes com latência percebida baixa (idealmente < 2 s).
- **RF2:** Não é necessário transmitir o conteúdo completo do documento; apenas o tipo do evento e metadados mínimos (ex.: autor, timestamp, trecho afetado).
- **RF3:** Usuários que estavam offline devem poder recuperar as notificações perdidas ao retornar à sessão.

**Requisitos não funcionais (NFRs):**

- **NFR1:** Baixa latência percebida para usuários ativos no documento.
- **NFR2:** Suportar crescimento gradual de usuários conectados sem redesenho completo da solução.
- **NFR3:** Simplicidade operacional compatível com uma equipe pequena (2–3 desenvolvedores backend).
- **NFR4:** Tolerar quedas temporárias de conexão sem perder eventos importantes para o usuário.

**Restrições:**

- Infraestrutura inicial: servidores de aplicação stateless em nuvem (escaláveis horizontalmente), banco de dados relacional existente.
- Sem restrição de linguagem ou framework de backend, mas preferência por soluções que a equipe consiga operar sem especialistas de infraestrutura.

**Candidatos técnicos a avaliar:**

| Abordagem | Descrição resumida |
|-----------|-------------------|
| **Polling periódico** | Cliente faz requisições HTTP a cada N segundos para verificar novos eventos |
| **Server-Sent Events (SSE)** | Servidor mantém conexão HTTP unidirecional e envia eventos ao cliente |
| **WebSocket** | Canal full-duplex persistente entre cliente e servidor |
| **Híbrida** | Combinação de duas ou mais abordagens acima |

**Tarefa:**

Avalie as alternativas acima e escolha a abordagem mais adequada para este cenário. Sua resposta deve:

1. **Comparar as alternativas** consideradas, apontando por que cada uma é ou não adequada para o problema.
2. **Justificar a decisão** com base nos RFs e NFRs apresentados.
3. **Discutir trade-offs e limitações** da solução escolhida.
4. **Descrever a estratégia básica** para lidar com falhas de conexão e entrega de notificações a usuários offline.

**Não é necessário escrever código nem detalhar o schema do banco de dados. Foque na decisão arquitetural e sua justificativa.**
<!-- /SECTION:statement -->

<!-- SECTION:solution-outline -->
**Essência da solução esperada:**

A resposta deve tomar uma decisão arquitetural clara e defendê-la. A solução não precisa escolher uma tecnologia única obrigatória: **SSE como canal principal**, **WebSocket bem justificado** ou uma **abordagem híbrida** podem ser aceitáveis se estiverem alinhadas aos requisitos e acompanhadas de trade-offs reais. Polling puro tende a ser fraco para o cenário, mas ainda deve ser analisado como alternativa.

### Comparação das alternativas

| Critério | Polling | SSE | WebSocket | Híbrida |
|----------|---------|-----|-----------|---------|
| **Direção** | Cliente → Servidor | Servidor → Cliente | Bidirecional | Depende da combinação |
| **Latência** | Alta (depende do intervalo) | Baixa | Baixa | Baixa |
| **Protocolo** | HTTP padrão | HTTP/1.1+ | WS (upgrade) | HTTP + WS ou HTTP + SSE |
| **Reconexão nativa** | Não | Sim (EventSource API) | Não (requer lógica manual) | Depende |
| **Overhead por cliente** | Baixo (conexão efêmera) | Médio (conexão persistente) | Médio-alto (handshake + estado) | Varia |
| **Infraestrutura stateful** | Não | Sim (conexão aberta) | Sim (socket por cliente) | Parcial |
| **Compatibilidade HTTP/2** | Sim | Sim (multiplexação eficiente) | Não (upgrade obrigatório) | Depende |

**Polling periódico:** normalmente fraco como solução principal. Impõe latência proporcional ao intervalo configurado, gera carga desnecessária no servidor mesmo quando não há eventos, e atende NFR1 apenas com intervalos muito curtos, o que aumenta custo e ruído operacional. Pode ser defensável como fallback simples.

**WebSocket:** tecnicamente viável, especialmente se a plataforma evoluir para colaboração mais interativa. O custo é maior complexidade stateful (gerenciar conexões ativas, balanceamento de carga com sticky sessions ou pub/sub centralizado) e um canal bidirecional que não é estritamente necessário para o escopo atual, onde o servidor só precisa empurrar notificações.

**SSE (Server-Sent Events):** adequado para o cenário. O canal é unidirecional (servidor → cliente), o que é suficiente para notificações de eventos. A API `EventSource` do browser oferece reconexão automática com `Last-Event-ID`, simplificando a estratégia de resiliência. Funciona sobre HTTP padrão (sem upgrade de protocolo), o que facilita o uso atrás de proxies e balanceadores de carga convencionais.

**Híbrida (SSE + polling de fallback):** aceitável e robusta. Usa SSE como canal principal e polling como fallback para ambientes onde SSE não é suportado (ex.: alguns proxies corporativos ou browsers legados). Adiciona complexidade, mas é uma escolha madura.

---

### Decisões arquiteturais defensáveis

#### Opção A — SSE como canal principal

**Justificativa alinhada aos requisitos:**

- **RF1 (latência < 2 s):** SSE entrega eventos no instante em que o servidor os publica — latência percebida equivalente a WebSocket para fluxo unidirecional.
- **RF2 (apenas metadados de evento):** o payload de cada notificação é pequeno (JSON com tipo, autor, timestamp); SSE é ideal para streams de eventos leves.
- **RF3 (usuários offline):** com `Last-Event-ID` e um event store simples no servidor (tabela de eventos com timestamp ou ID sequencial), o cliente reenvia o último ID ao reconectar e recebe os eventos perdidos.
- **NFR1 (baixa latência):** atendido.
- **NFR2 (escalabilidade gradual):** conexões SSE são leves; com HTTP/2, múltiplos streams compartilham o mesmo TCP. Para múltiplas instâncias de backend, um pub/sub leve (ex.: Redis Pub/Sub, Postgres LISTEN/NOTIFY) garante que o evento publicado por qualquer instância chegue a todos os clientes conectados.
- **NFR3 (simplicidade operacional):** SSE dispensa bibliotecas de socket proprietárias; qualquer framework web comum suporta streaming HTTP. Redis Pub/Sub para fan-out é operacionalmente simples.
- **NFR4 (tolerância a falhas):** `EventSource` reconecta automaticamente com backoff padrão; `Last-Event-ID` garante entrega de eventos perdidos.

#### Opção B — WebSocket

Também pode ser uma boa resposta se o aluno justificar que a plataforma tende a evoluir para colaboração mais rica, presença ativa ou edição operacional bidirecional. Deve reconhecer maior complexidade operacional: conexões persistentes stateful, fan-out entre instâncias, balanceamento adequado, autenticação da conexão e lógica manual de reconexão/replay.

#### Opção C — Híbrida

Uma decisão híbrida defensável pode usar SSE ou WebSocket como canal principal e polling para recuperação/fallback. A resposta deve delimitar quando cada mecanismo entra em ação, evitando apenas listar tecnologias sem critério.

---

### Trade-offs e limitações

1. **Unidirecionalidade do SSE:** se no futuro o cliente precisar enviar dados ao servidor via o mesmo canal (ex.: colaboração em tempo real com CRDT), será necessário adicionar outro mecanismo (HTTP POST ou WebSocket). Para o escopo atual, é aceitável.
2. **Conexões persistentes:** cada usuário ativo mantém uma conexão aberta ao servidor. Com muitos usuários simultâneos, isso exige atenção ao limite de conexões e ao modelo de concorrência do framework escolhido (ex.: event loop em Node.js lida bem; servidores thread-por-conexão escalam pior).
3. **Proxies e timeouts:** alguns proxies corporativos e CDNs encerram conexões ociosas. É necessário configurar keep-alive (`: ping` periódico no stream) e ajustar timeouts.
4. **Complexidade do WebSocket:** se escolhido, a solução deve tratar reconexão manual, heartbeats, fan-out e escalabilidade de conexões.
5. **Event store mínimo obrigatório:** a garantia de entrega offline requer que o servidor armazene eventos por um período (ex.: 24–72 h). Introduz um componente adicional de persistência, mas é simples de implementar com uma tabela de eventos.

---

### Estratégia de tolerância a falhas e usuários offline

**Reconexão:**
- Com SSE, o cliente pode usar `EventSource`, que reconecta automaticamente; o servidor deve enviar `id:` em cada evento para permitir replay via `Last-Event-ID`.
- Com WebSocket, o cliente precisa implementar reconnect com backoff, heartbeat/ping e envio do último `event_id` recebido ao reabrir a conexão.

**Event store para offline:**
- O backend persiste cada evento de notificação em uma tabela (`document_events`) com ID sequencial, `document_id`, tipo, payload e `created_at`.
- Ao reconectar (ou ao abrir o documento após período offline), o cliente informa o último `event_id` recebido; o servidor replica os eventos perdidos antes de retomar o stream ao vivo.
- Retenção sugerida: 48–72 h (configurável), após o que eventos antigos podem ser purgados.

**Fan-out entre instâncias:**
- Ao receber um evento (ex.: salvar documento), a instância que processou a escrita publica na fila de pub/sub (Redis Pub/Sub ou Postgres LISTEN/NOTIFY).
- Todas as instâncias de backend assinam o canal correspondente e entregam o evento SSE aos clientes conectados nelas.
<!-- /SECTION:solution-outline -->

<!-- REVIEW:metrics -->
{
  "quality": {
    "technicalCorrectness": 4,
    "statementClarity": 5,
    "rubricAlignment": 5,
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
  "suggestedChangedParts": ["solution-outline", "prompt"],
  "referencesStatus": "present"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendação: minor_revision.

Principais pontos:
- A questão pertence adequadamente a `architecture/architecture_decisions`: o foco é escolher e justificar uma estratégia arquitetural entre alternativas explícitas, não desenhar um sistema completo.
- A dificuldade está adequada para `intermediate`, pois exige comparação técnica, decisão justificada por RFs/NFRs e discussão objetiva de trade-offs sem exigir modelagem completa de infraestrutura.
- O formato `multi-section` está válido, com quatro seções textuais coerentes, sem template de código, sem `defaultLanguage` e com `supportedLanguages: [none]` apropriado para questão sem código.
- O enunciado exige decisão arquitetural clara e inclui alternativas suficientes: polling, SSE, WebSocket e abordagem híbrida.
- A rubrica está bem alinhada ao objetivo: avalia comparação, justificativa da decisão, trade-offs e resiliência/offline, em vez de premiar apenas citação de tecnologias.
- O `solution-outline` permite mais de uma resposta defensável, especialmente SSE, WebSocket ou solução híbrida. Recomenda-se apenas revisar o detalhe técnico que sugere incompatibilidade absoluta de WebSocket com HTTP/2, pois isso pode ser tratado de forma mais conservadora como limitação prática/comum, não impossibilidade universal.
- O prompt de avaliação segue o padrão real de `prompts/` e usa placeholders compatíveis com as seções (`alternativas`, `decisao`, `tradeoffs`, `falhas`). Os ids e pesos reproduzem a rubrica corretamente.
- Recomenda-se alinhar uma pequena tensão no prompt: a rubrica pede comparar as quatro alternativas, enquanto as instruções aceitam "pelo menos três"; isso pode tornar a correção mais leniente que a rubrica.
- Também recomenda-se ajustar a instrução sobre WebSocket para não dizer que a ausência de reconhecimento do canal bidirecional desnecessário nunca deve ser penalizada; melhor orientar que isso não invalida a decisão, mas pode afetar a avaliação de trade-offs quando ausente.
- As referências são plausíveis, relevantes e permanecem corretamente como `suggested_not_verified`.
<!-- /REVIEW:comments -->
