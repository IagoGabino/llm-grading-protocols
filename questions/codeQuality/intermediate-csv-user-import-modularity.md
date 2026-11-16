---
id: intermediate-csv-user-import-modularity
slug: intermediate-csv-user-import-modularity
title: "Qualidade de Código — Modularidade na Importação de Usuários CSV"
axis: codeQuality
subtheme: modularity
difficulty: intermediate
promptTemplate: intermediate-csv-user-import-modularity
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [modularity, single_responsibility, function_extraction, csv_import, refactoring]
references:
  - id: ref-1
    title: "Clean Code: A Handbook of Agile Software Craftsmanship"
    type: book
    url: null
    relevance: 5
    confidence: 5
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Refactoring: Improving the Design of Existing Code (2nd ed.)"
    type: book
    url: null
    relevance: 5
    confidence: 5
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Extract Function — Refactoring Catalog"
    type: technical_blog
    url: "https://refactoring.com/catalog/extractFunction.html"
    relevance: 4
    confidence: 4
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Single Responsibility Principle — Robert C. Martin"
    type: article
    url: null
    relevance: 4
    confidence: 4
    supports: [rubric, statement]
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
    - id: responsibility_identification
      name: Identificação das responsabilidades misturadas
      weight: 0.20
      description: >
        Reconhece e nomeia explicitamente as responsabilidades acumuladas na função original:
        parsing de campos, validação de obrigatoriedade, normalização de dados,
        acumulação de erros e montagem do resultado.
    - id: function_extraction
      name: Extração de funções coesas
      weight: 0.35
      description: >
        Extrai funções auxiliares com propósito único e bem definido — por exemplo,
        parseRow, validateFields, normalizeFields, buildResult — sem que uma função
        acumule mais de uma dessas responsabilidades.
    - id: behavior_preservation
      name: Preservação de comportamento
      weight: 0.25
      description: >
        O código refatorado produz exatamente o mesmo resultado para todas as entradas:
        email em lowercase, plano em uppercase, separação entre registros válidos e inválidos,
        e acumulação de erros por linha, conforme especificado no enunciado.
    - id: coupling_reduction
      name: Redução de acoplamento e efeitos colaterais
      weight: 0.10
      description: >
        As funções extraídas recebem apenas o que precisam por parâmetro, retornam valores
        sem modificar estado externo, e não dependem umas das outras além do necessário.
    - id: reasoning
      name: Justificativa da modularização
      weight: 0.10
      description: >
        Explica quais responsabilidades foram separadas, por que cada função extraída é coesa,
        e como a separação melhora testabilidade sem alterar comportamento.
---

<!-- SECTION:statement -->
O módulo abaixo processa a importação de usuários a partir de registros brutos (linhas de um CSV). Cada linha contém quatro campos: `nome`, `email`, `idade` e `plano`. A função `importUsers` é funcional, mas concentra em um único bloco: o parsing dos campos, a validação de obrigatoriedade, a normalização dos dados, a acumulação de erros e a montagem do resultado final.

**Regras de negócio (para preservação de comportamento):**
- **Validação obrigatória:** `nome` e `email` são campos obrigatórios; se ausentes ou em branco, o registro é inválido.
- **Normalização:**
  - `email` deve ser convertido para **lowercase**.
  - `plano` deve ser convertido para **uppercase**; se ausente ou em branco, assumir `'FREE'`.
  - `idade` deve ser interpretada como número inteiro; se ausente ou não numérica, assumir `0`.
- **Acumulação de erros:** registros inválidos devem ser coletados com o número da linha (1-based) e a lista de campos ausentes.
- **Resultado:** retornar `{ valid: [...], errors: [...] }`, onde `valid` contém os registros normalizados e `errors` contém objetos `{ line, missingFields }`.

**Tarefa:** refatore `importUsers` extraindo funções auxiliares que separem claramente as responsabilidades de parsing, validação, normalização e montagem do resultado. **Não altere o comportamento** descrito acima. Justifique suas decisões de modularização em um **raciocínio separado**.

