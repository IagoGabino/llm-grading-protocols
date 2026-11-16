---
id: easy-cpf-validation-tests
slug: easy-cpf-validation-tests
title: Testes — Validação de CPF com Casos de Borda
axis: tests
subtheme: test_design
difficulty: easy
promptTemplate: easy-cpf-validation-tests
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [edge_cases, regression]
inputConfig:
  type: code
rubric:
  version: v1
  criteria:
    - id: test_coverage
      name: Cobertura de casos
      weight: 0.35
      description: Testa casos válidos, inválidos (formato errado, tamanho, dígitos verificadores incorretos), valores nulos/vazios, CPFs conhecidos inválidos (todos iguais - 111.111.111-11).
    - id: test_structure
      name: Estrutura dos testes
      weight: 0.25
      description: Usa framework apropriado (Jest, pytest, JUnit), testes organizados com describe/test ou equivalente, nomes descritivos.
    - id: assertions
      name: Assertions corretas
      weight: 0.20
      description: Usa assertions apropriadas (toBe, toEqual, assertTrue, assertFalse), verifica valores de retorno esperados.
    - id: edge_cases
      name: Casos extremos
      weight: 0.20
      description: Testa strings com formatação (pontos e hífens), CPFs com dígitos verificadores incorretos, sequências inválidas.
---

<!-- SECTION:statement -->
Uma função `validateCPF` valida números de CPF brasileiros, verificando formato e dígitos verificadores. A função retorna `true` se o CPF for válido e `false` caso contrário.

**Regras de validação:**

1. **Formato:** CPF deve ter exatamente 11 dígitos numéricos (aceita com ou sem formatação: `12345678909` ou `123.456.789-09`)
2. **Sequências inválidas:** CPFs com todos os dígitos iguais são inválidos (ex: `111.111.111-11`, `000.000.000-00`)
3. **Dígitos verificadores:** os dois últimos dígitos são calculados a partir dos 9 primeiros usando algoritmo específico

**Algoritmo de validação dos dígitos verificadores:**

```
CPF: 123.456.789-09
Primeiros 9 dígitos: 1 2 3 4 5 6 7 8 9

# Cálculo do 1º dígito verificador (10ª posição):
soma = (1×10) + (2×9) + (3×8) + (4×7) + (5×6) + (6×5) + (7×4) + (8×3) + (9×2) = 210
resto = soma % 11 = 210 % 11 = 1
digito1 = (resto < 2) ? 0 : (11 - resto) = (1 < 2) ? 0 : (11-1) = 0

# Cálculo do 2º dígito verificador (11ª posição):
soma = (1×11) + (2×10) + (3×9) + (4×8) + (5×7) + (6×6) + (7×5) + (8×4) + (9×3) + (0×2) = 255
resto = soma % 11 = 255 % 11 = 2
digito2 = (resto < 2) ? 0 : (11 - resto) = (2 < 2) ? 0 : (11-2) = 9

CPF válido: 123.456.789-09
```

**Tarefa:**

Escreva **testes unitários** para a função `validateCPF` cobrindo:

1. **Casos válidos:** CPFs válidos com e sem formatação
2. **Casos inválidos:** formato errado, tamanho incorreto, dígitos verificadores errados
3. **Casos extremos:** valores nulos/undefined, strings vazias, CPFs com todos os dígitos iguais

**Use o template da sua linguagem preferida.**
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// Função a ser testada (já implementada)
function validateCPF(cpf) {
  if (!cpf) return false;
  
  // Remove formatação
  const cleaned = cpf.replace(/[^\d]/g, '');
  
  if (cleaned.length !== 11) return false;
  
  // Rejeita sequências de dígitos iguais
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Calcula dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let digit1 = (sum % 11 < 2) ? 0 : 11 - (sum % 11);
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  let digit2 = (sum % 11 < 2) ? 0 : 11 - (sum % 11);
  
  return parseInt(cleaned[9]) === digit1 && parseInt(cleaned[10]) === digit2;
}

// ESCREVA SEUS TESTES AQUI usando Jest
describe('validateCPF', () => {
  // TODO: Adicionar testes
});
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# Função a ser testada (já implementada)
import re

def validate_cpf(cpf):
    if not cpf:
        return False
    
    # Remove formatação
    cleaned = re.sub(r'[^\d]', '', cpf)
    
    if len(cleaned) != 11:
        return False
    
    # Rejeita sequências de dígitos iguais
    if re.match(r'^(\d)\1{10}$', cleaned):
        return False
    
    # Calcula dígitos verificadores
    sum_digits = sum(int(cleaned[i]) * (10 - i) for i in range(9))
    digit1 = 0 if sum_digits % 11 < 2 else 11 - (sum_digits % 11)
    
    sum_digits = sum(int(cleaned[i]) * (11 - i) for i in range(10))
    digit2 = 0 if sum_digits % 11 < 2 else 11 - (sum_digits % 11)
    
    return int(cleaned[9]) == digit1 and int(cleaned[10]) == digit2

