---
id: intermediate-department-modal-stale-state
slug: intermediate-department-modal-stale-state
title: "Correção de Bug — Estado Reaproveitado entre Entidades em Modal de Edição"
axis: bugFix
subtheme: state_and_lifecycle
difficulty: intermediate
promptTemplate: intermediate-department-modal-stale-state
supportedLanguages: [javascript]
defaultLanguage: javascript
tags: [stale_state, useEffect, props_sync, modal, lifecycle, react, form_reset]
references:
  - id: ref-1
    title: "Synchronizing with Effects — React Docs"
    type: official_docs
    url: "https://react.dev/learn/synchronizing-with-effects"
    relevance: 5
    confidence: 5
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "You Might Not Need an Effect — React Docs"
    type: official_docs
    url: "https://react.dev/learn/you-might-not-need-an-effect"
    relevance: 4
    confidence: 5
    supports: [solution-outline, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Preserving and Resetting State — React Docs"
    type: official_docs
    url: "https://react.dev/learn/preserving-and-resetting-state"
    relevance: 4
    confidence: 5
    supports: [solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "React Hooks: useEffect — Dan Abramov (overreacted.io)"
    type: technical_blog
    url: "https://overreacted.io/a-complete-guide-to-useeffect/"
    relevance: 3
    confidence: 4
    supports: [rubric, solution-outline]
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
    - id: root_cause
      name: Identificação da causa raiz
      weight: 0.25
      description: Identifica que o estado local (`localName`, `errors`) é inicializado a partir de `department` apenas na montagem do componente — o `useEffect` sem dependência em `department` (ou ausente) não sincroniza quando a prop muda, fazendo o modal exibir dados ou erros da entidade anterior.
    - id: sync_fix
      name: Correção da sincronização entre prop e estado local
      weight: 0.35
      description: Corrige o `useEffect` para re-executar quando `department` mudar (adicionando `department` ao array de dependências) e reinicializa `localName` e `errors` a partir da nova prop — garantindo que ao abrir o modal para outra entidade o estado reflita os dados corretos.
    - id: cleanup_on_close
      name: Limpeza de erros e estado temporário no fechamento
      weight: 0.20
      description: Garante que ao fechar o modal sem salvar, erros de validação e alterações locais não persistam para a próxima abertura — seja via reset no `useEffect` dependente de `isOpen`/`department`, seja limpando o estado no handler de fechamento, seja combinando ambos.
    - id: edit_preservation
      name: Preservação da edição em andamento
      weight: 0.10
      description: A correção não sobrescreve o que o usuário digitou enquanto o modal está aberto para a mesma entidade — o reset só ocorre quando `department` troca ou o modal reabre, não a cada render.
    - id: explanation
      name: Justificativa sobre ciclo de vida e dependências
      weight: 0.10
      description: Explica em linguagem clara por que o `useEffect` sem a dependência correta não detecta a mudança de entidade, como o array de dependências controla a sincronização e o risco de sobrescrever input do usuário com um efeito dependente demais.
---

<!-- SECTION:statement -->
O painel administrativo de uma empresa possui um modal de edição de departamentos. O mesmo componente `DepartmentEditModal` é reutilizado para editar departamentos diferentes: o componente recebe via prop o departamento selecionado (`department`) e permanece montado enquanto o painel estiver aberto — ele apenas alterna entre visível e oculto.

**Contrato esperado:**
- Ao abrir o modal para um departamento, os campos devem exibir os dados desse departamento.
- Ao trocar o departamento editado (fechar e abrir para outro), o estado local deve ser reinicializado com os dados da nova entidade.
- Ao fechar o modal sem salvar, erros de validação e alterações locais **não devem contaminar** a próxima abertura.
- Enquanto o modal está aberto para a mesma entidade, a edição em andamento **não deve ser sobrescrita** por re-renders externos.

**Comportamento incorreto (bug):**

```
1. Usuário abre o modal para o departamento "Financeiro" (id: 1).
2. Apaga o nome → aparece o erro "Nome é obrigatório".
3. Fecha o modal sem salvar.
4. Abre o modal para o departamento "Jurídico" (id: 2).
5. ❌ O campo "Nome" ainda mostra "" (vazio) ou "Financeiro" e o erro "Nome é obrigatório" ainda aparece.
```

**Tarefa:** Corrija `DepartmentEditModal` para que o estado local seja sincronizado corretamente com a prop `department` e os erros sejam limpos na troca de entidade. Na sua **linha de raciocínio**, explique: (1) por que o estado local não sincroniza quando a prop muda, (2) como você corrigiu a sincronização sem causar loop ou sobrescrever input ativo, e (3) como o ciclo de vida e as dependências do efeito se relacionam com o problema.

```javascript
// DepartmentEditModal.jsx
import { useState, useEffect } from 'react';

function DepartmentEditModal({ isOpen, department, onClose, onSave }) {
  const [localName, setLocalName] = useState(department?.name ?? '');
  const [errors, setErrors]       = useState({});

  // BUG: o efeito inicializa o estado apenas uma vez, na montagem.
  // Quando `department` muda (usuário troca de departamento), o estado
  // local não é reinicializado e continua exibindo dados do anterior.
  useEffect(() => {
    setLocalName(department?.name ?? '');
    setErrors({});
  }, []); // ← array de dependências vazio: executa só no mount

  function handleSave() {
    if (!localName.trim()) {
      setErrors({ name: 'Nome é obrigatório.' });
      return;
    }
    onSave({ ...department, name: localName.trim() });
  }

  if (!isOpen) return null;

  return (
    <div className="modal">
      <h2>Editar Departamento</h2>
      <label>
        Nome
        <input
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
        />
      </label>
      {errors.name && <span className="error">{errors.name}</span>}
      <button onClick={handleSave}>Salvar</button>
      <button onClick={onClose}>Cancelar</button>
    </div>
  );
}

export default DepartmentEditModal;
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// DepartmentEditModal.jsx
import { useState, useEffect } from 'react';

function DepartmentEditModal({ isOpen, department, onClose, onSave }) {
  const [localName, setLocalName] = useState(department?.name ?? '');
  const [errors, setErrors]       = useState({});

  // TODO: corrija o useEffect abaixo para que o estado local seja sincronizado
  // quando `department` muda (ex.: usuário troca de departamento) e para que
  // erros e alterações locais não contaminem a próxima abertura do modal.
  //
  // Dica: pense em quais valores devem entrar no array de dependências e em
  // qual momento o reset de `localName` e `errors` deve acontecer.
  // Cuidado: a correção não deve sobrescrever o que o usuário digita enquanto
  // o modal está aberto para a mesma entidade.
  useEffect(() => {
    setLocalName(department?.name ?? '');
    setErrors({});
  }, []); // ← dependências incorretas

  function handleSave() {
    if (!localName.trim()) {
      setErrors({ name: 'Nome é obrigatório.' });
      return;
    }
    onSave({ ...department, name: localName.trim() });
  }

  if (!isOpen) return null;

  return (
    <div className="modal">
      <h2>Editar Departamento</h2>
      <label>
        Nome
        <input
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
        />
      </label>
      {errors.name && <span className="error">{errors.name}</span>}
      <button onClick={handleSave}>Salvar</button>
      <button onClick={onClose}>Cancelar</button>
    </div>
  );
}

export default DepartmentEditModal;
<!-- /SECTION:template:javascript -->

<!-- SECTION:solution-outline -->
**Causa raiz**
- O `useEffect` possui array de dependências vazio (`[]`), portanto é executado **somente na montagem** do componente. Como `DepartmentEditModal` permanece montado e apenas alterna `isOpen`, ao trocar `department` o estado local (`localName`, `errors`) não é reinicializado e continua com os valores da entidade anterior.

**Correção principal — dependência em `department.id`**

```javascript
useEffect(() => {
  setLocalName(department?.name ?? '');
  setErrors({});
}, [department?.id]); // re-executa somente quando a entidade troca
```

- Usar `department?.id` (e não o objeto inteiro `department`) evita que o efeito dispare a cada render quando a referência do objeto muda sem o `id` mudar, prevenindo loop e sobrescrita do input ativo.

**Correção complementar — limpar ao fechar**

Para garantir que erros e edições temporárias não persistam mesmo que o componente seja reaproveitado com o mesmo `department.id` (ex.: modal fechado e reaberto para a mesma entidade):

```javascript
useEffect(() => {
  if (isOpen) {
    setLocalName(department?.name ?? '');
    setErrors({});
  }
}, [isOpen, department?.id]);
```

- Quando `isOpen` muda de `false` para `true`, o efeito reinicializa o estado com os dados frescos da prop — garantindo estado limpo em toda reabertura.

**Alternativa aceitável — `key` prop**

Passar `key={department?.id}` ao componente no pai força a remontagem a cada troca de entidade, reinicializando todo o estado automaticamente:

```jsx
<DepartmentEditModal key={department?.id} ... />
```

Trade-offs: simples e sem risco de loop, mas destrói e recria o componente inteiro — potencial perda de foco, animações e micro-estado. Válido como alternativa, mas o aluno deve mencionar esses trade-offs.

**Pontos essenciais**
1. O array de dependências vazio é a causa direta: sem `department?.id`, o efeito não detecta a troca de entidade.
2. Dependência no objeto `department` inteiro pode causar re-execuções desnecessárias se a referência mudar a cada render do pai.
3. Dependência em `isOpen` + `department?.id` resolve tanto a troca de entidade quanto o fechamento sem salvar.
4. A edição em andamento é preservada porque o efeito só re-executa quando `department?.id` ou `isOpen` mudam — não a cada keystroke do usuário.
5. A solução com `key` é válida mas exige justificativa de trade-offs para ser aceita como completa.
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
- A questão pertence claramente a `bugFix/state_and_lifecycle`: o problema central é estado local derivado de props em um modal mantido montado e reutilizado entre entidades, não qualidade de código, testabilidade, estado global, memory leak por listeners ou resposta assíncrona obsoleta.
- A dificuldade está adequada para `intermediate`, pois exige diagnosticar ciclo de vida do componente, dependências de `useEffect`, reset de estado local e preservação de edição em andamento, sem exigir biblioteca avançada ou arquitetura ampla.
- O formato `code` está coerente com JavaScript/React, o bug é reproduzível pelo fluxo descrito e o contrato de abertura, troca de entidade, fechamento sem salvar e limpeza de estado está explícito.
- A rubrica é observável e cobre causa raiz, sincronização entre prop e estado local, limpeza de erros, preservação do comportamento durante a edição e justificativa sobre ciclo de vida.
- O `solution-outline` reconhece alternativas relevantes, incluindo reset em `useEffect`, limpeza/reinicialização ligada a `isOpen` e remount com `key`, discutindo os trade-offs sem aceitar remount como solução mágica.
- O prompt de avaliação segue o padrão real de `prompts/`, usa placeholders compatíveis com questão `code` e reproduz corretamente os ids e pesos da rubrica.
- As referências são plausíveis, conservadoras e permanecem como `suggested_not_verified`.
<!-- /REVIEW:comments -->