```javascript
// userImporter.js
function importUsers(rawRows) {
  const valid = [];
  const errors = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const lineNumber = i + 1;

    // parsing
    const nome   = (row.nome   || '').trim();
    const email  = (row.email  || '').trim();
    const idade  = parseInt(row.idade, 10);
    const plano  = (row.plano  || '').trim().toUpperCase() || 'FREE';

    // validação
    const missingFields = [];
    if (!nome)  missingFields.push('nome');
    if (!email) missingFields.push('email');

    if (missingFields.length > 0) {
      errors.push({ line: lineNumber, missingFields });
      continue;
    }

    // normalização
    const normalizedEmail = email.toLowerCase();
    const normalizedIdade = isNaN(idade) ? 0 : idade;

    // montagem do resultado
    valid.push({ nome, email: normalizedEmail, idade: normalizedIdade, plano });
  }

  return { valid, errors };
}

module.exports = { importUsers };
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// userImporter.js

// TODO: extraia funções auxiliares para parsing, validação, normalização
//       e montagem do resultado, preservando exatamente o comportamento descrito.

function importUsers(rawRows) {
  const valid = [];
  const errors = [];

  for (let i = 0; i < rawRows.length; i++) {
    // TODO: use suas funções extraídas aqui
  }

  return { valid, errors };
}

module.exports = { importUsers };
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# user_importer.py
from typing import Any

# TODO: extraia funções auxiliares para parsing, validação, normalização
#       e montagem do resultado, preservando exatamente o comportamento descrito.

def import_users(raw_rows: list[dict[str, Any]]) -> dict:
    valid = []
    errors = []

    for i, row in enumerate(raw_rows):
        line_number = i + 1
        # TODO: use suas funções extraídas aqui

    return {"valid": valid, "errors": errors}
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// UserImporter.java
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class UserImporter {

    // TODO: extraia métodos auxiliares para parsing, validação, normalização
    //       e montagem do resultado, preservando exatamente o comportamento descrito.

    public ImportResult importUsers(List<Map<String, String>> rawRows) {
        List<Map<String, Object>> valid = new ArrayList<>();
        List<Map<String, Object>> errors = new ArrayList<>();

        for (int i = 0; i < rawRows.size(); i++) {
            int lineNumber = i + 1;
            Map<String, String> row = rawRows.get(i);
            // TODO: use seus métodos extraídos aqui
        }

        return new ImportResult(valid, errors);
    }

    public record ImportResult(
        List<Map<String, Object>> valid,
        List<Map<String, Object>> errors
    ) {}
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Responsabilidades identificadas no código original:** parsing de campos brutos, validação de obrigatoriedade, normalização (lowercase/uppercase/inteiro), acumulação de erros e montagem do resultado.

**Funções auxiliares esperadas:**

- `parseRow(row)` — extrai e limpa os campos brutos sem qualquer lógica de negócio; retorna objeto com campos como strings limpas.
- `validateFields(parsed)` — verifica obrigatoriedade de `nome` e `email`; retorna lista de `missingFields` (ou vazio se válido).
- `normalizeFields(parsed)` — aplica lowercase em `email`, uppercase em `plano` (fallback `'FREE'`), parse de `idade` com fallback `0`; retorna objeto normalizado.
- Montagem do resultado dentro de `importUsers`: recebe retorno de cada etapa e decide se empurra para `valid` ou `errors`.

**Preservação de comportamento obrigatória:**
- email em lowercase; plano em uppercase com fallback `'FREE'`; idade com fallback `0`.
- Registros inválidos acumulam `{ line, missingFields }` em `errors`; registros válidos com dados normalizados vão para `valid`.
- Linha é 1-based.

**Ganhos esperados:** cada função é testável de forma independente, sem dependência de estado externo; `importUsers` torna-se um orquestrador fino; acoplamento local reduzido.
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
- A questão está corretamente enquadrada em `codeQuality/modularity`: o foco é separar responsabilidades misturadas em parsing, validação, normalização, acumulação de erros e montagem do resultado, não apenas melhorar nomes ou legibilidade superficial.
- A dificuldade `intermediate` está adequada, pois exige refatoração com preservação de comportamento em várias regras pequenas, mas sem escalar para arquitetura de importação de dados ou desenho de sistema.
- O formato é compatível com questão `code`, com `inputConfig.type: code`, templates para JavaScript, Python e Java, rubrica com pesos somando 1.0 e `solution-outline` presente.
- O código inicial apresentado no enunciado é funcional e concentra responsabilidades de modo claro, criando um problema legítimo de modularidade.
- O enunciado explicita que o comportamento deve ser preservado e enumera regras observáveis de validação, normalização, acumulação de erros e resultado final.
- Os templates das três linguagens representam a mesma tarefa e o mesmo problema de modularidade, sem divergências relevantes nas regras.
- A rubrica avalia critérios observáveis: identificação de responsabilidades, extração de funções coesas, preservação de comportamento, redução de acoplamento local e justificativa.
- O `solution-outline` é consistente com o enunciado e apresenta uma organização possível sem invalidar alternativas equivalentes.
- O prompt de avaliação segue o padrão real de `prompts/`, usa placeholders compatíveis com questão `code` e reproduz corretamente os ids e pesos da rubrica.
- As referências são plausíveis e conservadoras para o tema, permanecendo corretamente como `suggested_not_verified`.
<!-- /REVIEW:comments -->
