---
id: advanced-deploy-approval-testability
slug: advanced-deploy-approval-testability
title: "Testes — Testabilidade de Serviço de Aprovação de Deploy com Múltiplas Dependências Externas"
axis: tests
subtheme: testability
difficulty: advanced
promptTemplate: advanced-deploy-approval-testability
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [testability, dependency_injection, fake_clock, http_client, environment_variables, sleep, ci_pipeline, deterministic_tests, stub]
references:
  - id: ref-1
    title: "Working Effectively with Legacy Code — Michael Feathers"
    type: book
    url: null
    relevance: 5
    confidence: 4
    supports: [statement, rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-2
    title: "xUnit Test Patterns: Refactoring Test Code — Gerard Meszaros"
    type: book
    url: null
    relevance: 5
    confidence: 4
    supports: [rubric, solution-outline]
    verificationStatus: suggested_not_verified
  - id: ref-3
    title: "Growing Object-Oriented Software, Guided by Tests — Freeman & Pryce"
    type: book
    url: null
    relevance: 4
    confidence: 4
    supports: [statement, rubric]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "The Twelve-Factor App — Config"
    type: technical_blog
    url: "https://12factor.net/config"
    relevance: 3
    confidence: 5
    supports: [statement]
    verificationStatus: suggested_not_verified
generationMetrics:
  validFormatSelfCheck: true
  rubricCriteriaCount: 5
  referencesSuggested: true
  plannedDifficulty: advanced
  expectedType: code
  taxonomyFit: strong
inputConfig:
  type: code
  language: javascript
rubric:
  version: v1
  criteria:
    - id: testability_diagnosis
      name: Diagnóstico dos acoplamentos que prejudicam testabilidade
      weight: 0.20
      description: Identifica explicitamente os quatro acoplamentos que tornam o código difícil de testar — cliente HTTP instanciado internamente, variável de ambiente lida no meio da lógica, relógio real (Date.now/new Date) e sleep/wait real — e explica por que cada um impede testes determinísticos.
    - id: refactoring_quality
      name: Qualidade da refatoração e injeção de dependências
      weight: 0.30
      description: Refatora o serviço para receber por injeção (parâmetro, construtor ou objeto de configuração) o cliente de CI, o repositório de aprovações, a configuração (incluindo freeze window e retry delay), o relógio e a função de espera — sem alterar o comportamento observável em produção.
    - id: decision_isolation
      name: Separação entre lógica de decisão e efeitos externos
      weight: 0.20
      description: A lógica de decisão (pipeline passou?, há aprovações suficientes?, está em freeze window?) fica separável e testável de forma independente dos efeitos externos (chamada HTTP, leitura de env, sleep) — é possível testar a regra de negócio sem ativar nenhum efeito externo.
    - id: unit_test_quality
      name: Qualidade dos testes unitários determinísticos
      weight: 0.20
      description: A suíte cobre os cenários essenciais — pipeline aprovado, pipeline falho, pipeline em execução com retry bem-sucedido, freeze window ativa e aprovações insuficientes — todos sem chamada HTTP real, sem leitura de variável de ambiente real, sem sleep real e sem dependência de relógio do sistema.
    - id: behavior_and_justification
      name: Preservação do comportamento e justificativa
      weight: 0.10
      description: A refatoração preserva o contrato externo do serviço (mesmos retornos, mesma lógica de retry) e o aluno explica como cada dependência injetada elimina um eixo de não determinismo, tornando os testes mais rápidos, confiáveis e isolados.
---

<!-- SECTION:statement -->
Um serviço de plataforma de engenharia verifica se uma nova versão de software pode ser promovida para produção antes de acionar o deploy. O código funciona corretamente, mas é extremamente difícil de testar: instancia o cliente HTTP internamente, lê variáveis de ambiente no meio da lógica, usa o relógio real para checar a janela de congelamento e chama `sleep` para aguardar o CI quando ele ainda está em execução.

**Código atual (com problemas de testabilidade):**

```javascript
// deployApproval.js
const axios = require('axios');

const CI_API_BASE = process.env.CI_API_BASE;  // lido no topo — mas pode ser lido dentro também

/**
 * Verifica se um release pode ser promovido para produção.
 * @param {string} releaseId
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
async function checkDeployApproval(releaseId) {
  // Lê variável de ambiente diretamente no meio da lógica
  const freezeStart = parseInt(process.env.FREEZE_WINDOW_START_HOUR ?? '22', 10);
  const freezeEnd   = parseInt(process.env.FREEZE_WINDOW_END_HOUR   ?? '6',  10);

  // Instancia o cliente HTTP internamente — impossível substituir em testes
  const ciClient = axios.create({ baseURL: process.env.CI_API_BASE });

  // Consulta o status do pipeline
  const { data: pipeline } = await ciClient.get(`/pipelines/${releaseId}`);

  if (pipeline.status === 'failed') {
    return { allowed: false, reason: 'Pipeline falhou.' };
  }

  if (pipeline.status === 'running') {
    // Aguarda tempo real — testes demoram ou travam
    await new Promise(resolve => setTimeout(resolve, 15_000));

    const { data: retried } = await ciClient.get(`/pipelines/${releaseId}`);
    if (retried.status !== 'passed') {
      return { allowed: false, reason: 'Pipeline ainda não concluído após retry.' };
    }
  }

  // Verifica janela de congelamento com relógio real
  const currentHour = new Date().getUTCHours();
  const inFreeze =
    freezeStart > freezeEnd
      ? currentHour >= freezeStart || currentHour < freezeEnd   // ex.: 22h–06h (atravessa meia-noite)
      : currentHour >= freezeStart && currentHour < freezeEnd;  // ex.: 10h–12h

  if (inFreeze) {
    return { allowed: false, reason: 'Deploy bloqueado: janela de congelamento ativa.' };
  }

  // Consulta repositório de aprovações — mesmo cliente HTTP, endpoint diferente
  const { data: approvals } = await ciClient.get(`/releases/${releaseId}/approvals`);
  const minApprovals = parseInt(process.env.MIN_APPROVALS ?? '2', 10);

  if (approvals.count < minApprovals) {
    return {
      allowed: false,
      reason: `Aprovações insuficientes: ${approvals.count} de ${minApprovals} necessárias.`,
    };
  }

  return { allowed: true };
}

module.exports = { checkDeployApproval };
```

**Problema observado nos testes:**

```javascript
// deployApproval.test.js  ← testes lentos, não determinísticos e frágeis
const { checkDeployApproval } = require('./deployApproval');

test('permite deploy quando pipeline passou e há aprovações', async () => {
  // Depende de CI_API_BASE, FREEZE_WINDOW_START_HOUR, MIN_APPROVALS no ambiente
  // Depende de API real de CI respondendo com { status: 'passed' }
  // Pode travar 15 segundos se o CI devolver 'running'
  // Depende do horário em que o teste é executado para a freeze window
  const result = await checkDeployApproval('release-42');
  expect(result.allowed).toBe(true);
});
```

**Contrato esperado após refatoração:**

- `checkDeployApproval(releaseId, deps?)` ou `new DeployApprovalService(deps).check(releaseId)` mantém o mesmo comportamento externo.
- `deps` deve aceitar:
  - `ciClient` — objeto com método `getPipelineStatus(releaseId)` e `getApprovals(releaseId)`;
  - `config` — objeto com `freezeWindowStartHour`, `freezeWindowEndHour`, `minApprovals` e `retryDelayMs`;
  - `clock` — função que retorna o horário UTC atual (substituível por número fixo em testes);
  - `sleep` — função de espera (substituível por `() => Promise.resolve()` em testes).
- Retorno sempre `{ allowed: boolean, reason?: string }`.
- Erros técnicos (falha de rede, resposta inesperada) devem ser propagados sem silenciar.

**Tarefa:**

1. **Diagnostique** todos os acoplamentos que tornam o código difícil de testar e explique por que cada um impede testes determinísticos.
2. **Refatore** o serviço para injetar cliente de CI, repositório de aprovações, configuração, relógio e função de espera — sem mudar o comportamento em produção.
3. **Escreva testes unitários determinísticos** cobrindo os cinco cenários:
   - pipeline com status `passed` e aprovações suficientes → `{ allowed: true }`;
   - pipeline com status `failed` → `{ allowed: false, reason: ... }`;
   - pipeline com status `running` seguido de `passed` no retry → `{ allowed: true }`;
   - freeze window ativa no horário correto → `{ allowed: false, reason: ... }`;
   - aprovações insuficientes → `{ allowed: false, reason: ... }`.
4. Os testes **não devem** chamar API real, ler variáveis de ambiente reais, aguardar tempo real ou depender do horário do sistema.

Na sua **linha de raciocínio**, explique:
- Quais acoplamentos foram eliminados e como.
- Por que os testes tornam-se mais rápidos, confiáveis e isolados após a refatoração.
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// deployApproval.js
// TODO: refatore para injetar todas as dependências externas

/**
 * Verifica se um release pode ser promovido para produção.
 *
 * @param {string} releaseId
 * @param {object} [deps] - dependências injetáveis
 * @param {object} [deps.ciClient]      - { getPipelineStatus(id), getApprovals(id) }
 * @param {object} [deps.config]        - { freezeWindowStartHour, freezeWindowEndHour, minApprovals, retryDelayMs }
 * @param {function} [deps.clock]       - () => number  (hora UTC atual, 0-23)
 * @param {function} [deps.sleep]       - (ms: number) => Promise<void>
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
async function checkDeployApproval(releaseId, deps = {}) {
  // TODO: extraia config, ciClient, clock e sleep de deps (com defaults para produção)

  // TODO: consulte o status do pipeline via ciClient.getPipelineStatus(releaseId)

  // TODO: trate status 'failed'

  // TODO: trate status 'running' (aguarde com sleep e tente novamente)

  // TODO: verifique a freeze window usando clock()

  // TODO: consulte aprovações via ciClient.getApprovals(releaseId)

  // TODO: verifique minApprovals

  // TODO: retorne { allowed: true } se todos os critérios passaram
}

module.exports = { checkDeployApproval };

// deployApproval.test.js
const { checkDeployApproval } = require('./deployApproval');

// Fakes e stubs reutilizáveis
function makeCiClient({ pipelineStatus = 'passed', approvalsCount = 2 } = {}) {
  return {
    getPipelineStatus: async (_id) => ({ status: pipelineStatus }),
    getApprovals:      async (_id) => ({ count: approvalsCount }),
  };
}

const DEFAULT_CONFIG = {
  freezeWindowStartHour: 22,
  freezeWindowEndHour:   6,
  minApprovals:          2,
  retryDelayMs:          0,  // sem espera em testes
};

describe('checkDeployApproval', () => {
  it('permite deploy quando pipeline passou e aprovações são suficientes', async () => {
    // TODO
  });

  it('bloqueia deploy quando pipeline falhou', async () => {
    // TODO
  });

  it('tenta novamente após running e permite deploy se retry retornar passed', async () => {
    // TODO: use um ciClient que retorna 'running' na primeira chamada e 'passed' na segunda
  });

  it('bloqueia deploy quando freeze window está ativa', async () => {
    // TODO: use um clock que retorna uma hora dentro da janela de congelamento
  });

  it('bloqueia deploy quando aprovações são insuficientes', async () => {
    // TODO
  });
});
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# deploy_approval.py
# TODO: refatore para injetar todas as dependências externas

import asyncio
from typing import Callable, Optional
from dataclasses import dataclass


@dataclass
class DeployConfig:
    freeze_window_start_hour: int = 22
    freeze_window_end_hour: int = 6
    min_approvals: int = 2
    retry_delay_ms: int = 15_000


class DeployApprovalService:
    """
    Verifica se um release pode ser promovido para produção.

    Parâmetros injetáveis:
      ci_client  — objeto com get_pipeline_status(release_id) e get_approvals(release_id)
      config     — DeployConfig com parâmetros de freeze window, min_approvals e retry_delay_ms
      clock      — callable() -> int  (hora UTC atual, 0–23)
      sleep_fn   — callable(seconds: float) -> Awaitable  (substituível em testes)
    """

    def __init__(self, ci_client=None, config: Optional[DeployConfig] = None,
                 clock: Optional[Callable] = None, sleep_fn=None):
        # TODO: armazene as dependências (use defaults de produção quando None)
        pass

    async def check(self, release_id: str) -> dict:
        """
        Retorna { 'allowed': bool, 'reason': str (opcional) }.
        """
        # TODO: consulte o status do pipeline

        # TODO: trate status 'failed'

        # TODO: trate status 'running' (aguarde com sleep_fn e tente novamente)

        # TODO: verifique a freeze window usando clock()

        # TODO: consulte aprovações

        # TODO: verifique min_approvals

        # TODO: retorne {'allowed': True} se todos os critérios passaram


# test_deploy_approval.py
import asyncio
import unittest
from deploy_approval import DeployApprovalService, DeployConfig


def make_ci_client(pipeline_status='passed', approvals_count=2):
    """Cria um fake de ciClient configurável."""

    class FakeCiClient:
        def __init__(self):
            self._calls = 0

        async def get_pipeline_status(self, _release_id):
            return {'status': pipeline_status}

        async def get_approvals(self, _release_id):
            return {'count': approvals_count}

    return FakeCiClient()


DEFAULT_CONFIG = DeployConfig(
    freeze_window_start_hour=22,
    freeze_window_end_hour=6,
    min_approvals=2,
    retry_delay_ms=0,
)


class TestDeployApproval(unittest.IsolatedAsyncioTestCase):

    async def test_permite_deploy_quando_pipeline_passou_e_aprovacoes_suficientes(self):
        # TODO
        pass

    async def test_bloqueia_deploy_quando_pipeline_falhou(self):
        # TODO
        pass

    async def test_retry_apos_running_e_permite_deploy_se_passed(self):
        # TODO: use um fake que retorna 'running' na primeira chamada e 'passed' na segunda
        pass

    async def test_bloqueia_deploy_quando_freeze_window_ativa(self):
        # TODO: use um clock que retorna uma hora dentro da janela de congelamento
        pass

    async def test_bloqueia_deploy_quando_aprovacoes_insuficientes(self):
        # TODO
        pass


if __name__ == '__main__':
    unittest.main()
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// DeployApprovalService.java
// TODO: refatore para injetar todas as dependências externas

import java.util.concurrent.CompletableFuture;
import java.util.function.IntSupplier;
import java.util.function.LongUnaryOperator;

public class DeployApprovalService {

    /** Resultado da verificação de aprovação de deploy. */
    public record ApprovalResult(boolean allowed, String reason) {
        public static ApprovalResult allowed() {
            return new ApprovalResult(true, null);
        }
        public static ApprovalResult denied(String reason) {
            return new ApprovalResult(false, reason);
        }
    }

    /** Contrato do cliente de CI (injetável). */
    public interface CiClient {
        /** Retorna o status do pipeline: "passed", "failed" ou "running". */
        String getPipelineStatus(String releaseId) throws Exception;
        /** Retorna o número de aprovações registradas para o release. */
        int getApprovals(String releaseId) throws Exception;
    }

    /** Configuração do serviço (injetável). */
    public record DeployConfig(
        int freezeWindowStartHour,
        int freezeWindowEndHour,
        int minApprovals,
        long retryDelayMs
    ) {
        public static DeployConfig defaults() {
            return new DeployConfig(22, 6, 2, 15_000L);
        }
    }

    private final CiClient   ciClient;
    private final DeployConfig config;
    private final IntSupplier  clock;    // retorna hora UTC atual (0–23)
    private final SleepFn      sleepFn;  // aguarda milissegundos (substituível em testes)

    @FunctionalInterface
    public interface SleepFn {
        void sleep(long ms) throws Exception;
    }

    public DeployApprovalService(CiClient ciClient, DeployConfig config,
                                  IntSupplier clock, SleepFn sleepFn) {
        // TODO: armazene as dependências
    }

    /** Construtor de produção: usa defaults e dependências reais. */
    public static DeployApprovalService production(CiClient ciClient) {
        // TODO: retorne instância com clock real (LocalTime.now().getHour()),
        //       sleep real (Thread.sleep) e DeployConfig.defaults()
        return null;
    }

    /**
     * Verifica se o release pode ser promovido para produção.
     * @param releaseId identificador do release
     * @return ApprovalResult com allowed=true ou allowed=false + motivo
     */
    public ApprovalResult check(String releaseId) throws Exception {
        // TODO: consulte o status do pipeline

        // TODO: trate "failed"

        // TODO: trate "running" (chame sleepFn e tente novamente)

        // TODO: verifique a freeze window usando clock

        // TODO: consulte aprovações

        // TODO: verifique minApprovals

        // TODO: retorne ApprovalResult.allowed() se todos os critérios passaram
        return null;
    }
}

