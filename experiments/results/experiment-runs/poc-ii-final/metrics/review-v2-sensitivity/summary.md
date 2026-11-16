# Review v2 Conservative Sensitivity Analysis

## Objective

This exploratory sensitivity run applies a conservative reviewer prompt to the frozen `review_v1` initial evaluations. It does not rerun `single`, does not rerun `multi_aggregate`, and does not replace the official main experiment.

## Scope

- Source experiment: `poc-ii-final`
- Prompt variant: `review-v2-conservative-audit`
- Planned review_v2 runs: 24
- Successful review_v2 runs: 24
- Failed review_v2 runs: 0
- Raw outputs: `experiments\results\experiment-runs\poc-ii-final\metrics\review-v2-sensitivity\raw`
- Captured model inputs: `experiments\results\experiment-runs\poc-ii-final\metrics\review-v2-sensitivity\openrouter-inputs`

## Strategy Comparison

| strategy | source | planned | success | successRate | overallMAE | meanSignedError | callCount | costCredits | avgLatencyMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| single | official | 24 | 24 | 1 | 0.2658 | 0.1400 | 24 | 0.0929 | 7006.5833 |
| review_v1 | official | 24 | 24 | 1 | 0.3092 | 0.1067 | 48 | 0.1822 | 12949.8333 |
| multi_aggregate | official | 24 | 24 | 1 | 0.2550 | 0.0983 | 72 | 0.2785 | 20195.7500 |
| review_v2_conservative | sensitivity | 24 | 24 | 1 | 0.2700 | 0.1442 | 24 | 0.0950 | 6195.6667 |

## Methodological Note

`review_v2_conservative` is an exploratory prompt-sensitivity ablation. It should be reported separately from the official `single`, `review_v1`, and `multi_aggregate` results.
