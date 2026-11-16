---
id: easy-meeting-room-booking-system
slug: easy-meeting-room-booking-system
title: "Design e Arquitetura — Sistema de Reserva de Salas de Reunião"
axis: architecture
subtheme: system_design
difficulty: easy
promptTemplate: easy-meeting-room-booking-system
supportedLanguages: [none]
tags: [system_design, high_level_architecture, conflict_prevention, monolith, corporate_internal]
references:
  - id: ref-1
    title: "Fundamentals of Software Architecture — Mark Richards, Neal Ford"
    type: book
    url: null
    relevance: 4
    confidence: 4
    supports: [statement, solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Designing Data-Intensive Applications — Martin Kleppmann"
    type: book
    url: null
    relevance: 4
    confidence: 4
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "PostgreSQL Documentation — Locking and Transactions"
    type: official_docs
    url: "https://www.postgresql.org/docs/current/explicit-locking.html"
    relevance: 3
    confidence: 5
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
generationMetrics:
  validFormatSelfCheck: true
  rubricCriteriaCount: 4
  referencesSuggested: true
  plannedDifficulty: easy
  expectedType: multi-section
  taxonomyFit: strong
inputConfig:
  type: multi-section
  sections:
    - id: componentes
      label: "Componentes e responsabilidades"
      placeholder: "Identifique os componentes principais da arquitetura (ex.: frontend, backend/API, banco de dados, autenticação) e descreva a responsabilidade de cada um."
    - id: fluxo
      label: "Fluxo de consulta e criação de reserva"
      placeholder: "Descreva o fluxo básico de dados para as operações de consultar disponibilidade de salas e criar uma nova reserva, desde a ação do usuário até a persistência no banco."
    - id: conflitos
      label: "Estratégia para evitar conflitos de horário"
      placeholder: "Como o sistema garante que duas reservas não ocupem a mesma sala no mesmo intervalo de tempo? Descreva a estratégia adotada."
    - id: tradeoffs
      label: "Trade-offs e limitações"
      placeholder: "Quais são as principais limitações da solução proposta? O que foi sacrificado ou simplificado em relação a requisitos mais avançados?"
rubric:
  version: v1
  criteria:
    - id: components_and_responsibilities
      name: Componentes e responsabilidades
      weight: 0.30
      description: "Identifica os componentes principais (frontend, backend/API, banco de dados, autenticação) e descreve a responsabilidade de cada um de forma coerente com os requisitos do problema."
    - id: data_flow
      name: Fluxo de dados
      weight: 0.30
      description: "Descreve o fluxo básico de consulta de disponibilidade e criação de reserva de forma clara e tecnicamente plausível, cobrindo desde a interação do usuário até a persistência dos dados."
    - id: conflict_prevention
      name: Estratégia de prevenção de conflitos
      weight: 0.25
      description: "Propõe mecanismo concreto para evitar reservas conflitantes (ex.: verificação de sobreposição antes de inserção, uso de transação com lock, constraint no banco), compatível com o nível easy e sem exigir consistência eventual avançada."
    - id: tradeoffs_awareness
      name: Consciência de trade-offs
      weight: 0.15
      description: "Reconhece pelo menos dois trade-offs ou limitações da solução proposta (ex.: escalabilidade limitada de um monólito, lock de banco em alta concorrência, ausência de notificações em tempo real) sem exigir soluções avançadas."
---

<!-- SECTION:statement -->
Uma empresa de médio porte quer construir um **sistema interno de reserva de salas de reunião**. Funcionários autenticados devem conseguir visualizar a disponibilidade de salas, criar reservas, cancelar reservas e o sistema deve impedir conflitos de horário. Administradores podem cadastrar e desativar salas.

A equipe de desenvolvimento é pequena (2–3 pessoas) e o sistema será usado por até 300 funcionários internos. Não há exigência de escala massiva nem de recursos em tempo real.

**Requisitos funcionais (RFs):**

- **RF1:** Funcionários autenticados podem listar salas disponíveis filtrando por data e intervalo de horário.
- **RF2:** Funcionários podem criar uma reserva informando sala, data, horário de início, horário de fim e título da reunião.
- **RF3:** Funcionários podem cancelar suas próprias reservas.
- **RF4:** O sistema deve impedir duas reservas com sobreposição de horário para a mesma sala.
- **RF5:** Administradores podem cadastrar novas salas e desativar salas existentes.

**Requisitos não funcionais (NFRs):**

- **NFR1:** Simplicidade de implementação e operação (equipe pequena, sem especialistas em infraestrutura).
- **NFR2:** Consistência suficiente para garantir que conflitos de reserva não ocorram, mesmo com múltiplos usuários simultâneos.
- **NFR3:** Baixa latência para consultas comuns de disponibilidade.
- **NFR4:** Registro básico de auditoria: ao criar ou cancelar uma reserva, o sistema deve armazenar quem realizou a ação e quando.

**Restrições:**

- Infraestrutura inicial simples: um servidor de aplicação e um banco de dados relacional.
- Não é exigida arquitetura distribuída, microsserviços, filas de mensagens ou cache distribuído.
- A solução deve ser compatível com uma equipe pequena e sem experiência em infraestrutura avançada.

**Tarefa:**

Proponha uma **arquitetura de alto nível** para este sistema. Sua resposta deve cobrir:

1. **Componentes e responsabilidades:** quais são as partes principais do sistema e o que cada uma faz.
2. **Fluxo de consulta e criação de reserva:** como os dados fluem desde a ação do usuário até a persistência, para as operações mais críticas.
3. **Estratégia para evitar conflitos de horário:** como o sistema garante que duas reservas não conflitem.
4. **Trade-offs e limitações:** o que a solução proposta sacrifica ou deixa de fora, e por quê é uma escolha razoável para o contexto.
<!-- /SECTION:statement -->

<!-- SECTION:solution-outline -->
**Essência da solução esperada:**

### Arquitetura geral

Uma arquitetura monolítica simples é adequada e esperada para este contexto. Os componentes principais são:

| Componente | Responsabilidade |
|---|---|
| **Frontend (SPA ou SSR)** | Interface para listar salas, criar/cancelar reservas, tela de administração de salas |
| **Backend / API (HTTP)** | Recebe requisições, aplica regras de negócio, valida conflitos, persiste dados |
| **Banco de dados relacional** | Armazena usuários, salas, reservas e log de auditoria |
| **Módulo de autenticação** | Valida identidade do usuário (ex.: JWT ou sessão); controla acesso às rotas |

Não são esperados: cache distribuído, fila de mensagens, microsserviços ou serviços externos além da autenticação.

---

### Fluxo básico para consultar disponibilidade e criar reserva

**Consultar disponibilidade:**
```
Usuário informa data e intervalo → Frontend chama GET /rooms/available?date=...&start=...&end=...
→ Backend consulta banco: salas ativas sem reserva sobreposta no período → Retorna lista de salas disponíveis
```

**Criar reserva:**
```
Usuário seleciona sala, data, início, fim e título → Frontend chama POST /reservations
→ Backend autentica usuário → Inicia transação no banco
→ Verifica sobreposição: SELECT ... WHERE room_id = ? AND start < ? AND end > ? (com lock)
→ Se livre: INSERT na tabela reservations + INSERT no log de auditoria → Commit
→ Se conflito: Rollback → Retorna erro ao usuário
```

---

### Estratégia para evitar conflitos de horário

A abordagem adequada para o nível easy é combinar duas camadas:

1. **Verificação de sobreposição dentro de transação:** antes de inserir uma reserva, o backend consulta se já existe reserva para a mesma sala com sobreposição de intervalo (`start_a < end_b AND end_a > start_b`), dentro de uma transação com lock (ex.: `SELECT ... FOR UPDATE` no PostgreSQL), garantindo atomicidade.
2. **Constraint ou índice único parcial no banco (opcional, mas valioso):** uma constraint que impede inserções conflitantes diretamente no banco serve como segunda linha de defesa.

Ambas as estratégias são simples e compatíveis com banco relacional padrão. Não é exigida consistência eventual, fila de reservas nem controle otimista avançado.

---

### Modelo simplificado de dados

Tabelas esperadas (nomes e campos podem variar):

- `users`: id, name, email, role (employee / admin)
- `rooms`: id, name, capacity, location, active
- `reservations`: id, room_id, user_id, title, start_at, end_at, cancelled_at
- `audit_log`: id, reservation_id, user_id, action (created / cancelled), performed_at

---

### Trade-offs e limitações esperados

Respostas fortes reconhecerão pelo menos dois dos seguintes:

- **Escalabilidade limitada:** monólito com lock de banco funciona bem para 300 usuários, mas pode ser gargalo com muito mais usuários simultâneos.
- **Lock em alta concorrência:** `SELECT FOR UPDATE` pode causar contenção se muitos usuários tentarem reservar a mesma sala ao mesmo tempo.
- **Sem notificações em tempo real:** se dois usuários estão na tela de reserva ao mesmo tempo, um receberá erro de conflito apenas ao tentar confirmar.
- **Auditoria básica:** log simples de criação e cancelamento; sem histórico de edições.
- **Sem autenticação avançada:** assume autenticação interna simples; não cobre SSO, 2FA ou integração com diretório corporativo.

---

### O que NÃO é esperado nesta questão (nível easy)

- Microsserviços ou arquitetura distribuída.
- Cache distribuído (Redis, Memcached).
- Fila de mensagens (RabbitMQ, Kafka).
- Consistência eventual avançada.
- Detalhamento de todos os endpoints da API REST.
- Schema completo do banco de dados.
<!-- /SECTION:solution-outline -->

<!-- REVIEW:metrics -->
{
  "quality": {
    "technicalCorrectness": 3,
    "statementClarity": 5,
    "rubricAlignment": 3,
    "difficultyAlignment": 5
  },
  "compatibility": {
    "promptAlignment": 4,
    "formatValid": true
  },
  "recommendation": "major_revision",
  "statusAfterReview": "needs_human_review",
  "mainIssue": "technical",
  "revisionLevelNeeded": "moderate",
  "suggestedChangedParts": ["rubric", "solution-outline", "prompt"],
  "referencesStatus": "present"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendação: major_revision.

Principais pontos:
- A questão pertence adequadamente a `architecture/system_design`: pede uma arquitetura de alto nível, componentes, responsabilidades, fluxos e trade-offs do sistema completo. Os exemplos pontuais de operações HTTP aparecem apenas no `solution-outline` e não transformam a tarefa em desenho detalhado de endpoints nem em uma decisão isolada entre alternativas.
- A dificuldade está adequada para `easy`. O contexto limita escala e infraestrutura, favorece uma arquitetura monolítica simples e exclui explicitamente microsserviços, filas, cache distribuído e mecanismos avançados.
- O formato está válido: `multi-section` com quatro seções textuais coerentes, sem template de código, sem `defaultLanguage` e com `supportedLanguages: [none]`. Os RFs, NFRs e restrições são suficientes e a tarefa cobre componentes e responsabilidades, fluxo de dados, prevenção de conflitos e trade-offs.
- Há um problema técnico relevante na estratégia central de concorrência. Consultar reservas sobrepostas com `SELECT ... FOR UPDATE` bloqueia apenas linhas existentes; quando nenhuma sobreposição existe, duas transações concorrentes podem não ter uma linha conflitante para bloquear e ambas podem inserir. Recomenda-se que o `solution-outline` apresente alternativas realmente seguras, sem impor uma única implementação: por exemplo, serializar por uma linha estável da sala dentro da transação, usar isolamento serializável com tratamento de retry ou, no PostgreSQL, uma exclusion constraint para intervalos.
- A afirmação de que uma “constraint ou índice único parcial” impede intervalos sobrepostos deve ser corrigida. Um índice único comum ou parcial não expressa, por si só, exclusão por sobreposição; além disso, uma exclusion constraint é específica de bancos que oferecem esse recurso, não de banco relacional padrão em geral.
- A rubrica soma 1.0 e seus critérios são observáveis, mas `conflict_prevention` atualmente lista como exemplos suficientes uma verificação antes da inserção, lock ou constraint sem exigir que o mecanismo feche a condição de corrida. Como impedir conflitos é um requisito central, recomenda-se exigir atomicidade efetiva sob requisições simultâneas e aceitar diferentes soluções tecnicamente válidas.
- O prompt segue o padrão real de `prompts/`, usa placeholders compatíveis com as quatro seções e reproduz corretamente ids e pesos da rubrica. Entretanto, ele também sugere `SELECT FOR UPDATE` sem esclarecer o que é bloqueado e pode premiar uma solução ainda vulnerável. Recomenda-se alinhar sua instrução de concorrência à rubrica revisada e penalizar arquitetura distribuída desnecessária quando ela contrariar a simplicidade do NFR1, em vez da orientação ambígua “não penalize, mas considere”.
- O `solution-outline` permanece majoritariamente compatível com o nível easy e não exige microsserviços, filas ou cache distribuído. Após corrigir a garantia de concorrência, convém preservar a abertura para monólito em camadas, SPA ou SSR, autenticação por sessão ou token e diferentes bancos relacionais, sem exigir sintaxe SQL, endpoints ou schema completos.
- As referências são plausíveis e conservadoras para arquitetura e transações. Permanecem corretamente como `suggested_not_verified`; a documentação de locking do PostgreSQL é pertinente, mas não deve ser interpretada como validação automática da estratégia descrita.
<!-- /REVIEW:comments -->
