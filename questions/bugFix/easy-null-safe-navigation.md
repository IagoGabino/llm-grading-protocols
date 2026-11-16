---
id: easy-null-safe-navigation
slug: easy-null-safe-navigation
title: Correção de Bug — TypeError ao Acessar Propriedades Aninhadas
axis: bugFix
subtheme: runtime_errors
difficulty: easy
promptTemplate: easy-null-safe-navigation
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [null_reference, safe_navigation, defensive_programming, nested_access]
references:
  - id: ref-1
    title: "Optional Chaining (?.) — MDN Web Docs"
    type: official_docs
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining"
    relevance: 5
    confidence: 5
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Nullish Coalescing Operator (??) — MDN Web Docs"
    type: official_docs
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing"
    relevance: 4
    confidence: 5
    supports: [solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Effective Java, 3rd Edition — Item 54: Return empty collections or arrays, not nulls"
    type: book
    url: null
    relevance: 3
    confidence: 3
    supports: [rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Python dict.get() — Python Docs"
    type: official_docs
    url: "https://docs.python.org/3/library/stdtypes.html#dict.get"
    relevance: 4
    confidence: 5
    supports: [solution-outline]
    verificationStatus: suggested_not_verified
generationMetrics:
  validFormatSelfCheck: true
  rubricCriteriaCount: 4
  referencesSuggested: true
  plannedDifficulty: easy
  expectedType: code
  taxonomyFit: strong
inputConfig:
  type: code
  language: javascript
rubric:
  version: v1
  criteria:
    - id: root_cause
      name: Identificação da causa raiz
      weight: 0.35
      description: Identifica que o acesso direto a `user.profile.address.city` (e `.state`) lança TypeError/NullPointerException quando `profile` ou `address` são nulos/ausentes, nomeando o nível exato onde ocorre o crash.
    - id: functional_fix
      name: Correção funcional com navegação segura
      weight: 0.35
      description: Implementa corretamente uma das estratégias aceitas — optional chaining `?.` + `??` (JS), encadeamento de `.get()` ou `or` (Python), bloco `if` / `Optional` (Java) — garantindo retorno de `"Localização desconhecida"` quando qualquer nível do caminho estiver ausente.
    - id: fallback_correctness
      name: Aplicação correta do valor de fallback
      weight: 0.20
      description: Retorna exatamente `"Localização desconhecida"` (e não `null`, string vazia ou lança exceção) em todos os casos de ausência; retorna `"Cidade - Estado"` quando ambas as propriedades existem.
    - id: code_quality
      name: Qualidade e clareza do código corrigido
      weight: 0.10
      description: Penalizar pirâmide de `if` aninhados quando a linguagem oferece operador nativo mais conciso (e.g., `?.` no JS); valorizar código expressivo e sem repetição desnecessária.
---

<!-- SECTION:statement -->
A função `formatUserLocation` recebe um objeto representando um usuário e deve retornar uma string no padrão `"Cidade - Estado"`. No entanto, para usuários recém-cadastrados, o objeto `profile` ou o objeto `address` podem ser `null` ou ausentes — e o código atual trava com `TypeError` ao tentar acessar `user.profile.address.city` nesses casos.

**Contrato esperado:**
- Se `profile` **e** `address` **e** ambas as propriedades (`city` e `state`) existirem → retorna `"<city> - <state>"`.
- Se qualquer parte do caminho for nula, `undefined`, ausente, ou se `city`/`state` forem `null`/`undefined` → retorna `"Localização desconhecida"`.
- A função **nunca** deve lançar exceção, independentemente do formato do objeto recebido.

**Comportamento incorreto (bug):**

Com os dados abaixo, o código atual trava em tempo de execução:

```javascript
// Usuário recém-cadastrado — sem perfil preenchido
const newUser = { id: 7, name: "Ana" };
formatUserLocation(newUser);
// ❌ TypeError: Cannot read properties of undefined (reading 'address')

// Usuário com perfil, mas sem endereço
const partialUser = { id: 8, name: "Bruno", profile: { bio: "Dev" } };
formatUserLocation(partialUser);
// ❌ TypeError: Cannot read properties of undefined (reading 'city')

// Usuário completo — deve funcionar
const fullUser = { id: 9, name: "Carla", profile: { address: { city: "BH", state: "MG" } } };
formatUserLocation(fullUser);
// ✅ "BH - MG"
```

**Tarefa:** Corrija `formatUserLocation` para que nunca lance exceção. Na sua **linha de raciocínio**, explique: (1) qual é a causa exata do crash, (2) qual técnica você usou para navegar com segurança pelas propriedades aninhadas e (3) por que o valor de fallback é retornado quando qualquer nível estiver ausente.

```javascript
// location.js
function formatUserLocation(user) {
  const city  = user.profile.address.city;
  const state = user.profile.address.state;
  return `${city} - ${state}`;
}

module.exports = { formatUserLocation };
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// location.js

/**
 * Retorna a localização formatada do usuário.
 * @param {object} user
 * @returns {string} "Cidade - Estado" ou "Localização desconhecida"
 */
function formatUserLocation(user) {
  // TODO: acesse user.profile.address.city e .state de forma segura.
  // Retorne "Localização desconhecida" se qualquer nível do caminho for nulo/ausente.
}

module.exports = { formatUserLocation };
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# location.py

def format_user_location(user: dict) -> str:
    """
    Retorna a localização formatada do usuário.
    Retorna "Localização desconhecida" se qualquer parte do caminho estiver ausente.
    """
    # TODO: navegue com segurança por user["profile"]["address"]["city"] e ["state"].
    # Use dict.get() ou verificações explícitas para evitar KeyError/TypeError.
    pass
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// LocationFormatter.java

public class LocationFormatter {

    /**
     * Retorna a localização formatada do usuário.
     * Retorna "Localização desconhecida" se profile, address, city ou state forem nulos.
     */
    public static String formatUserLocation(User user) {
        // TODO: verifique user, user.getProfile(), user.getProfile().getAddress()
        // antes de acessar city e state. Use if-guards ou Optional<T>.
        return null;
    }

    // --- Modelo de dados fornecido (não altere) ---
    public record Address(String city, String state) {}
    public record Profile(Address address) {}
    public record User(int id, String name, Profile profile) {}
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Causa raiz**
- O acesso em cadeia `user.profile.address.city` não realiza nenhuma verificação intermediária. Se `user.profile` for `null` ou `undefined`, a tentativa de ler `.address` sobre `null` lança `TypeError` (JS) / `AttributeError` (Python) / `NullPointerException` (Java) antes de chegar à propriedade `city`.

**Correções aceitas por linguagem**

*JavaScript (preferencial — mais conciso):*
```javascript
function formatUserLocation(user) {
  const city  = user?.profile?.address?.city;
  const state = user?.profile?.address?.state;
  if (!city || !state) return "Localização desconhecida";
  return `${city} - ${state}`;
}
// ou em uma linha:
// return user?.profile?.address?.city && user?.profile?.address?.state
//   ? `${user.profile.address.city} - ${user.profile.address.state}`
//   : "Localização desconhecida";
```

*Python:*
```python
def format_user_location(user: dict) -> str:
    profile = user.get("profile") or {}
    address = profile.get("address") or {}
    city    = address.get("city")
    state   = address.get("state")
    if not city or not state:
        return "Localização desconhecida"
    return f"{city} - {state}"
```

*Java (verificações explícitas):*
```java
public static String formatUserLocation(User user) {
    if (user == null || user.profile() == null
            || user.profile().address() == null) {
        return "Localização desconhecida";
    }
    String city  = user.profile().address().city();
    String state = user.profile().address().state();
    if (city == null || state == null) {
        return "Localização desconhecida";
    }
    return city + " - " + state;
}
// Alternativa aceita: Optional.ofNullable(user).map(User::profile)...
```

**Critérios de qualidade**
- JS: penalizar pirâmide de `if` aninhados; `?.` com `??` ou curto-circuito é o padrão esperado.
- Python: `dict.get()` com fallback `{}` é mais idiomático do que `try/except KeyError` para este cenário.
- Java: `Optional` é aceito; sequência de `if` com retorno antecipado também é válida e clara.

**Casos de borda cobertos pela correção**
- `user` é `null` / `None` → retorna fallback sem crash.
- `profile` existe mas `address` é `null` → retorna fallback.
- `address` existe mas `city` ou `state` são `null`/`""` → retorna fallback.
- Todos os campos presentes → retorna `"<city> - <state>"`.
<!-- /SECTION:solution-outline -->

<!-- REVIEW:metrics -->
{
  "quality": {
    "technicalCorrectness": 5,
    "statementClarity": 5,
    "rubricAlignment": 4,
    "difficultyAlignment": 5
  },
  "compatibility": {
    "promptAlignment": 4,
    "formatValid": true
  },
  "recommendation": "minor_revision",
  "statusAfterReview": "needs_human_review",
  "mainIssue": "rubric",
  "revisionLevelNeeded": "light",
  "suggestedChangedParts": ["rubric", "prompt"],
  "referencesStatus": "present"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendacao: minor_revision.

Principais pontos:
- A questao esta tecnicamente correta, permanece estritamente easy e usa codigo inicial curto o bastante para o nivel esperado.
- O enunciado define explicitamente o fallback esperado, incluindo a string exata "Localizacao desconhecida", o que torna a avaliacao objetiva.
- O solution-outline esta alinhado ao objetivo de aprendizagem: recomenda optional chaining em JavaScript, dict.get() encadeado em Python e verificacoes explicitas ou Optional em Java.
- A rubrica e o prompt de avaliacao poderiam explicitar melhor a tolerancia a estilos menos idiomaticos. Uma solucao com try/catch pode impedir o crash e retornar o fallback, mas deve perder pontos apenas em qualidade/idiomaticidade ou em explicacao da causa, conforme decisao humana. Hoje o prompt orienta a penalizar "try/catch global" de modo mais forte do que a rubrica deixa claro.
- O prompt de avaliacao foca na mecanica central de prevencao de erro em tempo de execucao e os ids/pesos batem com a rubrica; recomenda-se apenas ajustar a instrucao sobre try/catch para separar correcao funcional de estilo.
- As referencias estao presentes e plausiveis para apoiar a questao, mantendo verificacao humana posterior.
<!-- /REVIEW:comments -->
