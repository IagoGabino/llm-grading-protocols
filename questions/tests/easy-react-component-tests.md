---
id: easy-react-component-tests
slug: easy-react-component-tests
title: Testes — Componente React com Interações de Usuário
axis: tests
subtheme: test_design
difficulty: easy
promptTemplate: easy-react-component-tests
supportedLanguages: [javascript]
defaultLanguage: javascript
tags: [edge_cases, test_isolation]
inputConfig:
  type: code
  language: javascript
rubric:
  version: v1
  criteria:
    - id: rendering_tests
      name: Testes de renderização
      weight: 0.35
      description: Testa renderização inicial, presença de elementos, textos e estado padrão do componente.
    - id: interaction_tests
      name: Testes de interação
      weight: 0.40
      description: Testa eventos de usuário (cliques, digitação) usando userEvent ou fireEvent, verifica mudanças de estado.
    - id: assertions_quality
      name: Qualidade das asserções
      weight: 0.15
      description: Usa queries adequadas (getByRole, getByText), asserções específicas e verifica comportamento esperado.
    - id: test_structure
      name: Estrutura dos testes
      weight: 0.10
      description: Usa describe/it, nomes descritivos, boa organização e clareza.
---

<!-- SECTION:statement -->
Você precisa escrever testes para um componente React simples: um contador com botões de incremento e decremento.

**Componente a testar:**

```jsx
// Counter.jsx
import { useState } from 'react';

export function Counter({ initialValue = 0, min = 0, max = 10 }) {
  const [count, setCount] = useState(initialValue);

  const increment = () => {
    if (count < max) {
      setCount(count + 1);
    }
  };

  const decrement = () => {
    if (count > min) {
      setCount(count - 1);
    }
  };

  const reset = () => {
    setCount(initialValue);
  };

  return (
    <div>
      <h1>Contador</h1>
      <p data-testid="count-value">Valor: {count}</p>
      <div>
        <button onClick={decrement} disabled={count === min}>
          Decrementar
        </button>
        <button onClick={increment} disabled={count === max}>
          Incrementar
        </button>
        <button onClick={reset}>
          Resetar
        </button>
      </div>
    </div>
  );
}
```

**Tarefa:**

Escreva **pelo menos 5 testes** cobrindo:

1. **Renderização inicial** - verifica se contador começa com valor inicial correto
2. **Incremento** - clica no botão de incrementar e verifica se valor aumenta
3. **Decremento** - clica no botão de decrementar e verifica se valor diminui
4. **Limite máximo** - verifica que contador não ultrapassa valor máximo
5. **Resetar** - clica em resetar e verifica se volta ao valor inicial

**Boas práticas:**
- Use `@testing-library/react` para renderizar componente
- Use `@testing-library/user-event` ou `fireEvent` para simular interações
- Prefira `getByRole` para buscar botões (mais semântico)
- Use `getByTestId` ou `getByText` quando necessário

Na sua **linha de raciocínio**, explique:
- Por que escolheu essas queries específicas
- Diferença entre `fireEvent` e `userEvent`
- Importância de testar casos de borda (limites min/max)
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Counter } from './Counter';

describe('Counter component', () => {
  it('deve renderizar com valor inicial', () => {
    // TODO: renderize o componente e verifique o valor inicial
    render(<Counter initialValue={5} />);
    // TODO: adicione asserções
  });

  it('deve incrementar o contador ao clicar no botão', async () => {
    // TODO: renderize, encontre o botão, clique e verifique
  });

  // TODO: adicione pelo menos mais 3 testes conforme enunciado
});
<!-- /SECTION:template:javascript -->

<!-- SECTION:solution-outline -->
**Solução esperada:**

