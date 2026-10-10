# Calibration history — gateway judge panels (2026-10-10)

While the rubrics were being built, every task's reference and flawed fixtures were graded by two gateway judge panels. The grade files, with every verdict's reasoning, are kept under `grades/` (judges `claude-sonnet-5.5`, `gpt-6.1-sol`, `gemini-3.1-pro`, `claude-haiku-5.5`, `gpt-6-luna`, `gemini-3.8-flash`). They predate the grading-protocol hash added later that day, so `pif calibrate --report-only` now treats them as stale; the numbers below are as the harness reported them at the time. Re-running them under the current protocol is `bun pif calibrate --run ./leaderboard/calibration-2026-10 --tasks all` (about $15) and `… --panel panels/alternates.json` (about $3).

Accuracy is the share of verdicts matching `fixtures/expected.json`; a *false pass* is a planted error a judge let through.

| Rubric state | Judge | Verdicts | Accuracy | False passes |
|---|---|---|---|---|
| First pass (24 tasks) | Claude Sonnet 5.5 | 630 | 99.5% | 0 |
| | Gemini 3.1 Pro | 630 | 99.7% | 0 |
| | GPT-6.1 Sol | 630 | 99.0% | 0 |
| | **Panel (majority)** | 630 | **99.5%** | 0 |
| After fixing overlapping no-invention criteria (25 tasks) | Claude Sonnet 5.5 | 662 | 100.0% | 0 |
| | Gemini 3.1 Pro | 662 | 99.8% | 0 |
| | GPT-6.1 Sol | 662 | 99.5% | 0 |
| | **Panel (majority)** | 662 | **100.0%** | 0 |
| Budget panel, same state | Claude Haiku 5.5 | 662 | 99.4% | 1 |
| | Gemini 3.8 Flash | 662 | 100.0% | 0 |
| | GPT-6 Luna | 662 | 98.2% | 2 |
| | **Panel (majority)** | 662 | **99.7%** | 0 |
| Final rubric, the 16 tasks unchanged since | Claude Sonnet 5.5 · Gemini 3.1 Pro · GPT-6.1 Sol | 420 each | 100.0% each | 0 |
| | Claude Haiku 5.5 · Gemini 3.8 Flash | 420 each | 100.0% each | 0 |
| | GPT-6 Luna | 420 | 99.5% | 2 |

What calibration changed in the rubrics: the remaining misses after the first pass were all judges failing a *correct* fixture on a criterion that a planted error elsewhere had legitimately tripped (overlapping "invents nothing" criteria) or that could only be judged against packet files the criterion did not list. Those criteria were scoped and given the whole packet — see the integrity rule in `src/integrity.ts` — after which the three-family panel scored 100%.
