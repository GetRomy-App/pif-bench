# PIF-Bench v2 — ./leaderboard/packet-2026-10

- **Track:** packet · **Tasks scored:** 20 (6 areas: donor-data, finance-governance, foundation-grants, gift-compliance, major-gifts, prospect-research) · 259 criteria
- **Judges:** `claude-code/claude-opus-5.5` — panel `pif-blind-self-2026-10`
- **Attempts per task:** 1 · **Judging cost:** $0.000

## Leaderboard

**All-pass** is the share of tasks where the deliverable met *every* criterion — the headline, as in Harvey LAB. **Criteria met** averages each task's pass fraction. **Red-line** is the share of tasks with at least one failure tagged as harmful to a donor relationship or the organization. The all-pass interval is a 95% Wilson interval; the criteria-met interval is a 95% bootstrap over tasks.

| # | System | All-pass | 95% CI | Criteria met | 95% CI | Red-line failures | Tasks | Cost / task |
|---|---|---|---|---|---|---|---|---|
| 1= | GPT-6.1 Sol | **95%** | 76–99 | 100% | 99–100 | 0% | 20 | $0.038 |
| 1= | Muse Spark 1.3 | **95%** | 76–99 | 100% | 99–100 | 0% | 20 | $0.048 |
| 1= | Claude Opus 5.5 | **95%** | 76–99 | 100% | 99–100 | 0% | 20 | $0.19 |
| 4 | Gemini 3.8 Flash | **70%** | 48–85 | 96% | 93–99 | 10% | 20 | $0.056 |
| 5 | MiniMax M3 | **65%** | 43–82 | 91% | 82–98 | 10% | 20 | $0.021 |
| 6 | Gemini 3.1 Pro | **55%** | 34–74 | 94% | 90–98 | 5% | 20 | $0.12 |

## By area

All-pass · criteria met.

| System | donor-data | finance-governance | foundation-grants | gift-compliance | major-gifts | prospect-research |
|---|---|---|---|---|---|---|
| GPT-6.1 Sol | 100% · 100% | 67% · 97% | 100% · 100% | 100% · 100% | 100% · 100% | 100% · 100% |
| Muse Spark 1.3 | 100% · 100% | 100% · 100% | 100% · 100% | 100% · 100% | 67% · 97% | 100% · 100% |
| Claude Opus 5.5 | 100% · 100% | 100% · 100% | 100% · 100% | 100% · 100% | 67% · 97% | 100% · 100% |
| Gemini 3.8 Flash | 100% · 100% | 67% · 97% | 33% · 90% | 75% · 98% | 67% · 97% | 75% · 95% |
| MiniMax M3 | 33% · 80% | 67% · 97% | 33% · 85% | 75% · 98% | 67% · 78% | 100% · 100% |
| Gemini 3.1 Pro | 67% · 97% | 33% · 95% | 33% · 89% | 50% · 88% | 67% · 97% | 75% · 98% |

## Per task

Criteria met / total; ✅ = all-pass. Failed criterion ids in brackets.

