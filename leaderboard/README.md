# Published runs

Every number PIF-Bench publishes is rebuilt from the files in these directories: the deliverables exactly as the systems wrote them, every judge's verdict with its written reasoning, and the report. Nothing is summarized by hand.

| Directory | What | Graded by |
|---|---|---|
| [`packet-2026-10/`](packet-2026-10/) | Six models on the 20 packet tasks, one attempt each, run through the AI Gateway on 2026-10-10 with the standard candidate prompt | Blind agent judge (see below) |
| [`live-2026-04-25/`](live-2026-04-25/) | The 16 donor reports four products wrote on 2026-04-25 for PIF-Bench v1 (Rōmy, Claude.ai, ChatGPT, Gemini × Hastings, Gund, Powell Jobs, Smith), split verbatim — provenance in `provenance.json` | Blind agent judge |
| [`calibration-2026-10/`](calibration-2026-10/) | Every task's reference and flawed fixtures, graded by the blind agent judge (current) and, during rubric development, by the three-family and budget gateway panels ([HISTORY.md](calibration-2026-10/HISTORY.md)) | All three |
| [`blind-judging-2026-10/`](blind-judging-2026-10/) | The judge brief, the batch plan, every raw verdict file, and the packet-id → system key the judges never saw | — |

Rebuild any report:

```bash
bun pif report --run ./leaderboard/packet-2026-10 --tasks packet --panel panels/blind-self.json
bun pif report --run ./leaderboard/live-2026-04-25 --tasks live --panel panels/blind-self.json
bun pif calibrate --run ./leaderboard/calibration-2026-10 --tasks all --report-only --panel panels/blind-self.json
```

## How this release was graded

The standard panel (`panel.json`) — one judge each from Anthropic, OpenAI and Google, called through the gateway — was used to calibrate the rubrics. The leaderboards in this release were graded instead by a **blind agent judge**: fresh Claude Opus 5.5 agents in Claude Code, working through `pif judge-export` / `pif judge-import`:

- Each deliverable became a grading packet under a random id; the id → system key was kept apart and never shown to a judge.
- Names of AI systems and vendors, and per-product citation tags (`utm_source=…`), were removed before export.
- Packets were dealt into batches so no judge ever saw two answers to the same task, and written in shuffled order with one timestamp.
- Every task's reference and flawed fixtures were mixed into the same pool, unmarked, so the judge's accuracy on known answers was measured under exactly the conditions it graded the real deliverables.

**On the April live data.** The Claude.ai reports mention Rōmy by name although the prompts never did, so that run appears to have had Rōmy project context; it is not a clean product run. The MacKenzie Scott reports from v1 were not kept, so that task is unscored.

**Limitation.** The judge is a Claude model, and Claude Opus 5.5 is also one of the graded systems (and Claude.ai one of the April products). Blinding, binary criteria with named figures, and fixture calibration limit the room for favouritism but cannot rule it out; a single-family judge cannot measure self-preference. Grading the same deliverables with the three-family panel is one command (`bun pif grade`) for anyone with a gateway key, and every verdict here carries its reasoning for audit.
