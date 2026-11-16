---
id: advanced-beta-access-eligibility-readability
slug: advanced-beta-access-eligibility-readability
title: "Qualidade de Código — Legibilidade na Elegibilidade de Acesso a Recurso Beta"
axis: codeQuality
subtheme: readability
difficulty: advanced
promptTemplate: advanced-beta-access-eligibility-readability
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [readability, boolean_complexity, named_predicates, decomposition, business_rules, beta_rollout, eligibility]
references:
  - id: ref-1
    title: "Clean Code: A Handbook of Agile Software Craftsmanship — Robert C. Martin"
    type: book
    url: null
    relevance: 5
    confidence: 5
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Refactoring: Improving the Design of Existing Code (2nd ed.) — Martin Fowler"
    type: book
    url: null
    relevance: 5
    confidence: 4
    supports: [rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Decompose Conditional — Refactoring Catalog"
    type: technical_blog
    url: "https://refactoring.com/catalog/decomposeConditional.html"
    relevance: 4
    confidence: 3
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Cognitive Complexity: A new way of measuring understandability — SonarSource"
    type: technical_blog
    url: "https://www.sonarsource.com/docs/CognitiveComplexity.pdf"
    relevance: 4
    confidence: 3
    supports: [statement, rubric]
    verificationStatus: suggested_not_verified
generationMetrics:
  validFormatSelfCheck: true
  rubricCriteriaCount: 5
  referencesSuggested: true
  plannedDifficulty: advanced
  expectedType: code
  taxonomyFit: strong
inputConfig:
  type: code
  language: javascript
rubric:
  version: v1
  criteria:
    - id: predicate_extraction
      name: Extração de predicados nomeados
      weight: 0.30
      description: "Extrai predicados coesos com nomes que revelam intenção (ex.: isAccountActive, isComplianceBlocked, isInternalUser, isEnterpriseInAllowedRegion, isTrialAllowed, isManualOverride). Cada predicado cobre exatamente uma verificação atômica ou uma agrupação semântica clara; nenhum predicado mistura regras de naturezas diferentes."
    - id: precedence_organization
      name: "Organização da precedência e das exceções"
      weight: 0.30
      description: "A estrutura refatorada torna explícita a hierarquia de regras: bloqueios globais são verificados antes das elegibilidades; o override manual aparece em posição que deixa claro que ele não supera o bloqueio de compliance. Negações duplas e condições compostas difíceis de ler são eliminadas. A ordem de verificações revela diretamente a intenção do sistema."
    - id: behavior_preservation
      name: Preservação de comportamento
      weight: 0.20
      description: "A refatoração não altera nenhuma das regras: conta ativa, compliance, feature ativa, usuário interno com feature experimental, enterprise em região permitida, trial com feature compatível, override manual e prevalência do bloqueio de compliance sobre o override. Para qualquer combinação de entrada, o valor de retorno (true/false) deve ser idêntico ao do código original."
    - id: cognitive_complexity_reduction
      name: Redução da complexidade cognitiva
      weight: 0.10
      description: "A expressão booleana principal deixa de existir como um único bloco denso. O ponto de decisão final é compreensível sem rastrear a precedência de operadores ao longo de múltiplas linhas. O leitor consegue entender a lógica lendo os nomes dos predicados, sem precisar simular a avaliação booleana mentalmente."
    - id: reasoning
      name: Justificativa / linha de raciocínio
      weight: 0.10
      description: "Explica quais problemas de legibilidade foram identificados (complexidade booleana, negações, precedência de exceções), quais predicados foram criados, como a ordem foi reorganizada e por que as escolhas de nome e decomposição facilitam leitura e manutenção futura."
---

<!-- SECTION:statement -->
A função abaixo decide se um usuário corporativo pode ativar uma funcionalidade experimental em um sistema interno. O código é funcional, mas condensa todas as regras de elegibilidade em uma única expressão booleana densa, com negações, precedências implícitas e casos de exceção difíceis de rastrear sem executar mentalmente o código linha a linha.

**Regras de negócio (para preservação de comportamento):**
- A conta do usuário deve estar ativa (`user.accountStatus === 'active'`).
- Usuário bloqueado por compliance **nunca** acessa, mesmo com override manual (`user.complianceBlock === true` sempre nega).
- A feature deve estar ativa (`feature.enabled === true`).
- Usuários internos (`user.internal === true`) podem acessar se a feature estiver em modo experimental (`feature.experimentalOnly === true`).
- Clientes enterprise (`user.plan === 'enterprise'`) podem acessar se a região do usuário estiver na lista de regiões permitidas da feature (`feature.allowedRegions.includes(user.region)`).
- Usuários em período de trial (`user.trial === true`) só acessam se a feature permitir trial (`feature.allowTrial === true`).
- Um override manual (`feature.manualOverrides.includes(user.id)`) libera o acesso quando o plano não enquadraria o usuário nas regras de enterprise/internal/trial — mas o bloqueio de compliance ainda prevalece.

**Contrato (não altere a assinatura nem o valor de retorno):**
- Entrada: `canActivateBetaFeature(user, feature)`.
- Saída: `true` se o usuário é elegível, `false` caso contrário.

**Tarefa:** refatore a função abaixo para melhorar sua legibilidade. **Não altere o comportamento.** Extraia predicados com nomes que revelem intenção, organize explicitamente a precedência das regras e das exceções, e elimine a expressão booleana densa. Apresente sua refatoração e justifique as decisões numa **linha de raciocínio separada**.

```javascript
// betaAccess.js
function canActivateBetaFeature(user, feature) {
  return (
    user.accountStatus === 'active' &&
    !user.complianceBlock &&
    feature.enabled &&
    (
      (user.internal && feature.experimentalOnly) ||
      (user.plan === 'enterprise' && feature.allowedRegions.includes(user.region)) ||
      (user.trial && feature.allowTrial) ||
      (feature.manualOverrides.includes(user.id) && !user.complianceBlock)
    )
  );
}

module.exports = { canActivateBetaFeature };
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// betaAccess.js

/**
 * Decide se um usuário corporativo pode ativar uma funcionalidade experimental.
 *
 * @param {{
 *   id: string,
 *   accountStatus: string,
 *   complianceBlock: boolean,
 *   internal: boolean,
 *   plan: string,
 *   region: string,
 *   trial: boolean
 * }} user
 *
 * @param {{
 *   enabled: boolean,
 *   experimentalOnly: boolean,
 *   allowedRegions: string[],
 *   allowTrial: boolean,
 *   manualOverrides: string[]
 * }} feature
 *
 * @returns {boolean}
 *
 * TODO: refatore preservando as regras descritas no enunciado.
 * Dica: extraia predicados nomeados e coesos para cada verificação atômica;
 *       organize a estrutura de decisão para que a precedência das regras
 *       e das exceções seja legível sem simular a expressão booleana.
 */
function canActivateBetaFeature(user, feature) {
  // TODO: substitua a expressão booleana densa por predicados nomeados.
  //       Não altere a assinatura nem o valor de retorno.
  return false;
}

module.exports = { canActivateBetaFeature };
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# beta_access.py
from typing import TypedDict


class User(TypedDict):
    id: str
    account_status: str       # 'active' | outro
    compliance_block: bool
    internal: bool
    plan: str                 # 'enterprise' | outro
    region: str
    trial: bool


class Feature(TypedDict):
    enabled: bool
    experimental_only: bool
    allowed_regions: list[str]
    allow_trial: bool
    manual_overrides: list[str]


def can_activate_beta_feature(user: User, feature: Feature) -> bool:
    """
    Decide se um usuário corporativo pode ativar uma funcionalidade experimental.

    TODO: refatore preservando as regras descritas no enunciado.
    Dica: extraia predicados nomeados e coesos para cada verificação atômica;
          organize a estrutura de decisão para que a precedência das regras
          e das exceções seja legível sem simular a expressão booleana.
    """
    # TODO: substitua a expressão booleana densa por predicados nomeados.
    #       Não altere a assinatura nem o valor de retorno.
    return False
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// BetaAccessEvaluator.java
import java.util.List;

public class BetaAccessEvaluator {

    public static class User {
        public String id;
        public String accountStatus;   // "active" | outro
        public boolean complianceBlock;
        public boolean internal;
        public String plan;            // "enterprise" | outro
        public String region;
        public boolean trial;
    }

    public static class Feature {
        public boolean enabled;
        public boolean experimentalOnly;
        public List<String> allowedRegions;
        public boolean allowTrial;
        public List<String> manualOverrides;
    }

    /**
     * Decide se um usuário corporativo pode ativar uma funcionalidade experimental.
     *
     * @param user    dados do usuário corporativo
     * @param feature configuração da funcionalidade beta
     * @return true se o usuário é elegível, false caso contrário
     *
     * TODO: refatore preservando as regras descritas no enunciado.
     * Dica: extraia métodos auxiliares com nomes que revelem intenção para cada
     *       verificação atômica; organize a estrutura de decisão de forma que
     *       a precedência das regras e das exceções seja legível sem simular
     *       a expressão booleana.
     */
    public boolean canActivateBetaFeature(User user, Feature feature) {
        // TODO: substitua a expressão booleana densa por predicados nomeados.
        //       Não altere a assinatura nem o valor de retorno.
        return false;
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Problemas de legibilidade identificados:**
- Expressão booleana de múltiplas linhas que mistura bloqueios globais, elegibilidades por perfil e exceção de override sem separação visual ou semântica.
- A repetição de `!user.complianceBlock` dentro do `||` do override cria falsa impressão de que o override poderia superar o bloqueio de compliance, quando na verdade a primeira ocorrência fora do parêntese já o impede — a redundância oculta a intenção.
- Negações (`!user.complianceBlock`) embutidas em conjunções e disjunções aumentam a carga cognitiva de rastrear o valor final.
- A precedência implícita de `&&` sobre `||` exige que o leitor simule a avaliação mentalmente para entender quais condições são globais (AND externo) e quais são alternativas (OR interno).

**Predicados nomeados sugeridos:**
- `isAccountActive(user)` → `user.accountStatus === 'active'`
- `isComplianceBlocked(user)` → `user.complianceBlock === true`
- `isFeatureEnabled(feature)` → `feature.enabled === true`
- `isInternalWithExperimentalAccess(user, feature)` → `user.internal && feature.experimentalOnly`
- `isEnterpriseInAllowedRegion(user, feature)` → `user.plan === 'enterprise' && feature.allowedRegions.includes(user.region)`
- `isTrialAllowed(user, feature)` → `user.trial && feature.allowTrial`
- `hasManualOverride(user, feature)` → `feature.manualOverrides.includes(user.id)`

**Organização esperada da precedência:**
1. Guard imediato: se `isComplianceBlocked(user)` → retorna `false` (prevalece sobre tudo, inclusive override).
2. Verificações globais obrigatórias: `isAccountActive(user)` e `isFeatureEnabled(feature)` — se qualquer uma falhar, retorna `false`.
3. Elegibilidade pelo perfil: retorna `true` se qualquer uma das condições for verdadeira:
   - `isInternalWithExperimentalAccess(user, feature)`
   - `isEnterpriseInAllowedRegion(user, feature)`
   - `isTrialAllowed(user, feature)`
   - `hasManualOverride(user, feature)`
4. Retorno padrão: `false`.

**Ponto-chave sobre a redundância do override original:** a condição `feature.manualOverrides.includes(user.id) && !user.complianceBlock` no código original é funcionalmente equivalente a apenas `feature.manualOverrides.includes(user.id)`, pois `!user.complianceBlock` já está garantido pelo `&&` externo. A refatoração deve explicitar isso separando o guard de compliance no início, tornando o override limpo e sem redundância desnecessária.

**Preservação obrigatória:** para qualquer combinação de `user` e `feature`, o valor de retorno da função refatorada deve ser idêntico ao do código original.
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
- A questão pertence corretamente a `codeQuality/readability`: o foco é tornar uma lógica booleana densa compreensível por meio de predicados nomeados, explicitação de precedência e redução de complexidade cognitiva, sem deslocar a tarefa para RBAC, arquitetura de rollout ou sistema de feature flags.
- A dificuldade `advanced` está adequada, pois a resposta precisa preservar comportamento em várias regras sobrepostas, reconhecer a redundância do bloqueio de compliance no override, organizar guards globais e justificar a decomposição de predicados.
- O formato `code` está válido, com `inputConfig.type: code`, templates coerentes para JavaScript, Python e Java, e a mesma tarefa representada nas três linguagens. O código inicial do enunciado é funcional e tem baixa legibilidade por complexidade booleana real.
- O enunciado explicita as regras de elegibilidade, as exceções e a obrigação de preservar comportamento; a rubrica avalia preservação de comportamento, clareza dos nomes, organização da lógica, redução da complexidade cognitiva e justificativa com critérios observáveis.
- O `solution-outline` permanece no escopo de legibilidade/refatoração local e não transforma a solução esperada em autorização ampla, RBAC ou arquitetura de feature flags.
- O prompt de avaliação segue o padrão de `prompts/`, usa placeholders compatíveis com questão `code` e reproduz corretamente os ids e pesos da rubrica no JSON esperado.
- As referências estão presentes, são plausíveis para legibilidade, decomposição de condicionais e complexidade cognitiva, e permanecem como `suggested_not_verified`.
<!-- /REVIEW:comments -->
