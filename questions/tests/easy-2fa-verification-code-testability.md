---
id: easy-2fa-verification-code-testability
slug: easy-2fa-verification-code-testability
title: "Testes — Testabilidade de Gerador de Código de Verificação 2FA"
axis: tests
subtheme: testability
difficulty: easy
promptTemplate: easy-2fa-verification-code-testability
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [dependency_injection, deterministic_tests, clock, randomness, testability]
references:
  - id: ref-1
    title: "Working Effectively with Legacy Code"
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
    title: "Jest — Mock Functions (Official Docs)"
    type: official_docs
    url: "https://jestjs.io/docs/mock-functions"
    relevance: 3
    confidence: 5
    supports: [statement]
    verificationStatus: suggested_not_verified
generationMetrics:
  validFormatSelfCheck: true
  rubricCriteriaCount: 5
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
    - id: problem_diagnosis
      name: Diagnóstico do problema de testabilidade
      weight: 0.20
      description: Identifica explicitamente que o uso direto do relógio do sistema e da geração aleatória dentro da função são as dependências que tornam os testes instáveis e não determinísticos.
    - id: refactoring_quality
      name: Qualidade da refatoração
      weight: 0.30
      description: Refatora a função para receber (ou usar com valor padrão) funções controláveis de tempo e de geração de número — sem alterar o comportamento público da função quando chamada sem argumentos.
    - id: test_quality
      name: Qualidade dos testes unitários
      weight: 0.30
      description: Escreve testes determinísticos que verificam o código gerado, o timestamp de expiração (now + 10 minutos) e o formato do objeto retornado, usando valores fixos para tempo e aleatoriedade.
    - id: contract_preservation
      name: Preservação do contrato
      weight: 0.10
      description: A função refatorada ainda pode ser chamada sem argumentos e continua gerando um código de 6 dígitos com expiração 10 minutos à frente — o comportamento em produção não muda.
    - id: justification
      name: Justificativa da melhoria
      weight: 0.10
      description: Explica de forma concisa por que injetar (ou parametrizar) o relógio e a geração aleatória elimina o não determinismo e torna os testes confiáveis.
---

<!-- SECTION:statement -->
Um módulo de autenticação gera códigos temporários de verificação para login em dois fatores. Quando o usuário solicita acesso, o sistema cria um código numérico de 6 dígitos e registra quando ele vai expirar (10 minutos após a criação).

**Código atual:**

```javascript
// verificationCode.js
function generateVerificationCode() {
  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  return { code, expiresAt };
}

module.exports = { generateVerificationCode };
```

**Contrato esperado:**

- `code`: string de exatamente 6 dígitos numéricos (ex.: `"042817"`).
- `expiresAt`: objeto `Date` representando exatamente 10 minutos após o instante de criação.

**Problema:**

Toda vez que `generateVerificationCode` é chamada, ela consulta `Date.now()` e `Math.random()` diretamente. Isso faz com que testes que dependem de valores fixos sejam impossíveis de escrever de forma confiável:

- O `code` muda a cada execução.
- O `expiresAt` depende do relógio real, tornando difícil verificar se o cálculo de expiração está correto.

**Tarefa:**

1. **Refatore** a função `generateVerificationCode` para que seja possível controlar o instante de tempo e o valor aleatório durante os testes, sem quebrar o comportamento padrão em produção.
2. **Escreva testes unitários determinísticos** cobrindo:
   - O código gerado possui exatamente 6 dígitos numéricos.
   - O `expiresAt` corresponde a exatamente 10 minutos após o instante fornecido.
   - O objeto retornado contém as propriedades `code` e `expiresAt`.
3. Na sua **linha de raciocínio**, explique por que o código original é difícil de testar e como a refatoração resolve o problema.

> **Restrição:** não exija bibliotecas de mocking externas para controlar tempo ou aleatoriedade — a refatoração deve ser simples o suficiente para ser testada com funções substitutas passadas como argumento.
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// verificationCode.js
// TODO: refatore para receber dependências controláveis (tempo e aleatoriedade)
// Dica: use parâmetros com valores padrão para não quebrar chamadas sem argumento
function generateVerificationCode(/* TODO */) {
  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  return { code, expiresAt };
}

module.exports = { generateVerificationCode };

// verificationCode.test.js
const { generateVerificationCode } = require('./verificationCode');

describe('generateVerificationCode', () => {
  it('retorna um código de exatamente 6 dígitos numéricos', () => {
    // TODO
  });

  it('retorna expiresAt com 10 minutos à frente do instante fornecido', () => {
    // TODO
  });

  it('retorna um objeto com as propriedades code e expiresAt', () => {
    // TODO
  });
});
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# verification_code.py
import random
from datetime import datetime, timedelta

# TODO: refatore para receber dependências controláveis (tempo e aleatoriedade)
# Dica: use parâmetros com valores padrão para não quebrar chamadas sem argumento
def generate_verification_code():
    code = str(random.randint(0, 999_999)).zfill(6)
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    return {"code": code, "expires_at": expires_at}


# test_verification_code.py
# from verification_code import generate_verification_code
from datetime import datetime, timedelta

class TestGenerateVerificationCode:
    def test_code_tem_exatamente_6_digitos(self):
        # TODO
        pass

    def test_expires_at_e_10_minutos_apos_instante_fornecido(self):
        # TODO
        pass

    def test_retorno_contem_code_e_expires_at(self):
        # TODO
        pass
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// VerificationCode.java
import java.time.Instant;
import java.util.Random;
import java.util.function.LongSupplier;
import java.util.function.IntSupplier;

