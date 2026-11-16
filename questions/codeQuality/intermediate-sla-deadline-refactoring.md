---
id: intermediate-sla-deadline-refactoring
slug: intermediate-sla-deadline-refactoring
title: "Qualidade de Código — Refatoração do Cálculo de Prazo de SLA para Incidentes"
axis: codeQuality
subtheme: design_and_refactoring
difficulty: intermediate
promptTemplate: intermediate-sla-deadline-refactoring
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [magic_numbers, boolean_flags, refactoring, sla, design, extensibility, named_rules, configuration_table]
references:
  - id: ref-1
    title: "Refactoring: Improving the Design of Existing Code (2nd ed.) — Martin Fowler"
    type: book
    url: null
    relevance: 5
    confidence: 5
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Clean Code: A Handbook of Agile Software Craftsmanship — Robert C. Martin"
    type: book
    url: null
    relevance: 5
    confidence: 5
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Introduce Parameter Object — Refactoring Catalog (Fowler)"
    type: technical_blog
    url: "https://refactoring.com/catalog/introduceParameterObject.html"
    relevance: 4
    confidence: 4
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Replace Magic Number with Symbolic Constant — Refactoring Catalog (Fowler)"
    type: technical_blog
    url: "https://refactoring.com/catalog/replaceMagicLiteral.html"
    relevance: 4
    confidence: 4
    supports: [statement, solution-outline]
    verificationStatus: suggested_not_verified
generationMetrics:
  validFormatSelfCheck: true
  rubricCriteriaCount: 5
  referencesSuggested: true
  plannedDifficulty: intermediate
  expectedType: code
  taxonomyFit: strong
inputConfig:
  type: code
  language: javascript
rubric:
  version: v1
  criteria:
    - id: design_diagnosis
      name: Diagnóstico dos problemas de design
      weight: 0.25
      description: >
        Identifica e nomeia os problemas estruturais presentes no código original:
        parâmetros booleanos soltos que funcionam como flags de controle de fluxo,
        números mágicos sem nome (0.75, 0.5, 4, valores de horas em literais espalhados),
        regras de ajuste misturadas ao cálculo base sem separação clara de responsabilidades,
        e baixa extensibilidade para adicionar novas regras de SLA no futuro.
    - id: refactoring_quality
      name: Qualidade da refatoração proposta
      weight: 0.35
      description: >
        Reorganiza o código de forma que: (a) as regras de prioridade estejam agrupadas
        em uma tabela de configuração, enum, objeto literal ou função isolada com nome
        significativo — eliminando os números mágicos das horas base; (b) os ajustes
        (cliente premium, incidente de segurança, fora do expediente) sejam aplicados
        por funções nomeadas ou em etapas claramente identificáveis, sem flags booleanos
        espalhados no fluxo condicional; (c) os parâmetros soltos sejam agrupados em um
        objeto de contexto do incidente ou parâmetros nomeados equivalentes. Não é exigido
        padrão de projeto formal (Strategy, Command etc.), mas a solução deve ir além de
        renomear variáveis ou reorganizar condicionais superficialmente.
    - id: behavior_preservation
      name: Preservação do comportamento
      weight: 0.25
      description: >
        O contrato público permanece inalterado: a função retorna o prazo em horas
        para resolver o incidente. Todas as regras são preservadas integralmente:
        prazos base por prioridade (critical=2h, high=8h, medium=24h, low=72h),
        redução de 25% para cliente premium, redução de 50% para incidente de segurança,
        acréscimo de 4 horas fora do expediente, e prazo mínimo de 1 hora.
        A ordem de aplicação dos ajustes não pode alterar o resultado final
        em relação à lógica original.
    - id: extensibility
      name: Extensibilidade e redução de acoplamento
      weight: 0.10
      description: >
        A estrutura refatorada torna fácil adicionar uma nova prioridade (ex.: "urgent")
        ou um novo ajuste de SLA (ex.: "incidente de compliance") sem modificar
        o fluxo principal de cálculo. O aluno demonstra ou descreve como a extensão
        seria feita na justificativa ou no próprio código.
    - id: reasoning
      name: Justificativa dos trade-offs
      weight: 0.05
      description: >
        Explica os problemas identificados (flags, números mágicos, mistura de regras)
        e justifica as decisões de refatoração, discutindo ao menos um trade-off
        relevante — por exemplo, ganho de legibilidade versus complexidade adicional,
        ou escolha entre tabela de configuração e funções isoladas.
