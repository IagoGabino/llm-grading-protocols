import assert from "node:assert/strict";

import type { LLMProvider } from "../src/server/llm/types";

Object.defineProperty(process.env, "NODE_ENV", {
    value: "test",
    configurable: true,
    enumerable: true,
    writable: true,
});

async function main() {
    const { runSingleEvaluation } = await import("../src/server/evaluation/engine");
    const { buildEvaluateSuccessResponseBody } = await import(
        "../src/server/evaluation/api-response"
    );

    const validProvider: LLMProvider = {
        name: "verification-valid",
        async invoke() {
            return {
                model: "verification/model",
                output: JSON.stringify({
                    overall: 0,
                    criteria: [{ id: "correctness", score: 4, weight: 1, evidence: ["ok"] }],
                    feedback: "Resposta valida.",
                }),
            };
        },
    };

    const success = await runSingleEvaluation(
        {
            slug: "easy-cpf-validation-tests",
            resposta: "Cobrir CPF valido, CPF invalido e entradas formatadas.",
            raciocinio: "",
        },
        {
            provider: validProvider,
            useMock: false,
            retryLimit: 0,
            timeoutMs: 5_000,
        }
    );

    assert.equal(success.status, "success");
    assert.equal(success.model, "verification/model");
    assert.equal(success.callCount, 1);
    assert.equal(success.evaluation.overall, 4);
    assert.ok("rawOutput" in success);
    assert.ok(success.latencyMs >= 0);

    const apiBody = buildEvaluateSuccessResponseBody({
        result: success,
        attemptId: "attempt-1",
        useMock: false,
    });

    assert.equal(apiBody.model, "verification/model");
    assert.equal(apiBody.timingMs, success.latencyMs);
    assert.equal(apiBody.attemptId, "attempt-1");
    assert.equal(apiBody.overall, 4);
    assert.equal(apiBody.criteria.length, 1);

    const invalidJsonProvider: LLMProvider = {
        name: "verification-invalid-json",
        async invoke() {
            return {
                model: "verification/model",
                output: "isto nao e json",
            };
        },
    };

    const parseFailure = await runSingleEvaluation(
        {
            slug: "easy-cpf-validation-tests",
            resposta: "Resposta qualquer.",
            raciocinio: "",
        },
        {
            provider: invalidJsonProvider,
            useMock: false,
            retryLimit: 0,
            timeoutMs: 5_000,
        }
    );

    assert.equal(parseFailure.status, "parse_error");
    assert.equal(parseFailure.callCount, 1);
    assert.equal(parseFailure.rawOutput, "isto nao e json");
    assert.ok(parseFailure.errorMessage.length > 0);

    const invalidSchemaProvider: LLMProvider = {
        name: "verification-invalid-schema",
        async invoke() {
            return {
                model: "verification/model",
                output: JSON.stringify({
                    overall: 3,
                    criteria: [],
                    feedback: "Sem criterios.",
                }),
            };
        },
    };

    const schemaFailure = await runSingleEvaluation(
        {
            slug: "easy-cpf-validation-tests",
            resposta: "Resposta qualquer.",
            raciocinio: "",
        },
        {
            provider: invalidSchemaProvider,
            useMock: false,
            retryLimit: 0,
            timeoutMs: 5_000,
        }
    );

    assert.equal(schemaFailure.status, "schema_error");
    assert.equal(schemaFailure.callCount, 1);
    assert.deepEqual(schemaFailure.parsedOutput, {
        overall: 3,
        criteria: [],
        feedback: "Sem criterios.",
    });
    assert.ok(schemaFailure.errorMessage.length > 0);

    console.log("evaluation engine verification passed");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
