# Review v1 Exploratory Analysis

## Objective

This diagnostic analysis explains the observed behavior of `review_v1` by comparing the initial evaluation saved in `strategyMetadata.initialEvaluation` with the final revised `parsedOutput` from the same frozen review runs.

This is exploratory and diagnostic. It reads frozen experiment artifacts only and does not replace, modify, or rerun the main experiment.

## Scope

- Source runs: `experiments\results\experiment-runs\poc-ii-final\runs.json`
- Total review runs: 24
- Analyzed runs: 24
- Unavailable runs: 0
- Epsilon for unchanged classification: 0.05

## Overall Review Effect

- Improved runs: 4
- Worsened runs: 5
- Unchanged runs: 15
- Average score shift (final - initial): -0.0333
- Average initial signed error: 0.1400
- Average final signed error: 0.1067

Positive score shift means the reviewer raised scores on average; negative score shift means it lowered scores.

## Summary By Profile

| profile | runs | improved | worsened | unchanged | avgInitialAbsErr | avgFinalAbsErr | avgDelta | avgScoreShift |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| medium | 8 | 3 | 2 | 3 | 0.4425 | 0.4413 | -0.0013 | -0.1437 |
| misleading | 6 | 1 | 2 | 3 | 0.3200 | 0.3700 | 0.0500 | -0.0667 |
| strong | 8 | 0 | 0 | 8 | 0.0588 | 0.0588 | 0 | 0 |
| weak | 2 | 0 | 1 | 1 | 0.2250 | 0.6000 | 0.3750 | 0.3750 |

## Summary By Criterion

| criterionId | samples | improved | worsened | unchanged | avgInitialAbsErr | avgFinalAbsErr | avgDelta | avgScoreShift |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abstraction_extraction | 3 | 0 | 1 | 2 | 0.5000 | 0.6667 | 0.1667 | -0.1667 |
| api_contract | 3 | 0 | 1 | 2 | 0.5000 | 0.6667 | 0.1667 | -0.1667 |
| assertion_precision | 3 | 1 | 1 | 1 | 1 | 1.3333 | 0.3333 | 0.3333 |
| backend_flow | 3 | 0 | 0 | 3 | 0.5000 | 0.5000 | 0 | -0.3333 |
| batching_fix | 3 | 0 | 0 | 3 | 0.3333 | 0.3333 | 0 | 0 |
| behavior_coverage | 3 | 0 | 0 | 3 | 0.6667 | 0.6667 | 0 | 0 |
| behavior_preservation | 6 | 1 | 0 | 5 | 0.5833 | 0.5000 | -0.0833 | -0.0833 |
| circuit_breaker | 3 | 0 | 0 | 3 | 1 | 1 | 0 | 0 |
| conceptual_justification | 3 | 0 | 0 | 3 | 1 | 1 | 0 | 0 |
| contract_preservation | 3 | 0 | 0 | 3 | 0.3333 | 0.3333 | 0 | 0 |
| coupling_reduction | 3 | 0 | 0 | 3 | 0.3333 | 0.3333 | 0 | 0 |
| dependency_isolation | 3 | 0 | 0 | 3 | 0.1667 | 0.1667 | 0 | 0.3333 |
| determinism | 3 | 0 | 1 | 2 | 0.3333 | 0.5000 | 0.1667 | 0.1667 |
| duplication_identification | 3 | 0 | 0 | 3 | 0.5000 | 0.5000 | 0 | -0.3333 |
| error_handling | 3 | 1 | 1 | 1 | 0.3333 | 0.3333 | 0 | -0.3333 |
| explanation | 3 | 0 | 0 | 3 | 0.6667 | 0.6667 | 0 | 0 |
| function_extraction | 3 | 0 | 0 | 3 | 0.3333 | 0.3333 | 0 | 0 |
| http_status_codes | 3 | 1 | 0 | 2 | 0.8333 | 0.6667 | -0.1667 | -0.1667 |
| isolamento | 3 | 0 | 0 | 3 | 0.3333 | 0.3333 | 0 | 0 |
| memory_join | 3 | 0 | 0 | 3 | 0.6667 | 0.6667 | 0 | 0 |
| public_signature_preservation | 3 | 0 | 0 | 3 | 0 | 0 | 0 | 0 |
| reasoning | 6 | 1 | 0 | 5 | 0.6667 | 0.5000 | -0.1667 | -0.1667 |
| responsibility_identification | 3 | 0 | 0 | 3 | 0.1667 | 0.1667 | 0 | 0 |
| retry_e_dlq | 3 | 0 | 0 | 3 | 0.6667 | 0.6667 | 0 | 0.3333 |
| retry_strategy | 3 | 1 | 1 | 1 | 0.6667 | 0.6667 | 0 | -0.6667 |
| root_cause | 6 | 0 | 0 | 6 | 0.3333 | 0.3333 | 0 | 0 |
| root_cause_diagnosis | 3 | 0 | 0 | 3 | 0.5000 | 0.5000 | 0 | 0 |
| teardown_implementation | 3 | 0 | 0 | 3 | 0.3333 | 0.3333 | 0 | 0 |
| test_structure | 3 | 0 | 0 | 3 | 0.5000 | 0.5000 | 0 | 0 |
| timeout_fix | 3 | 0 | 0 | 3 | 0.1667 | 0.1667 | 0 | 0 |
| tradeoffs | 3 | 0 | 0 | 3 | 0.5000 | 0.5000 | 0 | 0 |
| ttl_and_tradeoffs | 3 | 0 | 0 | 3 | 1 | 1 | 0 | 0 |

## Overcorrection Candidates

| questionSlug | referenceAnswerId | profile | initial | final | expected | scoreShift | reviewDelta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| intermediate-payment-service-testability | intermediate-payment-service-testability-weak | weak | 2.5500 | 3.3000 | 2.1500 | 0.7500 | 0.7500 |
| intermediate-notification-dry-wrapper | intermediate-notification-dry-wrapper-medium | medium | 3.5000 | 2.9300 | 3.6800 | -0.5700 | 0.5700 |

## Interpretation Guardrail

This analysis describes observed behavior of `review_v1` on the frozen main experiment. It does not establish a causal claim about all possible review prompts, and it does not include any new LLM calls.

A future `review_v2` sensitivity analysis may test a revised reviewer prompt as a separate exploratory experiment. That future analysis should not be included in the official main-experiment results.
