---
id: advanced-idempotent-api-admissions
slug: advanced-idempotent-api-admissions
title: Design e Arquitetura — API REST Idempotente para Internações Hospitalares
axis: architecture
subtheme: api_design
difficulty: advanced
promptTemplate: advanced-idempotent-api-admissions
supportedLanguages: [none]
tags: [idempotency, http, rest, concurrency, healthtech, retry, distributed_systems]
references:
  - id: ref-1
    title: "Idempotency-Key HTTP Header Field (IETF Draft)"
    type: standard
    url: "https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/"
    relevance: 5
    confidence: 4
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Designing Data-Intensive Applications — Martin Kleppmann"
    type: book
    url: null
    relevance: 4
    confidence: 5
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "RESTful Web API Patterns and Practices Cookbook — Mike Amundsen"
    type: book
    url: null
    relevance: 4
    confidence: 3
    supports: [statement, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Stripe API — Idempotent Requests"
    type: technical_blog
    url: "https://stripe.com/docs/api/idempotent_requests"
    relevance: 4
    confidence: 5
    supports: [solution-outline, rubric]
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
    - id: contrato_headers
      label: "Contrato e Headers"
      placeholder: "Descreva o contrato HTTP da solução: qual identificador de idempotência você introduz (nome, posição no request, formato), quem é responsável por gerá-lo, e quais status codes devem ser retornados na primeira chamada, em retries bem-sucedidos e em situações de conflito (ex.: mesmo Idempotency-Key com payload diferente)."
    - id: fluxo_backend
      label: "Fluxo do Backend e Concorrência"
      placeholder: "Descreva o fluxo completo no servidor: como a chave é armazenada, qual mecanismo previne race conditions em retries simultâneos (ex.: Redis SETNX, transação com Unique Constraint no banco, lock distribuído), o que acontece enquanto a primeira requisição ainda está em processamento, e como a resposta original é retornada nas chamadas subsequentes."
    - id: tradeoffs_limitacoes
      label: "Trade-offs e Limitações"
      placeholder: "Discuta ao menos dois trade-offs da solução: TTL das chaves de idempotência (por quanto tempo guardar?), custo de armazenamento e latência adicional, o que acontece se o cliente gerar chaves repetidas para internações distintas, e o que não é coberto pela solução (ex.: chamadas com payload genuinamente diferente)."
rubric:
  version: v1
  criteria:
    - id: api_contract
      name: Contrato da API e identificador de idempotência
      weight: 0.30
      description: "Introduz um mecanismo de identificação inequívoca da transação (ex.: header Idempotency-Key gerado pelo cliente), especifica formato adequado (UUID v4 ou similar), define claramente os status codes esperados (ex.: 201 Created na primeira chamada; 200 ou 201 em retries com resposta cacheada; 422 ou 409 para conflito de payload) e não depende de atributos do domínio (ex.: ID do paciente) para definir unicidade da requisição."
    - id: backend_flow
      name: Fluxo do backend e prevenção de race conditions
      weight: 0.35
      description: "Descreve armazenamento da chave de idempotência com seu estado (ex.: processing, done) e a resposta serializada; usa mecanismo robusto contra race conditions em retries simultâneos (ex.: Redis SETNX/SET NX, Unique Constraint + retry na camada de aplicação, lock pessimista); define o comportamento enquanto a requisição original ainda está em processamento (ex.: retornar 409 Conflict com Retry-After, ou bloquear com polling); retorna resposta original cacheada sem criar novo registro."
    - id: http_status_codes
      name: Semântica correta de status codes HTTP
      weight: 0.20
      description: "Usa status codes semanticamente corretos e consistentes para cada cenário: primeira chamada bem-sucedida (201 Created + Location header), retry após conclusão (200 OK ou 201 com resposta idêntica), requisição ainda em processamento (409 Conflict ou 202 Accepted + Retry-After), conflito de payload para a mesma chave (422 Unprocessable Entity ou 400 Bad Request com mensagem descritiva). Não usa 2xx genérico nem ignora o cenário de conflito."
    - id: ttl_and_tradeoffs
      name: TTL, custo de armazenamento e trade-offs
      weight: 0.15
      description: "Define um TTL razoável para as chaves (justificado com base no período de risco de retry do cliente, ex.: 24h a 7 dias); reconhece o custo de armazenamento e latência adicional; aborda o que acontece quando o cliente reutiliza acidentalmente uma chave para operações distintas; reconhece o limite da solução (não cobre operações genuinamente distintas com mesma chave, nem protege contra bugs no cliente que enviam payloads diferentes com chaves diferentes)."
---

<!-- SECTION:statement -->
Uma empresa de HealthTech opera uma **API B2B** consumida por sistemas de hospitais parceiros para registrar internações de pacientes. O endpoint `POST /api/v1/admissions` recebe um payload com dados do paciente, diagnóstico inicial, leito e horário de admissão.

**Problema atual:**

Devido à instabilidade nas redes internas dos hospitais, os clientes frequentemente sofrem **timeout de leitura** após enviar a requisição — ou seja, o request chegou ao servidor e foi processado, mas o cliente não recebeu a resposta. Os sistemas hospitalares, seguindo sua política de retry automático, reenviam o mesmo payload minutos depois. Como resultado, a API está **criando múltiplos registros de internação** para o mesmo evento clínico, gerando:

- **Faturamento duplicado** para planos de saúde;
- **Inconsistência no prontuário eletrônico** do paciente;
- **Alertas falsos** nos sistemas de controle de leitos.

**Por que a checagem "ingênua" não resolve:**

Uma verificação simples como *"já existe uma internação para este paciente neste leito hoje?"* **não é suficiente**: um mesmo paciente pode ter alta e ser readmitido no mesmo dia, ou ser transferido para outro leito horas depois. O que caracteriza um **retry** não é a similaridade do domínio — é a **intenção de repetir a mesma transação**. Uma verificação por atributos clínicos não distingue duplicata de retry versus internação nova e legítima.

**Requisitos funcionais (RFs):**

- **RF1:** `POST /api/v1/admissions` deve ser **idempotente**: múltiplas chamadas com a mesma intenção de transação devem criar exatamente **um registro** e retornar a mesma resposta original.
- **RF2:** O sistema deve aceitar normalmente **internações distintas e legítimas** do mesmo paciente, mesmo que próximas no tempo.
- **RF3:** Em caso de retry enquanto a requisição original ainda está em processamento, o cliente deve receber uma resposta clara sobre o estado da operação.

**Requisitos não funcionais (NFRs):**

- **NFR1:** A solução deve ser robusta contra **race conditions** em retries simultâneos (dois ou mais retries chegando ao servidor exatamente ao mesmo tempo).
- **NFR2:** O mecanismo de idempotência não deve introduzir latência perceptível no caminho feliz (primeira chamada).
- **NFR3:** O estado de idempotência deve ser armazenado por tempo suficiente para cobrir o período de retry dos clientes.

**Restrições:**

- Infraestrutura disponível: servidores de aplicação stateless, banco de dados relacional (PostgreSQL) e um cache distribuído (Redis).
- A API usa JSON e segue convenções REST. Não há restrição de linguagem de implementação.
- Os sistemas hospitalares são clientes externos; você não controla o código deles, mas **pode especificar o contrato HTTP** que eles devem seguir.

**Tarefa:**

Projete a solução técnica para tornar o endpoint `POST /api/v1/admissions` idempotente, descrevendo:

1. **Contrato e Headers:** qual identificador você introduz, como o cliente o gera e o inclui na requisição, e quais status codes a API deve retornar em cada cenário (primeira chamada, retry após conclusão, retry em andamento, conflito de payload).

2. **Fluxo do Backend e Concorrência:** como o servidor armazena e consulta a chave de idempotência, qual mecanismo garante que dois retries simultâneos não criem dois registros (race condition), e como a resposta original é retornada nas chamadas subsequentes.

3. **Trade-offs e Limitações:** TTL das chaves, custo de armazenamento, o que acontece se o cliente reutilizar a mesma chave para internações distintas, e o que a solução não cobre.

**Não é necessário escrever código. Foque no design do contrato HTTP, no fluxo de backend e nas decisões de concorrência.**
<!-- /SECTION:statement -->

<!-- SECTION:solution-outline -->
**Essência da solução esperada:**

### 1. Contrato e Headers

**Identificador de idempotência:**

O cliente (sistema hospitalar) deve gerar um identificador único para cada **intenção de transação** — não por tentativa de envio. O padrão adotado pela indústria (Stripe, Adyen, AWS) é um header `Idempotency-Key` com valor UUID v4 gerado pelo cliente antes do primeiro envio e reutilizado em todos os retries da mesma operação.

```
POST /api/v1/admissions HTTP/1.1
Content-Type: application/json
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

{
  "patient_id": "PAT-9821",
  "bed_id": "UTI-04",
  "admission_at": "2025-11-15T14:30:00Z",
  "diagnosis_code": "J18.9"
}
```

**Responsabilidade da geração:** o cliente. A chave representa a intenção; o servidor não deve gerá-la (perderia o controle de idempotência).

**Status codes por cenário:**

| Cenário | Status code | Observação |
|---|---|---|
| Primeira chamada bem-sucedida | `201 Created` + `Location` header | Registro criado |
| Retry após conclusão (mesma key + mesmo payload) | `200 OK` ou `201 Created` com resposta original | Não cria novo registro |
| Retry simultâneo (request original ainda em processamento) | `409 Conflict` + `Retry-After` header | Cliente deve aguardar e tentar novamente |
| Mesma key com payload diferente | `422 Unprocessable Entity` | Detecta uso incorreto da chave |
| Header `Idempotency-Key` ausente | `400 Bad Request` | Obrigatório para mutações |

---

### 2. Fluxo do Backend e Concorrência

**Armazenamento das chaves:**

O servidor mantém um registro das chaves de idempotência com seu estado e a resposta serializada. Pode ser uma tabela no banco de dados relacional ou uma entrada no Redis:

```
idempotency_keys:
  key          → string (UUID do cliente)
  status       → enum: processing | done | failed
  request_hash → hash do payload (para detectar conflito de payload)
  response     → resposta serializada (status code + body)
  created_at   → timestamp
  expires_at   → timestamp (TTL)
```

**Prevenção de race conditions (retries simultâneos):**

O ponto crítico: dois retries chegando ao mesmo tempo devem resultar em **exatamente um registro criado**. Abordagens válidas:

- **Redis SETNX (SET if Not eXists):** antes de processar, tentar `SET idempotency:{key} "processing" NX EX 300`. Apenas o primeiro a adquirir o lock processa; os demais recebem 409 + Retry-After imediatamente.
- **Unique Constraint no banco:** inserir a chave com status `processing` em uma transação. A constraint de unicidade na coluna `key` garante que apenas uma inserção seja aceita; as demais recebem erro de constraint e retornam 409.
- **Lock distribuído (Redlock):** para cenários com múltiplas instâncias sem Redis único, implementar lock distribuído com TTL curto.

**Fluxo completo (caminho feliz + retry):**

```
Cliente envia POST com Idempotency-Key: K
  │
  ├─ Verificar se K já existe no armazenamento
  │    ├─ NÃO existe → tentar adquirir lock/inserir K (status: processing)
  │    │    ├─ Lock adquirido → processar request → salvar resposta → status: done → retornar 201
  │    │    └─ Lock não adquirido (race condition) → retornar 409 + Retry-After: 5
  │    │
  │    ├─ Existe com status: processing → retornar 409 + Retry-After: 5
  │    │
  │    ├─ Existe com status: done
  │    │    ├─ Payload igual → retornar resposta original cacheada (200/201)
  │    │    └─ Payload diferente → retornar 422 (conflito de chave)
  │    │
  │    └─ Existe com status: failed → retornar resposta de falha original
```

---

### 3. Trade-offs e Limitações

**TTL das chaves:**
O período de retenção deve cobrir o janela máxima de retry do cliente. Para redes hospitalares com instabilidade, um TTL entre 24 horas e 7 dias é razoável. Após o TTL, uma chave reutilizada é tratada como nova operação — aceitável se o cliente seguiu o protocolo corretamente.

**Custo de armazenamento:**
Cada chave armazena o UUID (36 bytes), o hash do payload, o status e a resposta serializada (~1–5 KB por internação). Para volumes típicos de B2B hospitalar (centenas de admissões/dia), o custo é desprezível.

**Reutilização acidental da chave:**
Se o cliente enviar a mesma `Idempotency-Key` com um payload diferente (nova internação, mesmo UUID), o servidor retornará 422. O cliente deve gerar uma nova chave para a nova operação. Isso exige documentação clara do contrato.

**O que a solução NÃO cobre:**
- Bugs no cliente que geram chaves distintas para o mesmo retry (a API não tem como saber que são retries do mesmo evento).
- Deduplicação de operações sem o header (clientes não conformes com o contrato).
- Garantia de entrega fim-a-fim além do escopo da API (ex.: falha após a API retornar 201 mas antes de o cliente registrar a resposta).
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
- A questão está no formato multi-section, com inputConfig coerente e sem template de código ou exigência de implementação.
- O enunciado deixa claro que uma restrição ingênua por atributos clínicos, como patient_id, leito ou data, não diferencia retry de uma nova internação legítima.
- O solution-outline cobre Idempotency-Key gerado pelo cliente, armazenamento de estado da chave, hash de payload, resposta cacheada e proteção contra concorrência via Redis SETNX, constraint única transacional ou lock distribuído.
- O prompt de avaliação está alinhado aos placeholders definidos em inputConfig.sections e aos critérios da rubrica, incluindo penalização explícita para SELECT antes de INSERT sem garantia de atomicidade.
- Os pesos da rubrica somam 1.0 e os critérios são observáveis para uma resposta de designArchitecture avançada.
- As referências são plausíveis para o tema e estão marcadas como suggested_not_verified, sem tratá-las como verificadas.
<!-- /REVIEW:comments -->
