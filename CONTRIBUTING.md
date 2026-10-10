# Contributing to PIF-Bench

PIF-Bench is built the way Harvey's Legal Agent Benchmark is: a task is real work, its rubric is a list of pass/fail checks a supervisor would make before the work goes out, and every check is written before any system is run. This guide is how to add or improve a task.

## Ground rules

- **Packet tasks are fiction.** Use synthetic people, organizations, foundations and companies. Real places and real laws are fine. Never use a real living person as a packet prospect, and never name a person after an AI system (Claude, Gemini, Rōmy …) — the blinding step would redact them.
- **The packet holds every rule it tests.** If a task applies a policy, a formula, a threshold or a tax rule, the rule is written into a document in the packet (the organization's gift-acceptance policy, its research standards, an excerpt of IRS guidance). The right answer must follow from the files plus ordinary professional reading and arithmetic — never from the author's or the judge's memory.
- **One task, one deliverable.** A single Markdown file, named in `deliverable`.
- **Live tasks are about real public figures** and are graded only on facts with a primary source, true as of the task's `as_of` date. They give the system no files.

## Anatomy of a task

```
tasks/<area>/<task-slug>/
├── task.json        instructions + rubric
├── documents/       the packet the system reads (Markdown, CSV, TSV, JSON, text)
├── references/      judge-only ground truth (live tasks; optional otherwise)
└── fixtures/
    ├── reference.md     a deliverable that passes every criterion
    ├── flawed.md        the same deliverable with a few planted errors
    └── expected.json    {"reference": {"fail": []}, "flawed": {"fail": ["C-004", …]}}
```

Areas: `prospect-research`, `foundation-grants`, `gift-compliance`, `major-gifts`, `donor-data`, `finance-governance` (packet track) and `live-prospects` (live track).

### `task.json`

| Field | Notes |
|---|---|
| `title` | What the work is, in a line. |
| `track` | `packet` or `live`. |
| `work_type` | `research`, `analyze`, `calculate`, `draft` or `review`. |
| `as_of` | The scenario's "today" (YYYY-MM-DD). Every date in the packet must be consistent with it. |
| `tier` | Prospect tasks only: `A` public philanthropist, `B` mid-profile, `C` private, `D` adversarial (namesakes, deaths, stale records). |
| `instructions` | The request, as a supervisor would write it: two to five sentences. Name the deliverable's purpose and reader. **Never hint at the traps.** |
| `deliverable` | Kebab-case `.md` filename. |
| `criteria` | 8–25 criteria, ids `C-001`, `C-002`, … in order. |

### A criterion

```json
{
  "id": "C-009",
  "title": "Largest documented gift is $15,000",
  "match_criteria": "PASS if the memo uses $15,000 (Granville Public Library Foundation, 2024) as the largest documented gift, giving a gift component of $45,000. FAIL if it uses any other figure — such as $20,000 (Denison, 2019) …",
  "sources": [],
  "red_line": false
}
```

- **`match_criteria` must say `PASS if …` and `FAIL if …`.** Name the exact figure, date, person or document. Name the likely wrong answers in the FAIL clause — that is what makes a judge consistent.
- **Binary and self-contained.** A judge reading only the deliverable and this text must be able to decide. If the judge needs the packet to decide (for example "attributes nothing that appears in no file"), list those files in `sources`.
- **No padding.** Every criterion is launch-critical under all-pass scoring. If a supervising development officer would not send the work back for it, leave it out. Never grade length, tone or formatting unless the assignment demands it.
- **One error, few criteria.** Test a computation's key inputs and its result, not every intermediate line, so a single slip does not fail five criteria.
- **`red_line: true`** for criteria whose failure would harm a donor or the organization: soliciting someone who has died, merging two people, crediting a gift that was someone else's, inventing a fact, breaching the privacy policy, issuing a receipt that misstates deductibility. It is reported, never weighted.
- **Live criteria** carry `evidence`: one or more primary-source URLs for the fact.

### Traps

A good packet task has two to four traps — places where a careless but fluent answer goes wrong — each tied to a criterion: a namesake, a stale record superseded by a newer one, a sold asset, a gift outside a window, a donor-list range, a document dated after the event it describes, a policy exception, a sensitive detail that policy says to leave out, a question the files cannot answer. Put distractors in the packet too; real files are messy.

### Fixtures — the judge self-test

`fixtures/reference.md` is a deliverable you would sign: it must pass every criterion. `fixtures/flawed.md` is the same deliverable with three to six planted errors; `expected.json` lists exactly the criteria those errors fail. Everything else in the flawed file stays right, so the self-test checks that judges *pass* correct work as well as fail wrong work. `bun pif calibrate` grades both with every judge and reports accuracy; a criterion that judges get wrong is rewritten, not excused.

## Checklist before you open a pull request

1. Recompute every number in the rubric with a script, from the packet alone.
2. Read the packet as a hurried model would: is any criterion answerable two ways? Tighten it.
3. `bun pif validate` — no errors.
4. `bun test` — green.
5. `bun pif calibrate --run <name> --tasks <your-task>` — the panel scores 100% on your fixtures, or you have fixed the criterion it missed.
