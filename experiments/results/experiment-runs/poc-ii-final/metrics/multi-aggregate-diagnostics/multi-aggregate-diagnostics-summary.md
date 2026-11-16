# Multi Aggregate Diagnostics

## Objective

This diagnostic analysis compares the frozen official `multi_aggregate` runs against `single` and inspects existing internal aggregate metadata/raw outputs. No new LLM calls were made, the runner was not executed, and official artifacts were not modified.

## Scope

- Experiment: `poc-ii-final`
- Analyzed single vs multi pairs: 24
- Missing pairs: 0
- Epsilon for practical ties: 0.05
- High stddev threshold: 0.5
- High error threshold: 0.3
- Internal data warnings: 0

## Overall Multi Vs Single

- Multi wins: 8
- Single wins: 7
- Practical ties: 9

## Summary By Profile

| profile | pairs | multiWins | singleWins | ties | singleMAE | multiMAE | avgDelta | multiSigned |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| medium | 8 | 4 | 2 | 2 | 0.4425 | 0.3875 | -0.0550 | 0.3150 |
| misleading | 6 | 3 | 3 | 0 | 0.3200 | 0.3067 | -0.0133 | -0.0700 |
| strong | 8 | 0 | 1 | 7 | 0.0588 | 0.0812 | 0.0225 | 0.0163 |
| weak | 2 | 1 | 1 | 0 | 0.2250 | 0.2650 | 0.0400 | 0.0650 |

## Summary By Criterion

| criterionId | samples | multiWins | singleWins | ties | singleMAE | multiMAE | avgDelta | multiSigned | stddev |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| abstraction_extraction | 3 | 1 | 1 | 1 | 0.5000 | 0.3900 | -0.1100 | -0.2767 | 0.2146 |
| api_contract | 3 | 2 | 0 | 1 | 0.5000 | 0.2800 | -0.2200 | -0.2800 | 0.1571 |
| assertion_precision | 3 | 3 | 0 | 0 | 1 | 0.6667 | -0.3333 | 0.6667 | 0.3143 |
| backend_flow | 3 | 0 | 0 | 3 | 0.5000 | 0.5000 | 0 | 0.1667 | 0 |
| batching_fix | 3 | 0 | 0 | 3 | 0.3333 | 0.3333 | 0 | -0.3333 | 0 |
| behavior_coverage | 3 | 1 | 0 | 2 | 0.6667 | 0.4433 | -0.2233 | 0.4433 | 0.1571 |
| behavior_preservation | 6 | 3 | 0 | 3 | 0.5833 | 0.4450 | -0.1383 | 0.3883 | 0.1179 |
| circuit_breaker | 3 | 2 | 0 | 1 | 1 | 0.6667 | -0.3333 | 0.6667 | 0.2357 |
| conceptual_justification | 3 | 1 | 0 | 2 | 1 | 0.9433 | -0.0567 | 0.9433 | 0.0786 |
| contract_preservation | 3 | 1 | 0 | 2 | 0.3333 | 0.2233 | -0.1100 | 0.2233 | 0.3143 |
| coupling_reduction | 3 | 0 | 0 | 3 | 0.3333 | 0.3333 | 0 | 0.3333 | 0 |
| dependency_isolation | 3 | 0 | 0 | 3 | 0.1667 | 0.1667 | 0 | -0.1667 | 0 |
| determinism | 3 | 1 | 0 | 2 | 0.3333 | 0.2233 | -0.1100 | 0.2233 | 0.0786 |
| duplication_identification | 3 | 2 | 0 | 1 | 0.5000 | 0.1667 | -0.3333 | -0.1667 | 0.3143 |
| error_handling | 3 | 2 | 1 | 0 | 0.3333 | 0.1667 | -0.1667 | 0.0533 | 0.1571 |
| explanation | 3 | 0 | 1 | 2 | 0.6667 | 0.7767 | 0.1100 | 0.7767 | 0.1571 |
| function_extraction | 3 | 1 | 1 | 1 | 0.3333 | 0.3867 | 0.0533 | -0.1667 | 0.1571 |
| http_status_codes | 3 | 2 | 0 | 1 | 0.8333 | 0.6133 | -0.2200 | -0.1667 | 0.2357 |
| isolamento | 3 | 2 | 0 | 1 | 0.3333 | 0.1100 | -0.2233 | -0.1100 | 0.0786 |
| memory_join | 3 | 1 | 0 | 2 | 0.6667 | 0.5567 | -0.1100 | -0.5567 | 0.1571 |
| public_signature_preservation | 3 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 |
| reasoning | 6 | 1 | 0 | 5 | 0.6667 | 0.5550 | -0.1117 | 0.3883 | 0.0786 |
| responsibility_identification | 3 | 0 | 2 | 1 | 0.1667 | 0.3867 | 0.2200 | -0.3867 | 0.3143 |
| retry_e_dlq | 3 | 2 | 0 | 1 | 0.6667 | 0.3333 | -0.3333 | 0 | 0.2721 |
| retry_strategy | 3 | 1 | 1 | 1 | 0.6667 | 0.7200 | 0.0533 | 0.5000 | 0.1571 |
| root_cause | 6 | 1 | 1 | 4 | 0.3333 | 0.3600 | 0.0267 | 0.2500 | 0.1179 |
| root_cause_diagnosis | 3 | 0 | 0 | 3 | 0.5000 | 0.5000 | 0 | 0.5000 | 0 |
| teardown_implementation | 3 | 0 | 0 | 3 | 0.3333 | 0.3333 | 0 | 0 | 0 |
| test_structure | 3 | 0 | 1 | 2 | 0.5000 | 0.5567 | 0.0567 | 0.5567 | 0.0786 |
| timeout_fix | 3 | 0 | 0 | 3 | 0.1667 | 0.1667 | 0 | 0.1667 | 0 |
| tradeoffs | 3 | 0 | 3 | 0 | 0.5000 | 0.8300 | 0.3300 | -0.0567 | 0.3928 |
| ttl_and_tradeoffs | 3 | 0 | 3 | 0 | 1 | 1.3900 | 0.3900 | -0.2767 | 0.0786 |

