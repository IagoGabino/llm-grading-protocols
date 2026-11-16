---
id: intermediate-report-filesystem-testability
slug: intermediate-report-filesystem-testability
title: Testes — Testabilidade de Serviço de Relatório com Escrita Direta no Filesystem
axis: tests
subtheme: testability
difficulty: intermediate
promptTemplate: intermediate-report-filesystem-testability
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [testability, filesystem, dependency_injection, io_isolation, pure_function, stub]
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
    title: "Node.js fs module — official documentation"
    type: official_docs
    url: "https://nodejs.org/api/fs.html"
    relevance: 3
    confidence: 5
    supports: [statement]
    verificationStatus: suggested_not_verified
  - id: ref-4
    title: "Python unittest.mock — official documentation"
    type: official_docs
    url: "https://docs.python.org/3/library/unittest.mock.html"
    relevance: 3
    confidence: 5
    supports: [solution-outline]
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
    - id: testability_diagnosis
      name: Diagnóstico do problema de testabilidade
      weight: 0.20
      description: Identifica que a lógica de cálculo/formatação está acoplada à escrita no filesystem dentro da mesma função, tornando impossível testar a lógica de negócio sem criar arquivos reais no disco.
    - id: io_separation
      name: Separação entre lógica pura e I/O
      weight: 0.30
      description: Refatora a função original em pelo menos duas partes — uma função pura responsável pelo cálculo e formatação do relatório (sem efeitos colaterais) e um ponto de escrita isolado que recebe o conteúdo formatado e o caminho do arquivo.
    - id: unit_test_quality
      name: Qualidade dos testes unitários
      weight: 0.25
      description: Escreve testes para cálculo (total de acessos, usuários únicos, data do relatório) e formatação do conteúdo sem acionar escrita real — testes são rápidos, sem dependência de disco, permissões ou limpeza de arquivos.
    - id: io_stub
      name: Uso adequado de fake/stub para escrita
      weight: 0.15
      description: O teste que verifica a integração entre a lógica e a escrita usa um fake, stub ou função substituta — verifica que o componente de escrita foi chamado com o caminho e o conteúdo esperados, sem criar arquivo real.
    - id: behavior_and_justification
      name: Preservação do comportamento e justificativa
      weight: 0.10
      description: A refatoração preserva o comportamento original (o relatório ainda é gravado no disco em produção) e o aluno explica por que separar lógica pura de I/O torna os testes mais rápidos, confiáveis e independentes de ambiente.
---

<!-- SECTION:statement -->
Um serviço interno gera um **relatório diário de acessos** e o grava em disco. O código funciona corretamente em produção, mas os testes são lentos e frágeis: dependem de um caminho de arquivo real, das permissões do sistema operacional e de limpeza manual dos arquivos criados.

**Código atual (com problema de testabilidade):**

```javascript
// access-report.js
const fs = require('fs');

/**
 * Gera o relatório de acessos e grava no disco.
 * @param {Array<{userId: string, timestamp: string}>} accesses - lista de registros de acesso
 * @param {string} outputPath - caminho do arquivo de saída
 */
function generateAccessReport(accesses, outputPath) {
  // Cálculo do resumo
  const total = accesses.length;
  const uniqueUsers = new Set(accesses.map(a => a.userId)).size;
  const reportDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Formatação do conteúdo
  const content = [
    `Relatório de Acessos — ${reportDate}`,
    `Total de acessos: ${total}`,
    `Usuários únicos: ${uniqueUsers}`,
  ].join('\n');

  // Escrita direta no filesystem — impossível testar sem arquivo real
  fs.writeFileSync(outputPath, content, 'utf8');
}

module.exports = { generateAccessReport };
```

**Problema observado nos testes:**

```javascript
// access-report.test.js  ← testes frágeis e lentos
const { generateAccessReport } = require('./access-report');
const fs = require('fs');
const path = require('path');

test('relatório contém total correto', () => {
  const tmpFile = path.join(__dirname, 'tmp_report.txt');
  const accesses = [
    { userId: 'u1', timestamp: '2024-06-01T08:00:00Z' },
    { userId: 'u2', timestamp: '2024-06-01T09:00:00Z' },
    { userId: 'u1', timestamp: '2024-06-01T10:00:00Z' },
  ];

  generateAccessReport(accesses, tmpFile); // cria arquivo real no disco

  const content = fs.readFileSync(tmpFile, 'utf8'); // lê do disco
  expect(content).toContain('Total de acessos: 3');

  fs.unlinkSync(tmpFile); // limpeza manual — frágil se o teste falhar antes
});
```