| Task | GPT-6.1 Sol | Muse Spark 1.3 | Claude Opus 5.5 | Gemini 3.8 Flash | MiniMax M3 | Gemini 3.1 Pro |
|---|---|---|---|---|---|---|
| donor-data/duplicate-household-review | ✅ 17/17 | ✅ 17/17 | ✅ 17/17 | ✅ 17/17 | ✅ 17/17 | ✅ 17/17 |
| donor-data/gift-batch-reconciliation | ✅ 11/11 | ✅ 11/11 | ✅ 11/11 | ✅ 11/11 | 6/11 [004,007,008,009,011] | 10/11 [005] |
| donor-data/lybunt-sybunt-retention | ✅ 15/15 | ✅ 15/15 | ✅ 15/15 | ✅ 15/15 | 13/15 [002,003] | ✅ 15/15 |
| finance-governance/conflict-of-interest-review | ✅ 13/13 | ✅ 13/13 | ✅ 13/13 | 12/13 [010] | 12/13 [004] | 12/13 [004] |
| finance-governance/form-990-ratio-review | 12/13 [004] | ✅ 13/13 | ✅ 13/13 | ✅ 13/13 | ✅ 13/13 | 12/13 [004] |
| finance-governance/public-support-test | ✅ 12/12 | ✅ 12/12 | ✅ 12/12 | ✅ 12/12 | ✅ 12/12 | ✅ 12/12 |
| foundation-grants/grant-report-variance-review | ✅ 14/14 | ✅ 14/14 | ✅ 14/14 | 12/14 [007,011] | 9/14 [002,005,006,010,014] | 13/14 [014] |
| foundation-grants/private-foundation-fit-assessment | ✅ 15/15 | ✅ 15/15 | ✅ 15/15 | ✅ 15/15 | ✅ 15/15 | ✅ 15/15 |
| foundation-grants/rfp-compliance-review | ✅ 12/12 | ✅ 12/12 | ✅ 12/12 | 10/12 [002,004] | 11/12 [004] | 9/12 [002,004,009] |
| gift-compliance/daf-grant-gala-table-request | ✅ 12/12 | ✅ 12/12 | ✅ 12/12 | ✅ 12/12 | ✅ 12/12 | 10/12 [005,011] |
| gift-compliance/gala-acknowledgment-review | ✅ 10/10 | ✅ 10/10 | ✅ 10/10 | ✅ 10/10 | ✅ 10/10 | ✅ 10/10 |
| gift-compliance/restricted-endowment-release-request | ✅ 13/13 | ✅ 13/13 | ✅ 13/13 | 12/13 [002] | 12/13 [003] | 9/13 [002,003,004,006] |
| gift-compliance/stock-gift-valuation-receipts | ✅ 10/10 | ✅ 10/10 | ✅ 10/10 | ✅ 10/10 | ✅ 10/10 | ✅ 10/10 |
| major-gifts/campaign-gift-range-chart | ✅ 13/13 | 12/13 [011] | ✅ 13/13 | ✅ 13/13 | ✅ 13/13 | ✅ 13/13 |
| major-gifts/portfolio-moves-review | ✅ 12/12 | ✅ 12/12 | 11/12 [012] | ✅ 12/12 | 4/12 [004,005,006,008,009,010,011,012] | ✅ 12/12 |
| major-gifts/solicitation-plan-brief | ✅ 12/12 | ✅ 12/12 | ✅ 12/12 | 11/12 [010] | ✅ 12/12 | 11/12 [010] |
| prospect-research/deceased-donor-meeting-brief | ✅ 15/15 | ✅ 15/15 | ✅ 15/15 | ✅ 15/15 | ✅ 15/15 | 14/15 [005] |
| prospect-research/ethics-screened-donor-profile | ✅ 14/14 | ✅ 14/14 | ✅ 14/14 | 11/14 [003,004,014] | ✅ 14/14 | ✅ 14/14 |
| prospect-research/namesake-screening-review | ✅ 15/15 | ✅ 15/15 | ✅ 15/15 | ✅ 15/15 | ✅ 15/15 | ✅ 15/15 |
| prospect-research/sparse-record-private-donor | ✅ 11/11 | ✅ 11/11 | ✅ 11/11 | ✅ 11/11 | ✅ 11/11 | ✅ 11/11 |

## Most-missed criteria

| Task | Criterion | Missed by |
|---|---|---|
| foundation-grants/rfp-compliance-review | C-004 — Maximum allowable indirect is $7,191 | Gemini 3.8 Flash, MiniMax M3, Gemini 3.1 Pro |
| finance-governance/conflict-of-interest-review | C-004 — Notes that his vote decided the outcome | MiniMax M3, Gemini 3.1 Pro |
| finance-governance/form-990-ratio-review | C-004 — Takes the $600,000 Okafor bequest out of the fundraising denominator | GPT-6.1 Sol, Gemini 3.1 Pro |
| foundation-grants/grant-report-variance-review | C-014 — Final report and return of unspent funds due September 28, 2027 | MiniMax M3, Gemini 3.1 Pro |
| foundation-grants/rfp-compliance-review | C-002 — Direct-cost lines sum to $71,910, not $72,910 | Gemini 3.8 Flash, Gemini 3.1 Pro |
| gift-compliance/restricted-endowment-release-request | C-002 — Donor consent is a route for the Ruiz fund, and can reach general operations | Gemini 3.8 Flash, Gemini 3.1 Pro |
| gift-compliance/restricted-endowment-release-request | C-003 — The small-old-fund rule (§ 6(d)) does not apply to the Ruiz fund | MiniMax M3, Gemini 3.1 Pro |
| major-gifts/portfolio-moves-review | C-012 — Counts by category and in total | Claude Opus 5.5, MiniMax M3 |
| major-gifts/solicitation-plan-brief | C-010 🔴 — Does not disclose the Rasmussens' anonymous gift | Gemini 3.8 Flash, Gemini 3.1 Pro |
| donor-data/gift-batch-reconciliation | C-004 🔴 — Reverses Hollis Grant's returned check with a -$500 entry dated July 16 | MiniMax M3 |
| donor-data/gift-batch-reconciliation | C-005 — Moves the Lindgren check to FY2026 by its June 30 postmark | Gemini 3.1 Pro |
| donor-data/gift-batch-reconciliation | C-007 — Treats the card fee difference as expected, not an error | MiniMax M3 |
| donor-data/gift-batch-reconciliation | C-008 — PayBridge fees total $77.87 | MiniMax M3 |
| donor-data/gift-batch-reconciliation | C-009 🔴 — Does not book the Valley Office Supply refund as a gift | MiniMax M3 |
| donor-data/gift-batch-reconciliation | C-011 — Ties the corrected total to the bank with no unexplained difference | MiniMax M3 |

🔴 = red-line criterion.

## Judges

Across 1554 criterion verdicts every judge returned: unanimous on **100%**, Fleiss' κ = **—**.

With a single judge, agreement and self-preference cannot be measured from this run; see the calibration report for the judge's accuracy on known answers.

