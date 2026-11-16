---
id: intermediate-notification-dry-wrapper
slug: intermediate-notification-dry-wrapper
title: "Qualidade de Código — Eliminação de Duplicação com Wrappers Reutilizáveis em Serviço de Notificações"
axis: codeQuality
subtheme: duplication_and_reuse
difficulty: intermediate
promptTemplate: intermediate-notification-dry-wrapper
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [dry, higher_order_functions, decorators, template_method, cross_cutting_concerns, retry, logging, refactoring]
references:
  - id: ref-1
    title: "Refactoring: Improving the Design of Existing Code (2nd ed.) — Martin Fowler"
    type: book
    url: null
    relevance: 5
    confidence: 5
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "Clean Code: A Handbook of Agile Software Craftsmanship — Robert C. Martin"
    type: book
    url: null
    relevance: 5
    confidence: 5
    supports: [statement, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Don't Repeat Yourself (DRY) — The Pragmatic Programmer"
    type: book
    url: null
    relevance: 5
    confidence: 4
    supports: [statement, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Extract Function — Refactoring Catalog"
    type: technical_blog
    url: "https://refactoring.com/catalog/extractFunction.html"
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
    - id: duplication_identification
      name: Identificação do código duplicado
      weight: 0.20
      description: >
        Identifica e nomeia explicitamente as três partes duplicadas nas funções originais:
        a lógica de retry com 3 tentativas, a formatação de logs (início, sucesso e falha)
        e o cálculo do tempo de execução. Distingue claramente o boilerplate compartilhado
        da lógica específica de cada canal (montagem de payload e chamada à API externa).
    - id: abstraction_extraction
      name: Extração de abstração reutilizável
      weight: 0.35
      description: >
        Cria um utilitário genérico (Higher-Order Function em JS, decorator em Python,
        classe base com Template Method ou Strategy em Java) que encapsula retry, logs e
        tempo de execução. O utilitário é parametrizado pelo comportamento específico de
        cada canal — não duplica lógica de infraestrutura para cada caso.
    - id: behavior_preservation
      name: Preservação do comportamento de infraestrutura
      weight: 0.20
      description: >
        O código refatorado preserva exatamente: 3 tentativas de retry em caso de erro,
        log de início antes de cada tentativa, log de sucesso com tempo total de execução
        e log de falha indicando o número da tentativa. As assinaturas públicas de
        sendEmail, sendSms e sendPushNotification permanecem idênticas.
    - id: public_signature_preservation
      name: Preservação das assinaturas públicas
      weight: 0.15
      description: >
        As três funções/métodos públicos (sendEmail, sendSms, sendPushNotification)
        mantêm exatamente a mesma assinatura de entrada do código original,
        garantindo que nenhum código consumidor precise ser alterado.
    - id: reasoning
      name: Justificativa técnica da abstração
      weight: 0.10
      description: >
        Explica quais partes são boilerplate e quais são específicas, qual abstração
        foi criada, e demonstra com um exemplo concreto a vantagem de manutenção
        (ex.: alterar de 3 para 5 tentativas requer mudança em um único lugar).
---

<!-- SECTION:statement -->
O serviço abaixo envia notificações por três canais diferentes: e-mail, SMS e push notification. As três funções são funcionais, mas duplicam cerca de 80% do seu corpo: todas implementam **a mesma lógica de retry** (3 tentativas em caso de erro), **a mesma formatação de logs** (registro de início, sucesso e falha com tempo de execução) e **o mesmo cálculo de tempo de execução**. Apenas a montagem do payload e a chamada final à API externa diferem entre elas.

**Comportamento de infraestrutura compartilhado (deve ser preservado integralmente):**
- **Retry:** até 3 tentativas; se uma falha, registra o erro e tenta novamente; se todas falharem, propaga a exceção da última tentativa.
- **Log de início:** registrado antes de cada tentativa, com o número da tentativa atual.
- **Log de sucesso:** registrado após a tentativa bem-sucedida, incluindo o tempo total de execução (em ms) desde a primeira tentativa.
- **Log de falha:** registrado quando uma tentativa falha, com o número da tentativa e a mensagem de erro.

**Lógica específica de cada canal (o que diferencia as funções):**
- `sendEmail(to, subject, body)` — monta `{ to, subject, body }` e chama `emailApi.send(payload)`.
- `sendSms(phoneNumber, text)` — monta `{ phoneNumber, text }` e chama `smsApi.send(payload)`.
- `sendPushNotification(deviceToken, title, message)` — monta `{ deviceToken, title, message }` e chama `pushApi.send(payload)`.

**Contrato público (imutável — não altere as assinaturas):**
As assinaturas das três funções devem permanecer idênticas às do código original para não quebrar nenhum consumidor existente.

**Tarefa:** refatore o módulo abaixo aplicando o princípio **DRY** — extraia o comportamento de infraestrutura duplicado (retry, logs, tempo de execução) para **uma única abstração reutilizável** e aplique-a nas três funções. Justifique suas decisões em um **raciocínio separado**.

```javascript
// notificationService.js
const MAX_RETRIES = 3;

async function sendEmail(to, subject, body) {
  const startTime = Date.now();
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[Email] Tentativa ${attempt}/${MAX_RETRIES} — enviando para ${to}`);
    try {
      const payload = { to, subject, body };
      await emailApi.send(payload);
      const elapsed = Date.now() - startTime;
      console.log(`[Email] Sucesso após ${elapsed}ms`);
      return;
    } catch (err) {
      lastError = err;
      console.error(`[Email] Falha na tentativa ${attempt}: ${err.message}`);
    }
  }

  throw lastError;
}