# ESCREVA SEUS TESTES AQUI usando pytest
import pytest

class TestValidateCPF:
    # TODO: Adicionar testes
    pass
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// Função a ser testada (já implementada)
public class CPFValidator {
    public static boolean validateCPF(String cpf) {
        if (cpf == null || cpf.isEmpty()) {
            return false;
        }
        
        // Remove formatação
        String cleaned = cpf.replaceAll("[^\\d]", "");
        
        if (cleaned.length() != 11) {
            return false;
        }
        
        // Rejeita sequências de dígitos iguais
        if (cleaned.matches("(\\d)\\1{10}")) {
            return false;
        }
        
        // Calcula dígitos verificadores
        int sum = 0;
        for (int i = 0; i < 9; i++) {
            sum += Character.getNumericValue(cleaned.charAt(i)) * (10 - i);
        }
        int digit1 = (sum % 11 < 2) ? 0 : 11 - (sum % 11);
        
        sum = 0;
        for (int i = 0; i < 10; i++) {
            sum += Character.getNumericValue(cleaned.charAt(i)) * (11 - i);
        }
        int digit2 = (sum % 11 < 2) ? 0 : 11 - (sum % 11);
        
        return Character.getNumericValue(cleaned.charAt(9)) == digit1 
            && Character.getNumericValue(cleaned.charAt(10)) == digit2;
    }
}