---

<!-- SECTION:statement -->
O sistema interno de suporte técnico abaixo possui a função `calculateSlaDeadline`, que calcula o prazo em horas para resolver um incidente. A função é funcional, mas apresenta problemas de design que dificultam sua evolução:

1. **Parâmetros booleanos soltos:** `isPremium`, `isSecurity` e `isOffHours` são flags que controlam fluxo condicional dentro da função, tornando a assinatura difícil de ler e o código frágil a novos casos.
2. **Números mágicos espalhados:** os valores `2`, `8`, `24`, `72`, `0.75`, `0.5` e `4` aparecem diretamente no código sem identificação do que representam.
3. **Regras misturadas sem separação:** o cálculo do prazo base e os ajustes (premium, segurança, fora do expediente) estão entrelaçados em um único bloco condicional, sem estrutura que facilite entender ou alterar cada regra de forma independente.
4. **Baixa extensibilidade:** adicionar uma nova prioridade ou um novo ajuste de SLA exige alterar vários pontos do mesmo bloco de código.

**Regras de negócio (para preservação de comportamento):**
- **Prazo base por prioridade:**
  - `critical`: 2 horas
  - `high`: 8 horas
  - `medium`: 24 horas
  - `low`: 72 horas
- **Ajustes aplicados sobre o prazo base:**
  - Cliente premium: reduz o prazo em **25%** (multiplica por 0,75)
  - Incidente de segurança: reduz o prazo pela **metade** (multiplica por 0,5)
  - Fora do expediente: soma **4 horas** ao prazo após os demais ajustes
- **Prazo mínimo:** o resultado final não pode ser inferior a **1 hora**

**Tarefa:** refatore `calculateSlaDeadline` de modo a:
- eliminar os números mágicos, nomeando os valores com constantes simbólicas ou estrutura de configuração;
- agrupar os parâmetros booleanos soltos em um objeto de contexto ou estrutura equivalente;
- separar claramente o cálculo do prazo base dos ajustes aplicados;
- preservar integralmente o comportamento descrito acima.

Não é exigido padrão de projeto formal. Justifique suas decisões em um **raciocínio separado**, identificando os problemas e descrevendo ao menos um trade-off da refatoração.

