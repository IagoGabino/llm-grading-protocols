---
id: easy-hr-document-storage-decision
slug: easy-hr-document-storage-decision
title: Design e Arquitetura — Decisão de Armazenamento de Documentos em Plataforma de RH
axis: architecture
subtheme: architecture_decisions
difficulty: easy
promptTemplate: easy-hr-document-storage-decision
supportedLanguages: [none]
tags: [object_storage, file_storage, trade_off, metadata, access_control]
references:
  - id: ref-1
    title: "Designing Data-Intensive Applications — Martin Kleppmann"
    type: book
    url: null
    relevance: 4
    confidence: 4
    supports: [statement, solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Amazon S3 Developer Guide — Presigned URLs"
    type: official_docs
    url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html"
    relevance: 4
    confidence: 5
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Fundamentals of Software Architecture — Mark Richards, Neal Ford"
    type: book
    url: null
    relevance: 3
    confidence: 4
    supports: [rubric, solution-outline]
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
    - id: alternativas
      label: "Comparação entre alternativas"
      placeholder: "Compare as abordagens consideradas (banco de dados, filesystem local, object storage). Para cada uma, indique ao menos uma vantagem e uma desvantagem no contexto desta plataforma de RH."
    - id: decisao
      label: "Decisão e justificativa"
      placeholder: "Qual abordagem você escolheu? Justifique com base nos requisitos funcionais e não funcionais descritos no problema."
    - id: tradeoffs
      label: "Trade-offs e limitações"
      placeholder: "Quais são as principais desvantagens da solução escolhida? O que foi sacrificado em relação às alternativas descartadas?"
    - id: metadados_acesso
      label: "Metadados, controle de acesso e download seguro"
      placeholder: "Como você armazenará os metadados dos arquivos? Como garantirá que somente usuários autorizados consigam fazer o download de um documento?"
rubric:
  version: v1
  criteria:
    - id: alternatives_comparison
      name: Comparação entre alternativas
      weight: 0.30
      description: "Compara de forma objetiva as abordagens (banco de dados, filesystem local, object storage), identificando ao menos uma vantagem e uma desvantagem de cada uma no contexto dos requisitos apresentados."
    - id: decision_justification
      name: Adequação da decisão e justificativa
      weight: 0.30
      description: "Escolhe object storage (S3, GCS, Azure Blob ou equivalente) com metadados no banco relacional e justifica a escolha com base nos RFs (envio/download de PDFs, metadados por arquivo) e NFRs (não sobrecarregar o banco, crescimento gradual, simplicidade operacional)."
    - id: tradeoffs_awareness
      name: Consciência de trade-offs
      weight: 0.25
      description: "Reconhece pelo menos dois trade-offs da solução escolhida (ex.: dependência de serviço externo, custo variável por uso, necessidade de gerenciar credenciais) e menciona o que foi sacrificado nas alternativas descartadas."
    - id: metadata_access_control
      name: Metadados e controle de acesso
      weight: 0.15
      description: "Propõe armazenar metadados no banco relacional (usuário, tipo, data, status) e descreve mecanismo básico de controle de acesso ao download, como URLs assinadas com expiração (presigned URLs) ou rota autenticada no backend."
---

<!-- SECTION:statement -->
Uma empresa de médio porte está desenvolvendo uma **plataforma interna de RH**. A funcionalidade principal a ser implementada agora permite que funcionários enviem documentos PDF — como comprovantes de endereço, contratos assinados e atestados médicos — e que a equipe de RH consiga acessar esses arquivos depois.

A equipe de desenvolvimento é pequena (3 pessoas) e precisa tomar uma decisão arquitetural sobre **onde e como armazenar esses arquivos** antes de iniciar a implementação.

**Requisitos funcionais (RFs):**

- **RF1:** Funcionários autenticados podem enviar arquivos PDF pelo sistema.
- **RF2:** Usuários autorizados (equipe de RH) podem fazer download dos arquivos enviados.
- **RF3:** Cada arquivo deve ter metadados associados: nome do funcionário, tipo do documento, data de envio e status de análise.
- **RF4:** Arquivos individuais podem chegar a dezenas de MB.

**Requisitos não funcionais (NFRs):**

- **NFR1:** Não sobrecarregar o banco de dados relacional com o conteúdo binário dos arquivos.
- **NFR2:** Permitir crescimento gradual do volume de arquivos sem grandes mudanças de infraestrutura.
- **NFR3:** Garantir que apenas usuários autorizados consigam acessar o conteúdo dos arquivos.
- **NFR4:** Preservar os arquivos mesmo que o servidor de aplicação seja reiniciado ou substituído.
- **NFR5:** Manter a operação simples para uma equipe sem especialistas em infraestrutura.

**Alternativas que a equipe está considerando:**

1. **Banco de dados:** salvar o conteúdo binário do PDF diretamente em uma coluna do banco relacional (ex.: coluna `BLOB` ou `BYTEA`).
2. **Filesystem local:** salvar os arquivos em um diretório no próprio servidor de aplicação.
3. **Object storage:** salvar os arquivos em um serviço de armazenamento de objetos (ex.: Amazon S3, Google Cloud Storage, Azure Blob Storage) e manter apenas os metadados no banco.

**Tarefa:**

Analise as alternativas e tome uma decisão arquitetural. Sua resposta deve cobrir:

1. **Comparação entre alternativas:** vantagens e desvantagens de cada opção no contexto deste problema.
2. **Decisão e justificativa:** qual abordagem você escolheu e por que, com referência direta aos RFs e NFRs.
3. **Trade-offs e limitações:** desvantagens da solução escolhida e o que foi aberto mão nas alternativas descartadas.
4. **Metadados, controle de acesso e download seguro:** como organizar os metadados no banco e como garantir que o download seja restrito a usuários autorizados.
<!-- /SECTION:statement -->

<!-- SECTION:solution-outline -->
**Essência da solução esperada:**

### Decisão arquitetural esperada

**Object storage + metadados no banco relacional** é a abordagem adequada para este cenário. Qualquer serviço equivalente é válido (S3, GCS, Azure Blob, MinIO para ambiente on-premise).

---

### Comparação entre alternativas

| Alternativa | Vantagem principal | Desvantagem principal no contexto |
|---|---|---|
| Banco de dados (BLOB) | Simplicidade transacional; não exige serviço externo | Arquivos grandes degradam performance do banco; backups maiores; não escala bem com volume |
| Filesystem local | Simples de implementar; sem custo de serviço externo | Arquivos perdidos em reinício/troca do servidor (viola NFR4); não escala horizontalmente |
| Object storage | Projetado para armazenar arquivos grandes; escala sem mudança de infraestrutura; durabilidade alta | Dependência de serviço externo; custo variável por armazenamento e transferência |

---

### Justificativa com base nos requisitos

- **NFR1** (não sobrecarregar o banco): salvar binários no banco viola diretamente este requisito; object storage isola o conteúdo do banco.
- **NFR2** (crescimento gradual): object storage cresce sem provisionar discos adicionais; filesystem local exigiria gestão manual de espaço.
- **NFR4** (preservar arquivos em restart): filesystem local perde arquivos se o servidor for substituído; object storage é independente do servidor de aplicação.
- **NFR5** (simplicidade operacional): serviços gerenciados (S3, GCS) reduzem carga operacional; não é necessário gerenciar backups de arquivo manualmente.

---

### Metadados e controle de acesso

**Tabela de metadados no banco relacional:**

| Campo | Descrição |
|---|---|
| `id` | Identificador único do documento |
| `user_id` | Referência ao funcionário que enviou |
| `document_type` | Tipo do documento (comprovante, contrato, atestado…) |
| `submitted_at` | Data e hora de envio |
| `status` | Estado de análise (pendente, aprovado, rejeitado) |
| `storage_key` | Chave/caminho do arquivo no object storage |

**Controle de acesso ao download:**

A estratégia básica e adequada para nível easy é uma das seguintes (ambas aceitáveis):

- **URL assinada (presigned URL):** o backend verifica autorização e gera uma URL temporária com expiração curta (ex.: 5 minutos) apontando para o object storage. O arquivo nunca é exposto publicamente.
- **Rota autenticada no backend:** o backend verifica autorização, baixa o arquivo do object storage e envia como stream para o cliente. Mais simples de implementar, mas adiciona carga de rede ao servidor.

URLs assinadas são preferíveis para não sobrecarregar o servidor, mas a rota autenticada é igualmente válida neste contexto easy.

---

### Trade-offs da solução escolhida

- **Dependência externa:** se o serviço de object storage ficar indisponível, uploads e downloads param. Mitigação: usar serviço gerenciado com SLA alto ou MinIO local como fallback.
- **Custo variável:** armazenamento e transferência de dados têm custo por uso. Para volume modesto de uma plataforma interna de RH, tende a ser baixo.
- **Gerenciamento de credenciais:** o backend precisa de credenciais de acesso ao bucket, o que requer atenção à segurança (variáveis de ambiente, IAM roles, etc.). Não é complexo, mas é um ponto adicional de configuração.

---

### O que NÃO é esperado nesta questão (nível easy)

- CDN para distribuição de arquivos.
- Multipart upload para arquivos muito grandes.
- Criptografia server-side ou client-side complexa.
- Políticas avançadas de retenção ou lifecycle.
- Solução de backup ou disaster recovery detalhada.
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
  "mainIssue": "technical",
  "revisionLevelNeeded": "light",
  "suggestedChangedParts": ["solution-outline", "prompt"],
  "referencesStatus": "present"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendação: minor_revision.

Principais pontos:
- A questão pertence adequadamente a `architecture/architecture_decisions`: exige comparar alternativas delimitadas e tomar uma decisão arquitetural, sem pedir o desenho completo do sistema.
- A dificuldade está adequada para `easy`. O enunciado fornece RFs, NFRs e alternativas explícitas e não exige CDN, multipart upload, criptografia complexa ou políticas avançadas.
- O formato `multi-section` está válido, com quatro seções textuais coerentes, sem templates de código, sem `defaultLanguage` e com `supportedLanguages: [none]` apropriado.
- O enunciado explicita banco de dados, filesystem local e object storage com metadados no banco, além de exigir um mecanismo de download seguro. Também pede decisão clara, justificativa por RFs/NFRs e trade-offs.
- A rubrica soma 1.0 e avalia aspectos observáveis: comparação das alternativas, decisão escolhida, aderência aos requisitos, trade-offs e controle de acesso. A preferência por object storage é coerente com as restrições dadas e não transforma a tarefa em simples citação de S3, pois a comparação e a justificativa continuam obrigatórias.
- O `solution-outline` mantém o escopo simples e aceita dois mecanismos básicos de download seguro. Recomenda-se apenas corrigir a afirmação de que o filesystem local perde arquivos em um simples reinício: o risco correto está na substituição do servidor, no armazenamento efêmero/local não compartilhado e na maior carga operacional; um disco persistente pode sobreviver a reinícios.
- O prompt segue o padrão real de `prompts/`, usa os quatro placeholders compatíveis com `inputConfig.sections` e reproduz corretamente ids e pesos da rubrica no JSON esperado.
- Recomenda-se alinhar duas instruções do prompt: exigir a comparação das três alternativas, como fazem enunciado e rubrica, em vez de aceitar apenas duas; e substituir a penalização baseada em "perda de arquivos em restart" pelo risco de substituição/armazenamento local efêmero. Também é preferível pedir evidência de RFs e NFRs, e não permitir que dois requisitos de apenas uma categoria satisfaçam integralmente a justificativa.
- As referências são plausíveis e conservadoras para o tema e permanecem corretamente como `suggested_not_verified`.
<!-- /REVIEW:comments -->
