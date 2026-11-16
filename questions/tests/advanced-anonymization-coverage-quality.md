---
id: advanced-anonymization-coverage-quality
slug: advanced-anonymization-coverage-quality
title: "Testes — Qualidade de Cobertura em Serviço de Anonimização de Dados para Export"
axis: tests
subtheme: coverage_and_quality
difficulty: advanced
promptTemplate: advanced-anonymization-coverage-quality
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [coverage_gap, weak_assertions, anonymization, privacy, mutation_testing, branch_coverage, edge_cases, data_export]
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
    title: "Martin Fowler — Test Coverage"
    type: technical_blog
    url: "https://martinfowler.com/bliki/TestCoverage.html"
    relevance: 5
    confidence: 5
    supports: [statement, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "GDPR — General Data Protection Regulation (Regulation EU 2016/679)"
    type: official_docs
    url: "https://gdpr-info.eu/"
    relevance: 3
    confidence: 4
    supports: [statement]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "xUnit Test Patterns: Refactoring Test Code — Gerard Meszaros"
    type: book
    url: null
    relevance: 4
    confidence: 4
    supports: [rubric, solution-outline]
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
    - id: coverage_diagnosis
      name: Diagnóstico das limitações da cobertura atual
      weight: 0.20
      description: "O aluno explica por que a suíte atual é enganosa apesar de cobrir linhas: os testes apenas verificam que o retorno é truthy e que existe um campo `id`, sem inspecionar se email, telefone e fullName foram realmente mascarados. Identifica que cobertura de linhas não detecta asserts fracos e que bugs de vazamento de campo sensível passariam todos os testes existentes."
    - id: sensitive_field_assertions
      name: Asserts sobre campos sensíveis e preservados
      weight: 0.30
      description: "A suíte melhorada contém testes que: (1) verificam que `email` no resultado é diferente do original e segue o formato de mascaramento esperado (ex.: apenas o domínio preservado ou caracteres substituídos); (2) verificam que `phone` no resultado contém apenas os dois últimos dígitos expostos; (3) verificam que `fullName` foi removido ou substituído por valor genérico; (4) verificam que `id`, `role` e `createdAt` são preservados intactos. Asserts usam valores concretos, não apenas truthy."
    - id: immutability_and_edge_cases
      name: Não mutação do input e casos de borda
      weight: 0.25
      description: "Inclui teste que verifica que o objeto original não foi modificado após a chamada (comparando propriedades antes e depois, ou usando cópia profunda como referência). Cobre pelo menos dois casos de borda relevantes: ausência de campo opcional (ex.: `phone` ausente, `fullName` ausente) sem lançar exceção, e objeto com todos os campos presentes."
    - id: bug_detection_reasoning
      name: Raciocínio sobre detecção de bugs e mutações
      weight: 0.15
      description: "O aluno explica, para cada grupo de testes adicionados, qual bug concreto seria detectado — por exemplo: 'se o campo email não for mascarado, o teste X falha porque compara o valor retornado com o email original'. Demonstra raciocínio sobre invariantes e sobre quais mutações na implementação os testes capturariam."
    - id: line_vs_branch_coverage
      name: Discussão sobre line coverage vs. qualidade real
      weight: 0.10
      description: "Explica brevemente por que line coverage isolada é insuficiente: uma suíte pode executar todas as linhas sem nunca verificar os valores produzidos. Menciona branch coverage ou assertion density como métricas complementares. Não exige ferramentas de mutation testing, mas pode citá-las conceitualmente."
---

<!-- SECTION:statement -->
## Contexto

Um serviço interno de analytics exporta dados de usuários para um dataset de suporte, mas antes de exportar precisa **anonimizar** os registros para obedecer a políticas internas de privacidade. A função `anonymizeUser` foi implementada e a equipe escreveu uma suíte de testes que **aparentemente atinge alta cobertura de linhas** — toda linha da função é executada ao menos uma vez. No entanto, a suíte é enganosa: ela verifica apenas que a função retorna um objeto e que o campo `id` existe. Bugs graves passariam despercebidos.

**Contrato da função `anonymizeUser`:**

- Recebe um objeto de usuário com os campos: `id` (string), `fullName` (string), `email` (string), `phone` (string, opcional), `role` (string) e `createdAt` (string ISO).
- Retorna um **novo objeto** anonimizado (não muta o original).
- **Campos preservados intactos:** `id`, `role`, `createdAt`.
- **`fullName`:** substituído pela string `"REDACTED"`.
- **`email`:** mascarado — apenas o domínio é preservado; a parte local é substituída por `"***"`. Exemplo: `"alice@example.com"` → `"***@example.com"`.
- **`phone`:** se presente, mascarado — apenas os dois últimos caracteres são preservados e o restante é substituído por `"****"`. Exemplo: `"(31) 99999-1234"` → `"****34"`. Se ausente, o campo não aparece no resultado.
- Não lança exceção quando campos opcionais (`phone`) estão ausentes.

**Código a ser testado (JavaScript):**

```javascript
// src/anonymizeUser.js

/**
 * Anonimiza os dados de um usuário antes de exportar para analytics.
 * @param {{ id: string, fullName: string, email: string, phone?: string, role: string, createdAt: string }} user
 * @returns {{ id: string, fullName: string, email: string, phone?: string, role: string, createdAt: string }}
 */
function anonymizeUser(user) {
  const [, domain] = user.email.split('@');
  const maskedEmail = `***@${domain}`;

  const result = {
    id: user.id,
    fullName: 'REDACTED',
    email: maskedEmail,
    role: user.role,
    createdAt: user.createdAt,
  };

  if (user.phone !== undefined) {
    const raw = user.phone.replace(/\D/g, '');
    result.phone = `****${raw.slice(-2)}`;
  }

  return result;
}

module.exports = { anonymizeUser };
```

**Suíte de testes atual (com problemas de qualidade):**

```javascript
// test/anonymizeUser.test.js
const { anonymizeUser } = require('../src/anonymizeUser');

describe('anonymizeUser', () => {
  const sampleUser = {
    id: 'u-001',
    fullName: 'Alice Ferreira',
    email: 'alice@example.com',
    phone: '(31) 99999-1234',
    role: 'analyst',
    createdAt: '2024-03-10T08:00:00Z',
  };

  test('retorna um objeto', () => {
    const result = anonymizeUser(sampleUser);
    expect(result).toBeTruthy();              // assert fraco: qualquer objeto passa
  });

  test('resultado tem campo id', () => {
    const result = anonymizeUser(sampleUser);
    expect(result.id).toBeDefined();          // assert fraco: não verifica o valor
  });

  test('não lança exceção', () => {
    expect(() => anonymizeUser(sampleUser)).not.toThrow(); // não verifica nenhum valor
  });
});
```

> **Atenção:** essa suíte executa todas as linhas de `anonymizeUser` — logo, reporta ~100% de cobertura de linhas. Ainda assim, os três testes passariam mesmo se a função retornasse o `user` original sem qualquer mascaramento, ou se vazasse o email completo, ou se mutasse o objeto de entrada.

**Sua tarefa:**

1. **Identifique** por que a suíte atual é enganosa apesar da alta cobertura de linhas: quais bugs ela **não** detectaria e por que os asserts são insuficientes.
2. **Melhore a suíte de testes** adicionando casos que cubram:
   - Mascaramento correto do `email` (verificar o valor exato retornado).
   - Mascaramento correto do `phone` (verificar que apenas os dois últimos dígitos estão expostos).
   - Substituição de `fullName` por `"REDACTED"`.
   - Preservação intacta de `id`, `role` e `createdAt`.
   - Não mutação do objeto original após a chamada.
   - Ausência de `phone` no input (campo omitido) sem lançar exceção e sem aparecer no resultado.
3. Use **asserts com valores concretos** — não apenas `toBeDefined()` ou `toBeTruthy()`.
4. Para cada grupo de testes adicionados, **explique qual bug seria detectado** caso a implementação estivesse incorreta (raciocínio sobre invariantes).
5. **Discuta brevemente** por que line coverage isolada não garante qualidade de cobertura e o que seria necessário para uma suíte realmente confiável.
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// test/anonymizeUser.test.js
const { anonymizeUser } = require('../src/anonymizeUser');

describe('anonymizeUser', () => {
  const sampleUser = {
    id: 'u-001',
    fullName: 'Alice Ferreira',
    email: 'alice@example.com',
    phone: '(31) 99999-1234',
    role: 'analyst',
    createdAt: '2024-03-10T08:00:00Z',
  };

  // Testes existentes (não remova — avalie se os asserts são suficientes)
  test('retorna um objeto', () => {
    const result = anonymizeUser(sampleUser);
    expect(result).toBeTruthy();
  });

  test('resultado tem campo id', () => {
    const result = anonymizeUser(sampleUser);
    expect(result.id).toBeDefined();
  });

  test('não lança exceção', () => {
    expect(() => anonymizeUser(sampleUser)).not.toThrow();
  });

  // TODO: adicione testes para mascaramento de email
  // describe('mascaramento de email', () => { ... })

  // TODO: adicione testes para mascaramento de phone
  // describe('mascaramento de phone', () => { ... })

  // TODO: adicione testes para substituição de fullName
  // describe('fullName redacted', () => { ... })

  // TODO: adicione testes para campos preservados (id, role, createdAt)
  // describe('campos não sensíveis preservados', () => { ... })

  // TODO: adicione teste de não mutação do objeto original
  // test('não muta o objeto de entrada', () => { ... })

  // TODO: adicione testes para campo phone ausente
  // describe('phone ausente', () => { ... })
});

/*
 * Linha de raciocínio (escreva como comentário):
 *
 * TODO: explique por que a suíte original é enganosa, qual bug cada
 * grupo de testes adicionado detectaria, e discuta line coverage vs.
 * qualidade real.
 */
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# test_anonymize_user.py
import unittest
import copy


# Módulo sob teste (não altere)
def anonymize_user(user: dict) -> dict:
    local, domain = user['email'].split('@')
    masked_email = f'***@{domain}'

    result = {
        'id': user['id'],
        'fullName': 'REDACTED',
        'email': masked_email,
        'role': user['role'],
        'createdAt': user['createdAt'],
    }

    if 'phone' in user:
        raw = ''.join(c for c in user['phone'] if c.isdigit())
        result['phone'] = f'****{raw[-2:]}'

    return result


class TestAnonymizeUser(unittest.TestCase):

    def setUp(self):
        self.sample_user = {
            'id': 'u-001',
            'fullName': 'Alice Ferreira',
            'email': 'alice@example.com',
            'phone': '(31) 99999-1234',
            'role': 'analyst',
            'createdAt': '2024-03-10T08:00:00Z',
        }

    # Testes existentes (mantenha — avalie se os asserts são suficientes)
    def test_retorna_objeto(self):
        result = anonymize_user(self.sample_user)
        self.assertIsNotNone(result)           # assert fraco

    def test_resultado_tem_id(self):
        result = anonymize_user(self.sample_user)
        self.assertIn('id', result)            # assert fraco

    def test_nao_lanca_excecao(self):
        try:
            anonymize_user(self.sample_user)
        except Exception:
            self.fail('anonymize_user lançou exceção inesperada')

    # TODO: adicione testes para mascaramento de email
    # def test_email_mascarado_preserva_dominio(self): ...
    # def test_email_mascarado_nao_contem_parte_local_original(self): ...

    # TODO: adicione testes para mascaramento de phone
    # def test_phone_mascarado_expoe_apenas_dois_ultimos_digitos(self): ...

    # TODO: adicione teste para substituição de fullName
    # def test_full_name_substituido_por_redacted(self): ...

    # TODO: adicione testes para campos preservados
    # def test_campos_nao_sensiveis_preservados(self): ...

    # TODO: adicione teste de não mutação
    # def test_nao_muta_objeto_original(self): ...

    # TODO: adicione testes para phone ausente
    # def test_sem_phone_nao_lanca_excecao(self): ...
    # def test_sem_phone_resultado_nao_contem_campo_phone(self): ...


if __name__ == '__main__':
    unittest.main()

# Linha de raciocínio (escreva como docstring ou comentário):
# TODO: explique por que a suíte original é enganosa, qual bug cada
# grupo de testes adicionado detectaria, e discuta line coverage vs.
# qualidade real.
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// AnonymizeUserTest.java
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.util.HashMap;
import java.util.Map;

// Módulo sob teste — não altere
class AnonymizeUser {
    /**
     * Anonimiza os dados de um usuário para exportação.
     * Campos sensíveis: fullName → "REDACTED", email → "***@domain", phone → "****XX" (últimos 2 dígitos).
     * Campos preservados: id, role, createdAt.
     * phone é opcional; se ausente, não aparece no resultado.
     */
    public static Map<String, String> anonymize(Map<String, String> user) {
        String[] parts = user.get("email").split("@", 2);
        String maskedEmail = "***@" + parts[1];

        Map<String, String> result = new HashMap<>();
        result.put("id",        user.get("id"));
        result.put("fullName",  "REDACTED");
        result.put("email",     maskedEmail);
        result.put("role",      user.get("role"));
        result.put("createdAt", user.get("createdAt"));

        if (user.containsKey("phone")) {
            String digits = user.get("phone").replaceAll("\\D", "");
            result.put("phone", "****" + digits.substring(digits.length() - 2));
        }

        return result;
    }
}

class AnonymizeUserTest {

    private Map<String, String> sampleUser;

    @BeforeEach
    void setUp() {
        sampleUser = new HashMap<>();
        sampleUser.put("id",        "u-001");
        sampleUser.put("fullName",  "Alice Ferreira");
        sampleUser.put("email",     "alice@example.com");
        sampleUser.put("phone",     "(31) 99999-1234");
        sampleUser.put("role",      "analyst");
        sampleUser.put("createdAt", "2024-03-10T08:00:00Z");
    }

    // Testes existentes (mantenha — avalie se os asserts são suficientes)
    @Test
    void retornaObjeto() {
        Map<String, String> result = AnonymizeUser.anonymize(sampleUser);
        assertNotNull(result);                    // assert fraco
    }

    @Test
    void resultadoTemId() {
        Map<String, String> result = AnonymizeUser.anonymize(sampleUser);
        assertTrue(result.containsKey("id"));     // assert fraco
    }

    @Test
    void naoLancaExcecao() {
        assertDoesNotThrow(() -> AnonymizeUser.anonymize(sampleUser));
    }

    // TODO: adicione testes para mascaramento de email
    // @Nested class MascaramentoDeEmail { ... }

    // TODO: adicione testes para mascaramento de phone
    // @Nested class MascaramentoDeTelefone { ... }

    // TODO: adicione teste para substituição de fullName
    // @Nested class FullNameRedacted { ... }

    // TODO: adicione testes para campos preservados (id, role, createdAt)
    // @Nested class CamposPreservados { ... }

    // TODO: adicione teste de não mutação do objeto original
    // @Test void naoMutaObjetoOriginal() { ... }

    // TODO: adicione testes para phone ausente
    // @Nested class PhoneAusente { ... }
}

/*
 * Linha de raciocínio (escreva como comentário):
 *
 * TODO: explique por que a suíte original é enganosa, qual bug cada
 * grupo de testes adicionado detectaria, e discuta line coverage vs.
 * qualidade real.
 */
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Diagnóstico da suíte original**

- Os três testes executam todas as linhas de `anonymizeUser`, atingindo ~100% de line coverage.
- Nenhum teste verifica se `email` foi realmente mascarado — um bug que retornasse o email original passaria nos três testes.
- Nenhum teste verifica se `phone` foi mascarado ou se expõe mais dígitos do que o esperado.
- Nenhum teste verifica se `fullName` foi substituído por `"REDACTED"`.
- `toBeTruthy()` e `toBeDefined()` passam com qualquer valor não nulo — inclusive com o objeto de entrada intacto.
- A suíte é enganosa porque confunde execução de código com verificação de comportamento.

**Cenários mínimos que a suíte melhorada deve incluir**

- **Mascaramento de email:**
  - `email` retornado é `"***@example.com"` (não contém `"alice"`).
  - Parte local original (`"alice"`) não aparece no resultado.
  - Domínio é preservado intacto.

- **Mascaramento de phone:**
  - `phone` retornado é `"****34"` para entrada `"(31) 99999-1234"`.
  - Dígitos além dos dois últimos não aparecem no resultado.

- **Substituição de fullName:**
  - `fullName` retornado é exatamente `"REDACTED"`.
  - `"Alice Ferreira"` não aparece no resultado.

- **Campos preservados:**
  - `id`, `role` e `createdAt` têm o mesmo valor do input.
  - Nenhum campo extra inesperado aparece no resultado.

- **Não mutação do input:**
  - Após a chamada, `user.email`, `user.fullName` e `user.phone` ainda têm os valores originais.
  - Estratégia: guardar cópia profunda antes da chamada e comparar depois.

- **Campo `phone` ausente:**
  - Chamada não lança exceção.
  - O objeto retornado não contém o campo `phone`.

**Raciocínio sobre detecção de bugs e mutações**

- Se `email` não for mascarado: o teste `expect(result.email).toBe('***@example.com')` falha.
- Se `fullName` não for substituído: o teste `expect(result.fullName).toBe('REDACTED')` falha.
- Se o objeto original for mutado: o teste de imutabilidade detecta que `user.fullName !== 'Alice Ferreira'` após a chamada.
- Se `phone` ausente causar exceção: o teste de campo ausente captura o erro.
- Se `id` for modificado: o teste de campos preservados detecta divergência de valor.

**Line coverage vs. qualidade real**

- Line coverage mede se cada linha foi executada, não se o comportamento foi verificado. Uma suíte com `expect(result).toBeTruthy()` pode atingir 100% sem detectar um único bug de valor.
- Branch coverage é mais rica: exige que cada decisão condicional seja exercitada em ambos os sentidos (ex.: `phone` presente e ausente).
- Assertion density e mutation score são métricas ainda mais próximas da qualidade real: quantos asserts há por caminho e quantas mutações na lógica são detectadas pelos testes.
- A conclusão pedagógica central: cobertura alta sem asserts significativos é uma falsa sensação de segurança.
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
Recomendacao: accept.

Principais pontos:
- A questao pertence claramente a `tests/coverage_and_quality`: o foco esta na diferenca entre cobertura de linhas aparente e capacidade real da suite de detectar defeitos por meio de asserts, branches, bordas e invariantes.
- A dificuldade `advanced` esta adequada, pois exige diagnostico critico da suite existente, escolha de cenarios relevantes, verificacao de nao mutacao, cobertura de campo opcional, raciocinio sobre bugs/mutacoes conceituais e discussao de line coverage versus qualidade real.
- O formato `code` esta valido. Os templates de JavaScript, Python e Java representam o mesmo contrato de `anonymizeUser`/`anonymize_user`/`AnonymizeUser.anonymize`, com a mesma tarefa central: melhorar testes sem reimplementar a funcao.
- A suite inicial e realisticamente fraca: executa a funcao, mas usa asserts como truthy, campo definido e ausencia de excecao, que nao detectariam vazamento de email, telefone, nome completo, perda de campos preservados ou mutacao do input.
- O enunciado deixa claro que o aluno deve melhorar a suite de testes e justificar a estrategia, nao alterar a funcao sob teste. Os comportamentos esperados sao explicitos e avaliaveis.
- A rubrica e observavel e alinhada ao objetivo: avalia diagnostico da suite, asserts para campos sensiveis e preservados, nao mutacao, casos de borda, raciocinio sobre defeitos/mutacoes e discussao de cobertura.
- O prompt de avaliacao segue o padrao real de `prompts/` para questoes `code`, usa placeholders compativeis (`enunciado`, `rubrica`, `pontos_esperados`, `codigo`, `raciocinio`) e reproduz corretamente os ids e pesos da rubrica.
- As referencias sao plausiveis e conservadoras para qualidade de testes/cobertura; a referencia de GDPR e periferica ao contexto, mas nao desloca a questao para privacidade juridica. Todas permanecem corretamente como `suggested_not_verified`.
<!-- /REVIEW:comments -->