```javascript
// slaCalculator.js

function calculateSlaDeadline(priority, isPremium, isSecurity, isOffHours) {
  let deadline;

  if (priority === 'critical') {
    deadline = 2;
  } else if (priority === 'high') {
    deadline = 8;
  } else if (priority === 'medium') {
    deadline = 24;
  } else if (priority === 'low') {
    deadline = 72;
  } else {
    throw new Error('Prioridade inválida: ' + priority);
  }

  if (isPremium) {
    deadline = deadline * 0.75;
  }

  if (isSecurity) {
    deadline = deadline * 0.5;
  }

  if (isOffHours) {
    deadline = deadline + 4;
  }

  if (deadline < 1) {
    deadline = 1;
  }

  return deadline;
}

module.exports = { calculateSlaDeadline };
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// slaCalculator.js

// TODO: elimine os números mágicos nomeando as horas base por prioridade e os fatores de ajuste.
// TODO: agrupe os parâmetros booleanos em um objeto de contexto ou estrutura equivalente.
// TODO: separe o cálculo do prazo base dos ajustes (premium, segurança, fora do expediente).
// TODO: preserve integralmente o comportamento: prazos base, ajustes e prazo mínimo de 1 hora.

function calculateSlaDeadline(/* TODO: ajuste a assinatura conforme sua refatoração */) {
  // TODO: implemente a refatoração aqui
}

module.exports = { calculateSlaDeadline };
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# sla_calculator.py
from __future__ import annotations

# Antipadrão original (referência — NÃO altere esta seção):
#
# def calculate_sla_deadline(priority: str, is_premium: bool,
#                            is_security: bool, is_off_hours: bool) -> float:
#     if priority == 'critical':
#         deadline = 2
#     elif priority == 'high':
#         deadline = 8
#     elif priority == 'medium':
#         deadline = 24
#     elif priority == 'low':
#         deadline = 72
#     else:
#         raise ValueError(f'Prioridade inválida: {priority}')
#     if is_premium:
#         deadline *= 0.75
#     if is_security:
#         deadline *= 0.5
#     if is_off_hours:
#         deadline += 4
#     return max(deadline, 1)

# TODO: elimine os números mágicos nomeando as horas base por prioridade e os fatores de ajuste.
# TODO: agrupe os parâmetros booleanos em um objeto de contexto (dataclass, dict ou NamedTuple).
# TODO: separe o cálculo do prazo base dos ajustes aplicados.
# TODO: preserve integralmente o comportamento descrito no enunciado.

def calculate_sla_deadline(# TODO: ajuste a assinatura conforme sua refatoração
) -> float:
    # TODO: implemente a refatoração aqui
    pass
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// SlaCalculator.java

public class SlaCalculator {

    // Antipadrão original (referência):
    //
    // public double calculateSlaDeadline(String priority, boolean isPremium,
    //                                    boolean isSecurity, boolean isOffHours) {
    //     double deadline;
    //     switch (priority) {
    //         case "critical": deadline = 2;  break;
    //         case "high":     deadline = 8;  break;
    //         case "medium":   deadline = 24; break;
    //         case "low":      deadline = 72; break;
    //         default: throw new IllegalArgumentException("Prioridade inválida: " + priority);
    //     }
    //     if (isPremium)    deadline *= 0.75;
    //     if (isSecurity)   deadline *= 0.5;
    //     if (isOffHours)   deadline += 4;
    //     return Math.max(deadline, 1);
    // }

    // TODO: elimine os números mágicos nomeando as horas base por prioridade e os fatores de ajuste
    //       (use enum, Map, constantes ou record conforme julgar mais adequado).
    // TODO: agrupe os parâmetros booleanos em um record, classe ou objeto de contexto.
    // TODO: separe o cálculo do prazo base dos ajustes aplicados.
    // TODO: preserve integralmente o comportamento descrito no enunciado.

    public double calculateSlaDeadline(/* TODO: ajuste a assinatura conforme sua refatoração */) {
        // TODO: implemente a refatoração aqui
        return 0;
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Problemas estruturais identificados no código original:**

1. **Números mágicos:** `2`, `8`, `24`, `72` (horas base), `0.75`, `0.5` (fatores de ajuste) e `4` (horas adicionais fora do expediente) não têm nome, exigindo leitura do contexto para entender o significado de cada valor.
2. **Parâmetros booleanos soltos:** três flags na assinatura (`isPremium`, `isSecurity`, `isOffHours`) são difíceis de ler na chamada e tendem a crescer com novas regras de SLA, tornando a assinatura cada vez mais frágil.
3. **Regras misturadas:** o cálculo do prazo base e os ajustes estão no mesmo bloco sequencial, sem abstração que identifique cada etapa de forma isolada.
4. **Baixa extensibilidade:** adicionar uma nova prioridade exige editar o bloco condicional principal; adicionar um ajuste exige inserir novo `if` no meio do fluxo.

**Abordagem esperada (aceita variações equivalentes):**

- **Tabela de configuração para prazos base:** um objeto literal, `Map`, enum ou dict que mapeia cada prioridade ao seu prazo em horas, eliminando o if/else ou switch e os números mágicos. Exemplo: `const BASE_DEADLINES = { critical: 2, high: 8, medium: 24, low: 72 }`.
- **Constantes nomeadas para os ajustes:** `PREMIUM_FACTOR = 0.75`, `SECURITY_FACTOR = 0.5`, `OFF_HOURS_ADDITION = 4`, `MIN_DEADLINE = 1`.
- **Objeto de contexto para os parâmetros booleanos:** agrupar `isPremium`, `isSecurity` e `isOffHours` em um único parâmetro (`incident`, `context` ou equivalente), melhorando a legibilidade da assinatura e facilitando a adição de novos atributos.
- **Separação entre cálculo base e ajustes:** uma etapa recupera o prazo base da tabela; a seguir, cada ajuste é aplicado de forma identificável (funções auxiliares nomeadas ou sequência comentada/nomeada).

**Preservação obrigatória do comportamento:**
- `critical → 2h`, `high → 8h`, `medium → 24h`, `low → 72h`
- Premium: `× 0,75`; Security: `× 0,5`; Off-hours: `+ 4h`
- Prazo mínimo final: `max(deadline, 1)`
- Erro para prioridade desconhecida.

**Extensibilidade demonstrável:**
- Adicionar a prioridade `urgent → 1h` requer apenas inserir uma entrada na tabela, sem alterar o fluxo de cálculo.
- Adicionar um ajuste `isCompliance → reduz 10%` requer apenas uma nova constante e uma nova linha de aplicação, sem tocar nas regras existentes.

**Trade-offs relevantes (ao menos um esperado na justificativa):**
- Tabela de configuração aumenta a indireção mas torna o código mais extensível sem modificar o fluxo principal.
- Objeto de contexto simplifica a assinatura mas requer que o chamador construa o objeto antes de chamar a função.
- Funções auxiliares para cada ajuste tornam o código mais modular mas aumentam levemente a quantidade de abstrações.
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
- A questão está bem alinhada a `codeQuality/design_and_refactoring`: o foco é redesenhar a estrutura interna de uma função com flags booleanas, números mágicos, regras misturadas e baixa extensibilidade, não apenas melhorar nomes ou legibilidade superficial.
- A dificuldade `intermediate` está adequada, pois exige refatoração estrutural leve com tabela de configuração, constantes nomeadas, organização de contexto e separação de regras, sem exigir Strategy, Command ou outro padrão formal.
- O formato é compatível com questão `code`, com `inputConfig.type: code`, templates para JavaScript, Python e Java, rubrica com cinco critérios e pesos somando 1.0, além de `solution-outline` presente.
- O código inicial é funcional e contém problemas claros de design interno. As regras de SLA estão explícitas, objetivas e suficientes para avaliar preservação de comportamento.
- Os templates das três linguagens representam a mesma tarefa e as mesmas regras de negócio: prazos base por prioridade, ajustes premium/security/off-hours, prazo mínimo e erro para prioridade desconhecida.
- A rubrica avalia diagnóstico de design, qualidade da refatoração, preservação de comportamento, extensibilidade/redução de acoplamento e justificativa com trade-off, com critérios observáveis.
- O `solution-outline` sugere tabela de configuração, constantes, objeto de contexto e funções auxiliares, mas aceita variações equivalentes e não força padrão de projeto formal como única solução correta.
- O prompt de avaliação segue o padrão real de `prompts/` para questões `code`, usa placeholders compatíveis e reproduz corretamente os ids e pesos da rubrica.
- As referências são plausíveis para o tema e permanecem corretamente marcadas como `suggested_not_verified`, sem serem tratadas como verificadas.
<!-- /REVIEW:comments -->
