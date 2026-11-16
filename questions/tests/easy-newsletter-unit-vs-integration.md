---
id: easy-newsletter-unit-vs-integration
slug: easy-newsletter-unit-vs-integration
title: "Testes — Unitários vs. Integração em Serviço de Inscrição em Newsletter"
axis: tests
subtheme: unit_and_integration
difficulty: easy
promptTemplate: easy-newsletter-unit-vs-integration
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [unit_tests, integration_tests, fake_repository, email_validation, test_classification]
references:
  - id: ref-1
    title: "Unit Testing: Principles, Practices, and Patterns"
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
    title: "Jest — Getting Started (Official Docs)"
    type: official_docs
    url: "https://jestjs.io/docs/getting-started"
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
    - id: test_classification
      name: Classificação correta dos testes
      weight: 0.30
      description: Identifica quais comportamentos devem ser cobertos por testes unitários (normalização e validação — lógica pura, sem repositório) e quais devem ser cobertos por teste de integração (fluxo completo com repositório fake/in-memory), justificando a distinção de forma objetiva.
    - id: unit_test_quality
      name: Qualidade dos testes unitários
      weight: 0.25
      description: Escreve testes unitários que cobrem normalização de email (remoção de espaços, lowercase) e rejeição de email vazio ou mal formado, sem instanciar repositório ou qualquer dependência externa.
    - id: integration_test_quality
      name: Qualidade do teste de integração
      weight: 0.25
      description: Escreve ao menos um teste de integração usando repositório fake/in-memory que cobre o fluxo completo de inscrição bem-sucedida, email duplicado e email inválido, verificando o resultado retornado pelo serviço.
    - id: test_isolation
      name: Isolamento entre testes
      weight: 0.10
      description: Garante que cada teste começa com estado limpo (repositório vazio ou reiniciado), sem dependências de ordem de execução.
    - id: justification
      name: Justificativa da escolha
      weight: 0.10
      description: Explica de forma concisa por que normalização/validação são testadas unitariamente (sem dependências externas, execução rápida) e por que o fluxo com repositório exige integração (verifica coordenação entre serviço e repositório).
---

<!-- SECTION:statement -->
Um serviço de inscrição em newsletter recebe um endereço de email, normaliza-o, valida seu formato e salva a inscrição em um repositório. O módulo é simples e expõe apenas a função `subscribe`.

**Código a ser testado:**

```javascript
// newsletterService.js

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function isValidEmail(email) {
  return typeof email === 'string' && email.length > 0 && email.includes('@');
}

async function subscribe(rawEmail, repository) {
  const email = normalizeEmail(rawEmail);

  if (!isValidEmail(email)) {
    return { success: false, reason: 'invalid_email' };
  }

  const alreadyExists = await repository.existsByEmail(email);
  if (alreadyExists) {
    return { success: false, reason: 'duplicate_email' };
  }

  await repository.save({ email });
  return { success: true };
}

module.exports = { normalizeEmail, isValidEmail, subscribe };
```

**Contrato esperado:**

| Situação | Retorno |
|---|---|
| Email válido e novo | `{ success: true }` |
| Email com espaços ou maiúsculas | normalizado antes de validar/salvar |
| Email vazio ou sem `@` | `{ success: false, reason: 'invalid_email' }` |
| Email já existente no repositório | `{ success: false, reason: 'duplicate_email' }` |

**Tarefa:**

1. **Testes unitários** para `normalizeEmail` e `isValidEmail`: não instancie repositório, não use fakes — são funções puras.
2. **Teste de integração** para `subscribe`: use um repositório fake/in-memory simples e cubra os três cenários (sucesso, email inválido e email duplicado).
3. Na **linha de raciocínio**, justifique por que alguns testes são unitários e outros são de integração.

> **Restrição:** não exija Docker, banco real ou frameworks de mock externos. O repositório fake pode ser um objeto literal com uma lista em memória.
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// newsletterService.js  (não altere este arquivo)
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function isValidEmail(email) {
  return typeof email === 'string' && email.length > 0 && email.includes('@');
}

async function subscribe(rawEmail, repository) {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return { success: false, reason: 'invalid_email' };
  const alreadyExists = await repository.existsByEmail(email);
  if (alreadyExists) return { success: false, reason: 'duplicate_email' };
  await repository.save({ email });
  return { success: true };
}

module.exports = { normalizeEmail, isValidEmail, subscribe };

// newsletterService.test.js
const { normalizeEmail, isValidEmail, subscribe } = require('./newsletterService');

// --- Testes unitários (funções puras — sem repositório) ---
describe('normalizeEmail', () => {
  it('remove espaços e converte para lowercase', () => {
    // TODO
  });
});

describe('isValidEmail', () => {
  it('retorna false para email vazio', () => {
    // TODO
  });

  it('retorna false para string sem @', () => {
    // TODO
  });

  it('retorna true para email com formato mínimo válido', () => {
    // TODO
  });
});

