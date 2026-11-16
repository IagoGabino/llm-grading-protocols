---
id: intermediate-permission-coverage-quality
slug: intermediate-permission-coverage-quality
title: "Testes — Qualidade de Cobertura em Módulo de Controle de Permissões"
axis: tests
subtheme: coverage_and_quality
difficulty: intermediate
promptTemplate: intermediate-permission-coverage-quality
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [coverage_gap, weak_assertions, authorization, negative_cases, edge_cases]
references:
  - id: ref-1
    title: "The Art of Unit Testing, 3rd Edition"
    type: book
    url: null
    relevance: 5
    confidence: 4
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Growing Object-Oriented Software, Guided by Tests"
    type: book
    url: null
    relevance: 4
    confidence: 4
    supports: [rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "OWASP Testing Guide — Authorization Testing"
    type: official_docs
    url: "https://owasp.org/www-project-web-security-testing-guide/stable/4-Web_Application_Security_Testing/05-Authorization_Testing/"
    relevance: 3
    confidence: 3
    supports: [statement]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Martin Fowler — Test Coverage"
    type: technical_blog
    url: "https://martinfowler.com/bliki/TestCoverage.html"
    relevance: 5
    confidence: 5
    supports: [statement, rubric]
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
    - id: gap_identification
      name: Identificação das lacunas da suíte inicial
      weight: 0.20
      description: "Identifica explicitamente as lacunas: ausência de cenários negativos (sem permissão, papel inválido), recurso inativo, permissão herdada, e asserts fracos que não verificam o motivo da negação."
    - id: scenario_coverage
      name: Cobertura de cenários relevantes
      weight: 0.30
      description: "Inclui testes para: (1) acesso permitido (caminho feliz), (2) usuário sem permissão direta, (3) papel inválido/inexistente, (4) recurso inativo, (5) permissão herdada via papel pai."
    - id: assertion_quality
      name: Qualidade dos asserts
      weight: 0.25
      description: "Asserts verificam não apenas o booleano de resultado, mas também o campo `reason` retornado nos casos de negação. Evita asserts que passariam mesmo com implementação errada."
    - id: negative_and_edge_cases
      name: Casos negativos e de borda
      weight: 0.15
      description: "Cobre pelo menos dois cenários de borda relevantes, como papel null/undefined, recurso com status inválido, ou usuário com lista de papéis vazia."
    - id: strategy_justification
      name: Justificativa da estratégia e diferença cobertura vs qualidade
      weight: 0.10
      description: "Explica por que a suíte original era enganosa apesar da alta cobertura de linhas, e como os novos testes aumentam a confiança real no comportamento do módulo."
---

<!-- SECTION:statement -->
## Contexto

O módulo `PermissionChecker` decide se um usuário pode executar uma ação em um recurso com base no papel (`role`) do usuário e no status do recurso. A suíte de testes atual **passa com 90% de cobertura de linhas**, mas os testes são fracos: testam apenas o caminho feliz e não verificam os campos relevantes do resultado.

**Contratos do módulo:**

- `canAccess(user, action, resource)` retorna `{ allowed: boolean, reason?: string }`.
- Um usuário tem um campo `role` (string) e opcionalmente um campo `parentRole` (string) que representa um papel herdado.
- Um recurso tem um campo `status`: `'active'` ou `'inactive'`.
- A tabela de permissões define quais ações cada papel pode executar em recursos ativos.
- **Regras de negócio:**
  - Se `resource.status !== 'active'` → `{ allowed: false, reason: 'resource_inactive' }`.
  - Se `user.role` não existe na tabela de permissões → `{ allowed: false, reason: 'invalid_role' }`.
  - Se o papel direto do usuário não permite a ação, verifica-se o `parentRole` (herança de um nível).
  - Se nem o papel direto nem o herdado permite a ação → `{ allowed: false, reason: 'permission_denied' }`.
  - Se o papel (direto ou herdado) permite a ação e o recurso está ativo → `{ allowed: true }`.

**Código a ser testado (JavaScript):**

```javascript
// src/PermissionChecker.js
const PERMISSIONS = {
  admin:   ['read', 'write', 'delete'],
  editor:  ['read', 'write'],
  viewer:  ['read'],
};

/**
 * @param {{ role: string, parentRole?: string }} user
 * @param {string} action
 * @param {{ status: string }} resource
 * @returns {{ allowed: boolean, reason?: string }}
 */
function canAccess(user, action, resource) {
  if (resource.status !== 'active') {
    return { allowed: false, reason: 'resource_inactive' };
  }

  const directPerms = PERMISSIONS[user.role];
  if (!directPerms) {
    return { allowed: false, reason: 'invalid_role' };
  }

  if (directPerms.includes(action)) {
    return { allowed: true };
  }

  if (user.parentRole) {
    const parentPerms = PERMISSIONS[user.parentRole];
    if (parentPerms && parentPerms.includes(action)) {
      return { allowed: true };
    }
  }

  return { allowed: false, reason: 'permission_denied' };
}

module.exports = { canAccess, PERMISSIONS };
```

**Suíte de testes atual (com problemas de qualidade):**

```javascript
// test/PermissionChecker.test.js
const { canAccess } = require('../src/PermissionChecker');

describe('PermissionChecker', () => {
  test('admin pode fazer read', () => {
    const user     = { role: 'admin' };
    const resource = { status: 'active' };
    const result   = canAccess(user, 'read', resource);
    expect(result.allowed).toBe(true);   // assert fraco: não verifica ausência de `reason`
  });

  test('editor pode fazer write', () => {
    const user     = { role: 'editor' };
    const resource = { status: 'active' };
    const result   = canAccess(user, 'write', resource);
    expect(result.allowed).toBe(true);   // assert fraco: não verifica ausência de `reason`
  });

  test('viewer pode fazer read', () => {
    const user     = { role: 'viewer' };
    const resource = { status: 'active' };
    const result   = canAccess(user, 'read', resource);
    expect(result).toBeTruthy();         // assert muito fraco: qualquer objeto passa
  });
});
```

> **Atenção:** essa suíte atinge ~90% de cobertura de linhas porque as três linhas de retorno de sucesso são exercitadas — mas as quatro condições de negação nunca são testadas, e os asserts não verificam o campo `reason`.

**Sua tarefa:**

1. **Identifique** as lacunas da suíte atual: quais cenários críticos não são cobertos e por que os asserts são fracos.
2. **Melhore a suíte de testes** adicionando casos que cubram:
   - Usuário sem permissão para a ação (caminho negativo direto).
   - Papel inválido ou inexistente.
   - Recurso inativo.
   - Permissão concedida via `parentRole` (herança).
   - Pelo menos um caso de borda (ex.: `user.role` vazio/nulo, ou `parentRole` sem permissão suficiente).
3. Use **asserts significativos** que verifiquem o objeto completo ou, no mínimo, os campos `allowed` e `reason` juntos.
4. Na sua **linha de raciocínio**, explique:
   - Por que a suíte original era enganosa mesmo com alta cobertura de linhas.
   - Como cada grupo de testes adicionados aumenta a confiança no comportamento real do módulo.
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// test/PermissionChecker.test.js
const { canAccess } = require('../src/PermissionChecker');

describe('PermissionChecker.canAccess', () => {
  // Testes existentes (não remova — apenas melhore os asserts se necessário)
  test('admin pode fazer read em recurso ativo', () => {
    const user     = { role: 'admin' };
    const resource = { status: 'active' };
    expect(canAccess(user, 'read', resource)).toEqual({ allowed: true });
  });

  // TODO: adicione testes para os cenários listados no enunciado
  // Sugestão de organização:
  // describe('recurso inativo', ...)
  // describe('papel inválido', ...)
  // describe('sem permissão direta', ...)
  // describe('permissão herdada via parentRole', ...)
  // describe('casos de borda', ...)
});

/*
 * Linha de raciocínio (escreva abaixo como comentário ou string):
 *
 * TODO: explique as lacunas da suíte original e como os novos testes
 * aumentam a confiança no módulo.
 */
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# test_permission_checker.py
import unittest

# Supondo que o módulo esteja disponível:
# from permission_checker import can_access

PERMISSIONS = {
    'admin':  ['read', 'write', 'delete'],
    'editor': ['read', 'write'],
    'viewer': ['read'],
}

def can_access(user: dict, action: str, resource: dict) -> dict:
    if resource.get('status') != 'active':
        return {'allowed': False, 'reason': 'resource_inactive'}
    direct_perms = PERMISSIONS.get(user.get('role'))
    if direct_perms is None:
        return {'allowed': False, 'reason': 'invalid_role'}
    if action in direct_perms:
        return {'allowed': True}
    parent_role = user.get('parentRole')
    if parent_role:
        parent_perms = PERMISSIONS.get(parent_role)
        if parent_perms and action in parent_perms:
            return {'allowed': True}
    return {'allowed': False, 'reason': 'permission_denied'}


class PermissionCheckerTest(unittest.TestCase):
    # Teste existente (mantenha e melhore o assert se necessário)
    def test_admin_pode_fazer_read(self):
        user     = {'role': 'admin'}
        resource = {'status': 'active'}
        self.assertEqual(can_access(user, 'read', resource), {'allowed': True})

    # TODO: adicione os demais cenários descritos no enunciado
    # Sugestão de organização por método:
    # def test_recurso_inativo_nega_acesso(self): ...
    # def test_papel_invalido_nega_acesso(self): ...
    # def test_viewer_nao_pode_fazer_delete(self): ...
    # def test_permissao_herdada_via_parent_role(self): ...
    # def test_borda_role_nulo(self): ...


if __name__ == '__main__':
    unittest.main()

# Linha de raciocínio (escreva como docstring ou comentário):
# TODO: explique as lacunas da suíte original e como os novos testes
# aumentam a confiança no módulo.
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// PermissionCheckerTest.java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Nested;
import static org.assertj.core.api.Assertions.assertThat;

// Tipos auxiliares (disponíveis no escopo):
// record User(String role, String parentRole) {}
// record Resource(String status) {}
// record AccessResult(boolean allowed, String reason) {}
// class PermissionChecker { static AccessResult canAccess(User u, String action, Resource r) {...} }

public class PermissionCheckerTest {

    // Teste existente (mantenha e melhore o assert se necessário)
    @Test
    void adminPodeFazerReadEmRecursoAtivo() {
        User user         = new User("admin", null);
        Resource resource = new Resource("active");
        AccessResult result = PermissionChecker.canAccess(user, "read", resource);
        assertThat(result.allowed()).isTrue();
        assertThat(result.reason()).isNull();
    }

    // TODO: adicione os demais cenários descritos no enunciado.
    // Sugestão de organização com @Nested:
    // @Nested class QuandoRecursoInativo { ... }
    // @Nested class QuandoPapelInvalido { ... }
    // @Nested class QuandoSemPermissaoDireta { ... }
    // @Nested class QuandoPermissaoHerdada { ... }
    // @Nested class CasosDeBorda { ... }
}

/*
 * Linha de raciocínio (escreva como comentário):
 *
 * TODO: explique as lacunas da suíte original e como os novos testes
 * aumentam a confiança no módulo.
 */

// Tipos auxiliares necessários para compilar:
record User(String role, String parentRole) {}
record Resource(String status) {}
record AccessResult(boolean allowed, String reason) {}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Lacunas da suíte original**

- Apenas 3 testes, todos caminhos felizes (permissão concedida).
- Nenhum teste verifica negação de acesso (4 caminhos de `return false` nunca executados nos testes).
- O assert `expect(result.allowed).toBe(true)` não verifica a ausência de `reason` no sucesso.
- O assert `expect(result).toBeTruthy()` é praticamente inútil: qualquer objeto, inclusive `{ allowed: false }`, passaria.
- Alta cobertura de linhas (≈90%) é enganosa: cobre o fluxo de dados, mas não as decisões de negócio críticas.

**Cenários mínimos que a suíte melhorada deve incluir**

- **Caminho feliz (permissão direta):** `admin` faz `delete` em recurso ativo → `{ allowed: true }` (sem `reason`).
- **Sem permissão direta:** `viewer` tenta `write` em recurso ativo → `{ allowed: false, reason: 'permission_denied' }`.
- **Papel inválido:** usuário com `role: 'superuser'` → `{ allowed: false, reason: 'invalid_role' }`.
- **Recurso inativo:** qualquer usuário, qualquer ação, `status: 'inactive'` → `{ allowed: false, reason: 'resource_inactive' }`.
- **Permissão herdada:** `viewer` com `parentRole: 'editor'` tenta `write` → `{ allowed: true }` (herdou do pai).
- **Borda 1:** `parentRole` presente mas sem permissão suficiente (`viewer` com `parentRole: 'editor'` tenta `delete`) → `{ allowed: false, reason: 'permission_denied' }`.
- **Borda 2:** `user.role` é `null` ou `undefined` → `{ allowed: false, reason: 'invalid_role' }`.

**Por que os novos asserts aumentam a confiança**

- `toEqual({ allowed: false, reason: 'permission_denied' })` detecta bugs em que `allowed` é `false` mas `reason` está errado ou ausente.
- Testar cada condição de negação independentemente previne regressões quando a tabela de permissões for alterada.
- Testar herança de papel garante que a segunda verificação (`parentRole`) não seja silenciosamente quebrada por um refactor.

**Sobre cobertura de linhas vs. qualidade**

- Cobertura de linhas mede se cada linha foi executada ao menos uma vez, não se cada decisão foi testada em ambos os sentidos (true/false).
- Uma suíte pode atingir 100% de cobertura de linhas com asserts que não verificam nada relevante.
- Cobertura de ramos (branch coverage) e cobertura de condições são métricas mais ricas, mas ainda não substituem a escolha consciente de cenários de negócio críticos.
- Mutation testing (opcional, ex.: Stryker, Pitest) pode revelar asserts fracos, mas não é requisito central desta questão.
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
    "promptAlignment": 5,
    "formatValid": true
  },
  "recommendation": "minor_revision",
  "statusAfterReview": "needs_human_review",
  "mainIssue": "technical",
  "revisionLevelNeeded": "light",
  "suggestedChangedParts": ["statement", "solution-outline"],
  "referencesStatus": "present"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendação: minor_revision.