public class VerificationCode {

    // TODO: refatore para receber dependências controláveis de tempo e aleatoriedade
    public static Result generate() {
        String code = String.format("%06d", new Random().nextInt(1_000_000));
        Instant expiresAt = Instant.ofEpochMilli(System.currentTimeMillis() + 10 * 60 * 1000L);
        return new Result(code, expiresAt);
    }

    public record Result(String code, Instant expiresAt) {}
}

// VerificationCodeTest.java
import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;

class VerificationCodeTest {

    @Test
    void codePossuiExatamente6Digitos() {
        // TODO
    }

    @Test
    void expiresAtE10MinutosAposInstanteFornecido() {
        // TODO
    }

    @Test
    void retornoContemCodeEExpiresAt() {
        // TODO
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Por que o código original é difícil de testar:**

- `Math.random()` / `random.randint()` / `new Random()` produzem valores diferentes a cada chamada: impossível verificar o valor exato do `code` sem controlar a fonte de aleatoriedade.
- `Date.now()` / `datetime.utcnow()` / `System.currentTimeMillis()` dependem do relógio real: impossível verificar o `expiresAt` com precisão sem congelar o tempo.

**Refatoração: parâmetros opcionais com valores padrão**

A abordagem mais simples é aceitar funções substitutas como parâmetros opcionais, preservando o comportamento padrão em produção:

```javascript
// JavaScript
function generateVerificationCode(
  now = () => Date.now(),
  random = () => Math.random()
) {
  const code = String(Math.floor(random() * 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(now() + 10 * 60 * 1000);
  return { code, expiresAt };
}
```

```python
# Python
from datetime import datetime, timedelta

def generate_verification_code(now=None, rand=None):
    if now is None:
        now = datetime.utcnow
    if rand is None:
        import random
        rand = lambda: random.randint(0, 999_999)
    code = str(rand()).zfill(6)
    expires_at = now() + timedelta(minutes=10)
    return {"code": code, "expires_at": expires_at}
```

```java
// Java
public static Result generate(LongSupplier clock, IntSupplier randomSource) {
    String code = String.format("%06d", randomSource.getAsInt() % 1_000_000);
    Instant expiresAt = Instant.ofEpochMilli(clock.getAsLong() + 10 * 60 * 1000L);
    return new Result(code, expiresAt);
}

// Sobrecarga sem argumentos preserva o contrato de produção:
public static Result generate() {
    return generate(System::currentTimeMillis, () -> new Random().nextInt(1_000_000));
}
```

**Testes determinísticos (JavaScript / Jest):**

```javascript
const FIXED_NOW = new Date('2025-01-15T10:00:00Z').getTime();
const FIXED_CODE_VALUE = 42817;

describe('generateVerificationCode', () => {
  it('retorna um código de exatamente 6 dígitos numéricos', () => {
    const { code } = generateVerificationCode(
      () => FIXED_NOW,
      () => FIXED_CODE_VALUE / 1_000_000
    );
    expect(code).toBe('042817');
    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it('retorna expiresAt com 10 minutos à frente do instante fornecido', () => {
    const { expiresAt } = generateVerificationCode(() => FIXED_NOW);
    const expected = new Date(FIXED_NOW + 10 * 60 * 1000);
    expect(expiresAt).toEqual(expected);
  });

  it('retorna um objeto com as propriedades code e expiresAt', () => {
    const result = generateVerificationCode(() => FIXED_NOW);
    expect(result).toHaveProperty('code');
    expect(result).toHaveProperty('expiresAt');
  });
});
```

**Pontos essenciais para avaliação:**

1. Identificação de `Date.now()` e `Math.random()` (ou equivalentes) como as fontes de não determinismo.
2. Refatoração que aceita substitutos controláveis sem quebrar a chamada padrão (`generate()` sem argumentos).
3. Testes que fixam tempo e aleatoriedade e verificam `code`, `expiresAt` e estrutura do retorno.
4. Justificativa que conecta "fonte de não determinismo → parâmetro controlável → teste confiável".
5. Comportamento em produção preservado (chamada sem argumentos continua funcionando).
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
  "suggestedChangedParts": ["solution-outline"],
  "referencesStatus": "present"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendacao: minor_revision.

Principais pontos:
- A questao pertence corretamente a tests/testability: o foco e refatorar uma funcao funcional para controlar relogio e aleatoriedade e, em seguida, escrever testes unitarios deterministicos. Nao ha desvio relevante para bugFix, codeQuality, seguranca, criptografia ou dependencias externas.
- A dificuldade easy e adequada, e os templates de JavaScript, Python e Java representam a mesma tarefa, preservando uma chamada sem argumentos para uso normal e permitindo fontes controlaveis nos testes.
- Enunciado, rubrica e prompt de avaliacao estao claros e alinhados. A rubrica soma 1.0, possui cinco criterios observaveis, e o prompt reproduz exatamente seus ids e pesos com placeholders compativeis com inputConfig.type code.
- Recomenda-se um unico ajuste no solution-outline: nos segundo e terceiro testes JavaScript, passar tambem uma fonte de aleatoriedade fixa. Atualmente eles controlam o tempo, mas deixam Math.random() real executar; ainda que as assercoes mostradas nao dependam do valor sorteado, isso contraria a expectativa declarada de que os testes nao usem aleatoriedade real.
- As referencias sao plausiveis e conservadoras para o tema e permanecem corretamente como suggested_not_verified.
<!-- /REVIEW:comments -->
