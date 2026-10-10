# Blind judging, October 2026

The record of how the 2026-10 leaderboards were graded, kept so the blinding can be checked.

- `judge-brief.md` — the instructions every judge agent received, word for word (each also got the paths of its own packets).
- `batches.json` — which packets each of the 19 judge agents graded. No batch holds two answers to the same task.
- `verdicts/` — every verdict file exactly as a judge wrote it: one per packet, a pass/fail and reasoning per criterion.
- `key.json` — packet id → system, task and attempt, with the hash of the deliverable each packet was made from and the grading-protocol hash. **Judges never saw it.** `meta.seed` is the random seed the export used (this release's ids were derived from the grading machine's absolute paths; exports made with the current harness use repo-relative paths, so a seed reproduces them in any checkout).

186 packets: 120 packet-track deliverables, 16 live-track reports, and all 50 fixtures (each task's reference and flawed deliverable) mixed in unmarked.

**Accuracy on the hidden fixtures:** 662 of 662 verdicts matched the answer key (`../calibration-2026-10/calibration.pif-blind-self-2026-10.md`).

**Test-retest:** an earlier, independent blind judging of the 66 live and fixture deliverables (made before the blinding also stripped citation tracking tags) agreed with this one on 894 of 898 criterion verdicts — 99.6%, Cohen's κ = 0.987. All four disagreements were this judging failing a criterion the earlier one passed.
