---
id: easy-rest-api-design
slug: easy-rest-api-design
title: Design e Arquitetura — API REST para Gerenciamento de Tarefas
axis: architecture
subtheme: api_design
difficulty: easy
promptTemplate: easy-rest-api-design
supportedLanguages: [none]
tags: [rest_api]
inputConfig:
  type: multi-section
  sections:
    - id: endpoints
      label: "Endpoints e métodos HTTP"
      placeholder: "Liste os endpoints necessários (ex: GET /tasks, POST /tasks/:id), especifique métodos HTTP e parâmetros."
    - id: status_codes
      label: "Status codes HTTP"
      placeholder: "Para cada endpoint, indique quais status codes serão retornados em diferentes cenários (200, 201, 404, 400, etc.)."
    - id: request_response
      label: "Estrutura de request/response"
      placeholder: "Defina formato JSON para requisições e respostas. Inclua exemplos de payloads."
    - id: justificativa
      label: "Justificativa e boas práticas"
      placeholder: "Explique por que escolheu essa estrutura e quais boas práticas REST você aplicou."
rubric:
  version: v1
  criteria:
    - id: endpoints_completeness
      name: Completude dos endpoints
      weight: 0.30
      description: Define endpoints para CRUD completo (listar, criar, buscar por ID, atualizar, deletar) com métodos HTTP corretos.
    - id: http_semantics
      name: Semântica HTTP correta
      weight: 0.25
      description: Usa métodos HTTP apropriados (GET para leitura, POST para criação, PUT/PATCH para atualização, DELETE para remoção) e status codes adequados.
    - id: data_structure
      name: Estrutura de dados
      weight: 0.20
      description: Define payloads JSON claros, consistentes e seguindo convenções (camelCase ou snake_case consistente, campos obrigatórios vs opcionais).
    - id: rest_principles
      name: Princípios REST
      weight: 0.15
      description: Aplica princípios REST (recursos identificados por URIs, stateless, uso adequado de verbos HTTP, códigos de status).
    - id: clarity
      name: Clareza e documentação
      weight: 0.10
      description: Documentação clara com exemplos, fácil de entender e implementar.
---

<!-- SECTION:statement -->
Uma equipe precisa de uma API REST simples para gerenciar tarefas (to-do list). A API deve permitir criar, listar, buscar, atualizar e deletar tarefas. Cada tarefa tem: id, título, descrição, status (pending/completed), data de criação e data de atualização.

**Requisitos funcionais:**

1. **Listar todas as tarefas** (com suporte a filtro por status)
2. **Criar nova tarefa** (título obrigatório, descrição opcional)
3. **Buscar tarefa por ID**
4. **Atualizar tarefa** (título, descrição e/ou status)
5. **Deletar tarefa**

**Requisitos não funcionais:**

- API deve seguir **princípios REST**
- Usar **métodos HTTP** apropriados (GET, POST, PUT/PATCH, DELETE)
- Retornar **status codes HTTP** corretos
- Payloads em **JSON**
- URLs devem ser **intuitivas** e seguir convenções REST

**Tarefa:**

Projete a API especificando:

1. **Endpoints:** quais URLs e métodos HTTP para cada operação
2. **Status codes:** quais códigos HTTP retornar em cada cenário (sucesso, erro de validação, não encontrado, etc.)
3. **Request/Response:** estrutura JSON de requisições e respostas com exemplos
4. **Justificativa:** explique por que suas escolhas seguem boas práticas REST

**Dica:** Pense em:
- Como nomear recursos (singular vs plural)
- Como identificar uma tarefa específica (path params)
- Como passar filtros (query params)
- Quais campos são obrigatórios vs opcionais
- Tratamento de erros (validação, recurso não encontrado)
<!-- /SECTION:statement -->

<!-- SECTION:solution-outline -->
**Solução esperada:**

