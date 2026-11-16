---
id: advanced-memory-leak-event-listeners
slug: advanced-memory-leak-event-listeners
title: Correção de Bug — Memory Leak por Event Listeners não Removidos
axis: bugFix
subtheme: state_and_lifecycle
difficulty: advanced
promptTemplate: advanced-memory-leak-event-listeners
supportedLanguages: [javascript]
defaultLanguage: javascript
tags: [memory_leak, exception_handling]
inputConfig:
  type: code
  language: javascript
rubric:
  version: v1
  criteria:
    - id: root_cause_analysis
      name: Análise da causa raiz
      weight: 0.30
      description: Identifica que listeners não são removidos ao desmontar componente, causando acúmulo de referências e impedindo garbage collection.
    - id: fix_completeness
      name: Completude da correção
      weight: 0.35
      description: Remove todos os listeners no cleanup, usa AbortController ou equivalente, previne múltiplos registros do mesmo listener.
    - id: lifecycle_understanding
      name: Entendimento de lifecycle
      weight: 0.20
      description: Demonstra conhecimento de mount/unmount, cleanup de efeitos, e padrões de gerenciamento de subscriptions.
    - id: debugging_approach
      name: Abordagem de debugging
      weight: 0.10
      description: Menciona técnicas de detecção (DevTools heap profiler, Performance tab, weak references).
    - id: explanation
      name: Explicação técnica
      weight: 0.05
      description: Explica impacto do leak (uso crescente de memória, slowdown, crashes) e como a correção resolve.
---

<!-- SECTION:statement -->
Uma Single Page Application (SPA) está apresentando degradação de performance ao longo do tempo. Após investigação com Chrome DevTools, descobriu-se que o heap de memória cresce continuamente mesmo com o usuário navegando entre páginas. A análise revelou que event listeners globais (window, document) estão sendo registrados mas nunca removidos.

**Comportamento observado:**

1. Usuário acessa Dashboard → event listeners registrados: 5
2. Usuário navega para Settings → listeners: 10 (5 antigos + 5 novos)
3. Usuário volta para Dashboard → listeners: 15 (10 antigos + 5 novos)
4. Após 20 navegações → listeners: 100+
5. Performance degrada, interações ficam lentas, eventual crash do browser

**Análise do Heap Snapshot:**
```
Retained Size: 45 MB
- EventTarget (window): 87 listeners
  - resize: 23 instances
  - scroll: 31 instances  
  - keydown: 18 instances
  - storage: 15 instances
```

**Código problemático:**

```javascript
// Dashboard.jsx (React component)
import { useEffect, useState } from 'react';

export function Dashboard() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    // Listener 1: Resize para layout responsivo
    window.addEventListener('resize', () => {
      setWindowWidth(window.innerWidth);
    });

    // Listener 2: Scroll para carregar mais dados
    window.addEventListener('scroll', () => {
      setScrollPosition(window.scrollY);
      if (window.scrollY > 500) {
        loadMoreData();
      }
    });

    // Listener 3: Atividade do usuário para timeout de sessão
    const activityHandler = () => setLastActivity(Date.now());
    document.addEventListener('keydown', activityHandler);
    document.addEventListener('mousemove', activityHandler);
    document.addEventListener('click', activityHandler);

    // Listener 4: Storage event para sincronizar abas
    window.addEventListener('storage', (e) => {
      if (e.key === 'user-preferences') {
        syncPreferences(e.newValue);
      }
    });

    // Listener 5: Beforeunload para avisar sobre mudanças não salvas
    window.addEventListener('beforeunload', (e) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // PROBLEMA: Nenhum cleanup!
  }, []); // Executa apenas no mount

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Window width: {windowWidth}px</p>
      <p>Scroll position: {scrollPosition}px</p>
      {/* ... */}
    </div>
  );
}

function loadMoreData() { /* ... */ }
function syncPreferences(value) { /* ... */ }
function hasUnsavedChanges() { return false; }
```

**Sintomas no usuário:**
- Aplicação fica mais lenta após navegar várias vezes
- Scroll stuttering (travamento)
- Browser alerta "Aba consumindo muita memória"
- Eventual crash: "Out of memory"

**Tarefa:**

Corrija o código para prevenir o memory leak. Na sua **linha de raciocínio**, explique:

1. **Por que** os listeners causam memory leak (retenção de closures, referências ao DOM, etc.)
2. **Como** você detectaria este problema em produção (ferramentas, métricas)
3. **Padrões** para prevenir este tipo de bug (AbortController, custom hooks, etc.)
4. **Trade-offs** da sua solução (se houver)
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
import { useEffect, useState } from 'react';

export function Dashboard() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    // TODO: Registre listeners E retorne função de cleanup que os remove
    // Dica: useEffect pode retornar uma função que será chamada no unmount

    // TODO: Considere usar AbortController para simplificar cleanup de múltiplos listeners
    
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Window width: {windowWidth}px</p>
      <p>Scroll position: {scrollPosition}px</p>
    </div>
  );
}
<!-- /SECTION:template:javascript -->

