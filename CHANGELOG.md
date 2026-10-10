# Changelog

Scores are comparable only within the same major version and the same task hashes (`bun pif list` prints each task's hash; every stored grade records the hash it was made against).

## 2.0.0 — 2026-10

A rebuild on the design of Harvey's Legal Agent Benchmark. v1 scores are not comparable with v2.

**Tasks**
- 20 packet-track tasks in six areas (prospect research, foundation & grants, gift compliance, major gifts, donor data, finance & governance), with synthetic records and every rule they apply written into the packet.
- 5 live-track tasks — the v1 prompts for MacKenzie Scott, Reed Hastings, Agnes Gund, Laurene Powell Jobs and Robert F. Smith — graded on facts true on 2026-04-25, each with primary-source evidence, from rubrics written without sight of any system's output.
- Every task ships a reference and a flawed deliverable as its own judge self-test.

**Grading**
- Binary `PASS if … / FAIL if …` criteria replace v1's seven weighted 0–100 dimensions.
- One judge call per criterion; a three-family panel (Anthropic, OpenAI, Google) by majority; blinded deliverables; a judge error is never a pass.
- All-pass rate is the headline; criteria met and red-line failures are diagnostics; a 95% Wilson interval on all-pass and a 95% bootstrap interval over tasks on criteria met. Every system is scored on the same tasks — missing work scores 0 — and a system with ungraded, errored or stale work is not ranked.
- Calibration (judge accuracy on the fixtures), inter-judge agreement and a self-preference check in every report.
- Every grade records the rubric hash, the judge model, a hash of the deliverable text and the grading protocol it was made under; a grade that no longer matches is redone, never reused.
- External judges (people or agents) grade blinded packets through `judge-export` / `judge-import`.

**Harness**
- TypeScript on Bun, models through the Vercel AI Gateway: `validate`, `list`, `prompt`, `estimate`, `run`, `import`, `grade`, `report`, `calibrate`.
- Offline test suite and task-integrity checks in CI.

**First published runs** (`leaderboard/`)
- Packet track: six models (Claude Opus 5.5, GPT-6.1 Sol, Gemini 3.1 Pro, Gemini 3.8 Flash, MiniMax M3, Muse Spark 1.3), one attempt each.
- Live track: the 16 April 2026 product reports from v1, re-graded under the live rubrics.
- Graded by a blind agent judge through `pif judge-export` / `pif judge-import`: 662/662 on the hidden fixtures, 99.6% test-retest agreement.

**Paper**
- `paper/pif_bench.tex` (and PDF) rewritten for v2: design, grading protocol, judge calibration, both tracks' results, v1 vs v2 on the same reports, limitations. The v1 paper remains at commit `845964c`.

**Removed from v1**
- Structural Completeness (rewarded a house format), hyperlink-based Source Attribution, capacity accuracy against unknowable "actuals", hand-set weights, and the cost-per-score table that divided per-report prices by monthly subscriptions. See [METHODOLOGY.md](METHODOLOGY.md#6-what-changed-from-v1-and-why).

## 1.0.0 — 2026-04-25

The original seven-dimension PIF-Bench; see [docs/v1/README.md](docs/v1/README.md).