// DeployApprovalServiceTest.java
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class DeployApprovalServiceTest {

    /** Cria um fake de CiClient com status e contagem de aprovações configuráveis. */
    static DeployApprovalService.CiClient fakeCiClient(String pipelineStatus, int approvalsCount) {
        return new DeployApprovalService.CiClient() {
            @Override
            public String getPipelineStatus(String releaseId) {
                return pipelineStatus;
            }
            @Override
            public int getApprovals(String releaseId) {
                return approvalsCount;
            }
        };
    }

    static final DeployApprovalService.DeployConfig DEFAULT_CONFIG =
        new DeployApprovalService.DeployConfig(22, 6, 2, 0L);

    @Test
    void permiteDeployQuandoPipelinePassouEAprovacoesSuficientes() throws Exception {
        // TODO
    }

    @Test
    void bloqueiaDeployQuandoPipelineFalhou() throws Exception {
        // TODO
    }

    @Test
    void tentaNovamenteAposRunningEPermiteSePassedNoRetry() throws Exception {
        // TODO: use um CiClient que retorna "running" na primeira chamada e "passed" na segunda
    }

    @Test
    void bloqueiaDeployQuandoFreezeWindowAtiva() throws Exception {
        // TODO: use um clock que retorna uma hora dentro da janela de congelamento
    }

    @Test
    void bloqueiaDeployQuandoAprovacoesInsuficientes() throws Exception {
        // TODO
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Por que o código original é difícil de testar (quatro eixos de acoplamento):**
- **Cliente HTTP instanciado internamente**: `axios.create(...)` é chamado dentro de `checkDeployApproval`; não há como substituir por um fake sem monkey-patching global.
- **Variáveis de ambiente lidas no meio da lógica**: `process.env.FREEZE_WINDOW_START_HOUR` etc. são lidas em tempo de execução da função — testes precisam setar e restaurar variáveis de ambiente ou correm o risco de resultados que variam por ambiente de CI.
- **Relógio real (`new Date().getUTCHours()`)**: o comportamento da freeze window depende do horário em que o teste é executado — um teste que passa às 10h pode falhar às 23h.
- **`sleep` real (`setTimeout` com 15 000 ms)**: qualquer cenário que passe pelo caminho `running → retry` torna o teste 15 s mais lento; em suítes grandes, isso é inaceitável.

**Refatoração: injeção de todas as dependências externas**

```javascript
// JavaScript
async function checkDeployApproval(releaseId, deps = {}) {
  const {
    ciClient  = productionCiClient(),
    config    = { freezeWindowStartHour: 22, freezeWindowEndHour: 6,
                  minApprovals: 2, retryDelayMs: 15_000 },
    clock     = () => new Date().getUTCHours(),
    sleep     = (ms) => new Promise(r => setTimeout(r, ms)),
  } = deps;

  let status = (await ciClient.getPipelineStatus(releaseId)).status;

  if (status === 'failed') return { allowed: false, reason: 'Pipeline falhou.' };

  if (status === 'running') {
    await sleep(config.retryDelayMs);
    status = (await ciClient.getPipelineStatus(releaseId)).status;
    if (status !== 'passed')
      return { allowed: false, reason: 'Pipeline ainda não concluído após retry.' };
  }

  const h = clock();
  const { freezeWindowStartHour: s, freezeWindowEndHour: e } = config;
  const inFreeze = s > e ? (h >= s || h < e) : (h >= s && h < e);
  if (inFreeze) return { allowed: false, reason: 'Deploy bloqueado: janela de congelamento ativa.' };

  const { count } = await ciClient.getApprovals(releaseId);
  if (count < config.minApprovals)
    return { allowed: false, reason: `Aprovações insuficientes: ${count} de ${config.minApprovals} necessárias.` };

  return { allowed: true };
}
```

**Testes essenciais sem dependências externas:**

```javascript
describe('checkDeployApproval', () => {
  const cfg = { freezeWindowStartHour: 22, freezeWindowEndHour: 6,
                minApprovals: 2, retryDelayMs: 0 };
  const noSleep = async () => {};

  it('permite deploy — pipeline passed, aprovações suficientes', async () => {
    const ci = { getPipelineStatus: async () => ({ status: 'passed' }),
                 getApprovals:      async () => ({ count: 3 }) };
    const result = await checkDeployApproval('r1', { ciClient: ci, config: cfg,
                                                     clock: () => 14, sleep: noSleep });
    expect(result).toEqual({ allowed: true });
  });

  it('bloqueia — pipeline failed', async () => {
    const ci = { getPipelineStatus: async () => ({ status: 'failed' }),
                 getApprovals: async () => ({ count: 3 }) };
    const result = await checkDeployApproval('r1', { ciClient: ci, config: cfg,
                                                     clock: () => 14, sleep: noSleep });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/falhou/i);
  });

  it('permite deploy após retry — running → passed', async () => {
    let call = 0;
    const ci = {
      getPipelineStatus: async () => ({ status: call++ === 0 ? 'running' : 'passed' }),
      getApprovals:      async () => ({ count: 2 }),
    };
    const result = await checkDeployApproval('r1', { ciClient: ci, config: cfg,
                                                     clock: () => 14, sleep: noSleep });
    expect(result).toEqual({ allowed: true });
  });

  it('bloqueia — freeze window ativa às 23h', async () => {
    const ci = { getPipelineStatus: async () => ({ status: 'passed' }),
                 getApprovals:      async () => ({ count: 3 }) };
    const result = await checkDeployApproval('r1', { ciClient: ci, config: cfg,
                                                     clock: () => 23, sleep: noSleep });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/congelamento/i);
  });

  it('bloqueia — aprovações insuficientes', async () => {
    const ci = { getPipelineStatus: async () => ({ status: 'passed' }),
                 getApprovals:      async () => ({ count: 1 }) };
    const result = await checkDeployApproval('r1', { ciClient: ci, config: cfg,
                                                     clock: () => 14, sleep: noSleep });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/insuficientes/i);
  });
});
```

**Por que a refatoração melhora velocidade, confiabilidade e isolamento:**
- Os testes executam em milissegundos — nenhum `sleep` real é acionado.
- A freeze window é testada de forma determinística com um clock fixo, independentemente do horário do sistema.
- A lógica de decisão não depende de variáveis de ambiente — toda configuração chega via `config`.
- Falhas de rede ou comportamentos do CI são simulados por fakes simples, sem necessidade de servidor real.
- Cada cenário é testado de forma isolada e reproduzível em qualquer ambiente.

**Pontos essenciais para avaliação:**
1. Diagnóstico explícito dos quatro acoplamentos (cliente HTTP, env vars, relógio, sleep).
2. Injeção coerente das quatro dependências com defaults funcionais em produção.
3. Separação clara entre regra de decisão e integração com sistemas externos.
4. Suíte com os cinco cenários obrigatórios sem nenhuma dependência externa real.
5. Justificativa conectando cada injeção à eliminação de um eixo de não determinismo.
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
Recomendacao: accept.

Principais pontos:
- A questao pertence corretamente a tests/testability: o foco e tornar deterministica uma unidade dificil de testar por dependencias externas reais, e nao discutir arquitetura de CI/CD ou infraestrutura de deploy.
- A dificuldade advanced esta adequada, pois exige diagnostico de multiplos acoplamentos, refatoracao por injecao de dependencias, separacao entre decisao e efeitos externos, preservacao de comportamento e testes para varios fluxos.
- O formato e compativel com questao code. Os templates de JavaScript, Python e Java representam a mesma tarefa e mantem o problema central de testabilidade por cliente HTTP real, ambiente, relogio e espera temporal.
- O codigo inicial e funcional no cenario esperado, mas dificil de testar pelos acoplamentos reais. O enunciado deixa claro que o aluno deve refatorar e escrever testes sem API real, env real, clock real ou sleep real.
- A solucao esperada injeta ou parametriza cliente de CI/adaptador de aprovacoes, configuracao, relogio e espera, e separa a logica de decisao dos efeitos externos de forma avaliavel.
- A rubrica avalia criterios observaveis: diagnostico, qualidade da refatoracao, isolamento da decisao, testes deterministicos, preservacao de comportamento e justificativa.
- O solution-outline permanece no escopo de testabilidade e nao transforma a questao em arquitetura de CI/CD ou deploy real.
- O prompt de avaliacao segue o padrao de prompts para questao code, usa placeholders compativeis e reproduz corretamente ids e pesos da rubrica.
- As referencias estao presentes, plausiveis e conservadoras para o tema, permanecendo corretamente como suggested_not_verified.
<!-- /REVIEW:comments -->