```javascript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Counter } from './Counter';

describe('Counter component', () => {
  it('deve renderizar com valor inicial padrão', () => {
    render(<Counter />);
    
    expect(screen.getByText('Contador')).toBeInTheDocument();
    expect(screen.getByTestId('count-value')).toHaveTextContent('Valor: 0');
  });

  it('deve renderizar com valor inicial customizado', () => {
    render(<Counter initialValue={5} />);
    
    expect(screen.getByTestId('count-value')).toHaveTextContent('Valor: 5');
  });

  it('deve incrementar o contador ao clicar no botão', async () => {
    const user = userEvent.setup();
    render(<Counter initialValue={3} />);

    const incrementButton = screen.getByRole('button', { name: /incrementar/i });
    await user.click(incrementButton);

    expect(screen.getByTestId('count-value')).toHaveTextContent('Valor: 4');
  });

  it('deve decrementar o contador ao clicar no botão', async () => {
    const user = userEvent.setup();
    render(<Counter initialValue={5} />);

    const decrementButton = screen.getByRole('button', { name: /decrementar/i });
    await user.click(decrementButton);

    expect(screen.getByTestId('count-value')).toHaveTextContent('Valor: 4');
  });

  it('não deve incrementar além do valor máximo', async () => {
    const user = userEvent.setup();
    render(<Counter initialValue={10} max={10} />);

    const incrementButton = screen.getByRole('button', { name: /incrementar/i });
    
    // Botão deve estar desabilitado no máximo
    expect(incrementButton).toBeDisabled();
    
    // Tentar clicar não deve alterar o valor
    await user.click(incrementButton);
    expect(screen.getByTestId('count-value')).toHaveTextContent('Valor: 10');
  });

  it('não deve decrementar abaixo do valor mínimo', async () => {
    const user = userEvent.setup();
    render(<Counter initialValue={0} min={0} />);

    const decrementButton = screen.getByRole('button', { name: /decrementar/i });
    
    // Botão deve estar desabilitado no mínimo
    expect(decrementButton).toBeDisabled();
    
    // Tentar clicar não deve alterar o valor
    await user.click(decrementButton);
    expect(screen.getByTestId('count-value')).toHaveTextContent('Valor: 0');
  });

  it('deve resetar para valor inicial ao clicar em resetar', async () => {
    const user = userEvent.setup();
    render(<Counter initialValue={5} />);

    // Incrementar algumas vezes
    const incrementButton = screen.getByRole('button', { name: /incrementar/i });
    await user.click(incrementButton);
    await user.click(incrementButton);
    
    expect(screen.getByTestId('count-value')).toHaveTextContent('Valor: 7');

    // Resetar
    const resetButton = screen.getByRole('button', { name: /resetar/i });
    await user.click(resetButton);

    expect(screen.getByTestId('count-value')).toHaveTextContent('Valor: 5');
  });

  it('deve habilitar/desabilitar botões conforme limites', async () => {
    const user = userEvent.setup();
    render(<Counter initialValue={5} min={0} max={10} />);

    const incrementButton = screen.getByRole('button', { name: /incrementar/i });
    const decrementButton = screen.getByRole('button', { name: /decrementar/i });

    // Ambos habilitados no meio do range
    expect(incrementButton).not.toBeDisabled();
    expect(decrementButton).not.toBeDisabled();

    // Incrementar até o máximo
    for (let i = 0; i < 5; i++) {
      await user.click(incrementButton);
    }

    // No máximo, incrementar deve estar desabilitado
    expect(incrementButton).toBeDisabled();
    expect(decrementButton).not.toBeDisabled();
  });
});
```

**Justificativa:**

### Por que essas queries?

1. **`getByRole('button', { name: /incrementar/i })`:**
   - Mais semântico e acessível
   - Testa que elemento é realmente um botão
   - Usa texto acessível (screen readers)
   - Case-insensitive com regex `/i`

2. **`getByTestId('count-value')`:**
   - Para elementos sem role semântico claro
   - Alternativa: `getByText(/Valor: \d+/)` com regex

3. **`getByText('Contador')`:**
   - Simples para textos estáticos
   - Verifica renderização de títulos

### fireEvent vs userEvent

| fireEvent | userEvent |
|-----------|-----------|
| Dispara evento único | Simula sequência completa de eventos reais |
| `fireEvent.click(button)` | `await user.click(button)` |
| Síncrono | Assíncrono (mais realista) |
| Não simula hover, focus, etc. | Simula interação completa do usuário |

**Recomendação:** usar `userEvent` (mais próximo do comportamento real)

### Importância de testar limites

- **Casos de borda** revelam bugs que usuários reais encontrarão
- **Validação de lógica:** garante que `if (count < max)` funciona
- **Acessibilidade:** botões desabilitados no limite melhoram UX
- **Regressão:** se alguém mudar `<=` para `<`, testes detectam

### Outras asserções úteis

```javascript
// Testar classe CSS
expect(button).toHaveClass('disabled');

// Testar atributo
expect(button).toHaveAttribute('aria-pressed', 'true');

// Testar visibilidade
expect(element).toBeVisible();
```

### Melhorias possíveis (fora do escopo easy)

- Testar com diferentes props (min/max negativos)
- Testar acessibilidade com `jest-axe`
- Snapshot testing para regrессões visuais
- Testar callbacks (se componente receber `onChange`)
<!-- /SECTION:solution-outline -->