async function sendSms(phoneNumber, text) {
  const startTime = Date.now();
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[SMS] Tentativa ${attempt}/${MAX_RETRIES} — enviando para ${phoneNumber}`);
    try {
      const payload = { phoneNumber, text };
      await smsApi.send(payload);
      const elapsed = Date.now() - startTime;
      console.log(`[SMS] Sucesso após ${elapsed}ms`);
      return;
    } catch (err) {
      lastError = err;
      console.error(`[SMS] Falha na tentativa ${attempt}: ${err.message}`);
    }
  }

  throw lastError;
}

async function sendPushNotification(deviceToken, title, message) {
  const startTime = Date.now();
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[Push] Tentativa ${attempt}/${MAX_RETRIES} — enviando para ${deviceToken}`);
    try {
      const payload = { deviceToken, title, message };
      await pushApi.send(payload);
      const elapsed = Date.now() - startTime;
      console.log(`[Push] Sucesso após ${elapsed}ms`);
      return;
    } catch (err) {
      lastError = err;
      console.error(`[Push] Falha na tentativa ${attempt}: ${err.message}`);
    }
  }

  throw lastError;
}

module.exports = { sendEmail, sendSms, sendPushNotification };
```
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// notificationService.js
const MAX_RETRIES = 3;

// TODO: crie uma Higher-Order Function (ex.: withRetryAndLogs) que encapsule
//       a lógica de retry (3 tentativas), logs de início/sucesso/falha e
//       cálculo do tempo de execução. Ela deve receber como parâmetros o
//       prefixo de log e a função de envio específica do canal.

// TODO: reescreva sendEmail, sendSms e sendPushNotification usando o utilitário
//       acima. As assinaturas públicas das três funções NÃO devem mudar.

async function sendEmail(to, subject, body) {
  // TODO: use o utilitário extraído aqui.
}

async function sendSms(phoneNumber, text) {
  // TODO: use o utilitário extraído aqui.
}

async function sendPushNotification(deviceToken, title, message) {
  // TODO: use o utilitário extraído aqui.
}

module.exports = { sendEmail, sendSms, sendPushNotification };
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# notification_service.py
import time
import logging

MAX_RETRIES = 3
logger = logging.getLogger(__name__)

# TODO: crie um decorator (ou função de wrapper de ordem superior) que encapsule
#       a lógica de retry (3 tentativas), logs de início/sucesso/falha e
#       cálculo do tempo de execução. Ele deve ser parametrizável pelo prefixo
#       de log e pela função de envio específica do canal.

# TODO: reescreva send_email, send_sms e send_push_notification usando o
#       utilitário acima. As assinaturas públicas das três funções NÃO devem mudar.

async def send_email(to: str, subject: str, body: str) -> None:
    # TODO: use o utilitário extraído aqui.
    pass

async def send_sms(phone_number: str, text: str) -> None:
    # TODO: use o utilitário extraído aqui.
    pass

async def send_push_notification(device_token: str, title: str, message: str) -> None:
    # TODO: use o utilitário extraído aqui.
    pass
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// NotificationService.java
import java.util.function.Supplier;

public class NotificationService {

    private static final int MAX_RETRIES = 3;

    // TODO: extraia um método privado genérico (ex.: sendWithRetry) que encapsule
    //       retry (3 tentativas), logs de início/sucesso/falha e cálculo do tempo
    //       de execução. Use uma interface funcional (Supplier, Callable ou similar)
    //       para receber a operação de envio específica do canal.
    //       Alternativamente, aplique o padrão Template Method com uma classe base
    //       abstrata e um método hook para a montagem de payload e chamada à API.

    // TODO: reescreva sendEmail, sendSms e sendPushNotification usando o utilitário
    //       acima. As assinaturas públicas dos três métodos NÃO devem mudar.

    public void sendEmail(String to, String subject, String body) throws Exception {
        // TODO: use o utilitário extraído aqui.
    }

    public void sendSms(String phoneNumber, String text) throws Exception {
        // TODO: use o utilitário extraído aqui.
    }

    public void sendPushNotification(String deviceToken, String title, String message) throws Exception {
        // TODO: use o utilitário extraído aqui.
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Partes duplicadas identificadas no código original:**
- Loop de retry com 3 tentativas e controle de `lastError`.
- Log de início (`Tentativa N/3 — enviando para …`) antes de cada tentativa.
- Log de sucesso com tempo de execução total (em ms) ao completar com êxito.
- Log de falha (`Falha na tentativa N: <mensagem>`) ao capturar uma exceção.
- Relançamento da última exceção após esgotar as tentativas.

**Partes específicas de cada canal (não devem ser movidas para o utilitário):**
- Montagem do payload com os campos exclusivos do canal.
- Chamada à API externa do canal (`emailApi`, `smsApi`, `pushApi`).

**Abstrações recomendadas por linguagem:**

- **JavaScript — Higher-Order Function:**
  ```
  async function withRetryAndLogs(label, sendFn) {
    const startTime = Date.now();
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(`[${label}] Tentativa ${attempt}/${MAX_RETRIES}`);
      try {
        await sendFn();
        console.log(`[${label}] Sucesso após ${Date.now() - startTime}ms`);
        return;
      } catch (err) {
        lastError = err;
        console.error(`[${label}] Falha na tentativa ${attempt}: ${err.message}`);
      }
    }
    throw lastError;
  }

  // Aplicação:
  async function sendEmail(to, subject, body) {
    await withRetryAndLogs('Email', () => emailApi.send({ to, subject, body }));
  }
  ```

- **Python — Decorator parametrizável:**
  ```
  import functools, time

  def with_retry_and_logs(label):
      def decorator(fn):
          @functools.wraps(fn)
          async def wrapper(*args, **kwargs):
              start = time.monotonic()
              last_err = None
              for attempt in range(1, MAX_RETRIES + 1):
                  logger.info(f"[{label}] Tentativa {attempt}/{MAX_RETRIES}")
                  try:
                      await fn(*args, **kwargs)
                      elapsed = int((time.monotonic() - start) * 1000)
                      logger.info(f"[{label}] Sucesso após {elapsed}ms")
                      return
                  except Exception as e:
                      last_err = e
                      logger.error(f"[{label}] Falha na tentativa {attempt}: {e}")
              raise last_err
          return wrapper
      return decorator

  @with_retry_and_logs("Email")
  async def send_email(to, subject, body):
      await email_api.send({"to": to, "subject": subject, "body": body})
  ```

- **Java — Template Method ou método helper com `ThrowingSupplier`:**
  - Criar método privado `sendWithRetry(String label, ThrowingRunnable operation)` que executa retry, mede tempo e registra logs.
  - Cada método público (`sendEmail`, `sendSms`, `sendPushNotification`) chama `sendWithRetry` passando uma lambda com a montagem de payload e a chamada à API do canal.
  - Alternativa: classe abstrata `AbstractNotificationSender` com método `template` final e método abstrato `doSend()`.

**Preservação obrigatória:**
- Assinaturas de `sendEmail(to, subject, body)`, `sendSms(phoneNumber, text)` e `sendPushNotification(deviceToken, title, message)` permanecem idênticas.
- Exatamente 3 tentativas com os logs de início, sucesso e falha conforme especificado.
- A exceção da última tentativa é propagada após esgotar as 3 tentativas.

**Ganho de manutenção:** ao alterar o número de tentativas de 3 para 5, basta modificar `MAX_RETRIES` (ou o parâmetro do utilitário) em **um único lugar**, em vez de editar as três funções separadamente.
<!-- /SECTION:solution-outline -->

<!-- REVIEW:metrics -->
{
  "quality": {
    "technicalCorrectness": 5,
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
  "mainIssue": "prompt",
  "revisionLevelNeeded": "light",
  "suggestedChangedParts": ["prompt"],
  "referencesStatus": "present"
}
<!-- /REVIEW:metrics -->

<!-- REVIEW:comments -->
Recomendação: minor_revision.

Principais pontos:
- A questão está corretamente alinhada a `codeQuality/duplication_and_reuse`: o centro da tarefa é remover duplicação real de controle de fluxo, retry, tratamento de erro, logs e medição de tempo, não apenas melhorar aparência ou legibilidade.
- O código inicial contém duplicação extensa e intencional nas três funções, envolvendo loop, `try/catch`, controle de `lastError`, logs e cálculo de tempo; isso justifica a dificuldade `intermediate`.
- O enunciado e a rubrica deixam claro que o contrato público deve ser preservado, mantendo os mesmos parâmetros e saídas/efeitos observáveis de `sendEmail`, `sendSms` e `sendPushNotification`.
- O `solution-outline` é idiomático para as linguagens esperadas: aceita Higher-Order Function/wrapper em JavaScript, decorator ou wrapper em Python e helper com interface funcional, Strategy ou Template Method em Java.
- A rubrica e o prompt avaliam corretamente a preservação do comportamento transversal, incluindo 3 tentativas, logs de início/sucesso/falha, tempo de execução e propagação da última exceção. Isso reduz o risco de aceitar respostas que apenas apagam retry/logs para diminuir linhas.
- O único ajuste recomendado é no prompt de avaliação: ele deve instruir explicitamente o avaliador a penalizar soluções de "falso DRY" que concentram tudo em um único método como `sendNotification(type, payload)` com `if/else` ou `switch` por canal, pois isso reduz cópia superficialmente, mas mistura responsabilidades, dificulta extensão e viola o Open-Closed Principle.
- O prompt já orienta o avaliador a reconhecer o padrão extraído e não só a diminuição de linhas; a recomendação acima é um reforço específico para evitar aceitar uma abstração centralizada e medonha como se fosse reutilização adequada.
- As referências são plausíveis e permanecem marcadas como `suggested_not_verified`, sem necessidade de alteração material nesta revisão.
<!-- /REVIEW:comments -->
