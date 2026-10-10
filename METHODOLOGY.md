# PIF-Bench v2 — Methodology

PIF-Bench measures how often an AI system does a piece of nonprofit development work **completely right**: research a prospect, verify a screening match, receipt a gala, read a funder's 990-PF, reconcile a gift batch, size an ask. Version 2 replaces v1's holistic 0–100 scores with the design of Harvey's [Legal Agent Benchmark](https://github.com/harveyai/harvey-labs) (LAB): real tasks, rubrics of pass/fail checks written before any system runs, independent LLM judges, and an all-pass headline.

## 1. Tasks

A task is a directory: instructions, a packet of source documents, an inline rubric, and a judge self-test (see [CONTRIBUTING.md](CONTRIBUTING.md)).

**Two tracks, never blended.**

| | Packet track (headline) | Live track |
|---|---|---|
| Subject | Synthetic prospects, donors and organizations | Real public philanthropists |
| What the system gets | The task's files, a date, the request | The request only — it researches on its own |
| Ground truth | Known by construction: every fact is in the packet, every rule in a policy document | Facts true and public on the task's `as_of` date, each with a primary source |
| Who can run it | Any model, through the API harness | Products with web research (Rōmy, ChatGPT, Claude.ai, Gemini), collected by hand and imported |
| Reproducible | Fully | Pinned to a date; facts can be re-checked against the cited sources |

The packet track is the headline because it is the only setting in which the right answer is not in dispute. It also removes the largest confound in v1, where every prospect was a celebrity whose facts sit in model training data: a packet prospect exists nowhere else, so a system can only answer by reading.

**Areas** (packet track): prospect research, foundation & grants, gift compliance, major gifts, donor data, finance & governance. Each task carries two to four *traps* — places where fluent but careless work goes wrong (a namesake, a sold property, a gift outside a window, a donor who has died, a donor-advised-fund grant asked to pay for gala seats) — each tied to a criterion.

## 2. Rubrics

Each criterion is a binary check with explicit `PASS if … / FAIL if …` language, naming exact figures and the likely wrong answers. Criteria are equally weighted. There are no dimension weights to choose and no 0–100 judgments to make.

A criterion may be tagged **red-line** when its failure would harm a donor relationship or the organization — soliciting someone who has died, merging two people, crediting someone else's gift, inventing a fact, breaching a privacy rule, overstating a deduction. Red-line tags change nothing in the score; they are reported beside it.

Rubrics are fixed before systems run. Every grade records exactly what it was made against — the task's rubric hash, the judge model, a hash of the deliverable's text and the grading protocol (judge prompt, message template and blinding rules) — and a grade that no longer matches any of them is redone, never reused. Every deliverable records the hash of the prompt it was produced from; a deliverable made from an older prompt is regenerated, not graded.

## 3. Grading

- **One criterion per judge call.** The judge sees the assignment, the deliverable and one criterion (plus any packet files the criterion names as ground truth). No criterion can colour another's verdict, and every verdict carries its own written reasoning, stored with the result.
- **A panel from three model families** — Anthropic, OpenAI and Google by default (`panel.json`). A criterion passes when a strict majority of the panel passes it. A judge error is never a pass. No single vendor's judge can decide a verdict alone.
- **Blind.** Before a judge reads a deliverable, names of AI systems and vendors are replaced with "[the assistant]". House styles can still give a system away, which is why criteria test content, never format, and why every report prints a self-preference check (below).
- **Deterministic settings.** Temperature 0 where the model accepts it; otherwise the provider default, recorded in `panel.json`.

## 4. Scores

| Metric | Definition | Role |
|---|---|---|
| **All-pass rate** | Share of tasks where the deliverable met every criterion | Headline (as in LAB) |
| Criteria met | Mean over tasks of each task's passed ÷ total | Diagnostic: how close a system came |
| Red-line failure rate | Share of tasks with at least one red-line criterion failed | Diagnostic: how often it could do harm |

Attempts are averaged within a task before tasks are averaged, so every task counts the same however many criteria or runs it has. Every system is scored on the same set of tasks: a system with no deliverable for a task — a failed or skipped generation — scores 0 on it, so leaving out a hard task can never help. A system with ungraded work, a judge error, or a deliverable from an older prompt is listed as *not ranked* rather than scored on what happens to be complete.