**Contrato esperado após refatoração:**

- `summarizeAccesses(accesses)` → `{ total, uniqueUsers, reportDate }` — pura, sem efeitos colaterais.
- `formatReport(summary)` → `string` — formata o conteúdo, pura, sem efeitos colaterais.
- `generateAccessReport(accesses, outputPath, writeFn?)` → mantém comportamento original em produção; em testes, recebe uma função de escrita substituta.

**Tarefa:**

1. **Refatore** o código para separar cálculo, formatação e escrita em partes testáveis de forma independente.
2. **Escreva testes unitários** para `summarizeAccesses` e `formatReport` sem tocar no filesystem.
3. **Escreva um teste** que verifique, sem criar arquivo real, que a função de escrita é chamada com o caminho e o conteúdo corretos.

Na sua **linha de raciocínio**, explique:
- Por que o código original dificulta testes e como a refatoração resolve isso.
- Por que os testes tornam-se mais rápidos e confiáveis após a separação.
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// access-report.js
// TODO: separe a lógica em funções testáveis independentemente

const fs = require('fs');

/**
 * Calcula o resumo dos acessos.
 * @param {Array<{userId: string, timestamp: string}>} accesses
 * @returns {{ total: number, uniqueUsers: number, reportDate: string }}
 */
function summarizeAccesses(accesses) {
  // TODO: retorne { total, uniqueUsers, reportDate } sem efeitos colaterais
}

/**
 * Formata o conteúdo do relatório a partir do resumo.
 * @param {{ total: number, uniqueUsers: number, reportDate: string }} summary
 * @returns {string}
 */
function formatReport(summary) {
  // TODO: retorne a string formatada sem efeitos colaterais
}

/**
 * Gera e grava o relatório de acessos.
 * @param {Array<{userId: string, timestamp: string}>} accesses
 * @param {string} outputPath
 * @param {function(string, string): void} [writeFn] - função de escrita (injetável em testes)
 */
function generateAccessReport(accesses, outputPath, writeFn) {
  // TODO: use summarizeAccesses e formatReport;
  //       grave com writeFn (se fornecida) ou com fs.writeFileSync por padrão
}

module.exports = { summarizeAccesses, formatReport, generateAccessReport };

// access-report.test.js
const { summarizeAccesses, formatReport, generateAccessReport } = require('./access-report');

const SAMPLE_ACCESSES = [
  { userId: 'u1', timestamp: '2024-06-01T08:00:00Z' },
  { userId: 'u2', timestamp: '2024-06-01T09:00:00Z' },
  { userId: 'u1', timestamp: '2024-06-01T10:00:00Z' },
];

describe('summarizeAccesses', () => {
  it('conta o total de acessos', () => {
    // TODO
  });

  it('conta apenas usuários únicos', () => {
    // TODO
  });

  it('inclui a data do relatório no formato YYYY-MM-DD', () => {
    // TODO
  });
});

describe('formatReport', () => {
  it('formata o relatório com os dados do resumo', () => {
    // TODO
  });
});

describe('generateAccessReport', () => {
  it('chama a função de escrita com o caminho e conteúdo corretos', () => {
    // TODO: use uma função stub para writeFn e verifique os argumentos
    //       sem criar arquivo no disco
  });
});
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# access_report.py
# TODO: separe a lógica em funções testáveis independentemente

import os
from datetime import date
from typing import Callable, List, Dict


def summarize_accesses(accesses: List[Dict]) -> Dict:
    """
    Calcula o resumo dos acessos.
    Retorna: { 'total': int, 'unique_users': int, 'report_date': str }
    """
    # TODO: retorne o dicionário sem efeitos colaterais
    pass


def format_report(summary: Dict) -> str:
    """
    Formata o conteúdo do relatório a partir do resumo.
    Retorna: string formatada
    """
    # TODO: retorne a string formatada sem efeitos colaterais
    pass


