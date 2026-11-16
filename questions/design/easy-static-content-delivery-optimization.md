---
id: easy-static-content-delivery-optimization
slug: easy-static-content-delivery-optimization
title: "Design e Arquitetura — Otimização de Entrega de Conteúdo Estático em Plataforma de Cursos"
axis: architecture
subtheme: scalability_and_performance
difficulty: easy
promptTemplate: easy-static-content-delivery-optimization
supportedLanguages: [none]
tags: [cdn, object_storage, cache_headers, static_content, performance, backend_offload]
references:
  - id: ref-1
    title: "MDN Web Docs — HTTP Caching"
    type: official_docs
    url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching"
    relevance: 5
    confidence: 5
    supports: [statement, solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Designing Data-Intensive Applications — Martin Kleppmann"
    type: book
    url: null
    relevance: 3
    confidence: 4
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Amazon CloudFront Developer Guide — Configuring Cache Behavior"
    type: official_docs
    url: "https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/ConfiguringCaching.html"
    relevance: 4
    confidence: 5
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-4
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
    - id: diagnostico
      label: "Diagnóstico do gargalo"
      placeholder: "Identifique qual é o problema de performance descrito no cenário e explique por que a arquitetura atual não escala bem nesse ponto."
    - id: solucao
      label: "Proposta de solução"
      placeholder: "Descreva a solução proposta para otimizar a entrega dos arquivos estáticos. Mencione os componentes envolvidos (object storage, CDN, cache headers ou equivalentes) e como eles se encaixam na arquitetura."
    - id: cache_invalidacao
      label: "Estratégia de cache e invalidação"
      placeholder: "Como você configuraria o cache para os arquivos estáticos? Como garantiria que usuários recebam a versão atualizada quando um arquivo for substituído por um administrador?"
    - id: tradeoffs
      label: "Trade-offs e limitações"
      placeholder: "Quais são as principais desvantagens ou limitações da solução proposta? O que deve ser monitorado ou gerenciado com atenção?"
rubric:
  version: v1
  criteria:
    - id: bottleneck_diagnosis
      name: Diagnóstico do gargalo
      weight: 0.25
      description: "Identifica corretamente que o backend está servindo arquivos estáticos pesados diretamente, causando sobrecarga desnecessária; relaciona isso com a frequência baixa de mudança dos arquivos e com o crescimento da carga em horários de pico."
    - id: solution_adequacy
      name: Adequação da solução proposta
      weight: 0.35
      description: "Propõe mover arquivos estáticos para object storage (ex.: S3, GCS, Azure Blob ou equivalente) e servi-los via CDN ou com cache HTTP adequado; explica como o backend passa a atuar apenas no controle de acesso, autenticação ou metadados, sem servir os bytes dos arquivos diretamente."
    - id: cache_invalidation
      name: Estratégia de cache e invalidação
      weight: 0.25
      description: "Define uma estratégia de cache coerente (ex.: Cache-Control com TTL longo para arquivos versionados, ou TTL curto com invalidação explícita na CDN ao substituir um arquivo); demonstra entender que invalidação é necessária quando administradores atualizam um arquivo."
    - id: tradeoffs_awareness
      name: Consciência de trade-offs
      weight: 0.15
      description: "Reconhece pelo menos dois trade-offs ou limitações concretas da solução (ex.: custo de CDN ou object storage, latência de propagação de cache após invalidação, necessidade de gerenciar credenciais de acesso ao bucket, eventual exposição pública de arquivos se não houver controle de acesso)."
---

<!-- SECTION:statement -->
Uma empresa mantém uma **plataforma interna de cursos corporativos**. Cada aula tem uma página com imagens ilustrativas, PDFs de material complementar e vídeos curtos. Atualmente, todos esses arquivos estáticos são servidos diretamente pelo backend da aplicação, que também gerencia autenticação, dados de progresso e avaliações.

O conteúdo das aulas muda raramente: depois de aprovado por um administrador, um arquivo quase nunca é substituído. Porém, em horários de pico — quando grupos de funcionários acessam as aulas ao mesmo tempo —, o backend fica sobrecarregado e as páginas demoram a carregar.

**Requisitos funcionais (RFs):**

- **RF1:** Usuários autenticados acessam páginas de aula que contêm imagens, PDFs e vídeos curtos.
- **RF2:** O conteúdo aprovado muda raramente; a maioria dos arquivos permanece a mesma por semanas ou meses.
- **RF3:** Administradores podem substituir um arquivo quando necessário (ex.: corrigir um PDF ou trocar uma imagem).
- **RF4:** Usuários devem continuar acessando o conteúdo com baixa latência, mesmo em horários de pico.

**Requisitos não funcionais (NFRs):**

- **NFR1:** Reduzir a carga do backend da aplicação para que ele possa se concentrar em lógica de negócio, autenticação e progresso do aluno.
- **NFR2:** Melhorar o tempo de carregamento das páginas para usuários que podem estar em regiões geográficas diferentes.
- **NFR3:** Manter a solução simples de operar para uma equipe pequena.
- **NFR4:** Garantir que, ao substituir um arquivo, os usuários recebam a versão atualizada sem precisar aguardar longos períodos de cache expirado.
- **NFR5:** Evitar exposição pública irrestrita de arquivos quando houver material restrito a determinados perfis de usuário.

**Contexto adicional:**

- A equipe é pequena e não quer introduzir infraestrutura complexa (sem sharding, sem filas, sem microsserviços).
- O acesso ao conteúdo é sempre mediado por autenticação; nenhum arquivo deve ser acessível sem login.
- O volume de arquivos é moderado; não há necessidade de soluções multi-region complexas ou replicação geográfica elaborada.

**Tarefa:**

Proponha uma solução arquitetural simples para melhorar a entrega de conteúdo estático nesta plataforma. Sua resposta deve cobrir:

1. **Diagnóstico do gargalo:** qual é o problema central e por que a arquitetura atual não escala bem nesse ponto.
2. **Proposta de solução:** quais componentes você introduziria e como eles mudam a responsabilidade do backend.
3. **Estratégia de cache e invalidação:** como configurar o cache e garantir que arquivos substituídos sejam entregues corretamente.
4. **Trade-offs e limitações:** desvantagens da solução escolhida e pontos de atenção operacional.
<!-- /SECTION:statement -->

<!-- SECTION:solution-outline -->
**Essência da solução esperada:**

### Diagnóstico esperado

O backend está atuando como servidor de arquivos estáticos — função para a qual não foi projetado. Como o conteúdo muda raramente, cada requisição ao backend para buscar uma imagem, PDF ou vídeo é desnecessária: o mesmo byte poderia ter sido entregue por cache. Em horários de pico, o volume de requisições de arquivos compete com requisições de lógica de negócio (progresso, avaliações, autenticação), saturando o servidor.

---

### Solução esperada

**Object storage + CDN (ou cache HTTP bem configurado)** é a abordagem adequada para este cenário. Variações aceitáveis:

- Arquivos estáticos movidos para um **object storage** (S3, GCS, Azure Blob, MinIO ou equivalente).
- Uma **CDN** (CloudFront, Cloudflare, Fastly ou equivalente) posicionada à frente do object storage para cachear e entregar os arquivos próximo ao usuário.
- Alternativa mais simples (sem CDN): o backend gera **URLs assinadas (presigned URLs)** com expiração curta; o cliente faz download diretamente do object storage, sem que o backend sirva os bytes.

**Novo papel do backend:**

- Autenticar o usuário e verificar se ele tem acesso à aula.
- Retornar metadados da aula (título, descrição, lista de arquivos).
- Gerar URLs temporárias (presigned) para cada arquivo, ou servir como origem autorizada para a CDN.
- **Não** transferir os bytes dos arquivos ao cliente.

---

### Estratégia de cache e invalidação

Dois cenários aceitáveis:

1. **Arquivos com nome versionado (cache longo):**
   - Ao substituir um arquivo, o administrador faz upload com nome diferente (ex.: `aula-01-v2.pdf`).
   - O backend atualiza o metadado apontando para o novo nome.
   - O cache pode ter TTL longo (dias/semanas) porque o nome do arquivo muda a cada versão.
   - Vantagem: simples, sem necessidade de invalidação explícita.

2. **Arquivos com nome fixo (invalidação explícita):**
   - Ao substituir um arquivo, o administrador faz upload no mesmo caminho.
   - O backend (ou um script de deploy) aciona a invalidação do cache na CDN para aquele arquivo específico.
   - TTL mais curto pode ser usado como fallback (ex.: 1 hora), mas invalidação explícita garante atualização imediata.

Ambas as estratégias são aceitáveis para nível easy. O aluno deve escolher uma e justificá-la.

---

### Trade-offs esperados

- **Custo variável:** object storage e CDN cobram por armazenamento e transferência. Para uma plataforma interna com volume moderado, o custo tende a ser baixo, mas deve ser monitorado.
- **Latência de propagação:** após invalidação, pode haver uma janela em que diferentes nós da CDN ainda entregam o arquivo antigo. Não é problema crítico para conteúdo de curso, mas deve ser comunicado.
- **Gerenciamento de credenciais:** o backend precisa de credenciais para acessar o bucket e gerar presigned URLs. Exige atenção à segurança (IAM roles, variáveis de ambiente).
- **Controle de acesso:** se a CDN cachear URLs assinadas sem validação de identidade, um usuário pode compartilhar a URL temporária. Mitigação: TTL curto nas URLs assinadas (ex.: 5–15 minutos).

---

### O que NÃO é esperado nesta questão (nível easy)

- Cache distribuído de banco de dados (Redis, Memcached).
- Sharding ou replicação multi-region complexa.
- Filas de processamento assíncrono.
- Microsserviços ou decomposição de backend.
- Multipart upload ou criptografia avançada de arquivos.
- Configuração detalhada de políticas de lifecycle ou retenção de bucket.
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
- A questão pertence adequadamente a `architecture/scalability_and_performance`: o enunciado deixa claro que o gargalo é o backend servindo imagens, PDFs e vídeos curtos diretamente, enquanto também executa autenticação, progresso e lógica de negócio.
- A dificuldade está adequada para `easy`. A tarefa exige diagnóstico, proposta simples de offload de conteúdo estático, estratégia de cache/invalidação e trade-offs, sem exigir sharding, filas, microsserviços, multi-region complexo ou cache distribuído de banco de dados.
- O formato `multi-section` está válido, com quatro seções textuais coerentes, sem templates de código, sem `defaultLanguage` e com `supportedLanguages: [none]` apropriado para questão sem código.
- O enunciado não se limita a "use CDN": ele exige justificar como a responsabilidade do backend muda, como o cache será configurado, como arquivos substituídos serão atualizados e quais limitações operacionais ou de segurança precisam ser consideradas.
- A rubrica soma 1.0 e avalia critérios observáveis: diagnóstico do gargalo, adequação da solução, estratégia de cache/invalidação e consciência de trade-offs, cobrindo também aderência aos requisitos de baixa latência, simplicidade operacional e cuidado com acesso a conteúdo restrito.
- O `solution-outline` aceita alternativas equivalentes, como object storage com CDN, cache HTTP bem configurado ou URLs assinadas para download direto, sem fechar a resposta em uma única tecnologia específica.
- O prompt de avaliação segue o padrão real de `prompts/`, usa placeholders compatíveis com as seções `diagnostico`, `solucao`, `cache_invalidacao` e `tradeoffs`, e reproduz corretamente ids e pesos da rubrica no JSON esperado.
- As referências são plausíveis e conservadoras para o tema e permanecem corretamente como `suggested_not_verified`.
<!-- /REVIEW:comments -->