The all-pass rate carries a 95% Wilson interval (tasks score 0 or 1); criteria met carries a 95% bootstrap interval over tasks (10,000 resamples, fixed seed, tasks in id order so any rebuild prints the same interval). Percentages are printed as whole numbers; with a few dozen tasks, a decimal place would claim precision the data does not have.

## 5. Checking the judges

**Calibration.** Every task ships a reference deliverable that must pass every criterion and a flawed deliverable with three to six planted errors that must fail exactly the listed criteria. `pif calibrate` grades both with every judge and the panel and reports accuracy, false passes (a planted error waved through — the dangerous direction) and false fails. A criterion the judges get wrong is rewritten.

**Agreement.** Every report gives the share of unanimous verdicts, Fleiss' κ for the panel and Cohen's κ for each pair of judges.

**Self-preference.** For each judge, the report computes how much more that judge passes its own family's system than the judges from *other* families do, minus the same lift on neutral systems (families with no judge on the panel). The baseline never includes a same-family judge, so one biased judge cannot make an unbiased one look biased. A value near zero means no measurable favouritism. It needs judges from at least two families and at least one neutral system.

**External judges.** People — or agents outside the harness — grade through `pif judge-export` and `pif judge-import`: one Markdown packet per deliverable under a random id, the id → system key kept apart, packets dealt so no judge sees two answers to the same task, written in shuffled order with one timestamp, and every task's fixtures mixed in unmarked so the judges' accuracy is measured under the same conditions as their real grading. A verdict file that misses, repeats or invents a criterion — or arrives for a deliverable that has since changed — is rejected whole.

## 6. What changed from v1, and why

| v1 | Problem | v2 |
|---|---|---|
| Seven dimensions scored 0–100 by one model session | Not reproducible; no published claim lists behind the numbers | Binary criteria, each verdict with written reasoning, all stored |
| Factual Precision (20%) and Hallucination Rate (25%) | Two measures of the same thing — 45% of the weight | Specific fact criteria and red-line "invents nothing" criteria |
| Capacity Estimation Accuracy vs "verified actuals" | No verified capacity exists for a living donor | Capacity is graded only where the packet defines the formula, so the right figure is computable |
| Structural Completeness (section checklist) | Rewarded a house format; a 16-section report scored 100 by construction | No format criteria; criteria test content |
| Source Attribution (share of claims with citations; hyperlinks praised) | Rewarded formatting, not whether a source supports the claim | Citation criteria name the file that must be cited for a specific fact |
| Ground truth for recall built after reading outputs | Circular: the best output defines the answer key | Rubrics fixed before any run; live rubrics written from primary sources by authors who never saw the outputs |
| One judge, same family as a contestant | Self-preference cannot be ruled out | Three-family panel, majority vote, blinded, with a self-preference check |
| Hand-set dimension weights (25/20/15/15/10/10/5) | The weights decide the ranking, and no data supports one choice over another | No weights: every criterion counts once |
| Cost per report vs monthly subscriptions | Not comparable units | Measured API cost per task for API runs; no subscription arithmetic |
| n = 5 celebrities | Tests recall from training data, not research | Synthetic packet prospects that exist nowhere else; live track reported separately |
| Two decimal places on n = 5 | False precision | Whole-number percentages with bootstrap intervals |

## 7. Threats to validity

- **LLM judges are not people.** Calibration measures their accuracy on known answers; it cannot prove they generalize to every deliverable. Reasoning for every verdict is stored so any grade can be audited, and human review of disputed verdicts is the next step.
- **Author knowledge.** Packet rules are written by the benchmark's authors. Each rule is stated in the packet, so a reader can disagree with a rule but not with whether a deliverable applied it.
- **Developer conflict.** PIF-Bench is maintained by Rōmy, which builds one of the systems it can grade. The rubrics, judges, prompts, raw outputs and grades are all published so the results can be checked without trusting the maintainer.
- **Live-track drift.** Facts change. Live tasks are pinned to an `as_of` date and graded only on facts true then; a product run later is compared against the same date, so a re-run can be penalised for recency. Re-pin and re-source a live task before reusing it on a new date.
- **Single-turn.** Tasks are one request, one deliverable. Real work is iterative.