Principais pontos:
- A questão pertence claramente a `tests/coverage_and_quality`: o foco é melhorar uma suíte existente, identificar lacunas de cobertura e trocar asserts fracos por verificações significativas.
- A dificuldade está adequada para `intermediate`: exige análise da suíte inicial, seleção de cenários negativos e de borda, melhoria dos asserts e justificativa da estratégia, sem exigir técnicas avançadas como mutation testing.
- O formato `code` está compatível com os templates em JavaScript, Python e Java. As três versões representam o mesmo problema central: testar o comportamento de `canAccess` em permissões diretas, papéis inválidos, recurso inativo, herança via `parentRole` e bordas.
- A rubrica é observável e bem alinhada ao enunciado. Ela avalia identificação de lacunas, cenários relevantes, casos negativos e de borda, qualidade dos asserts e justificativa sobre cobertura de linhas versus confiança real.
- O prompt de avaliação segue o padrão real de `prompts/` para questões `code`, usa placeholders compatíveis (`enunciado`, `rubrica`, `pontos_esperados`, `codigo`, `raciocinio`) e reproduz corretamente os ids e pesos da rubrica.
- Ajuste recomendado: revisar a afirmação de que a suíte inicial passa com aproximadamente 90% de cobertura de linhas. Pelo código mostrado, os testes iniciais exercitam apenas caminhos felizes de permissão direta e não executam os ramos de negação nem o retorno de sucesso via `parentRole`, então o percentual exato parece tecnicamente frágil. Uma formulação mais conservadora seria dizer que a suíte aparenta boa cobertura ou cobre linhas do caminho feliz, mas não cobre decisões críticas.
- Também vale ajustar no `solution-outline` a frase sobre "três linhas de retorno de sucesso", pois os três testes iniciais exercitam o mesmo retorno de sucesso direto, não três retornos distintos. O ponto pedagógico está correto, mas a redação pode ficar mais precisa.
- As referências são plausíveis e conservadoras para o tema de qualidade de testes e autorização, e permanecem corretamente como `suggested_not_verified`.
<!-- /REVIEW:comments -->
