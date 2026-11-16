---
id: advanced-url-shortener-architecture
slug: advanced-url-shortener-architecture
title: Design e Arquitetura — Encurtador de URLs com Estatísticas Básicas
axis: architecture
subtheme: system_design
difficulty: advanced
promptTemplate: advanced-url-shortener-architecture
supportedLanguages: [none]
tags: [caching, trade_off, eventual_consistency]
inputConfig:
  type: multi-section
  sections:
    - id: componentes
      label: "Componentes principais"
      placeholder: "Liste os módulos centrais e suas responsabilidades (API, banco, cache, etc.)."
    - id: fluxo
      label: "Fluxo e interações"
      placeholder: "Descreva o fluxo principal: criar link, armazenar, redirecionar, contar cliques."
    - id: justificativa
      label: "Justificativa e trade-offs"
      placeholder: "Explique como a arquitetura atende aos NFRs (latência, disponibilidade, custo) e cite pelo menos um trade-off."
rubric:
  version: v1
  criteria:
    - id: clarity_components
      name: Clareza dos componentes e interações
      weight: 0.30
      description: Identifica API, persistência, cache e caminho de leitura/redirect.
    - id: alignment_nfr
      name: Alinhamento aos NFRs
      weight: 0.30
      description: Argumenta latência, disponibilidade e simplicidade de operação.
    - id: tradeoffs
      name: Análise de trade-offs
      weight: 0.25
      description: Reconhece limitações (contagem eventual, colisões, etc.) e propõe mitigação simples.
    - id: technical_precision
      name: Precisão técnica e vocabulário
      weight: 0.15
      description: Usa termos adequados (cache, TTL, consistência, disponibilidade) sem contradições.
---

<!-- SECTION:statement -->
Uma startup quer lançar um **encurtador de URLs** para criadores de conteúdo. O serviço deve permitir encurtar links e acompanhar métricas simples.

**Requisitos funcionais (RFs):**
- **RF1:** Criar um link curto a partir de uma URL longa; opcionalmente aceitar um **alias** customizado (ex.: `meuevento` → `https://sho.rt/meuevento`).
- **RF2:** Redirecionar **rapidamente** do link curto para a URL original.
- **RF3:** Registrar **contagem de cliques** por link (apenas total; sem geolocalização).

**Requisitos não funcionais (NFRs):**
- **NFR1: Baixa latência no redirecionamento** (p95 < 50 ms no backend).
- **NFR2: Alta disponibilidade de leitura** (redirecionar mesmo sob picos).
- **NFR3: Custo/operacionalidade**: equipe pequena, preferir solução simples que permita crescer sem reescrever tudo.

**Tarefa:**
Proponha uma **arquitetura de alto nível** e **justifique** suas escolhas considerando os NFRs.  
Descreva:
1. **Componentes principais** e **responsabilidades** (API, armazenamento, cache, etc.).
2. **Como interagem** (fluxo: criar link → armazenar → redirecionar → contar clique).
3. **Justificativa:** por que essa arquitetura atende os NFRs; cite **pelo menos um trade-off** da sua abordagem.
<!-- /SECTION:statement -->

<!-- SECTION:solution-outline -->
**Essência da solução esperada**

### Abordagem A — Monólito simples com cache em memória
- **Componentes:** API monolítica (CRUD de links + redirect), banco relacional (Postgres), cache LRU em memória para aliases populares.
- **Fluxo:** criação → gravação no DB → redirect lê cache (ou DB) → buffer de contagem em memória, flush periódico.
- **Atendimento aos NFRs:** latência via cache local, simplicidade operacional, baixo custo.
- **Trade-offs:** cache por processo (menos efetivo em múltiplas instâncias), contagem eventual mitigada por flush assíncrono.

### Abordagem B — Monólito com cache externo (Redis)
- **Componentes:** API monolítica, Redis (map alias→URL + contador `INCR`), banco relacional para persistência.
- **Fluxo:** criação salva em DB e Redis; redirect resolve via Redis; contadores persistidos periodicamente.
- **Atendimento aos NFRs:** baixa latência via Redis, alta disponibilidade de leitura, simplicidade de operação.
- **Trade-offs:** sincronização Redis↔DB, perda eventual de cliques recentes mitigada com flush curto (10s).

**Resumo:** O aluno pode escolher A ou B, desde que justifique como atende NFRs e apresente trade-offs coerentes.
<!-- /SECTION:solution-outline -->