### 1. Endpoints e Métodos HTTP

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/tasks` | Listar todas as tarefas (com filtro opcional `?status=pending` ou `?status=completed`) |
| POST | `/tasks` | Criar nova tarefa |
| GET | `/tasks/:id` | Buscar tarefa por ID |
| PUT | `/tasks/:id` | Atualizar tarefa (substituição completa) |
| PATCH | `/tasks/:id` | Atualizar tarefa (atualização parcial) |
| DELETE | `/tasks/:id` | Deletar tarefa |

**Observações:**
- **Plural (`/tasks`):** convenção REST usar plural para coleções
- **Path param (`:id`):** identificador único da tarefa
- **Query param (`?status=...`):** filtro opcional para listagem

---

### 2. Status Codes HTTP

| Endpoint | Cenário | Status Code |
|----------|---------|-------------|
| GET `/tasks` | Sucesso (lista vazia ou com items) | 200 OK |
| GET `/tasks` | Query param inválido | 400 Bad Request |
| POST `/tasks` | Criado com sucesso | 201 Created |
| POST `/tasks` | Validação falhou (título ausente) | 400 Bad Request |
| GET `/tasks/:id` | Tarefa encontrada | 200 OK |
| GET `/tasks/:id` | Tarefa não encontrada | 404 Not Found |
| PUT/PATCH `/tasks/:id` | Atualizado com sucesso | 200 OK |
| PUT/PATCH `/tasks/:id` | Tarefa não encontrada | 404 Not Found |
| PUT/PATCH `/tasks/:id` | Validação falhou | 400 Bad Request |
| DELETE `/tasks/:id` | Deletado com sucesso | 204 No Content |
| DELETE `/tasks/:id` | Tarefa não encontrada | 404 Not Found |

**Boas práticas:**
- **201 Created** retorna `Location` header com URL da tarefa criada
- **204 No Content** para DELETE bem-sucedido (sem corpo de resposta)
- **400** para erros de validação com mensagem clara no corpo
- **404** quando recurso específico não existe

---

### 3. Estrutura Request/Response

#### GET `/tasks` (Listar)

**Request:**
```http
GET /tasks?status=pending HTTP/1.1
```

**Response 200 OK:**
```json
{
  "data": [
    {
      "id": "1",
      "title": "Implementar API REST",
      "description": "Criar endpoints CRUD para tarefas",
      "status": "pending",
      "createdAt": "2025-11-20T10:00:00Z",
      "updatedAt": "2025-11-20T10:00:00Z"
    },
    {
      "id": "2",
      "title": "Escrever testes",
      "description": null,
      "status": "pending",
      "createdAt": "2025-11-20T11:00:00Z",
      "updatedAt": "2025-11-20T11:00:00Z"
    }
  ],
  "total": 2
}
```

---

#### POST `/tasks` (Criar)

**Request:**
```http
POST /tasks HTTP/1.1
Content-Type: application/json

{
  "title": "Nova tarefa",
  "description": "Descrição opcional"
}
```

**Response 201 Created:**
```http
HTTP/1.1 201 Created
Location: /tasks/3

{
  "id": "3",
  "title": "Nova tarefa",
  "description": "Descrição opcional",
  "status": "pending",
  "createdAt": "2025-11-21T09:00:00Z",
  "updatedAt": "2025-11-21T09:00:00Z"
}
```

**Response 400 Bad Request (validação falhou):**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "title",
      "message": "Title is required"
    }
  ]
}
```

---

#### GET `/tasks/:id` (Buscar por ID)

**Request:**
```http
GET /tasks/1 HTTP/1.1
```

**Response 200 OK:**
```json
{
  "id": "1",
  "title": "Implementar API REST",
  "description": "Criar endpoints CRUD para tarefas",
  "status": "completed",
  "createdAt": "2025-11-20T10:00:00Z",
  "updatedAt": "2025-11-21T14:00:00Z"
}
```

**Response 404 Not Found:**
```json
{
  "error": "Task not found",
  "id": "999"
}
```

---

#### PATCH `/tasks/:id` (Atualizar parcial)

**Request:**
```http
PATCH /tasks/1 HTTP/1.1
Content-Type: application/json

{
  "status": "completed"
}
```

**Response 200 OK:**
```json
{
  "id": "1",
  "title": "Implementar API REST",
  "description": "Criar endpoints CRUD para tarefas",
  "status": "completed",
  "createdAt": "2025-11-20T10:00:00Z",
  "updatedAt": "2025-11-21T14:30:00Z"
}
```

---

#### DELETE `/tasks/:id` (Deletar)

**Request:**
```http
DELETE /tasks/1 HTTP/1.1
```

**Response 204 No Content:**
```http
HTTP/1.1 204 No Content
```

---

### 4. Justificativa e Boas Práticas Aplicadas

#### Princípios REST aplicados:

1. **Recursos como substantivos:** `/tasks` (não `/getTasks` ou `/createTask`)
2. **Identificadores únicos:** `:id` no path para recurso específico
3. **Métodos HTTP semânticos:**
   - GET: leitura (idempotente, safe)
   - POST: criação (não idempotente)
   - PUT/PATCH: atualização (idempotente)
   - DELETE: remoção (idempotente)

4. **Status codes apropriados:**
   - 2xx: sucesso
   - 4xx: erro do cliente (validação, not found)
   - 5xx: erro do servidor (não usado aqui, mas seria para crashes)

5. **Stateless:** cada requisição é autocontida (autenticação via token em header, não sessão)

6. **Cacheability:** GET retorna 200 (cacheável), POST/PUT/DELETE não

7. **Uniform interface:** estrutura consistente entre endpoints

#### Escolhas de design:

- **Plural (`/tasks`):** convenção para coleções REST
- **PATCH vs PUT:** PATCH para atualização parcial (só status), PUT para substituição completa
- **Query params para filtros:** `?status=pending` em vez de `/tasks/pending` (mais flexível)
- **`createdAt`/`updatedAt`:** timestamps automáticos (não enviados pelo cliente)
- **Status padrão:** novo task criado como `pending`
- **Null explícito:** `description: null` quando não fornecido (em vez de omitir campo)

#### Melhorias possíveis (fora do escopo easy):

- Paginação: `?page=1&limit=20`
- Ordenação: `?sort=createdAt&order=desc`
- Versionamento: `/v1/tasks`
- HATEOAS: links para ações relacionadas
- Rate limiting: headers `X-RateLimit-*`
- Autenticação: `Authorization: Bearer <token>`
<!-- /SECTION:solution-outline -->
