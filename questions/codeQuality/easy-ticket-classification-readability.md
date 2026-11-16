---
id: easy-ticket-classification-readability
slug: easy-ticket-classification-readability
title: "Qualidade de Código — Legibilidade na Classificação de Chamados de Suporte"
axis: codeQuality
subtheme: readability
difficulty: easy
promptTemplate: easy-ticket-classification-readability
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [readability, naming, guard_clauses, conditionals, support_ticket, refactoring]
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
    title: "Replace Nested Conditional with Guard Clauses — Refactoring Catalog"
    type: technical_blog
    url: "https://refactoring.com/catalog/replaceNestedConditionalWithGuardClauses.html"
    relevance: 4
    confidence: 3
    supports: [solution-outline, rubric]
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
    - id: naming_clarity
      name: Clareza dos nomes
      weight: 0.25
      description: "Variáveis, parâmetros e função recebem nomes que revelam intenção; elimina abreviações e siglas sem contexto (t, h, v, si, r)."
    - id: conditional_organization
      name: Organização e ordem das condicionais
      weight: 0.30
      description: "As condições são reescritas em ordem clara de prioridade (ex.: guard clauses ou early returns), eliminando aninhamento desnecessário e tornando o fluxo linear e fácil de seguir."
    - id: behavior_preservation
      name: Preservação de comportamento
      weight: 0.25
      description: "A refatoração não altera as regras de classificação: as cinco condições e seus retornos ('critical', 'high', 'medium', 'low') produzem exatamente os mesmos resultados que o código original para qualquer entrada válida."
    - id: reasoning
      name: Justificativa / linha de raciocínio
      weight: 0.15
      description: "Explica quais problemas de legibilidade foram corrigidos (nomes, estrutura condicional, ordem de prioridade) e por que as decisões tomadas facilitam leitura e manutenção."
    - id: simplicity
      name: Foco e simplicidade
      weight: 0.05
      description: "A solução permanece simples e focada: sem decomposição excessiva em múltiplas funções desnecessárias, sem introduzir complexidade nova; a melhoria é de legibilidade, não de arquitetura."
---

<!-- SECTION:statement -->
A função abaixo classifica chamados de suporte técnico como `low`, `medium`, `high` ou `critical` com base em quatro campos do chamado. O código é funcional, mas usa nomes de variáveis e parâmetros pouco claros, combinações de condições difíceis de decifrar e a ordem das verificações não reflete a prioridade das regras.

**Regras de negócio (para preservação de comportamento):**
- Se o campo `si` for `'down'`, a classificação é `critical`.
- Se `v` for `true` **e** `h` for maior que `4`, a classificação é `high`.
- Se `t` for `'high'`, a classificação é `high`.
- Se `h` for maior ou igual a `24`, a classificação é `medium`.
- Caso contrário, a classificação é `low`.

**Tarefa:** refatore a função abaixo para melhorar sua legibilidade. Foque em **renomear** o parâmetro e as variáveis para termos descritivos, **reorganizar** as condicionais em ordem clara de prioridade e **simplificar** o fluxo sem alterar o comportamento. Apresente sua refatoração e justifique as decisões em uma **linha de raciocínio separada**.