<!-- SECTION:solution-outline -->
**Causa raiz do memory leak:**

1. **Listeners não removidos:** cada vez que componente monta, novos listeners são adicionados mas nunca removidos no unmount
2. **Closures retêm referências:** cada listener mantém closure sobre `setWindowWidth`, `setScrollPosition`, etc., impedindo GC do componente desmontado
3. **Referências circulares:** listener → closure → state → component instance → DOM nodes
4. **Acúmulo infinito:** a cada navegação, mais listeners e closures se acumulam no heap

**Solução 1 — Cleanup manual:**

```javascript
import { useEffect, useState } from 'react';

export function Dashboard() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    // 1. Definir handlers como funções nomeadas (para remover depois)
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    const handleScroll = () => {
      setScrollPosition(window.scrollY);
      if (window.scrollY > 500) {
        loadMoreData();
      }
    };

    const handleActivity = () => {
      setLastActivity(Date.now());
    };

    const handleStorage = (e) => {
      if (e.key === 'user-preferences') {
        syncPreferences(e.newValue);
      }
    };

    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    // 2. Registrar listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('keydown', handleActivity);
    document.addEventListener('mousemove', handleActivity);
    document.addEventListener('click', handleActivity);

    // 3.  CLEANUP: Remover TODOS os listeners no unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('keydown', handleActivity);
      document.removeEventListener('mousemove', handleActivity);
      document.removeEventListener('click', handleActivity);
    };
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Window width: {windowWidth}px</p>
      <p>Scroll position: {scrollPosition}px</p>
    </div>
  );
}
```

**Solução 2 — AbortController (moderno):**

```javascript
import { useEffect, useState } from 'react';

export function Dashboard() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    //  AbortController simplifica cleanup de múltiplos listeners
    const controller = new AbortController();
    const { signal } = controller;

    const handleResize = () => setWindowWidth(window.innerWidth);
    const handleScroll = () => {
      setScrollPosition(window.scrollY);
      if (window.scrollY > 500) loadMoreData();
    };
    const handleActivity = () => setLastActivity(Date.now());
    const handleStorage = (e) => {
      if (e.key === 'user-preferences') syncPreferences(e.newValue);
    };
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    // Todos os listeners compartilham o mesmo signal
    window.addEventListener('resize', handleResize, { signal });
    window.addEventListener('scroll', handleScroll, { signal });
    window.addEventListener('storage', handleStorage, { signal });
    window.addEventListener('beforeunload', handleBeforeUnload, { signal });
    document.addEventListener('keydown', handleActivity, { signal });
    document.addEventListener('mousemove', handleActivity, { signal });
    document.addEventListener('click', handleActivity, { signal });

    //  CLEANUP: Um único abort() remove todos
    return () => controller.abort();
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Window width: {windowWidth}px</p>
      <p>Scroll position: {scrollPosition}px</p>
    </div>
  );
}
```

**Solução 3 — Custom Hook (mais elegante):**

```javascript
// useEventListener.js
import { useEffect, useRef } from 'react';

export function useEventListener(target, event, handler, options = {}) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const element = target.current || target;
    if (!element?.addEventListener) return;

    const eventListener = (event) => savedHandler.current(event);
    element.addEventListener(event, eventListener, options);

    return () => element.removeEventListener(event, eventListener, options);
  }, [target, event, options]);
}

// Dashboard.jsx (usando hook)
export function Dashboard() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEventListener(window, 'resize', () => setWindowWidth(window.innerWidth));
  useEventListener(window, 'scroll', () => {
    if (window.scrollY > 500) loadMoreData();
  });
  // ... outros listeners

  return <div>...</div>;
}
```

**Como detectar em produção:**

1. **Chrome DevTools:**
   - Performance tab → Heap allocations timeline
   - Memory tab → Heap snapshot comparison (antes/depois de navegações)
   - Detached DOM nodes count crescente

2. **Métricas de observabilidade:**
   - `performance.memory.usedJSHeapSize` monitorado ao longo do tempo
   - Alertas quando heap cresce > 50MB em sessão normal

3. **Ferramentas:**
   - Lighthouse → "Avoid event listeners in long-lived objects"
   - React DevTools Profiler → Component re-renders sem unmount

**Trade-offs:**

- **Solução 1 (manual):** verboso mas explícito, funciona em qualquer ambiente
- **Solução 2 (AbortController):** elegante mas requer browser moderno (IE não suporta)
- **Solução 3 (custom hook):** mais abstrato, adiciona camada de indireção

**Melhorias adicionais:**

- **Debounce/Throttle:** evitar handlers de scroll/resize executarem excessivamente
- **Passive listeners:** `{ passive: true }` melhora performance de scroll
- **Weak references:** em casos específicos, usar `WeakMap` para callbacks
<!-- /SECTION:solution-outline -->
