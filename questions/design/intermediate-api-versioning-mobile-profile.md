---
id: intermediate-api-versioning-mobile-profile
slug: intermediate-api-versioning-mobile-profile
title: "Design e Arquitetura — Evolução de API de Perfil com Compatibilidade Retroativa"
axis: architecture
subtheme: api_design
difficulty: intermediate
promptTemplate: intermediate-api-versioning-mobile-profile
supportedLanguages: [none]
tags: [api_versioning, backward_compatibility, api_contract, deprecation, breaking_change]
references:
  - id: ref-1
    title: "RESTful Web API Patterns and Practices Cookbook"
    type: book
    url: null
    relevance: 5
    confidence: 3
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "API Versioning Has No Right Way — Stripe Blog"
    type: technical_blog
    url: null
    relevance: 4
    confidence: 3
    supports: [statement, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Microsoft REST API Guidelines"
    type: official_docs
    url: "https://github.com/microsoft/api-guidelines"
    relevance: 4
    confidence: 4
    supports: [rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Web API Design Crafting Interfaces that Developers Love — Apigee"
    type: technical_blog
    url: null
    relevance: 3
    confidence: 3
    supports: [rubric]
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
    - id: versionamento
      label: "Estratégia de versionamento e compatibilidade"
      placeholder: "Qual estratégia você adotaria para versionar ou evoluir a API? Explique como clientes antigos continuariam funcionando e como clientes novos consumiriam a estrutura atualizada. Justifique a escolha (URL versioning, header versioning, content negotiation, field expansion, etc.)."
    - id: contrato
      label: "Contrato de resposta e mudanças compatíveis"
      placeholder: "Quais mudanças no contrato de resposta são compatíveis (non-breaking) e quais são incompatíveis (breaking)? Como você exporia o campo 'address' estruturado e o objeto 'preferences' sem quebrar apps que já consomem a versão atual? Descreva o contrato esperado para cada cenário."
    - id: depreciacao
      label: "Plano de depreciação e transição"
      placeholder: "Como você comunicaria a depreciação da estrutura antiga? Que mecanismos (headers, documentação, aviso em resposta) usaria para indicar que uma versão está em processo de remoção? Qual seria o período de suporte da versão anterior?"
    - id: tradeoffs
      label: "Trade-offs da abordagem escolhida"
      placeholder: "Quais são os principais trade-offs da estratégia que você escolheu? Considere: duplicação de lógica no backend, custo de manutenção de múltiplas versões, complexidade para o cliente, risco de contrato divergente e facilidade de evolução futura."
rubric:
  version: v1
  criteria:
    - id: versioning_strategy
      name: Estratégia de versionamento
      weight: 0.30
      description: Propõe estratégia clara e justificada para lidar com a coexistência de versões (URL versioning, header versioning, field expansion / additive-only, etc.), explica como clientes antigos e novos são atendidos simultaneamente e considera viabilidade para apps mobile publicados.
    - id: contract_clarity
      name: Clareza do contrato de resposta
      weight: 0.30
      description: "Distingue corretamente mudanças compatíveis (additive: novos campos opcionais, novas propriedades) de mudanças incompatíveis (structural: campo 'address' passou de string para objeto), e descreve como cada versão do contrato é exposta."
    - id: deprecation_plan
      name: Plano de depreciação e transição
      weight: 0.25
      description: "Define mecanismo concreto de comunicação de depreciação (ex.: header Deprecation/Sunset, resposta com campo de aviso, documentação), estabelece prazo de suporte e descreve a transição entre versões de forma gerenciável."
    - id: tradeoffs_awareness
      name: Consciência de trade-offs
      weight: 0.15
      description: "Reconhece ao menos dois trade-offs relevantes da abordagem escolhida (ex.: custo de manter duas versões ativas, risco de divergência de contrato, complexidade de roteamento, pressão para forçar atualização dos clientes) e propõe mitigações razoáveis."
---

<!-- SECTION:statement -->
Uma empresa de tecnologia possui um aplicativo mobile publicado nas duas lojas (iOS e Android) que consome o endpoint `GET /api/profile` para exibir os dados do usuário logado. O contrato atual retorna:

```json
{
  "id": "u123",
  "name": "Ana Silva",
  "email": "ana@example.com",
  "address": "Rua A, 123 - Belo Horizonte/MG"
}
```

A equipe de produto aprovou um conjunto de melhorias para o cadastro de usuário:

1. **Endereço estruturado:** o campo `address` deve passar de uma string livre para um objeto com os campos `street`, `number`, `city` e `state`, permitindo integração com serviços de entrega e validação de CEP.
2. **Preferências de conta:** um novo objeto `preferences` deve ser exposto, contendo `language` e `notificationsEnabled`, para personalização da experiência no app.

O novo formato desejado é:

```json
{
  "id": "u123",
  "name": "Ana Silva",
  "email": "ana@example.com",
  "address": {
    "street": "Rua A",
    "number": "123",
    "city": "Belo Horizonte",
    "state": "MG"
  },
  "preferences": {
    "language": "pt-BR",
    "notificationsEnabled": true
  }
}
```

**Contexto importante:**

- Versões antigas do app (sem atualização) continuarão ativas por **pelo menos 6 meses**, pois não é possível forçar atualização imediata nas lojas.
- O app antigo lê o campo `address` diretamente como string para exibir em tela; se o campo virar objeto, o app quebrará.
- Novos builds do app já estão prontos para consumir o contrato atualizado.
- A API é pública e consumida apenas pelo app mobile da empresa (não por parceiros externos).

**Requisitos funcionais:**

- **RF1:** Apps antigos devem continuar funcionando sem atualização imediata.
- **RF2:** Apps novos devem conseguir consumir a estrutura de endereço estruturado e o objeto de preferências.
- **RF3:** A API deve ter uma estratégia clara para evolução futura sem repetir o mesmo problema.
- **RF4:** A depreciação da estrutura antiga deve ser comunicada de forma rastreável.

**Requisitos não funcionais:**

- **NFR1:** Minimizar o impacto em clientes mobile já publicados.
- **NFR2:** Manter documentação clara do contrato de cada versão.
- **NFR3:** Permitir período de transição entre versões sem duplicação excessiva de lógica no backend.

**Tarefa:**

Você deve propor uma estratégia de evolução para a API `GET /api/profile`. Descreva:

1. **Estratégia de versionamento e compatibilidade:** como clientes antigos e novos serão atendidos ao mesmo tempo.
2. **Contrato de resposta:** quais mudanças são compatíveis e quais são incompatíveis, e como cada versão do contrato será exposta.
3. **Plano de depreciação e transição:** como a versão antiga será comunicada como depreciada e eventualmente removida.
4. **Trade-offs:** os principais custos e riscos da abordagem escolhida.

**Não é necessário descrever implementação de banco de dados, autenticação ou arquitetura de serviços.**
<!-- /SECTION:statement -->

<!-- SECTION:solution-outline -->
**Essência da solução esperada:**

### 1. Estratégia de versionamento e compatibilidade

A mudança de `address` de string para objeto é uma **breaking change**: um cliente que faz `address.toUpperCase()` ou simplesmente exibe a string quebrará ao receber um objeto. Portanto, alguma forma de separação de versão é necessária.

**Abordagem A — URL Versioning (`/v1` e `/v2`)**

- `GET /api/v1/profile` → retorna o contrato antigo (address como string, sem preferences)
- `GET /api/v2/profile` → retorna o contrato novo (address estruturado + preferences)
- Apps antigos continuam chamando `/v1`; apps novos passam a chamar `/v2`.
- **Vantagem:** separação explícita, fácil de roteamento, simples de documentar.
- **Desvantagem:** duplicação de rota; pode levar a dois caminhos de código no backend se não bem encapsulado.

**Abordagem B — Header Versioning (`Accept-Version` ou `Api-Version`)**

- Um único endpoint `GET /api/profile`; a versão é negociada via header.
- `Api-Version: 1` → resposta antiga; `Api-Version: 2` → resposta nova.
- **Vantagem:** mantém URL limpa; bom para APIs públicas com muitos consumidores.
- **Desvantagem:** apps mobile antigos já publicados não enviam o header → servidor precisa de fallback para versão padrão. Mais complexo para testar e debugar.

**Abordagem C — Field Expansion (additive-only, sem nova versão)**

- Mantém `address` como string por compatibilidade e adiciona `address_structured` como novo campo opcional.
- Adiciona `preferences` como campo novo (additive: não quebra clientes antigos que ignoram campos desconhecidos).
- **Vantagem:** sem versionamento formal; clientes antigos ignoram campos novos sem quebrar.
- **Desvantagem:** campo `address` permanece como string por tempo indeterminado; contrato fica poluído com campos redundantes; não resolve o problema estrutural a longo prazo.

**Recomendação para o cenário:** URL Versioning (Abordagem A) é a mais clara e gerenciável para uma API mobile com período de transição definido. Field Expansion (Abordagem C) é aceitável como solução de curto prazo se a breaking change puder ser postergada, mas deve ser combinada com um plano de migração.

---

### 2. Contrato de resposta e mudanças compatíveis

**Mudanças compatíveis (non-breaking):**
- Adicionar novo campo opcional `preferences` (clients antigos ignoram campos desconhecidos conforme Tolerant Reader pattern).
- Adicionar novos campos dentro de `preferences`.
- Adicionar campos completamente novos no nível raiz.

**Mudanças incompatíveis (breaking):**
- Alterar o tipo de `address` de string para objeto — rompe qualquer client que trate o campo como string.
- Remover ou renomear campo existente.
- Alterar a semântica de um campo existente.

**Contrato por versão (exemplo com URL versioning):**

`GET /api/v1/profile` (mantido por período de depreciação):
```json
{
  "id": "u123",
  "name": "Ana Silva",
  "email": "ana@example.com",
  "address": "Rua A, 123 - Belo Horizonte/MG"
}
```

`GET /api/v2/profile`:
```json
{
  "id": "u123",
  "name": "Ana Silva",
  "email": "ana@example.com",
  "address": {
    "street": "Rua A",
    "number": "123",
    "city": "Belo Horizonte",
    "state": "MG"
  },
  "preferences": {
    "language": "pt-BR",
    "notificationsEnabled": true
  }
}
```

---

### 3. Plano de depreciação e transição

- **Deprecation header:** adicionar `Deprecation: true` e `Sunset: <data>` nas respostas de `/v1` imediatamente após o lançamento de `/v2`. O header `Sunset` indica a data prevista de remoção.
- **Documentação:** changelog e OpenAPI spec atualizados indicando v1 como deprecated e v2 como current.
- **Monitoramento:** logar chamadas à `/v1` para acompanhar se ainda há clients ativos. Após 6 meses sem tráfego relevante, remover a rota.
- **Comunicação interna:** dado que o único consumidor é o app da empresa, coordenar com o time mobile o cronograma de atualização da versão mínima suportada.
- **Prazo mínimo:** 6 meses de suporte à v1 (alinhado ao enunciado), com revisão de tráfego ao final do período.

---

### 4. Trade-offs da abordagem por versão de URL

| Aspecto | Trade-off |
|---------|-----------|
| **Duplicação de lógica** | Se não bem encapsulado, o backend mantém dois serializadores de resposta. Mitigação: uma única camada de serviço, com transformadores de saída por versão. |
| **Custo de manutenção** | Bugs no endpoint de perfil precisam ser corrigidos em ambas as versões durante o período de transição. |
| **Pressão de migração** | Apps antigos podem permanecer na v1 além do prazo se não houver mecanismo de força (não disponível em lojas de app). Mitigação: forçar atualização mínima de app via soft/hard gate na UI. |
| **Contrato explícito** | URL versioning torna a versão visível na URL, facilitando debug de logs e rastreamento de tráfego por versão. |
| **Evolução futura** | Com versionamento estabelecido, mudanças futuras seguem o mesmo processo: v3 quando necessário, com sunset planejado para v2. |

**Pontos essenciais para pontuação máxima:**
1. Identificar `address` como breaking change e `preferences` como additive.
2. Propor mecanismo concreto de versão (URL, header ou field expansion) com justificativa.
3. Descrever como clientes antigos continuam funcionando sem código novo.
4. Mencionar algum mecanismo de depreciação (header Deprecation/Sunset, documentação, logs de uso).
5. Reconhecer ao menos dois trade-offs da abordagem escolhida.
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
- A questão pertence adequadamente a `architecture/api_design`: o foco é contrato público de API, versionamento, compatibilidade retroativa, depreciação e evolução de resposta, sem exigir desenho completo de backend, autenticação, banco de dados ou microsserviços.
- A dificuldade `intermediate` está adequada, pois exige distinguir mudança aditiva de breaking change, justificar uma estratégia de evolução e discutir trade-offs, mas sem exigir implementação ou desenho distribuído complexo.
- O formato está válido para `multi-section`: há quatro seções textuais coerentes com a resposta esperada, `supportedLanguages: [none]`, ausência de `defaultLanguage` e ausência de template de código.
- O enunciado deixa claro que alterar `address` de string para objeto quebra apps antigos, enquanto adicionar `preferences` pode ser compatível se clientes ignorarem campos desconhecidos.
- A rubrica avalia critérios observáveis de contrato, versionamento, compatibilidade retroativa, depreciação e trade-offs, com pesos somando 1.0.
- O `solution-outline` permite abordagens defensáveis, incluindo versionamento por URL, versionamento por header e expansão compatível de campos, sem forçar uma única estratégia como obrigatória.
- O prompt de avaliação segue o padrão dos arquivos em `prompts/`, usa placeholders compatíveis com as seções `versionamento`, `contrato`, `depreciacao` e `tradeoffs`, e reproduz corretamente ids e pesos da rubrica.
- As referências são plausíveis para o tema e permanecem marcadas como `suggested_not_verified`, sem tratá-las como verificadas.
<!-- /REVIEW:comments -->