def generate_access_report(
    accesses: List[Dict],
    output_path: str,
    write_fn: Callable[[str, str], None] = None,
) -> None:
    """
    Gera e grava o relatório de acessos.
    write_fn: função de escrita injetável — usa open/write por padrão.
    """
    # TODO: use summarize_accesses e format_report;
    #       grave com write_fn (se fornecida) ou com open() por padrão
    pass


# test_access_report.py
import unittest
from access_report import summarize_accesses, format_report, generate_access_report

SAMPLE_ACCESSES = [
    {'userId': 'u1', 'timestamp': '2024-06-01T08:00:00Z'},
    {'userId': 'u2', 'timestamp': '2024-06-01T09:00:00Z'},
    {'userId': 'u1', 'timestamp': '2024-06-01T10:00:00Z'},
]


class TestSummarizeAccesses(unittest.TestCase):
    def test_conta_total_de_acessos(self):
        # TODO
        pass

    def test_conta_apenas_usuarios_unicos(self):
        # TODO
        pass

    def test_inclui_data_do_relatorio(self):
        # TODO
        pass


class TestFormatReport(unittest.TestCase):
    def test_formata_relatorio_com_dados_do_resumo(self):
        # TODO
        pass


class TestGenerateAccessReport(unittest.TestCase):
    def test_chama_funcao_de_escrita_com_caminho_e_conteudo_corretos(self):
        # TODO: use uma lista ou objeto simples como stub para write_fn
        #       e verifique os argumentos sem criar arquivo no disco
        pass


if __name__ == '__main__':
    unittest.main()
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// AccessReport.java
// TODO: separe a lógica em métodos testáveis independentemente

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.stream.Collectors;
import java.nio.file.Files;
import java.nio.file.Path;

public class AccessReport {

    public record AccessEntry(String userId, String timestamp) {}

    public record ReportSummary(int total, int uniqueUsers, String reportDate) {}

    /**
     * Calcula o resumo dos acessos.
     * Deve retornar { total, uniqueUsers, reportDate } sem efeitos colaterais.
     */
    public static ReportSummary summarizeAccesses(List<AccessEntry> accesses) {
        // TODO
        return null;
    }

    /**
     * Formata o conteúdo do relatório a partir do resumo.
     * Deve retornar a string formatada sem efeitos colaterais.
     */
    public static String formatReport(ReportSummary summary) {
        // TODO
        return null;
    }

    /**
     * Gera e grava o relatório de acessos.
     * writeFn: consumidor injetável — usa Files.writeString por padrão se null.
     */
    public static void generateAccessReport(
            List<AccessEntry> accesses,
            String outputPath,
            BiConsumer<String, String> writeFn) throws Exception {
        // TODO: use summarizeAccesses e formatReport;
        //       grave com writeFn (se não nulo) ou com Files.writeString por padrão
    }
}

// AccessReportTest.java
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.util.List;

class AccessReportTest {

    static final List<AccessReport.AccessEntry> SAMPLE = List.of(
        new AccessReport.AccessEntry("u1", "2024-06-01T08:00:00Z"),
        new AccessReport.AccessEntry("u2", "2024-06-01T09:00:00Z"),
        new AccessReport.AccessEntry("u1", "2024-06-01T10:00:00Z")
    );

    @Test
    void contaTotalDeAcessos() {
        // TODO
    }

    @Test
    void contaApenasUsuariosUnicos() {
        // TODO
    }

    @Test
    void incluiDataDoRelatorio() {
        // TODO
    }

    @Test
    void formataRelatorioComDadosDoResumo() {
        // TODO
    }