## Signed Error

Overall mean signed error: single=0.1400, multi=0.0983. By this aggregate, multi_aggregate is more severe than single. Positive signed error means generosity; negative signed error means severity.

## Internal Dispersion

- low_dispersion_low_error: 15
- low_dispersion_high_error: 9
- high_dispersion_low_error: 0
- high_dispersion_high_error: 0
- unavailable: 0

Low dispersion with high error suggests common evaluator bias. High dispersion with high error suggests internal instability may have hurt the final score.

## Aggregation Loss

- Criterion comparisons with internal evaluations: 105
- Criteria where aggregate lost to at least one internal evaluator: 38
- Average aggregationLoss: 0.1157

This is a post-hoc diagnostic only. It does not imply that production could know which internal evaluator was best without expected scores.

## Main Cases Where Multi Lost To Single

| questionSlug | referenceAnswerId | profile | expected | single | multi | singleErr | multiErr | delta | severity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| intermediate-notification-dry-wrapper | intermediate-notification-dry-wrapper-misleading | misleading | 2.9 | 3 | 3.19 | 0.1 | 0.29 | 0.19 | moderate |
| intermediate-csv-user-import-modularity | intermediate-csv-user-import-modularity-weak | weak | 1.88 | 1.83 | 1.68 | 0.05 | 0.2 | 0.15 | moderate |
| intermediate-n-plus-one-queries | intermediate-n-plus-one-queries-misleading | misleading | 2.18 | 1.85 | 1.72 | 0.33 | 0.46 | 0.13 | moderate |
| intermediate-feature-flag-isolation | intermediate-feature-flag-isolation-misleading | misleading | 2.23 | 2.23 | 2.14 | 0 | 0.09 | 0.09 | small |
| advanced-idempotent-api-admissions | advanced-idempotent-api-admissions-strong | strong | 4.9 | 4.83 | 4.75 | 0.07 | 0.15 | 0.08 | small |
| advanced-idempotent-api-admissions | advanced-idempotent-api-admissions-medium | medium | 2.8 | 3.15 | 3.21 | 0.35 | 0.41 | 0.06 | small |
| intermediate-notification-dry-wrapper | intermediate-notification-dry-wrapper-medium | medium | 3.68 | 3.5 | 3.44 | 0.18 | 0.24 | 0.06 | small |

## Should we run multi_aggregate_v2?

I would not run `multi_aggregate_v2` now. The diagnostics do not show a strong enough pattern to justify another expensive multi run before consolidating the current results. Treat possible aggregation-rule improvements as future work.
