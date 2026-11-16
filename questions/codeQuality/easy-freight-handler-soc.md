---
id: easy-freight-handler-soc
slug: easy-freight-handler-soc
title: "Qualidade de Código — Separação de Responsabilidades no Handler de Frete"
axis: codeQuality
subtheme: modularity
difficulty: easy
promptTemplate: easy-freight-handler-soc
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [separation_of_concerns, single_responsibility, function_extraction, http_handler, refactoring, testability]
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
    title: "Extract Function — Refactoring Catalog"
    type: technical_blog
    url: "https://refactoring.com/catalog/extractFunction.html"
    relevance: 5
    confidence: 4
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Separation of Concerns — Martin Fowler's Bliki"
    type: technical_blog
    url: "https://martinfowler.com/bliki/SeparationOfConcerns.html"
    relevance: 4
    confidence: 4
    supports: [statement, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "The Pragmatic Programmer: Your Journey to Mastery (20th Anniversary Edition)"
    type: book
    url: null
    relevance: 3
    confidence: 4
    supports: [rubric, solution-outline]
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
    - id: business_logic_extraction
      name: Extração da lógica de negócio
      weight: 0.40
      description: >
        Cria uma função separada (ex.: calculateFreight) que recebe apenas valores primitivos
        (weight, distance, region) e retorna o custo calculado — sem qualquer referência a
        objetos HTTP (req, res, request, response, status codes, JSON).
    - id: handler_delegation
      name: Delegação correta no handler
      weight: 0.25
      description: >
        O handler HTTP passa a ser uma camada de orquestração fina: extrai os dados do objeto
        de requisição, chama a função de negócio e devolve o resultado na resposta, sem
        reimplementar a matemática do frete.
    - id: behavior_preservation
      name: Preservação do cálculo original
      weight: 0.20
      description: >
        A fórmula e a lógica de taxa extra por região produzem exatamente os mesmos resultados
        que o código original para qualquer combinação de weight, distance e region.
    - id: reasoning
      name: Justificativa de testabilidade e desacoplamento
      weight: 0.15
      description: >
        A justificativa menciona explicitamente ao menos um dos seguintes: "testabilidade"
        (possibilidade de testar a função pura sem mocks de HTTP), "separação de
        responsabilidades" ou "desacoplamento do framework".
---

<!-- SECTION:statement -->
O endpoint abaixo (`POST /api/freight`) recebe o peso do pacote, a distância de entrega e a região do destinatário, calcula o custo do frete e responde com o resultado em JSON. O código funciona corretamente, mas toda a regra de cálculo está embutida dentro do handler HTTP — impossibilitando testar a matemática sem subir um servidor ou mockar o objeto de requisição.

**Regras de negócio (para preservação de comportamento):**
- Custo base: `peso × 0.5 + distância × 2`
- Se a região for `"NORTE"` ou `"NORDESTE"`, somar uma taxa adicional de **15** ao custo base.
- O resultado deve ser um número (o custo total do frete).

**Tarefa:** refatore o código aplicando a Separação de Responsabilidades (SoC): extraia a regra de cálculo do frete para uma função independente que não saiba nada sobre HTTP. O handler deve passar a ser apenas um orquestrador. Apresente sua refatoração e justifique a decisão em um **raciocínio separado**.

```javascript
// freightController.js
app.post('/api/freight', (req, res) => {
  const { weight, distance, region } = req.body;

  let cost = weight * 0.5 + distance * 2;
  if (region === 'NORTE' || region === 'NORDESTE') {
    cost += 15;
  }

  res.json({ freight: cost });
});
```

<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// freightController.js

// TODO: extraia a lógica de cálculo do frete para uma função separada,
//       sem dependência de req, res ou qualquer objeto HTTP.

app.post('/api/freight', (req, res) => {
  const { weight, distance, region } = req.body;

  // TODO: chame a função extraída aqui e devolva o resultado.
  res.json({ freight: 0 });
});
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# freight_controller.py
from flask import Flask, request, jsonify

app = Flask(__name__)

# TODO: extraia a lógica de cálculo do frete para uma função separada,
#       sem dependência de request, Response ou qualquer objeto HTTP.

@app.route('/api/freight', methods=['POST'])
def freight_handler():
    data = request.get_json()
    weight = data.get('weight')
    distance = data.get('distance')
    region = data.get('region')

    # TODO: chame a função extraída aqui e devolva o resultado.
    return jsonify({'freight': 0})
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// FreightController.java
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class FreightController {

    // TODO: extraia a lógica de cálculo do frete para um método separado
    //       (ou classe de serviço), sem dependência de HttpServletRequest,
    //       ResponseEntity ou qualquer objeto HTTP.

    @PostMapping("/freight")
    public FreightResponse handleFreight(@RequestBody FreightRequest req) {
        double weight   = req.getWeight();
        double distance = req.getDistance();
        String region   = req.getRegion();

        // TODO: chame o método extraído aqui e devolva o resultado.
        return new FreightResponse(0);
    }

    public record FreightRequest(double weight, double distance, String region) {
        public double getWeight()   { return weight; }
        public double getDistance() { return distance; }
        public String getRegion()   { return region; }
    }

    public record FreightResponse(double freight) {}
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Problema identificado:** a regra matemática (`peso × 0.5 + distância × 2` + taxa regional) está acoplada ao handler HTTP, impedindo testes unitários da lógica de negócio sem infraestrutura de servidor ou mocks de `req`/`res`.

**Função de negócio esperada:**

- `calculateFreight(weight, distance, region)` — recebe apenas valores primitivos, aplica a fórmula e retorna o custo total como número. Nenhuma menção a HTTP, `req`, `res`, status codes ou JSON.

**Handler refatorado esperado:**

- Extrai `weight`, `distance` e `region` do objeto de requisição.
- Delega o cálculo para `calculateFreight(weight, distance, region)`.
- Devolve o resultado obtido na resposta HTTP — sem reimplementar a matemática.

**Preservação obrigatória:** `peso × 0.5 + distância × 2`; se `region === 'NORTE' || region === 'NORDESTE'`, somar 15.

**Ganhos esperados na justificativa:** a função de negócio pode ser testada com uma chamada direta (ex.: `calculateFreight(10, 5, 'NORTE')`) sem qualquer mock HTTP; o handler torna-se um orquestrador fino; a lógica passa a ser reutilizável em outros contextos (CLI, fila de mensagens etc.).
<!-- /SECTION:solution-outline -->

<!-- REVIEW:metrics -->
{
  "quality": {
    "technicalCorrectness": 5,
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
  "suggestedChangedParts": ["statement", "template"],
  "referencesStatus": "present"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendacao: minor_revision.

Principais pontos:
- A questao esta tecnicamente correta, permanece estritamente easy e pede apenas a extracao de uma funcao simples, sem exigir injecao de dependencias ou arquitetura adicional.
- O solution-outline separa explicitamente a matematica do frete da camada HTTP: a funcao esperada recebe apenas weight, distance e region, enquanto o handler apenas extrai dados, delega e responde.
- A rubrica avalia tanto o codigo quanto a justificativa do aluno, incluindo testabilidade, separacao de responsabilidades e desacoplamento do framework.
- O prompt de avaliacao esta alinhado a rubrica e instrui o juiz a penalizar respostas que mantem req, res, request, response ou objetos HTTP na funcao extraida; isso cobre o caso de apenas mover o codigo para outra funcao passando o request inteiro.
- Recomenda-se apenas reforcar no enunciado ou no comentario inicial do template a falsa sensacao de que o codigo "ja esta bom por ser pequeno", para tornar mais explicito que acoplamento a infraestrutura independe do tamanho do handler.
- As referencias estao presentes e plausiveis para o tema, mantendo verificacao humana posterior.
<!-- /REVIEW:comments -->