// ESCREVA SEUS TESTES AQUI usando JUnit 5
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CPFValidatorTest {
    // TODO: Adicionar testes
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Solução esperada:**

### JavaScript (Jest)

```javascript
describe('validateCPF', () => {
  // Casos válidos
  test('should validate correct CPF without formatting', () => {
    expect(validateCPF('12345678909')).toBe(true);
  });
  
  test('should validate correct CPF with formatting', () => {
    expect(validateCPF('123.456.789-09')).toBe(true);
  });
  
  test('should validate another valid CPF', () => {
    expect(validateCPF('11144477735')).toBe(true);
  });
  
  // Casos inválidos - formato
  test('should reject CPF with incorrect length', () => {
    expect(validateCPF('123456789')).toBe(false); // 9 dígitos
  });
  
  test('should reject CPF with letters', () => {
    expect(validateCPF('123.456.789-0A')).toBe(false);
  });
  
  test('should reject empty string', () => {
    expect(validateCPF('')).toBe(false);
  });
  
  test('should reject null value', () => {
    expect(validateCPF(null)).toBe(false);
  });
  
  test('should reject undefined value', () => {
    expect(validateCPF(undefined)).toBe(false);
  });
  
  // Casos inválidos - dígitos verificadores incorretos
  test('should reject CPF with wrong check digits', () => {
    expect(validateCPF('12345678900')).toBe(false); // Correto seria 09
  });
  
  test('should reject CPF with first check digit wrong', () => {
    expect(validateCPF('12345678919')).toBe(false);
  });
  
  // Casos extremos - sequências inválidas
  test('should reject CPF with all same digits (111.111.111-11)', () => {
    expect(validateCPF('11111111111')).toBe(false);
  });
  
  test('should reject CPF with all zeros', () => {
    expect(validateCPF('00000000000')).toBe(false);
  });
  
  test('should reject CPF 222.222.222-22', () => {
    expect(validateCPF('22222222222')).toBe(false);
  });
  
  test('should reject CPF 999.999.999-99', () => {
    expect(validateCPF('99999999999')).toBe(false);
  });
  
  // Casos extremos - formatação
  test('should handle CPF with extra spaces', () => {
    expect(validateCPF(' 123.456.789-09 ')).toBe(true);
  });
  
  test('should handle CPF with dots only', () => {
    expect(validateCPF('123.456.789.09')).toBe(true);
  });
});
```

**Comando para rodar:**
```bash
npm install --save-dev jest
npx jest cpf.test.js
```

---

### Python (pytest)

```python
import pytest

class TestValidateCPF:
    # Casos válidos
    def test_validate_correct_cpf_without_formatting(self):
        assert validate_cpf('12345678909') == True
    
    def test_validate_correct_cpf_with_formatting(self):
        assert validate_cpf('123.456.789-09') == True
    
    def test_validate_another_valid_cpf(self):
        assert validate_cpf('11144477735') == True
    
    # Casos inválidos - formato
    def test_reject_cpf_with_incorrect_length(self):
        assert validate_cpf('123456789') == False  # 9 dígitos
    
    def test_reject_cpf_with_letters(self):
        assert validate_cpf('123.456.789-0A') == False
    
    def test_reject_empty_string(self):
        assert validate_cpf('') == False
    
    def test_reject_none_value(self):
        assert validate_cpf(None) == False
    
    # Casos inválidos - dígitos verificadores
    def test_reject_cpf_with_wrong_check_digits(self):
        assert validate_cpf('12345678900') == False  # Correto seria 09
    
    def test_reject_cpf_with_first_check_digit_wrong(self):
        assert validate_cpf('12345678919') == False
    
    # Casos extremos - sequências inválidas
    def test_reject_cpf_with_all_same_digits(self):
        assert validate_cpf('11111111111') == False
    
    def test_reject_cpf_with_all_zeros(self):
        assert validate_cpf('00000000000') == False
    
    def test_reject_cpf_222(self):
        assert validate_cpf('22222222222') == False
    
    def test_reject_cpf_999(self):
        assert validate_cpf('99999999999') == False
    
    # Casos extremos - formatação
    def test_handle_cpf_with_extra_spaces(self):
        assert validate_cpf(' 123.456.789-09 ') == True
    
    def test_handle_cpf_with_dots_only(self):
        assert validate_cpf('123.456.789.09') == True

# Testes parametrizados (bônus)
@pytest.mark.parametrize("cpf,expected", [
    ('12345678909', True),
    ('123.456.789-09', True),
    ('11111111111', False),
    ('12345678900', False),
    ('', False),
    (None, False),
])
def test_validate_cpf_parametrized(cpf, expected):
    assert validate_cpf(cpf) == expected
```

**Comando para rodar:**
```bash
pip install pytest
pytest test_cpf.py -v
```

---

### Java (JUnit 5)

```java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;

class CPFValidatorTest {
    // Casos válidos
    @Test
    void shouldValidateCorrectCPFWithoutFormatting() {
        assertTrue(CPFValidator.validateCPF("12345678909"));
    }
    
    @Test
    void shouldValidateCorrectCPFWithFormatting() {
        assertTrue(CPFValidator.validateCPF("123.456.789-09"));
    }
    
    @Test
    void shouldValidateAnotherValidCPF() {
        assertTrue(CPFValidator.validateCPF("11144477735"));
    }
    
    // Casos inválidos - formato
    @Test
    void shouldRejectCPFWithIncorrectLength() {
        assertFalse(CPFValidator.validateCPF("123456789")); // 9 dígitos
    }
    
    @Test
    void shouldRejectCPFWithLetters() {
        assertFalse(CPFValidator.validateCPF("123.456.789-0A"));
    }
    
    @Test
    void shouldRejectEmptyString() {
        assertFalse(CPFValidator.validateCPF(""));
    }
    
    @Test
    void shouldRejectNullValue() {
        assertFalse(CPFValidator.validateCPF(null));
    }
    
    // Casos inválidos - dígitos verificadores
    @Test
    void shouldRejectCPFWithWrongCheckDigits() {
        assertFalse(CPFValidator.validateCPF("12345678900")); // Correto seria 09
    }
    
    @Test
    void shouldRejectCPFWithFirstCheckDigitWrong() {
        assertFalse(CPFValidator.validateCPF("12345678919"));
    }
    
    // Casos extremos - sequências inválidas
    @ParameterizedTest
    @ValueSource(strings = {
        "11111111111",
        "00000000000",
        "22222222222",
        "33333333333",
        "44444444444",
        "55555555555",
        "66666666666",
        "77777777777",
        "88888888888",
        "99999999999"
    })
    void shouldRejectCPFWithAllSameDigits(String cpf) {
        assertFalse(CPFValidator.validateCPF(cpf));
    }
    
    // Casos extremos - formatação
    @Test
    void shouldHandleCPFWithExtraSpaces() {
        assertTrue(CPFValidator.validateCPF(" 123.456.789-09 "));
    }
    
    @Test
    void shouldHandleCPFWithDotsOnly() {
        assertTrue(CPFValidator.validateCPF("123.456.789.09"));
    }
}
```

**Comando para rodar (Maven):**
```xml
<dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter</artifactId>
    <version>5.9.3</version>
    <scope>test</scope>
</dependency>
```

```bash
mvn test
```

---

### Cobertura de Casos

| Tipo de Teste | Exemplos |
|--------------|----------|
| **Válidos** | CPF correto sem formatação, com formatação (pontos e hífen) |
| **Inválidos - Formato** | Tamanho incorreto, letras, vazio, null/undefined/None |
| **Inválidos - Dígitos** | Dígitos verificadores errados (primeiro, segundo ou ambos) |
| **Extremos - Sequências** | Todos os dígitos iguais (111...111, 000...000, etc.) |
| **Extremos - Formatação** | Espaços extras, diferentes separadores |

---

### Estrutura de Testes (Melhores Práticas)

**Nomes descritivos:** `shouldRejectCPFWithIncorrectLength` (não `test1`)  
**Arrange-Act-Assert:** setup → chamada da função → verificação  
**Um conceito por teste:** não testar formato E dígitos no mesmo teste  
**Testes parametrizados:** para sequências inválidas (0-9 repetidos)  
**Casos extremos:** null, vazio, formatações incomuns  

---

### CPFs Válidos para Teste

```
12345678909 
11144477735 
52998224725 
```

### CPFs Inválidos Conhecidos

```
11111111111  (todos iguais)
12345678900  (dígitos verificadores errados)
123456789    (tamanho incorreto)
```

**Gerador online para validação:** [geradordecpf.com](https://www.geradordecpf.com/)
<!-- /SECTION:solution-outline -->