// --- Repositório fake (in-memory) para testes de integração ---
function makeFakeRepository(initialEmails = []) {
  // TODO: implemente existsByEmail(email) e save({ email })
}

// --- Testes de integração (subscribe + repositório fake) ---
describe('subscribe', () => {
  let repository;

  beforeEach(() => {
    repository = makeFakeRepository(); // repositório vazio antes de cada teste
  });

  it('retorna success: true para inscrição válida e nova', async () => {
    // TODO
  });

  it('retorna invalid_email para email sem @', async () => {
    // TODO
  });

  it('retorna duplicate_email quando email já existe', async () => {
    // TODO
  });
});
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# newsletter_service.py  (não altere este arquivo)

def normalize_email(email: str) -> str:
    return email.strip().lower()

def is_valid_email(email: str) -> bool:
    return isinstance(email, str) and len(email) > 0 and "@" in email

async def subscribe(raw_email: str, repository) -> dict:
    email = normalize_email(raw_email)
    if not is_valid_email(email):
        return {"success": False, "reason": "invalid_email"}
    if await repository.exists_by_email(email):
        return {"success": False, "reason": "duplicate_email"}
    await repository.save({"email": email})
    return {"success": True}


# test_newsletter_service.py
import pytest
from newsletter_service import normalize_email, is_valid_email, subscribe


# --- Repositório fake (in-memory) para testes de integração ---
class FakeRepository:
    def __init__(self):
        self._emails = []

    async def exists_by_email(self, email: str) -> bool:
        # TODO
        pass

    async def save(self, record: dict) -> None:
        # TODO
        pass


# --- Testes unitários (funções puras — sem repositório) ---
class TestNormalizeEmail:
    def test_remove_espacos_e_converte_para_lowercase(self):
        # TODO
        pass


class TestIsValidEmail:
    def test_retorna_false_para_email_vazio(self):
        # TODO
        pass

    def test_retorna_false_para_string_sem_arroba(self):
        # TODO
        pass

    def test_retorna_true_para_email_com_formato_minimo_valido(self):
        # TODO
        pass


# --- Testes de integração (subscribe + repositório fake) ---
class TestSubscribe:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.repository = FakeRepository()  # repositório vazio antes de cada teste

    @pytest.mark.asyncio
    async def test_retorna_sucesso_para_inscricao_valida_e_nova(self):
        # TODO
        pass

    @pytest.mark.asyncio
    async def test_retorna_invalid_email_para_email_sem_arroba(self):
        # TODO
        pass

    @pytest.mark.asyncio
    async def test_retorna_duplicate_email_quando_email_ja_existe(self):
        # TODO
        pass
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// NewsletterService.java  (não altere este arquivo)
public class NewsletterService {

    public static String normalizeEmail(String email) {
        return email.strip().toLowerCase();
    }

    public static boolean isValidEmail(String email) {
        return email != null && !email.isEmpty() && email.contains("@");
    }

    public static SubscribeResult subscribe(String rawEmail, NewsletterRepository repository) {
        String email = normalizeEmail(rawEmail);
        if (!isValidEmail(email)) {
            return new SubscribeResult(false, "invalid_email");
        }
        if (repository.existsByEmail(email)) {
            return new SubscribeResult(false, "duplicate_email");
        }
        repository.save(email);
        return new SubscribeResult(true, null);
    }

    public record SubscribeResult(boolean success, String reason) {}
}

// NewsletterRepository.java  (interface)
public interface NewsletterRepository {
    boolean existsByEmail(String email);
    void save(String email);
}

