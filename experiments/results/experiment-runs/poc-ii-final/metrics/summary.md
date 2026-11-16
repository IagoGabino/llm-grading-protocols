# Experiment Metrics Summary

Experiment: poc-ii-final
Model: google/gemini-2.5-flash
Prompt version: experiment-runner-v1

## Formulas

- `absoluteError = abs(predictedOverall - expectedOverall)`
- `signedError = predictedOverall - expectedOverall`
- `criterionAbsoluteError = abs(predictedScore - expectedScore)`
- `criterionSignedError = predictedScore - expectedScore`
- `overallMAE = mean(absoluteError)` over successful runs only
- `criterionMAE = mean(criterionAbsoluteError)` over matched criteria from successful runs only
- Failed runs are excluded from MAE and included in robustness summaries.

## Counts

- Planned runs: 72
- Found runs: 72
- Successful runs: 72
- Matrix assessment source: reference_answers

## Per-Strategy Summary

| strategy | planned | success | successRate | overallMAE | criterionMAE | totalCostCredits | avgLatencyMs | totalCallCount |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| single | 24 | 24 | 1 | 0.2658 | 0.5143 | 0.0929 | 7006.5833 | 24 |
| review | 24 | 24 | 1 | 0.3092 | 0.5190 | 0.1822 | 12949.8333 | 48 |
| multi_aggregate | 24 | 24 | 1 | 0.2550 | 0.4538 | 0.2785 | 20195.7500 | 72 |

## Status Counts

| strategy | success | parse_error | schema_error | llm_error | timeout |
| --- | --- | --- | --- | --- | --- |
| single | 24 | 0 | 0 | 0 | 0 |
| review | 24 | 0 | 0 | 0 | 0 |
| multi_aggregate | 24 | 0 | 0 | 0 | 0 |

## Operational Summary

| strategy | foundRuns | totalCallCount | avgCallCount | totalCostCredits | avgLatencyMs | maxLatencyMs |
| --- | --- | --- | --- | --- | --- | --- |
| single | 24 | 24 | 1 | 0.0929 | 7006.5833 | 14964 |
| review | 24 | 48 | 2 | 0.1822 | 12949.8333 | 18640 |
| multi_aggregate | 24 | 72 | 3 | 0.2785 | 20195.7500 | 27104 |

## Strategy Diagnostics

Multi-aggregate diagnostic runs available: 24
Multi-aggregate diagnostic runs unavailable: 0

| criterionId | samples | avgStdDev | maxStdDev |
| --- | --- | --- | --- |
| api_contract | 3 | 0.1571 | 0.2357 |
| backend_flow | 3 | 0 | 0 |
| http_status_codes | 3 | 0.2357 | 0.4714 |
| ttl_and_tradeoffs | 3 | 0.0786 | 0.2357 |
| isolamento | 3 | 0.0786 | 0.2357 |
| circuit_breaker | 3 | 0.2357 | 0.4714 |
| retry_e_dlq | 3 | 0.2721 | 0.4082 |
| tradeoffs | 3 | 0.3928 | 0.4714 |
| responsibility_identification | 3 | 0.3143 | 0.4714 |
| function_extraction | 3 | 0.1571 | 0.2357 |
| behavior_preservation | 6 | 0.1178 | 0.2357 |
| coupling_reduction | 3 | 0 | 0 |
| reasoning | 6 | 0.0786 | 0.4714 |
| root_cause | 6 | 0.1179 | 0.4714 |
| timeout_fix | 3 | 0 | 0 |
| error_handling | 3 | 0.1572 | 0.2357 |
| retry_strategy | 3 | 0.1572 | 0.2357 |
| explanation | 3 | 0.1571 | 0.4714 |
| root_cause_diagnosis | 3 | 0 | 0 |
| teardown_implementation | 3 | 0 | 0 |
| determinism | 3 | 0.0786 | 0.2357 |
| conceptual_justification | 3 | 0.0786 | 0.2357 |
| batching_fix | 3 | 0 | 0 |
| memory_join | 3 | 0.1571 | 0.4714 |
| contract_preservation | 3 | 0.3143 | 0.9428 |
| duplication_identification | 3 | 0.3143 | 0.4714 |
| abstraction_extraction | 3 | 0.2147 | 0.4082 |
| public_signature_preservation | 3 | 0 | 0 |
| dependency_isolation | 3 | 0 | 0 |
| behavior_coverage | 3 | 0.1571 | 0.4714 |
| assertion_precision | 3 | 0.3143 | 0.4714 |
| test_structure | 3 | 0.0786 | 0.2357 |

## Consistency

Score-justification consistency was not evaluated: No predeclared score-justification consistency annotations/checklist were provided in the protocol.

## Notes

- `weightedOverallFromCriteria` and `overallConsistencyDelta` are diagnostics only; they do not replace `parsedOutput.overall`.
- Grouped summaries are exploratory and marked sparse when support is low.
- Python notebooks should consume the exported tables instead of redefining official formulas.

## Warnings

- Question axis "architecture" was reported as canonical axis "designArchitecture".
- Question axis "architecture" was reported as canonical axis "designArchitecture".
- Question axis "tests" was reported as canonical axis "testing".
- Question axis "tests" was reported as canonical axis "testing".