```javascript
// ticketClassifier.js
function classify(tk) {
  let r = 'low';
  if (tk.si !== 'down') {
    if (tk.t === 'high') {
      r = 'high';
    } else {
      if (tk.v && tk.h > 4) {
        r = 'high';
      } else {
        if (tk.h >= 24) {
          r = 'medium';
        }
      }
    }
  } else {
    r = 'critical';
  }
  return r;
}

module.exports = { classify };
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// ticketClassifier.js

/**
 * Classifica um chamado de suporte como 'low', 'medium', 'high' ou 'critical'.
 * @param {{ t: string, h: number, v: boolean, si: string }} tk
 *   t  = priority informada pelo cliente ('high' | outro)
 *   h  = horas em aberto
 *   v  = cliente VIP (true/false)
 *   si = impacto no serviço ('down' | outro)
 * @returns {'low' | 'medium' | 'high' | 'critical'}
 */
function classifyTicket(ticket) {
  // TODO: refatore preservando as regras descritas no enunciado.
  // Dica: renomeie o parâmetro e use nomes descritivos para cada verificação;
  //       organize as condições em ordem explícita de prioridade com early return.
  return 'low';
}

module.exports = { classifyTicket };
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# ticket_classifier.py


def classify_ticket(ticket: dict) -> str:
    """
    Classifica um chamado de suporte como 'low', 'medium', 'high' ou 'critical'.

    ticket keys:
        t  (str)  — priority informada pelo cliente: 'high' | outro
        h  (int)  — horas em aberto
        v  (bool) — cliente VIP
        si (str)  — impacto no serviço: 'down' | outro

    TODO: refatore preservando as regras descritas no enunciado.
    Dica: renomeie as variáveis com nomes descritivos e organize as condições
          em ordem explícita de prioridade com early return / guard clauses.
    """
    return 'low'
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// TicketClassifier.java
public class TicketClassifier {

    /**
     * Classifica um chamado de suporte como "low", "medium", "high" ou "critical".
     *
     * @param ticket chamado com os campos priority, hoursOpen, isVipCustomer e serviceImpact
     * @return classificação do chamado
     *
     * TODO: refatore preservando as regras descritas no enunciado.
     * Dica: renomeie variáveis locais com nomes descritivos e organize as condições
     *       em ordem explícita de prioridade com early return.
     */
    public String classifyTicket(Ticket ticket) {
        // TODO: implemente aqui a versão refatorada
        return "low";
    }

    public static class Ticket {
        public String priority;      // 'high' | outro
        public int hoursOpen;        // horas em aberto
        public boolean isVipCustomer; // cliente VIP
        public String serviceImpact; // 'down' | outro
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Problemas de legibilidade identificados:** nomes de variáveis e parâmetros sem significado (`tk`, `r`, `t`, `h`, `v`, `si`); condicionais aninhadas em três níveis desnecessários; a condição mais prioritária (`'down'`) fica no ramo `else` em vez de ser tratada primeiro; ausência de guard clauses ou early return.

**Renomeações esperadas:**
- `tk` → `ticket` (parâmetro)
- `si` → `serviceImpact` / `ticket.serviceImpact`
- `v` → `isVipCustomer` / `ticket.isVipCustomer`
- `h` → `hoursOpen` / `ticket.hoursOpen`
- `t` → `priority` / `ticket.priority`
- `r` → eliminada (usar early return)

**Organização esperada das condicionais (ordem de prioridade explícita):**
1. Guard clause: se `serviceImpact === 'down'` → retorna `'critical'` imediatamente.
2. Guard clause: se `isVipCustomer && hoursOpen > 4` → retorna `'high'`.
3. Guard clause: se `priority === 'high'` → retorna `'high'`.
4. Guard clause: se `hoursOpen >= 24` → retorna `'medium'`.
5. Retorno padrão: `'low'`.

**Preservação obrigatória:** as cinco regras e seus retornos devem produzir exatamente os mesmos resultados que o código original para qualquer combinação de entrada.

**Ponto-chave para a justificativa:** a leitura top-down do fluxo refatorado revela diretamente a hierarquia de severidade (critical → high → high → medium → low), ao contrário do original que esconde `critical` no `else` de uma condição negada.
<!-- /SECTION:solution-outline -->

<!-- REVIEW:metrics -->
{
  "quality": {
    "technicalCorrectness": 3,
    "statementClarity": 4,
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
  "suggestedChangedParts": ["statement", "template", "rubric", "solution-outline", "prompt"],
  "referencesStatus": "present"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendação: minor_revision.

Principais pontos:
- A questão pertence a `codeQuality/readability`: o trabalho central é melhorar nomes, tornar as condições compreensíveis e linearizar o fluxo, sem corrigir defeito funcional, propor arquitetura ou exigir modularização ampla.
- A dificuldade está adequada para `easy` sem ser trivial: há quatro campos, regras sobrepostas e uma ordem de precedência que precisa ser preservada; apenas renomear uma variável ou formatar o código não atende à rubrica.
- O formato `code` é válido, com frontmatter, `inputConfig`, templates para JavaScript, Python e Java, rubrica com cinco critérios e pesos somando 1.0, `solution-outline` e prompt estruturado. Os placeholders `enunciado`, `rubrica`, `pontos_esperados`, `codigo` e `raciocinio` seguem o padrão real para esse tipo de questão, e os ids e pesos do JSON do prompt correspondem à rubrica.
- O problema principal é a inconsistência do contrato entre linguagens. JavaScript e Python recebem chaves legadas abreviadas (`t`, `h`, `v`, `si`), enquanto Java já expõe campos descritivos (`priority`, `hoursOpen`, `isVipCustomer`, `serviceImpact`). Assim, o estudante de Java não enfrenta a mesma tarefa de nomenclatura que os demais.
- O enunciado pede preservação de comportamento, mas o `solution-outline` sugere acessos como `ticket.serviceImpact` no lugar de `ticket.si`. Em JavaScript e Python, renomear diretamente as propriedades muda o formato aceito pela função e pode quebrar o contrato de entrada. Recomenda-se escolher e explicitar uma abordagem uniforme: manter as chaves legadas e criar aliases locais descritivos, ou adotar campos descritivos nos três templates e declarar claramente essa alteração de contrato.
- A rubrica e o prompt devem acompanhar essa decisão: atualmente tratam `t`, `h`, `v` e `si` como nomes que precisam ser eliminados, embora possam ser chaves obrigatórias do contrato em JavaScript/Python. A penalização deve distinguir o uso inevitável das chaves legadas de variáveis locais pouco descritivas.
- As regras de classificação estão explícitas e objetivas, e o código inicial é funcional, porém deliberadamente pouco legível. O `solution-outline` permanece focado em nomes e fluxo, sem transformar a tarefa em modularidade ou redesign.
- O cenário de chamados e a refatoração curta são suficientemente distintos da questão existente de desconto/e-commerce, que possui mais regras e exige extração de funções auxiliares.
- As referências são plausíveis e conservadoras para legibilidade e simplificação de condicionais; todas permanecem corretamente como `suggested_not_verified`, sujeitas à verificação humana.
<!-- /REVIEW:comments -->
