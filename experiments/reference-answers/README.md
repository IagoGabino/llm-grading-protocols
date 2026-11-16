# Reference answers

Este diretório guarda respostas de referência do experimento POC II em arquivos YAML por questão.

## Onde colocar arquivos

- Rascunhos incrementais: `experiments/reference-answers/drafts/<questionSlug>.yaml`
- Arquivos finais, futuramente: `experiments/reference-answers/final/<questionSlug>.yaml`
- Exemplo demonstrativo: `experiments/reference-answers/examples/example-question.yaml`

O script ignora arquivos que não sejam `.yaml` ou `.yml`.

## Formato esperado

Cada arquivo representa uma questão existente do banco:

```yaml
questionSlug: easy-refactor-shipping

answers:
  - id: easy-refactor-shipping-strong
    profile: strong
    variant: complete_correct
    language: javascript
    code: |
      ...
    justification: |
      ...
    expectedOverall: 4.8
    expectedCriteria:
      - criterionId: problems
        expectedScore: 5
        rationale: |
          ...
```

O `questionSlug` fica só na raiz do arquivo. O loader anexa esse slug a cada resposta quando gera a lista achatada para uso futuro pelo runner.

## Como rodar

Validar a pasta padrão de rascunhos:

```bash
npm run validate:reference-answers
```

Validar um arquivo ou pasta específica:

```bash
npm run validate:reference-answers -- experiments/reference-answers/drafts/minha-questao.yaml
npm run validate:reference-answers -- experiments/reference-answers/drafts
npm run validate:reference-answers -- experiments/reference-answers/final
```

## O que o validador checa

- estrutura YAML, `questionSlug` e `answers`;
- exatamente 3 respostas por arquivo;
- uma resposta `strong`, uma `medium` e uma `weak` ou `misleading`;
- ids únicos dentro do arquivo e entre arquivos;
- `profile`, `variant`, notas e rationales;
- presença de `answerText`, `code` ou `justification`;
- existência da questão no banco real;
- alinhamento de `expectedCriteria[].criterionId` com a rubrica real;
- `language` compatível com `supportedLanguages`, quando informada;
- conteúdo compatível com questões `code` ou `multi-section`;
- warnings simples de coerência entre `profile`, `expectedOverall` e pesos da rubrica.

Erros bloqueantes retornam exit code diferente de zero. Warnings não quebram o script.

Esta validação é incremental: ela valida o que existir no caminho informado e não exige agora as 8 questões finais, 24 respostas, cobertura dos quatro eixos ou distribuição final de dificuldades.

As respostas e notas esperadas são curadas manualmente e não devem ser recalibradas depois de inspecionar saídas dos modelos.