    @Test
    void chamaFuncaoDeEscritaComCaminhoEConteudoCorretos() throws Exception {
        // TODO: use um array ou lista simples como stub para writeFn
        //       e verifique os argumentos sem criar arquivo no disco
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Por que o código original é difícil de testar:**
- `generateAccessReport` mistura três responsabilidades: cálculo do resumo, formatação do conteúdo e escrita no disco.
- Qualquer teste que chame a função cria um arquivo real — dependendo de caminho, permissões do SO e limpeza manual.
- Se o teste falhar antes de `unlinkSync`/`os.remove`, o arquivo permanece no disco e pode interferir em execuções futuras.
- Testes de lógica de negócio (ex.: contagem de usuários únicos) ficam lentos e frágeis por causa de I/O desnecessário.

**Refatoração: separação de lógica pura e escrita injetável**

```javascript
// JavaScript
function summarizeAccesses(accesses) {
  const total = accesses.length;
  const uniqueUsers = new Set(accesses.map(a => a.userId)).size;
  const reportDate = new Date().toISOString().slice(0, 10);
  return { total, uniqueUsers, reportDate };
}

function formatReport({ total, uniqueUsers, reportDate }) {
  return [
    `Relatório de Acessos — ${reportDate}`,
    `Total de acessos: ${total}`,
    `Usuários únicos: ${uniqueUsers}`,
  ].join('\n');
}

function generateAccessReport(accesses, outputPath, writeFn = fs.writeFileSync) {
  const summary = summarizeAccesses(accesses);
  const content = formatReport(summary);
  writeFn(outputPath, content);
}
```

**Testes essenciais sem filesystem:**

```javascript
describe('summarizeAccesses', () => {
  it('conta o total de acessos', () => {
    const result = summarizeAccesses(SAMPLE_ACCESSES);
    expect(result.total).toBe(3);
  });

  it('conta apenas usuários únicos', () => {
    const result = summarizeAccesses(SAMPLE_ACCESSES);
    expect(result.uniqueUsers).toBe(2); // u1 aparece 2 vezes
  });

  it('inclui data no formato YYYY-MM-DD', () => {
    const result = summarizeAccesses(SAMPLE_ACCESSES);
    expect(result.reportDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatReport', () => {
  it('formata o relatório com os dados do resumo', () => {
    const summary = { total: 3, uniqueUsers: 2, reportDate: '2024-06-01' };
    const content = formatReport(summary);
    expect(content).toContain('Total de acessos: 3');
    expect(content).toContain('Usuários únicos: 2');
    expect(content).toContain('2024-06-01');
  });
});

describe('generateAccessReport', () => {
  it('chama writeFn com caminho e conteúdo corretos', () => {
    const calls = [];
    const stubWrite = (path, content) => calls.push({ path, content });

    generateAccessReport(SAMPLE_ACCESSES, '/reports/daily.txt', stubWrite);

    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe('/reports/daily.txt');
    expect(calls[0].content).toContain('Total de acessos: 3');
  });
});
```

**Por que a refatoração torna os testes mais rápidos e confiáveis:**
- `summarizeAccesses` e `formatReport` são funções puras — determinísticas, sem I/O, executam em microssegundos.
- O stub de escrita captura os argumentos na memória; não cria arquivos, não depende de permissões e não exige limpeza.
- Qualquer falha na lógica de negócio é detectada imediatamente, sem interferência do ambiente de execução.

**Pontos essenciais para avaliação:**
1. Separação em ao menos duas funções puras: cálculo/formatação.
2. `generateAccessReport` aceita uma função de escrita substituta (parâmetro, default value ou sobrecarga).
3. Testes de cálculo e formatação sem tocar no disco.
4. Teste de integração usando stub/fake que verifica path e conteúdo recebidos.
5. Justificativa conecta separação de I/O → ausência de dependência de disco → testes rápidos e determinísticos.
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
- A questao pertence corretamente a tests/testability: o foco nao e apenas modularizar o codigo, mas tornar a logica de relatorio testavel sem dependencia de filesystem real.
- A dificuldade intermediate esta adequada, pois exige diagnostico do acoplamento com I/O, refatoracao com isolamento de efeitos colaterais, testes unitarios para logica pura e verificacao da escrita por fake/stub.
- O formato e compativel com questao code. Os templates de JavaScript, Python e Java representam a mesma tarefa e mantem o problema central de testabilidade por escrita direta no disco.
- O codigo inicial e funcional em producao, mas dificil de testar por misturar calculo, formatacao e escrita no filesystem. O enunciado deixa claro que o aluno deve refatorar e escrever testes sem criar arquivos reais.
- A rubrica avalia criterios observaveis: diagnostico, separacao entre logica e I/O, testes unitarios sem disco, uso de fake/stub para escrita, preservacao de comportamento e justificativa.
- O solution-outline permanece no escopo de testabilidade e nao transforma a questao em arquitetura de storage, cloud ou performance.
- O prompt de avaliacao segue o padrao de prompts para questao code, usa placeholders compativeis e reproduz corretamente ids e pesos da rubrica.
- As referencias estao presentes, plausiveis e conservadoras para o tema, permanecendo corretamente como suggested_not_verified.
<!-- /REVIEW:comments -->
