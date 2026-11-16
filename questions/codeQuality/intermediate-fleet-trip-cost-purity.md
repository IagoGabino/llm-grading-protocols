---
id: intermediate-fleet-trip-cost-purity
slug: intermediate-fleet-trip-cost-purity
title: "Qualidade de Código — Imutabilidade e Injeção de Dependências no Cálculo de Custo de Viagem"
axis: codeQuality
subtheme: modularity
difficulty: intermediate
promptTemplate: intermediate-fleet-trip-cost-purity
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [pure_functions, immutability, dependency_injection, side_effects, determinism, refactoring, fleet_management]
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
    title: "Working Effectively with Legacy Code — Michael C. Feathers"
    type: book
    url: null
    relevance: 4
    confidence: 4
    supports: [rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Parameterize Method — Refactoring Catalog (Fowler)"
    type: technical_blog
    url: "https://refactoring.com/catalog/parameterizeFunction.html"
    relevance: 4
    confidence: 4
    supports: [solution-outline, rubric]
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
    - id: mutation_elimination
      name: Eliminação da mutação do parâmetro de entrada
      weight: 0.30
      description: >
        A função refatorada NÃO altera o objeto `trip` recebido por parâmetro.
        Em vez de adicionar propriedades ao objeto original (ex.: `trip.totalCost`, `trip.flags`),
        a função retorna um novo objeto com os valores calculados, preservando o objeto de entrada intacto.
    - id: dependency_injection_price
      name: Injeção da dependência de preço de combustível
      weight: 0.25
      description: >
        A função refatorada NÃO acessa nenhuma variável global (ex.: `GLOBAL_CONFIG.currentFuelPrice`).
        O preço do combustível é recebido explicitamente como parâmetro, tornando a função
        auto-suficiente e testável sem necessidade de manipular estado global.
    - id: dependency_injection_time
      name: Injeção do não-determinismo de tempo
      weight: 0.20
      description: >
        A função refatorada NÃO lê o relógio do sistema internamente (ex.: `new Date()`,
        `datetime.now()`, `LocalDateTime.now()`). O horário ou flag de período noturno
        é recebido como parâmetro, tornando a função determinística e testável com
        qualquer valor de horário sem dependência do relógio real.
    - id: behavior_preservation
      name: Preservação do contrato de cálculo
      weight: 0.15
      description: >
        A lógica de negócio original é preservada integralmente: custo = (distância × preçoCombustível) + pedágios,
        com adicional de 20% aplicado quando o horário indicar período noturno
        (entre 22h e 05h, inclusive). Nenhuma regra de cálculo deve ser alterada ou omitida.
    - id: reasoning
      name: Justificativa técnica sobre testabilidade e funções puras
      weight: 0.10
      description: >
        Explica os três problemas estruturais identificados (mutação de parâmetro, acoplamento
        global e não-determinismo de tempo), justifica por que as mudanças tornam a função
        uma função pura (ou aproximadamente pura), e demonstra como isso facilita
        a criação de testes unitários — em particular, por que a injeção de dependências
        elimina a necessidade de mocks complexos para variáveis globais e relógio do sistema.
---

<!-- SECTION:statement -->
O sistema de Gestão de Frotas abaixo possui a função `calculateTripCost(trip)`, que calcula o custo estimado de uma viagem com base na distância percorrida, no preço do combustível e nos pedágios. A função é funcional, mas apresenta três problemas estruturais de modularidade:

1. **Mutação do parâmetro de entrada:** a função adiciona as propriedades `totalCost` e `flags` diretamente ao objeto `trip` recebido, alterando o estado do chamador de forma silenciosa.
2. **Acoplamento a variável global:** o preço do combustível é lido de `GLOBAL_CONFIG.currentFuelPrice`, criando dependência oculta de estado global que impossibilita testes isolados.
3. **Não-determinismo de tempo:** a função chama `new Date()` internamente para decidir se aplica a taxa noturna, tornando o resultado dependente do relógio do sistema no momento da chamada.

**Regras de negócio (para preservação de comportamento):**
- **Cálculo base:** `custoBase = trip.distanceKm × fuelPrice + trip.tollFees`
- **Taxa noturna:** se o horário estiver entre **22h e 05h** (inclusive nas duas pontas), aplica-se um adicional de **20%** sobre o `custoBase`. Caso contrário, nenhum adicional é aplicado.
- **Resultado:** o custo total calculado e a flag indicando se a taxa noturna foi aplicada devem ser retornados — **sem modificar o objeto `trip` original**.

**Tarefa:** refatore `calculateTripCost` de modo que ela:
- **não mute** o objeto `trip` passado por parâmetro;
- **não acesse** `GLOBAL_CONFIG` nem qualquer outra variável global;
- **não chame** `new Date()` (ou equivalente) internamente;
- **preserve integralmente** a lógica de cálculo descrita acima.

Justifique suas decisões em um **raciocínio separado**, explicando os três problemas identificados e como a refatoração torna a função testável.

```javascript
// tripCostCalculator.js

const GLOBAL_CONFIG = {
  currentFuelPrice: 5.89, // R$ por litro
};

function calculateTripCost(trip) {
  const fuelPrice = GLOBAL_CONFIG.currentFuelPrice;
  const now = new Date();
  const hour = now.getHours();

  const baseCost = trip.distanceKm * fuelPrice + trip.tollFees;
  const isNightTime = hour >= 22 || hour <= 5;
  const totalCost = isNightTime ? baseCost * 1.2 : baseCost;

  // Mutação: adiciona propriedades ao objeto de entrada
  trip.totalCost = totalCost;
  trip.flags = { nightSurchargeApplied: isNightTime };

  return trip;
}

module.exports = { calculateTripCost };
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// tripCostCalculator.js

// TODO: remova a leitura de GLOBAL_CONFIG e de new Date() da função.
//       Adicione os parâmetros necessários para receber essas dependências externamente.
//       A função NÃO deve modificar o objeto trip recebido.
//       Retorne um novo objeto com totalCost e flags.

function calculateTripCost(trip /*, TODO: adicione parâmetros aqui */) {
  // TODO: implemente a refatoração aqui
}

module.exports = { calculateTripCost };
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# trip_cost_calculator.py
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime

# Antipadrão original (referência — NÃO altere esta seção):
#
# GLOBAL_CONFIG = {"current_fuel_price": 5.89}
#
# def calculate_trip_cost(trip: dict) -> dict:
#     fuel_price = GLOBAL_CONFIG["current_fuel_price"]
#     now = datetime.now()
#     hour = now.hour
#     base_cost = trip["distance_km"] * fuel_price + trip["toll_fees"]
#     is_night_time = hour >= 22 or hour <= 5
#     total_cost = base_cost * 1.2 if is_night_time else base_cost
#     trip["total_cost"] = total_cost                        # mutação
#     trip["flags"] = {"night_surcharge_applied": is_night_time}  # mutação
#     return trip

# TODO: refatore calculate_trip_cost abaixo.
#       - Adicione os parâmetros necessários para receber fuelPrice e o horário externamente.
#       - Não acesse nenhuma variável global.
#       - Não chame datetime.now() internamente.
#       - Não modifique o dicionário trip recebido.
#       - Retorne um novo dicionário com total_cost e flags.

def calculate_trip_cost(trip: dict /*, TODO: adicione parâmetros aqui */) -> dict:
    # TODO: implemente a refatoração aqui
    pass
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// TripCostCalculator.java
import java.time.LocalDateTime;
import java.util.Map;

public class TripCostCalculator {

    // Antipadrão original (referência):
    // private static final double FUEL_PRICE = GlobalConfig.getCurrentFuelPrice();
    //
    // public Map<String, Object> calculateTripCost(Map<String, Object> trip) {
    //     double fuelPrice = GlobalConfig.getCurrentFuelPrice();   // global
    //     int hour = LocalDateTime.now().getHour();               // relógio do sistema
    //     double distanceKm = (double) trip.get("distanceKm");
    //     double tollFees   = (double) trip.get("tollFees");
    //     double baseCost   = distanceKm * fuelPrice + tollFees;
    //     boolean isNight   = hour >= 22 || hour <= 5;
    //     double totalCost  = isNight ? baseCost * 1.2 : baseCost;
    //     trip.put("totalCost", totalCost);          // mutação
    //     trip.put("flags", Map.of("nightSurchargeApplied", isNight)); // mutação
    //     return trip;
    // }

    // TODO: refatore calculateTripCost abaixo.
    //       - Adicione os parâmetros necessários para receber fuelPrice e o horário externamente.
    //       - Não acesse GlobalConfig nem LocalDateTime.now().
    //       - Não modifique o Map trip recebido.
    //       - Retorne um novo Map (ou record) com totalCost e flags.

    public Map<String, Object> calculateTripCost(
            Map<String, Object> trip
            /* TODO: adicione parâmetros aqui */) {
        // TODO: implemente a refatoração aqui
        return Map.of();
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Três problemas estruturais identificados no código original:**

1. **Mutação do parâmetro de entrada:** `trip.totalCost = ...` e `trip.flags = ...` alteram o objeto recebido, criando efeito colateral invisível para o chamador.
2. **Acoplamento a variável global:** `GLOBAL_CONFIG.currentFuelPrice` é uma dependência oculta; testes que precisam variar o preço do combustível teriam de manipular estado global antes de chamar a função.
3. **Não-determinismo de tempo:** `new Date()` (ou `datetime.now()` / `LocalDateTime.now()`) faz o resultado depender do relógio real, impossibilitando testar a taxa noturna sem controlar o sistema ou usar mocks pesados de relógio.

**Assinatura refatorada esperada:**

- `calculateTripCost(trip, fuelPrice, calculationDate)` — ou variação equivalente como `(trip, fuelPrice, hour)`.
- O objeto `trip` original permanece intocado após a chamada.
- A função retorna um novo objeto: `{ totalCost, flags: { nightSurchargeApplied } }` (ou campos equivalentes).

**Lógica de cálculo preservada (obrigatória):**
- `baseCost = trip.distanceKm * fuelPrice + trip.tollFees`
- `isNightTime = hour >= 22 || hour <= 5`
- `totalCost = isNightTime ? baseCost * 1.2 : baseCost`

**Ganhos de testabilidade:**
- Testar a taxa noturna basta passar `hour = 23` (noturno) ou `hour = 14` (diurno) — sem mock de relógio.
- Testar diferentes preços de combustível basta variar `fuelPrice` — sem alterar `GLOBAL_CONFIG`.
- Verificar que `trip` não é modificado basta comparar o objeto antes e depois da chamada — sem configuração adicional.
- A função é determinística: dadas as mesmas entradas, sempre produz a mesma saída.
<!-- /SECTION:solution-outline -->

<!-- REVIEW:metrics -->
{
  "quality": {
    "technicalCorrectness": 4,
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
  "mainIssue": "technical",
  "revisionLevelNeeded": "light",
  "suggestedChangedParts": ["template", "rubric", "prompt"],
  "referencesStatus": "present"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendacao: minor_revision.

Principais pontos:
- A questao atende bem ao eixo codeQuality, subtema modularity, dificuldade intermediate e tipo code. O codigo original em JavaScript apresenta claramente os tres antipadroes exigidos: mutacao direta do objeto de entrada, uso de variavel global para preco de combustivel e leitura direta do relogio do sistema.
- A dificuldade esta adequada para intermediate, pois exige imutabilidade, injecao de dependencias e preservacao de comportamento, indo alem de uma refatoracao estetica.
- O solution-outline propoe alterar a assinatura para receber explicitamente o preco do combustivel e uma data/hora ou hora de calculo, o que esta alinhado ao objetivo de aprendizagem.
- A principal correcao material esta no template Python: a assinatura usa comentario `/* ... */`, que nao e sintaxe valida em Python. Recomenda-se ajustar esse trecho para um placeholder ou comentario Python valido, sem mudar a ideia da questao.
- A rubrica e o prompt penalizam corretamente solucoes que mantenham `new Date()`, `datetime.now()` ou `LocalDateTime.now()` dentro da funcao. Ainda assim, como o objetivo-alvo pede receber data/hora como parametro, recomenda-se remover ou restringir a permissao de aceitar apenas uma flag precomputada de periodo noturno, para que a avaliacao cobre passagem de parametros de forma estrita.
- As regras matematicas de dominio estao alinhadas entre as tres linguagens: custo base como distancia vezes preco do combustivel mais pedagios, adicional de 20% para horario entre 22h e 05h inclusive, e retorno da flag de adicional noturno.
- As referencias estao presentes e plausiveis como sugestoes, mantendo verificacao humana posterior.
<!-- /REVIEW:comments -->
