# PIF-Bench

**How often does an AI system do nonprofit development work completely right?**

PIF-Bench v2 grades AI systems on the work a development office actually does: verify a wealth-screening match, brief a gift officer whose donor has died, receipt a gala, value a year-end stock gift, read a funder's 990-PF, check a grant proposal against its RFP, reconcile a gift batch, run the Schedule A public support test, research a public philanthropist. It is built on the design of Harvey's [Legal Agent Benchmark](https://github.com/harveyai/harvey-labs): every task carries a rubric of pass/fail checks written before any system runs, a panel of judges from three model families grades each check on its own, and the headline is the share of tasks a system gets **entirely** right.

- **Method:** [METHODOLOGY.md](METHODOLOGY.md) — and what changed from v1, and why
- **Write a task:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **v1 (April 2026), archived:** [docs/v1/README.md](docs/v1/README.md)
- **Maintained by:** [Rōmy](https://getromy.app) — which builds one of the systems PIF-Bench can grade; everything needed to check the results without trusting us is in this repository

## Results — October 2026

Graded by a blind agent judge (see [leaderboard/README.md](leaderboard/README.md)): on every task's hidden reference and flawed fixtures it returned 662 of 662 verdicts correctly, and an independent second judging of the live reports and fixtures agreed on 99.6% of 898 verdicts (κ = 0.987). Full reports, every deliverable and every verdict with its reasoning are in [`leaderboard/`](leaderboard/).

**Packet track** — 20 tasks, 259 criteria, one attempt per model ([report](leaderboard/packet-2026-10/report.md))

| # | System | All-pass | 95% CI | Criteria met | Red-line failures |
|---|---|---|---|---|---|
| 1= | GPT-6.1 Sol | **95%** | 76–99 | 100% | 0% |
| 1= | Muse Spark 1.3 | **95%** | 76–99 | 100% | 0% |
| 1= | Claude Opus 5.5 | **95%** | 76–99 | 100% | 0% |
| 4 | Gemini 3.8 Flash | **70%** | 48–85 | 96% | 10% |
| 5 | MiniMax M3 | **65%** | 43–82 | 91% | 10% |
| 6 | Gemini 3.1 Pro | **55%** | 34–74 | 94% | 5% |

The three leaders each missed one criterion in 259, so the packet track does not separate them; it does separate them from the rest, whose misses include a wrong indirect-cost cap on a grant budget, a restricted-endowment memo that skipped the donor-consent route, and a solicitation brief that repeated another donor's confidential gift. The next task set needs to be harder.

**Live track** — the 16 reports four products wrote on 2026-04-25 for v1, re-graded blind against facts true that day ([report](leaderboard/live-2026-04-25/report.md))

| # | System (April 2026) | All-pass | Criteria met | 95% CI |
|---|---|---|---|---|
| 1 | Claude.ai — Opus 4.7 Adaptive | 0% | 83% | 76–87 |
| 2 | Rōmy — Deep Research | 0% | 74% | 71–79 |
| 3 | Gemini app — 3.1 Pro | 0% | 67% | 54–81 |
| 4 | ChatGPT — GPT-5.3 | 0% | 60% | 50–71 |

No report met every criterion for any prospect. Every system contradicted the verified fact sheet somewhere (a stale role or holding, a wrong year, a superseded net worth), which is a red-line criterion — so the live red-line rates (75–100%) mostly count factual slips, not harmful advice. Four tasks is a small sample: the intervals overlap. Two caveats on this April data: the MacKenzie Scott outputs from v1 were not kept, so that task is unscored; and the Claude.ai reports mention Rōmy by name although the prompts never did, so that run appears to have had Rōmy project context and is not a clean product run.

**v1 vs v2.** v1 published Rōmy 94.1, Claude 92.3, Gemini 79.1, ChatGPT 76.9 on the same April reports (plus Scott). Under v2's pre-registered, blind, criterion-level grading, Gemini and ChatGPT still trail, Claude.ai now leads Rōmy, and no system is anywhere near "94% accurate": the best met 83% of the checks.


## What's in it

| | Tasks | Criteria | What the system gets |
|---|---|---|---|
| **Packet track** (headline) | 20 tasks in six areas | 259 | A packet of synthetic records and policies, a date, and a request |
| **Live track** | 5 public philanthropists | 72 | The request only; it researches on its own |

**Packet areas:** prospect research (4), foundation & grants (3), gift compliance (4), major gifts (3), donor data (3), finance & governance (3). Every packet prospect, donor and organization is fictional, so a system can only answer by reading the files — and every rule a task applies (a capacity formula, a receipting policy, a UPMIFA excerpt, an RFP) is written into the packet, so the right answer is not a matter of opinion.

**Live track:** MacKenzie Scott, Reed Hastings, Agnes Gund, Laurene Powell Jobs and Robert F. Smith, each paired with a requesting organization — the five prompts from v1. Criteria are facts true on 2026-04-25, each with primary-source evidence, plus red lines that follow from them (for example: Agnes Gund died in September 2025, so a report that recommends soliciting her fails).

Each task is a directory:

```
tasks/gift-compliance/stock-gift-valuation-receipts/
├── task.json        instructions + 10 pass/fail criteria
├── documents/       transfer notices, a price table, sale confirmations, the policy
└── fixtures/        a reference deliverable, a flawed one, and which criteria the flaws must fail
```

A criterion looks like this:

```json
{
  "id": "C-002",
  "title": "Marchetti gift valued at $25,068.00",
  "match_criteria": "PASS if the Marchetti gift is valued at $25,068.00: 400 shares × $62.67, the mean of QPXI's high ($63.48) and low ($61.86) on 2026-01-02. FAIL if the gift value is any other figure — such as $24,820.00 (the $62.05 closing price), $24,584.00 (the 2025-12-29 mean), … $25,240.00 (the sale principal) or $25,215.00 (sale proceeds net of commission)."
}
```

## How it is graded

1. **One criterion per judge call**, so no check colours another, and every verdict carries written reasoning that is stored with the result.
2. **A panel from three model families** (`panel.json`); a criterion passes on a strict majority, and a judge error never counts as a pass.
3. **Blind:** names of AI systems and vendors are replaced with "[the assistant]" before a judge reads a deliverable.
4. **All-pass is the headline:** a task scores 1 only if every criterion passed. Criteria met and red-line failures are reported beside it, with 95% bootstrap intervals over tasks.
5. **The judges are tested too:** each task's reference deliverable must pass every criterion and its flawed deliverable must fail exactly the planted errors. Every report includes judge agreement (Fleiss' κ, pairwise Cohen's κ) and a self-preference check.

## Run it

Requires [Bun](https://bun.sh) and an [AI Gateway](https://vercel.com/ai-gateway) key (`AI_GATEWAY_API_KEY`, or a `VERCEL_OIDC_TOKEN` from `vercel env pull`).

```bash
bun install
bun pif validate                                   # offline integrity check of every task (CI runs this)
bun test                                           # offline test suite — no model calls
bun pif estimate --tasks packet                    # what a run will cost, before you spend anything

bun pif run --run my-run --tasks packet --candidates claude-opus-5.5,gpt-6.1-sol
bun pif grade --run my-run --tasks packet
bun pif report --run my-run --tasks packet         # writes results/my-run/report.md and report.json

bun pif calibrate --run my-calibration --tasks all # judge accuracy on every task's fixtures
```

**Grading a product** (Rōmy, ChatGPT, Claude.ai, Gemini — anything you run by hand): `bun pif prompt <task-id>` prints exactly what to give it. Save each answer as `<task-id>.md` (or with `__` for `/`), then:

```bash
bun pif import --run my-run --candidate my-product --from ./answers --collected-at 2026-10-10
bun pif grade --run my-run --tasks live
```

Add the product to `candidates.json` (with its model `family`) so the report can label it and run the self-preference check.

## Repository

| Path | What |
|---|---|
| `tasks/` | The benchmark: one directory per task |
| `src/` | Harness: schema, loader, integrity checks, runner, judge, scoring, statistics, reports, CLI |
| `tests/` | Offline tests (scoring math, statistics, prompts, blinding, integrity, an end-to-end run with a fake model) |
| `panel.json`, `panels/` | The standard judge panel, and alternates measured against it |
| `candidates.json` | Systems the harness can run or label |
| `leaderboard/` | Published runs: every deliverable, every judge's verdict and reasoning, and the report |
| `paper/` | The v1 paper (LaTeX) |

## License

CC BY 4.0 — see [LICENSE](LICENSE).
