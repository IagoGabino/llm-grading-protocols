---
id: advanced-contract-audit-trail-strategy
slug: advanced-contract-audit-trail-strategy
title: "Design e Arquitetura — Estratégia de Rastreamento de Alterações em Contratos B2B"
axis: architecture
subtheme: architecture_decisions
difficulty: advanced
promptTemplate: advanced-contract-audit-trail-strategy
supportedLanguages: [none]
tags: [audit_trail, event_sourcing, versioning, append_only, compliance, data_integrity, architecture_decisions]
references:
  - id: ref-1
    title: "Designing Data-Intensive Applications — Martin Kleppmann"
    type: book
    url: null
    relevance: 5
    confidence: 5
    supports: [statement, solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Patterns of Enterprise Application Architecture — Martin Fowler"
    type: book
    url: null
    relevance: 4
    confidence: 5
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Event Sourcing — Martin Fowler (martinfowler.com)"
    type: technical_blog
    url: "https://martinfowler.com/eaaDev/EventSourcing.html"
    relevance: 4
    confidence: 5
    supports: [statement, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Audit Log Pattern — Enterprise Integration Patterns"
    type: technical_blog
    url: null
    relevance: 4
    confidence: 3
    supports: [statement, rubric]
    verificationStatus: suggested_not_verified
generationMetrics:
  validFormatSelfCheck: true
  rubricCriteriaCount: 4
  referencesSuggested: true
  plannedDifficulty: advanced
  expectedType: multi-section
  taxonomyFit: strong
inputConfig:
  type: multi-section
  sections:
    - id: comparacao_alternativas
      label: "Comparação entre as abordagens"
      placeholder: "Compare as três estratégias consideradas: audit log append-only, versionamento de registros e event sourcing. Para cada uma, descreva como ela registra alterações, suas principais vantagens e suas limitações no contexto desta plataforma de contratos B2B."
    - id: decisao_justificativa
      label: "Decisão arquitetural e justificativa"
      placeholder: "Qual abordagem você escolheu? Justifique com base nos requisitos funcionais e não funcionais descritos no problema. Explique como a solução escolhida registra quem alterou, qual campo, quando, o valor anterior, o valor novo e o motivo da alteração."
    - id: tradeoffs
      label: "Trade-offs e custo da solução escolhida"
      placeholder: "Quais são as principais desvantagens e custos da solução escolhida? Considere armazenamento, complexidade de consulta histórica, manutenção e evolução do sistema."
    - id: limitacoes_alternativas
      label: "Limitações e quando outra abordagem seria melhor"
      placeholder: "Quais são as limitações da solução escolhida que não foram cobertas? Em quais cenários futuros ou condições diferentes uma das alternativas descartadas seria mais adequada?"
rubric:
  version: v1
  criteria:
    - id: alternatives_comparison
      name: Comparação entre as abordagens
      weight: 0.30
      description: "Compara de forma objetiva as três abordagens (audit log append-only, versionamento de registros, event sourcing), identificando como cada uma registra alterações e ao menos uma vantagem e uma limitação concreta de cada uma no contexto do problema. Não basta nomear as estratégias; o aluno deve diferenciá-las tecnicamente."
    - id: decision_and_auditability
      name: Adequação da decisão e auditabilidade
      weight: 0.35
      description: "Escolhe uma abordagem coerente com os requisitos (forte auditabilidade, baixo risco de complexidade, facilidade de consulta ao estado atual, evolução gradual a partir de CRUD existente) e demonstra como a solução registra explicitamente: ator responsável, campo alterado, valor anterior, valor novo, data/hora e motivo da alteração. A decisão não precisa ser audit log; qualquer alternativa bem justificada é válida."
    - id: tradeoffs_awareness
      name: Consciência de trade-offs
      weight: 0.25
      description: "Identifica ao menos dois trade-offs concretos da solução escolhida entre: custo de armazenamento, complexidade de consulta histórica, dificuldade de manutenção, acoplamento ao modelo de domínio, complexidade de onboarding da equipe, ou dificuldade de evolução do schema. Não aceitar trade-offs genéricos sem relação com os requisitos apresentados."
    - id: limitations_awareness
      name: Consciência das limitações e cenários alternativos
      weight: 0.10
      description: "Reconhece ao menos uma limitação real da solução escolhida que não é coberta por ela, e identifica em qual cenário concreto uma das alternativas descartadas seria mais adequada (ex.: event sourcing para reconstrução de projeções, versionamento para snapshots de entidades complexas)."
---

<!-- SECTION:statement -->
Uma **plataforma B2B de gestão de contratos** é usada por empresas para gerenciar acordos comerciais com fornecedores e clientes. Cada contrato possui campos sensíveis como **limite financeiro**, **status contratual** (ativo, suspenso, encerrado), **responsáveis** (gestor comercial e gestor jurídico) e **datas de vigência**.

O sistema atual é um **CRUD tradicional** com banco de dados relacional: os campos são atualizados diretamente na tabela `contracts`, sem histórico. Clientes da plataforma começaram a exigir **rastreabilidade completa** de alterações nesses campos sensíveis para fins de conformidade interna e auditorias externas.

**Requisitos funcionais (RFs):**

- **RF1:** Permitir consultar o **estado atual** de um contrato sem complexidade adicional de leitura.
- **RF2:** Permitir consultar **quem alterou qual campo, quando e de qual valor para qual valor**, com o motivo da alteração registrado.
- **RF3:** Permitir reconstruir o **histórico cronológico** de alterações de um contrato para fins de auditoria.
- **RF4:** Não é necessário reconstruir o estado completo do domínio a partir de eventos em tempo real.

**Requisitos não funcionais (NFRs):**

- **NFR1:** **Forte auditabilidade e integridade histórica**: o histórico de alterações não pode ser modificado ou apagado após o registro.
- **NFR2:** **Baixo risco de complexidade**: a equipe tem 4 engenheiros sem experiência prévia em event sourcing.
- **NFR3:** **Facilidade de consulta ao estado atual**: a leitura do contrato vigente deve ser simples e eficiente.
- **NFR4:** **Custo de armazenamento aceitável**: o volume de alterações por contrato é relativamente baixo (dezenas por mês, por contrato).
- **NFR5:** **Evolução gradual**: a solução deve ser adotável a partir do sistema CRUD existente sem uma reescrita completa.

**Alternativas que a equipe está avaliando:**

1. **Audit log append-only:** registrar cada alteração em um campo sensível como um evento de auditoria imutável em uma tabela separada (`contract_audit_logs`), mantendo a tabela `contracts` como fonte principal de leitura do estado atual.
2. **Versionamento de registros:** a cada alteração, salvar uma cópia completa do contrato (ou de seus campos relevantes) como uma nova versão histórica, mantendo um registro de qual é a versão atual.
3. **Event sourcing:** tratar todos os eventos de domínio como fonte de verdade e reconstruir o estado atual do contrato a partir da sequência de eventos.

**Restrições:**

- O sistema usa banco de dados relacional (PostgreSQL). Não há restrição sobre adicionar novas tabelas.
- A equipe não tem familiaridade com frameworks de event sourcing.
- Não é necessário suportar projeções em tempo real ou CQRS.

**Tarefa:**

Analise as três alternativas e tome uma **decisão arquitetural**. Sua resposta deve cobrir:

1. **Comparação entre as abordagens:** como cada uma registra alterações, vantagens e limitações no contexto desta plataforma.
2. **Decisão e justificativa:** qual abordagem você escolheu, como ela registra ator, campo, valores anteriores/novos e motivo, e por que ela é adequada aos requisitos.
3. **Trade-offs e custo da solução escolhida:** desvantagens concretas em termos de armazenamento, consulta histórica, complexidade e manutenção.
4. **Limitações e cenários alternativos:** o que a solução não cobre e em qual contexto outra abordagem seria mais adequada.

**Não é necessário escrever código ou detalhar o schema completo do banco. Foque na decisão arquitetural e em sua justificativa.**
<!-- /SECTION:statement -->

<!-- SECTION:solution-outline -->
**Essência da solução esperada:**

### Decisão arquitetural esperada

**Audit log append-only** é a abordagem mais adequada para este contexto, dadas as restrições de equipe pequena sem experiência em event sourcing, a necessidade de evolução gradual a partir de um CRUD existente e o requisito de consulta ao estado atual sem complexidade adicional. Qualquer alternativa é aceitável se o aluno a justifica adequadamente em relação aos RFs e NFRs.

---

### Comparação entre as abordagens

| Abordagem | Como registra alterações | Vantagem principal | Limitação principal |
|---|---|---|---|
| Audit log append-only | Tabela imutável com cada alteração de campo (antes/depois, ator, motivo) | Separação clara entre leitura do estado atual e histórico; baixa complexidade de adoção | Não reconstituiu o estado a partir dos logs sem lógica adicional; o modelo principal ainda é atualizado diretamente |
| Versionamento de registros | Cópia completa (ou parcial) do contrato a cada alteração, com ponteiro para versão atual | Facilita reconstrução de snapshot em qualquer ponto do tempo | Maior volume de dados; consulta do estado atual requer filtro por versão vigente; pode duplicar dados não alterados |
| Event sourcing | Sequência imutável de eventos de domínio; estado reconstruído aplicando eventos | Histórico completo e auditável por construção; base para projeções e CQRS | Alta complexidade operacional; exige infraestrutura e cultura de engenharia compatíveis; viola NFR2 e NFR5 para este contexto |

---

### Justificativa para audit log append-only

**Como registra alterações:**

Cada vez que um campo sensível é alterado, o sistema insere um registro na tabela de auditoria com:

| Campo | Descrição |
|---|---|
| `contract_id` | Referência ao contrato alterado |
| `changed_by` | ID do usuário responsável pela alteração |
| `changed_at` | Timestamp da alteração |
| `field_name` | Nome do campo alterado (ex.: `financial_limit`) |
| `old_value` | Valor anterior (serializado como string/JSON) |
| `new_value` | Valor novo (serializado como string/JSON) |
| `reason` | Motivo fornecido pelo usuário |

A tabela `contracts` continua como fonte de leitura do estado atual (RF1, NFR3). O histórico fica em `contract_audit_logs` (RF2, RF3, NFR1).

**Por que esta abordagem atende aos requisitos:**

- **NFR1 (auditabilidade):** registros de auditoria são insert-only; não há UPDATE nem DELETE nessa tabela.
- **NFR2 (baixa complexidade):** não requer infraestrutura nova, frameworks especializados ou mudança de paradigma.
- **NFR3 (estado atual simples):** `SELECT * FROM contracts WHERE id = ?` continua funcionando sem reconstituição.
- **NFR5 (evolução gradual):** pode ser adotado incrementalmente: adicionar a tabela e instrumentar as operações de escrita sensíveis, sem reescrever a lógica de leitura.

---

### Trade-offs da solução escolhida

- **Consistência entre tabelas:** a alteração no contrato e o registro de auditoria devem ocorrer na mesma transação. Se a transação falhar parcialmente, pode haver divergência — mitigável com transação atômica, mas requer atenção na implementação.
- **Consultas históricas exigem joins:** reconstruir o histórico cronológico de um campo requer consultar `contract_audit_logs` por `contract_id` e `field_name`. Não é possível obter um snapshot do contrato em um ponto do tempo sem lógica de reconstituição adicional.
- **Dependência do modelo atual:** o log de auditoria registra campos pelo nome; renomear campos no schema quebra a continuidade histórica sem migração cuidadosa.
- **Não captura alterações fora da camada de aplicação:** atualizações diretas no banco (scripts de manutenção, migrations) não são capturadas automaticamente.

---

### Quando outra abordagem seria melhor

- **Versionamento de registros** seria mais adequado se houvesse necessidade frequente de reconstruir o estado completo do contrato em qualquer ponto do tempo (snapshot em data específica), especialmente para relatórios de conformidade que exigem visão integral do contrato em uma data de auditoria, não campo a campo.
- **Event sourcing** seria mais adequado se o sistema precisasse suportar projeções em tempo real, CQRS, ou se houvesse múltiplos contextos consumindo a sequência de eventos para construir suas próprias visões do domínio. Não é adequado para este contexto dado NFR2 e a maturidade atual da equipe.

---

### O que NÃO é esperado nesta questão (nível advanced)

- Schema SQL completo com todos os campos e constraints.
- Solução de backup ou retenção de logs.
- Implementação de CQRS ou projeções.
- Definição de políticas de retenção de dados históricos.
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
- A questão pertence adequadamente a `architecture/architecture_decisions`: o foco é comparar alternativas arquiteturais para rastreabilidade de alterações sensíveis e tomar uma decisão justificada, sem virar desenho completo de schema, system design amplo ou API design.
- A dificuldade `advanced` está bem calibrada, pois exige análise comparativa entre audit log append-only, versionamento de registros e event sourcing, considerando auditabilidade, estado atual, histórico, custo, complexidade operacional e evolução gradual.
- O formato `multi-section` está válido para questão sem código: não há templates de código nem `defaultLanguage`, `supportedLanguages: [none]` é apropriado e as quatro seções textuais de `inputConfig.sections` correspondem à resposta esperada.
- A rubrica é observável e alinhada ao enunciado: avalia comparação entre alternativas, decisão escolhida, auditabilidade, trade-offs, limitações e cenários em que outra abordagem seria preferível.
- O `solution-outline` indica audit log append-only como a opção mais adequada ao contexto, mas não força essa alternativa como única resposta correta; aceita outras decisões quando bem justificadas contra RFs e NFRs.
- O prompt de avaliação segue o padrão esperado para `multi-section`, usa placeholders compatíveis com as seções, reproduz corretamente ids e pesos da rubrica e contém instruções específicas para esta questão, sem se tornar genérico.
- As referências estão presentes, plausíveis e continuam corretamente como `suggested_not_verified`.
<!-- /REVIEW:comments -->