// NewsletterServiceTest.java
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class NewsletterServiceTest {

    // --- Repositório fake (in-memory) para testes de integração ---
    static class FakeRepository implements NewsletterRepository {
        private final List<String> emails = new ArrayList<>();

        @Override
        public boolean existsByEmail(String email) {
            // TODO
            return false;
        }

        @Override
        public void save(String email) {
            // TODO
        }
    }

    private FakeRepository repository;

    @BeforeEach
    void setUp() {
        repository = new FakeRepository(); // repositório vazio antes de cada teste
    }

    // --- Testes unitários (funções puras — sem repositório) ---
    @Test
    void normalizeEmail_removeEspacosEConverteParaLowercase() {
        // TODO
    }

    @Test
    void isValidEmail_retornaFalseParaEmailVazio() {
        // TODO
    }

    @Test
    void isValidEmail_retornaFalseParaStringSemArroba() {
        // TODO
    }

    @Test
    void isValidEmail_retornaTrueParaEmailComFormatoMinimoValido() {
        // TODO
    }

    // --- Testes de integração (subscribe + repositório fake) ---
    @Test
    void subscribe_retornaSucessoParaInscricaoValidaENova() {
        // TODO
    }

    @Test
    void subscribe_retornaInvalidEmailParaEmailSemArroba() {
        // TODO
    }

    @Test
    void subscribe_retornaDuplicateEmailQuandoEmailJaExiste() {
        // TODO
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Por que separar unitário e integração:**

- `normalizeEmail` e `isValidEmail` são funções **puras** (entrada → saída, sem dependência externa): testá-las unitariamente é suficiente, rápido e não exige nenhum colaborador.
- `subscribe` **coordena** normalização, validação e repositório. Mesmo com lógica simples, o único jeito de verificar se a coordenação está correta é exercitar o fluxo completo com um repositório — ainda que fake. Isso é um **teste de integração leve**.

**Repositório fake mínimo (JavaScript):**

```javascript
function makeFakeRepository(initialEmails = []) {
  const stored = [...initialEmails];
  return {
    async existsByEmail(email) { return stored.includes(email); },
    async save({ email })     { stored.push(email); },
  };
}
```

**Testes unitários essenciais:**

```javascript
describe('normalizeEmail', () => {
  it('remove espaços e converte para lowercase', () => {
    expect(normalizeEmail('  USER@Example.com  ')).toBe('user@example.com');
  });
});

describe('isValidEmail', () => {
  it('retorna false para email vazio', () => {
    expect(isValidEmail('')).toBe(false);
  });
  it('retorna false para string sem @', () => {
    expect(isValidEmail('invalido')).toBe(false);
  });
  it('retorna true para email com formato mínimo válido', () => {
    expect(isValidEmail('a@b')).toBe(true);
  });
});
```

**Testes de integração essenciais:**

```javascript
describe('subscribe', () => {
  let repository;
  beforeEach(() => { repository = makeFakeRepository(); });

  it('retorna success: true para inscrição válida e nova', async () => {
    const result = await subscribe('user@example.com', repository);
    expect(result).toEqual({ success: true });
  });

  it('retorna invalid_email para email sem @', async () => {
    const result = await subscribe('invalido', repository);
    expect(result).toEqual({ success: false, reason: 'invalid_email' });
  });

  it('retorna duplicate_email quando email já existe', async () => {
    await subscribe('user@example.com', repository); // primeira inscrição
    const result = await subscribe('user@example.com', repository);
    expect(result).toEqual({ success: false, reason: 'duplicate_email' });
  });
});
```

**Pontos essenciais para avaliação:**

1. Distinguir `normalizeEmail`/`isValidEmail` (puras → unitário) de `subscribe` (coordenação → integração).
2. Testes unitários **não instanciam** repositório.
3. Repositório fake implementa `existsByEmail` e `save` em memória, sem infra externa.
4. `beforeEach` garante repositório vazio → isolamento entre testes de integração.
5. Justificativa conecta "sem dependência → unitário" e "verifica coordenação → integração".
<!-- /SECTION:solution-outline -->

<!-- REVIEW:metrics -->
{
  "quality": {
    "technicalCorrectness": 4,
    "statementClarity": 4,
    "rubricAlignment": 5,
    "difficultyAlignment": 5
  },
  "compatibility": {
    "promptAlignment": 5,
    "formatValid": true
  },
  "recommendation": "minor_revision",
  "statusAfterReview": "needs_human_review",
  "mainIssue": "clarity",
  "revisionLevelNeeded": "light",
  "suggestedChangedParts": ["statement"],
  "referencesStatus": "present"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendacao: minor_revision.

Principais pontos:
- A questao pertence corretamente a tests/unit_and_integration: exige testes unitarios para normalizacao/validacao como logica pura e testes de integracao leves para o fluxo de subscribe com repositorio fake/in-memory.
- A dificuldade easy esta adequada. A tarefa nao exige Docker, banco real, PostgreSQL ou infraestrutura pesada, e os cenarios esperados de sucesso, email invalido e duplicidade aparecem no enunciado, na rubrica, no solution-outline e no prompt de avaliacao.
- Os templates de JavaScript, Python e Java representam essencialmente o mesmo contrato e permitem separar claramente funcoes puras do fluxo com repositorio. A questao tambem nao se reduz a testabilidade por injecao de dependencias.
- Ha uma pequena inconsistencia no enunciado: ele afirma que o modulo expoe apenas a funcao subscribe, mas o codigo e os templates importam/chamam diretamente normalizeEmail e isValidEmail para testes unitarios. Recomenda-se ajustar essa frase para deixar claro que as funcoes puras tambem estao acessiveis para teste, sem mudar a estrutura da questao.
- A rubrica e observavel e cobre distincao unitario/integracao, cobertura dos cenarios, asserts/resultado, isolamento entre testes e justificativa. O prompt segue o padrao de prompts code, usa placeholders compativeis e reproduz ids e pesos da rubrica.
- As referencias sao plausiveis e conservadoras para o tema, permanecendo corretamente como suggested_not_verified.
<!-- /REVIEW:comments -->
