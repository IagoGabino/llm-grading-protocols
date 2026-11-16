---
id: intermediate-transactional-email-pipeline
slug: intermediate-transactional-email-pipeline
title: "Design e Arquitetura — Pipeline Assíncrono de E-mails Transacionais"
axis: architecture
subtheme: system_design
difficulty: intermediate
promptTemplate: intermediate-transactional-email-pipeline
supportedLanguages: [none]
tags: [async, outbox_pattern, transactional_email, reliability, retry, observability]
references:
  - id: ref-1
    title: "Designing Data-Intensive Applications — Martin Kleppmann"
    type: book
    url: null
    relevance: 5
    confidence: 4
    supports: [statement, solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Pattern — Transactional Outbox (microservices.io)"
    type: technical_blog
    url: "https://microservices.io/patterns/data/transactional-outbox.html"
    relevance: 5
    confidence: 4
    supports: [statement, solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Release It! Design and Deploy Production-Ready Software — Michael T. Nygard"
    type: book
    url: null
    relevance: 4
    confidence: 3
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "AWS Well-Architected Framework — Reliability Pillar"
    type: official_docs
    url: "https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html"
    relevance: 3
    confidence: 4
    supports: [solution-outline]
    verificationStatus: suggested_not_verified
generationMetrics:
  validFormatSelfCheck: true
  rubricCriteriaCount: 4
  referencesSuggested: true
  plannedDifficulty: intermediate
  expectedType: multi-section
  taxonomyFit: strong
inputConfig:
  type: multi-section
  sections:
    - id: componentes
      label: "Componentes e responsabilidades"
      placeholder: "Descreva os componentes principais da arquitetura proposta (ex.: API, tabela de solicitações, worker, provedor externo) e o que cada um é responsável por fazer."
    - id: fluxo
      label: "Fluxo de envio assíncrono"
      placeholder: "Explique o fluxo completo: desde a ação do usuário que dispara o e-mail até a confirmação de envio pelo provedor externo. Inclua como o status é atualizado."
    - id: falhas
      label: "Tratamento de falhas e retry"
      placeholder: "Descreva como o sistema lida com falhas transitórias do provedor (retry, backoff), falhas definitivas (dead-letter / reprocessamento manual) e como evitar envio duplicado."
    - id: tradeoffs
      label: "Trade-offs da solução"
      placeholder: "Identifique pelo menos dois trade-offs da arquitetura proposta. Considere aspectos como consistência eventual, complexidade operacional, duplicidade e observabilidade."
rubric:
  version: v1
  criteria:
    - id: components_and_responsibilities
      name: Componentes e responsabilidades
      weight: 0.30
      description: "Identifica corretamente os componentes essenciais — API principal, tabela/outbox de solicitações de e-mail, worker assíncrono e provedor externo — e descreve com clareza a responsabilidade de cada um. A operação principal persiste a solicitação de e-mail atomicamente antes de retornar ao cliente."
    - id: async_flow
      name: Fluxo assíncrono e rastreabilidade
      weight: 0.30
      description: "Descreve o fluxo end-to-end: ação do usuário → persistência da solicitação com status inicial (pending) → worker lê e envia ao provedor → atualiza status (sent/failed). Menciona que a latência do provedor não impacta o fluxo principal da aplicação. Inclui rastreabilidade mínima (status consultável pelo suporte)."
    - id: failure_handling
      name: Tratamento de falhas e deduplicação"
      weight: 0.25
      description: "Propõe retry para falhas transitórias com limite de tentativas e backoff, mecanismo para tratar falhas definitivas (ex.: dead-letter, fila de inspeção ou flag no registro) e estratégia mínima para evitar duplicidade no envio (ex.: idempotency key, checagem de status antes do envio)."
    - id: tradeoffs_awareness
      name: Consciência de trade-offs
      weight: 0.15
      description: "Reconhece pelo menos dois trade-offs reais da solução — como consistência eventual entre operação principal e envio do e-mail, risco residual de duplicidade em cenários de retry, complexidade operacional adicional do worker, ou observabilidade necessária do pipeline de envio."
---

<!-- SECTION:statement -->
Uma plataforma SaaS envia e-mails transacionais importantes após ações do usuário: confirmação de cadastro, redefinição de senha, convite para membro da equipe e aviso de alteração sensível na conta.

Hoje, o backend chama o provedor externo de e-mail diretamente dentro da requisição HTTP. Quando o provedor demora para responder ou retorna erro, o usuário recebe uma resposta de falha mesmo quando a operação principal — por exemplo, criar o convite — já foi persistida com sucesso no banco de dados. Além disso, o suporte interno não consegue saber se um e-mail específico foi enviado, está pendente ou falhou.

**Requisitos funcionais (RFs):**

- **RF1:** A operação principal da aplicação (ex.: criar convite, redefinir senha) não deve depender da disponibilidade imediata do provedor de e-mail para retornar sucesso ao cliente.
- **RF2:** O sistema deve registrar cada solicitação de envio com destinatário, tipo de e-mail, payload mínimo e status atual.
- **RF3:** Deve ser possível consultar se um e-mail está `pending`, `sent` ou `failed`.
- **RF4:** O sistema deve tentar reenvio automático para falhas transitórias do provedor.
- **RF5:** E-mails que falharem definitivamente devem ficar disponíveis para inspeção ou reprocessamento manual pela equipe de suporte.
- **RF6:** A solução deve evitar envio duplicado sempre que possível.

**Requisitos não funcionais (NFRs):**

- **NFR1:** Baixa latência no fluxo principal da aplicação — a requisição do usuário não deve aguardar o provedor de e-mail.
- **NFR2:** Confiabilidade razoável para e-mails importantes: o pipeline deve tentar entregar mesmo após falhas temporárias.
- **NFR3:** Simplicidade operacional compatível com uma equipe pequena (2–3 desenvolvedores backend sem especialistas de infraestrutura).
- **NFR4:** Observabilidade mínima do pipeline: a equipe de suporte deve conseguir inspecionar o status de envio de qualquer e-mail.
- **NFR5:** Baixo acoplamento ao provedor externo: trocar de provedor não deve exigir mudanças no fluxo principal da aplicação.

**Restrições:**

- Infraestrutura atual: banco de dados relacional (ex.: PostgreSQL) e um servidor de aplicação. A equipe pode introduzir um componente adicional simples se necessário.
- Sem Kafka, microsserviços ou infraestrutura distribuída complexa.
- A solução deve poder ser operada por uma equipe pequena sem ferramentas de orquestração avançadas.

**Tarefa:**

Projete uma **arquitetura de alto nível** para o pipeline de e-mails transacionais. Sua resposta deve cobrir:

1. **Componentes e responsabilidades:** quais são os componentes principais e o que cada um faz?
2. **Fluxo de envio assíncrono:** como um e-mail é solicitado, enfileirado e enviado? Como o status é atualizado?
3. **Tratamento de falhas e retry:** como o sistema lida com falhas transitórias, definitivas e com o risco de duplicidade?
4. **Trade-offs da solução:** quais são as principais desvantagens ou limitações da arquitetura proposta?

**Não é necessário escrever código, definir schema completo do banco ou escolher um provedor específico de e-mail. Foque na arquitetura de alto nível e nas decisões de design.**
<!-- /SECTION:statement -->

<!-- SECTION:solution-outline -->
**Essência da solução esperada:**

A solução deve desacoplar o envio do e-mail do fluxo principal da requisição HTTP, usando persistência como ponto de coordenação e um worker assíncrono como executor. Duas abordagens são aceitáveis.

---

### Abordagem A — Outbox Pattern (tabela de e-mails pendentes + worker)

**Componentes:**

1. **API principal:** processa a operação do usuário (ex.: criar convite) e, na mesma transação de banco de dados, insere um registro na tabela de e-mails com status `pending`. Retorna sucesso ao cliente sem chamar o provedor.
2. **Tabela de solicitações de e-mail (outbox):** persiste destinatário, tipo, payload mínimo (ex.: nome, link), status (`pending` / `sent` / `failed`), contagem de tentativas e timestamps. É a fonte de verdade do pipeline.
3. **Worker assíncrono:** processo separado (pode ser um cron leve, loop com sleep ou job scheduler simples) que consulta registros `pending`, chama o provedor de e-mail, e atualiza o status para `sent` ou incrementa a contagem de tentativas em caso de falha.
4. **Provedor externo de e-mail:** serviço de terceiros que efetua o envio (ex.: SendGrid, Mailgun, SES). O worker é o único componente que interage com ele.

**Fluxo de envio:**

```
Usuário → POST /invites
         → API cria convite + insere email_requests (pending) — transação atômica
         → retorna 201 Created ao usuário

Worker (loop / cron a cada N segundos):
  → SELECT * FROM email_requests WHERE status = 'pending' AND attempts < max_attempts
  → Para cada registro:
      → Chama provedor de e-mail
      ↓ Sucesso             ↓ Falha transitória         ↓ Falha definitiva (attempts >= max)
      → status = 'sent'     → attempts++, retry_at = now + backoff   → status = 'failed'
      → sent_at = now       → status = 'pending' (agendado)           → disponível para suporte
```

**Tratamento de falhas e deduplicação:**

- **Retry com backoff exponencial:** o worker aguarda intervalos crescentes entre tentativas (ex.: 1 min, 5 min, 15 min).
- **Limite de tentativas:** após N falhas (ex.: 3–5), o registro é marcado como `failed` e permanece na tabela para inspeção ou reprocessamento manual.
- **Deduplicação:** antes de chamar o provedor, o worker verifica se o status ainda é `pending`. Se o worker crashar após enviar mas antes de atualizar o status, poderá tentar novamente (at-least-once). Mitigação: usar idempotency key no provedor (campo `idempotency_key` no registro), que evita que o provedor entregue o mesmo e-mail duas vezes mesmo se chamado mais de uma vez com a mesma chave.

**Observabilidade:**

- A tabela `email_requests` funciona como log de auditoria nativo: suporte pode consultar qualquer e-mail por usuário, tipo ou status.
- Métricas simples: contagem de registros por status, taxa de falha, tempo médio entre `created_at` e `sent_at`.

---

### Abordagem B — Fila leve (ex.: Redis, BullMQ, pg-boss) + worker consumidor

Alternativa válida onde, ao invés de ler a tabela diretamente, a API enfileira uma mensagem em um sistema de fila. O worker consome a fila, chama o provedor e persiste o resultado na tabela de status.

**Diferenças principais:**
- Adiciona um componente de fila, o que melhora o throughput em volumes maiores, mas aumenta a complexidade operacional.
- A tabela de status permanece necessária para rastreabilidade (a fila sozinha não garante histórico consultável).
- Para a escala descrita (equipe pequena, volume moderado), a Abordagem A é mais simples e suficiente.

---

### Trade-offs esperados (respostas fortes identificam ao menos dois):

1. **Consistência eventual:** o e-mail não é enviado imediatamente. O usuário recebe a confirmação da operação principal, mas o e-mail pode demorar segundos ou minutos para chegar. Aceitável para o contexto, mas deve ser comunicado ao time de produto.
2. **Risco residual de duplicidade (at-least-once):** se o worker falhar após enviar mas antes de confirmar, o e-mail pode ser reenviado. Mitigado com idempotency key no provedor.
3. **Complexidade operacional adicional:** o worker é um processo adicional a monitorar, reiniciar e versionar. Para equipe pequena, isso tem custo real.
4. **Observabilidade do pipeline:** sem monitoramento ativo, a equipe pode não perceber acúmulo de falhas. Requer pelo menos alertas sobre registros `failed` ou com muitas tentativas.

---

### Pontos essenciais para pontuação máxima:

1. Separação clara entre fluxo principal (API) e envio assíncrono (worker).
2. Persistência atômica da solicitação de e-mail junto com a operação principal.
3. Status rastreável (`pending` / `sent` / `failed`) consultável pelo suporte.
4. Retry com limite e estratégia para falhas definitivas.
5. Ao menos uma estratégia para reduzir duplicidade (idempotency key ou checagem de status).
6. Dois ou mais trade-offs reais da solução, não apenas lista de vantagens.

**Respostas NÃO aceitas:**
- Chamar o provedor de e-mail de forma síncrona na requisição HTTP (não resolve o problema).
- Apenas mencionar "usar uma fila" sem descrever componentes, fluxo e tratamento de falhas.
- Ignorar a rastreabilidade de status ou o reprocessamento de falhas definitivas.
<!-- /SECTION:solution-outline -->

<!-- REVIEW:metrics -->
{
  "quality": {
    "technicalCorrectness": 5,
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
  "mainIssue": "rubric",
  "revisionLevelNeeded": "light",
  "suggestedChangedParts": ["rubric"],
  "referencesStatus": "present"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendacao: minor_revision.

Principais pontos:
- A questao esta bem alinhada a architecture/system_design: o cenario e concreto, cotidiano e centrado no desacoplamento entre fluxo principal da aplicacao, persistencia da solicitacao, worker assincrono, provedor externo e rastreabilidade de status.
- A dificuldade intermediate esta adequada: exige desenho de fluxo, tratamento de falhas, deduplicacao e trade-offs, sem pedir infraestrutura pesada, Kafka, microsservicos ou implementacao de provider/template HTML.
- O formato multi-section esta valido, sem templates de codigo e sem defaultLanguage; supportedLanguages [none] esta adequado para uma questao sem codigo.
- Os RFs, NFRs, secoes de resposta, solution-outline e prompt de avaliacao sustentam a solucao esperada com API principal, outbox/tabela de envio, worker, provider, status, retry, falhas definitivas e trade-offs. O prompt usa placeholders compativeis com as quatro secoes e reproduz corretamente os ids e pesos da rubrica.
- Ajuste leve recomendado: remover a aspa excedente no nome do criterio "Tratamento de falhas e deduplicacao"; isso nao compromete a avaliacao, mas deve ser corrigido na revisao humana.
- As referencias estao presentes, plausiveis e relevantes, mantendo verificationStatus como suggested_not_verified.
<!-- /REVIEW:comments -->
