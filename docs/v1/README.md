# PIF-Bench v1 (April 2026) — archived

> **Superseded by PIF-Bench v2** — see the [README](../../README.md) and [METHODOLOGY.md](../../METHODOLOGY.md) for what changed and why. Below is the v1 write-up as published (only its links were updated), kept as the record of the v1 method and its scores.

**Prospect Intelligence Fidelity Benchmark** — a seven-dimension framework for evaluating AI-generated donor research against verified public records.

- **Paper:** [`paper/pif_bench.tex`](../../paper/pif_bench.tex)
- **Blog post:** https://getromy.app/labs/blog/benchmarking-ai-prospect-research (that address now carries the v2 write-up; the v1 text is below)
- **Maintained by:** [Rōmy](https://getromy.app)

The full write-up below is a copy of the blog post linked above. The LaTeX source for the academic paper version lives in [`paper/`](../../paper/).

---

# PIF-Bench: Benchmarking AI Donor Research

Every AI system can produce a donor research report. ChatGPT, Claude, Gemini, Grok — give any of them a name and ask for prospect intelligence, and you'll get something that looks plausible. But "looks plausible" is dangerous in fundraising. A fabricated board membership or an inflated giving estimate doesn't just waste time — it damages donor relationships.

We needed a way to measure which systems produce reports you can actually trust. No existing benchmark tests AI for prospect research fidelity. So we built one.

## Why existing benchmarks don't work

Most AI benchmarks measure general reasoning, code generation, or factual recall from training data. None of them test the specific task that matters for fundraising: taking a person's name and producing an accurate, actionable donor intelligence profile.

The closest analogues — factual QA benchmarks like TriviaQA or biographical datasets — don't measure what fundraisers need. They don't test giving capacity estimation, wealth indicator accuracy, or whether the system can distinguish between two people named "Michael Johnson."

## PIF-Bench: Prospect Intelligence Fidelity Benchmark

PIF-Bench is a seven-dimension evaluation framework built on verified public records. It tests what matters for fundraising professionals: can you trust this report enough to make an ask?

### The seven dimensions

Each AI system's output is scored on seven dimensions, each 0-100:

**1. Factual Precision (FP) — Weight: 20%**
What percentage of stated facts are correct when verified against public records? A report that says "Jane Doe owns a $2.1M property in Palo Alto" is checked against county assessor records.

**2. Discovery Recall (DR) — Weight: 10%**
What percentage of known facts about the prospect did the system find? If the ground truth contains 12 verified data points and the system found 8, recall is 67%.

**3. Hallucination Rate (HR) — Weight: 25%**
What percentage of claims are fabricated, conflated with another person, or unverifiable? This carries the highest weight because fabricated information is the most damaging failure mode in fundraising. Score is inverted (100 minus hallucination percentage).

**4. Capacity Estimation Accuracy (CEA) — Weight: 15%**
How close is the system's giving capacity estimate to verified actuals? Systems without explicit capacity estimates receive a zero.

**5. Source Attribution (SA) — Weight: 10%**
What percentage of factual claims include a traceable source citation?

**6. Structural Completeness (SC) — Weight: 5%**
Does the output cover the sections a fundraiser needs? Evaluated against a checklist: wealth indicators, giving history, professional background, philanthropic interests, connection points, and recommended approach.

**7. Actionability (ACT) — Weight: 15%**
Could a fundraiser make a qualified ask based solely on this report within 30 days?

### Composite formula

```
PIF = (FP x 0.20) + (DR x 0.10) + (HR x 0.25) + (CEA x 0.15) + (SA x 0.10) + (SC x 0.05) + (ACT x 0.15)
```

Hallucination rate carries the highest weight (25%) because fabricated information is the most damaging failure mode in fundraising.

## Test protocol

### The prompt

All systems received the identical prompt:

> Research MacKenzie Scott as a potential major donor prospect for a mid-sized education nonprofit based in Atlanta, Georgia. Provide a comprehensive donor intelligence report including:
>
> 1. Personal and professional background
> 2. Wealth indicators and asset profile
> 3. Known philanthropic giving history with specific amounts and recipient organizations
> 4. Cause areas and giving philosophy
> 5. Estimated giving capacity for a single gift to an education nonprofit
> 6. Recommended ask amount and engagement strategy
> 7. Key connection points and potential red flags
>
> Cite your sources for every factual claim.

### Why MacKenzie Scott

This prospect was chosen for the initial benchmark because she is a Tier A (Public Philanthropist) case with extensive verifiable records:

- **IRS/public records**: $26+ billion in documented giving to 2,700+ organizations since 2019
- **SEC filings**: Amazon stock transactions and beneficial ownership are public
- **Media coverage**: Extensive reporting on specific gift amounts and recipients
- **Philosophy documentation**: Multiple published essays explaining her approach

The real test is whether systems understand her giving model. Scott famously does not accept solicitations — she finds organizations through her own research network (Bridgespan/Lever for Change). Any system that recommends a standard cold outreach fails the actionability dimension.

### Systems tested

| System | Configuration | Date tested |
|---|---|---|
| Romy | Deep research mode | April 25, 2026 |
| Claude | Opus 4.7 Adaptive | April 25, 2026 |
| ChatGPT | GPT 5.3 | April 25, 2026 |
| Gemini | 3.1 Pro | April 25, 2026 |

All responses were collected in full, unedited, and scored against verified public records.

## Results

### Composite PIF-Scores

| System | FP | DR | HR | CEA | SA | SC | ACT | PIF-Score |
|---|---|---|---|---|---|---|---|---|
| **Romy** | 94 | 97 | 94 | 92 | 95 | 100 | 95 | **94.6** |
| **Claude** | 95 | 92 | 95 | 90 | 82 | 92 | 93 | **92.2** |
| **ChatGPT** | 88 | 65 | 90 | 72 | 82 | 75 | 70 | **79.9** |
| **Gemini** | 83 | 72 | 86 | 60 | 72 | 70 | 73 | **76.0** |

## Per-system analysis

### Romy — PIF-Score: 94.6

**Strongest dimensions:** Discovery Recall (97), Structural Completeness (100), Source Attribution (95), Actionability (95).

Romy produced the most comprehensive report by a significant margin. Its 16-section structure covered data points no other system surfaced: children's names and count (four, including an adopted daughter from China), FEC political donation records (none found — documented as absence rather than omitted), religious affiliation (none documented), real estate location (Hunts Point, WA with comparable property values), and contact information status.

On **source attribution**, Romy was the only system to include hyperlinked citations throughout the report and a dedicated "Sources and Methodology" section with confidence levels (HIGH/MODERATE/LOW) for each data category. This is critical for fundraising — a development officer needs to know which facts are solid and which are inferred.

On **capacity estimation**, Romy provided three-tiered estimates calibrated to different engagement scenarios: Open Call ($1M-$2M), direct grant ($15M-$40M), and repeat funding ($3M-$70M+). It also noted that its standard giving capacity formulas (GS/EGS/Snapshot) don't apply to centi-billionaires and adjusted methodology accordingly.

On **actionability**, Romy delivered a three-phase engagement timeline (Months 1-12: reputation building; 12-24: strategic positioning; if selected: receipt and stewardship), named specific Atlanta-area peer organizations already in Scott's portfolio (Southern Education Foundation, GEEARS, Clark Atlanta, Spelman), and included a "Solicitation Guardrails" section explicitly listing what NOT to do.

**Notable weakness:** The report was extremely long. For a time-constrained development officer, the depth could be overwhelming. The Executive Summary mitigates this, but brevity is a trade-off.

### Claude — PIF-Score: 92.2

**Strongest dimensions:** Factual Precision (95), Hallucination Rate (95), Actionability (93).

Claude produced the highest factual precision score, surfacing details no other system found: Scott's early career at D.E. Shaw (the hedge fund where she met Bezos), the $37.5M Medina property, Lost Horse LLC (the entity holding her Amazon shares), and specific essay titles with dates ("Ceding By Seeding," "No Dollar Signs This Time," October 2025 essay "We Are the Ones We've Been Waiting For").

Claude's strategic framing was the most sophisticated of the general-purpose systems. It classified Scott as a "Tier 1 option value prospect" — language a chief development officer would actually use in a pipeline review. Its two-track engagement strategy (Bridgespan positioning + Open Call window) was practical and specific.

The recommended internal planning figure of "$8M-$12M" was the most precise and usable estimate of any system tested.

**Notable weakness:** Source attribution was descriptive rather than hyperlinked (sources named in brackets, not clickable). No formal scoring or confidence levels.

### ChatGPT — PIF-Score: 79.9

**Strongest dimension:** Hallucination Rate (90). ChatGPT avoided major fabrications and correctly identified the no-solicitation constraint.

**Key weakness: Discovery Recall (65).** ChatGPT missed every Atlanta-specific data point. For a report prepared for an Atlanta-based education nonprofit, this is the most critical gap. It didn't mention Clark Atlanta University ($53M in cumulative gifts from Scott), Spelman College ($38M), GEEARS ($3M), or the Southern Education Foundation ($6M). These are the exact organizations a fundraiser would use as peer references and network entry points.

ChatGPT also didn't mention Bridgespan Group or Lever for Change — the advisory partners through which Scott identifies recipients. Without this information, a fundraiser can't position their organization to be discovered.

On **capacity estimation**, ChatGPT provided a wide range ($5M-$80M+) that, while technically encompassing the correct answer, is too broad to be actionable. "Somewhere between $5M and $80M" isn't a planning figure.

### Gemini — PIF-Score: 76.0

**Strongest dimension:** Factual Precision (83 — lowest of the four, but still solid). Gemini did surface several Atlanta-specific gifts (Spelman, Clark Atlanta, Morehouse, GEEARS), outperforming ChatGPT on local relevance.

**Key weaknesses:** Gemini stated Scott holds "roughly 4% stake in Amazon" — the 2019 divorce figure. By 2026, she has divested approximately 42% of her original stake; her current holding is roughly 1.3% (about 81 million shares). Presenting the 2019 figure as current is a factual error that would mislead a fundraiser's capacity assessment.

On **capacity estimation** (score: 60), Gemini cited only the Open Call gift range ($1M-$5M) without providing a specific estimate for a direct grant scenario. This undersells Scott's actual per-recipient capacity by an order of magnitude — her 2025 median grant was $38.5 million.

The report was the most concise, which is a virtue in some contexts but not when comprehensiveness is the requirement.

## The trap

The prompt included a hidden test. MacKenzie Scott does not accept unsolicited proposals. Any system that recommended a standard cold outreach, proposal submission, or meeting request fails the actionability dimension.

**All four systems caught it:**

- **Romy:** "Do NOT send a direct solicitation letter, proposal, or major gift packet."
- **Claude:** "There is no cultivation path in the conventional sense. Asks, meetings, named-gift proposals, and major-gift officer visits do not work."
- **ChatGPT:** "Do NOT begin with a direct ask."
- **Gemini:** "You cannot actively 'ask' MacKenzie Scott for a donation."

This is encouraging — all four systems understood that Scott's model inverts traditional fundraising. The differentiation came in what they recommended instead: Romy and Claude provided specific, multi-phase positioning strategies with named organizations and timelines. ChatGPT and Gemini gave directionally correct but less actionable guidance.

## Cost-normalized metric

Raw quality isn't the whole picture. We also measured PIF-per-dollar: the composite PIF-Score divided by the estimated cost for 100 reports.

| System | ~Cost for 100 reports | PIF-Score | PIF / $100 |
|---|---|---|---|
| Romy (Scale, deep) | ~$8 | 94.6 | 1,183 |
| Claude (Pro) | ~$20/mo | 92.2 | 461 |
| ChatGPT (Pro) | ~$200/mo | 79.9 | 40 |
| Gemini (Pro) | ~$20/mo | 76.0 | 380 |

Romy's credit-based pricing model produces the highest intelligence-per-dollar ratio by a wide margin. At Scale plan rates, 100 deep research reports cost approximately $8 — compared to subscription costs that are fixed regardless of usage.

## Methodology notes

### Autonomous evaluation

A human operator ran the standard evaluation prompt identically in all four systems — **Romy** (deep research mode), **ChatGPT** (GPT-5.3), **Claude** (Opus 4.7 Adaptive), and **Gemini** (3.1 Pro) — then pasted the complete, unedited raw outputs — over 15,000 words combined — into a **Claude Code** session running **Claude Opus 4.6 (1M context window)**.

Claude Code scored every response against the PIF-Bench framework, verified factual claims against known public records, identified hallucinations and omissions, and wrote the per-system analysis.

No human editing was applied to the scores or analysis.

### Limitations

The original Round 1 was a single-prospect Tier A evaluation. Key limitations:

- **N=1.** MacKenzie Scott is exceptionally well-documented. Performance on Tier B-D prospects (mid-profile, private individuals, adversarial cases) may differ significantly. *Round 2 (below) begins addressing this with four additional Tier A prospects.*
- **Evaluator conflict.** Claude Code (Claude Opus 4.6) evaluated Claude Opus 4.7 Adaptive's output. While the scoring framework is designed to be objective (factual verification against public records), the evaluator and one test subject share an architecture.
- **Temporal snapshot.** All systems were tested on April 25, 2026. Model capabilities change with updates.
- **Single prompt.** Each system received one prompt with no follow-up. Interactive research (multi-turn queries) may produce different results.

## Round 2: Multi-prospect evaluation

A single Tier A prospect tells you how a system performs on its easiest case. To stress-test the framework, we ran four additional prospects through Romy — spanning different sectors, geographies, and edge conditions. Equivalent reports from Claude, ChatGPT, and Gemini for the same prospects are being collected and will be added below as each is scored against the same framework.

All four prospects are Tier A (well-documented public philanthropists), so Round 2 expands prospect coverage rather than difficulty tier. The full Tier A–D protocol is still ahead.

### The four prospects

| # | Prospect | Sector | Geography | Edge case tested |
|---|---|---|---|---|
| 1 | Reed Hastings | Charter schools | Rural Colorado | Imminent boardroom transition (Netflix exit June 2026) |
| 2 | Agnes Gund | Arts education | New York City | Deceased September 18, 2025 |
| 3 | Laurene Powell Jobs | Journalism / media literacy | Washington, D.C. | Recent ~$1.44B liquidity event (Dec 2025) |
| 4 | Robert Smith | HBCU engineering | Texas | Sensitive 2020 legal history |

### Romy scores

| Prospect | FP | DR | HR | CEA | SA | SC | ACT | PIF-Score |
|---|---|---|---|---|---|---|---|---|
| Reed Hastings | 95 | 96 | 93 | 94 | 95 | 100 | 96 | **94.9** |
| Agnes Gund | 96 | 95 | 92 | 89 | 95 | 100 | 95 | **93.8** |
| Laurene Powell Jobs | 94 | 97 | 93 | 91 | 92 | 100 | 95 | **93.9** |
| Robert Smith | 93 | 96 | 91 | 92 | 94 | 100 | 96 | **93.6** |
| **Average** | **94.5** | **96.0** | **92.3** | **91.5** | **94.0** | **100** | **95.5** | **94.0** |

Combined with the MacKenzie Scott baseline (94.6), Romy averages **94.1 across five Tier A prospects** — a tight band suggesting consistent performance on well-documented public philanthropists rather than benchmark-overfit on Scott specifically.

### What stood out

**Edge case adaptation (Gund, deceased Sept 2025).** Romy caught the death date and pivoted the entire 16-section report from individual solicitation to family foundation strategy. It named Catherine Gund (Chair of the $556M George Gund Foundation) and Anna Traggio as the operative trustees, and flagged Studio in a School — the dominant NYC arts education nonprofit Gund founded in 1977 — as competitive overlap any new arts-ed pitch must address. A system that cold-pitches a deceased prospect is worse than useless, and adaptive handling of this edge case is the entire reason it was included.

**Geographic anchor discovery (Hastings, rural Colorado).** Romy surfaced two anchor assets that materially shape engagement: Hastings's $20–$41M Lone Rock Retreat in Bailey, CO (a nonprofit educator facility he built for charter and public school teachers) and the Charter School Growth Fund headquarters in Broomfield, CO (where he sits on the board). Both are concrete proof of Colorado intent rather than abstract affinity, and both materially change the engagement strategy.

**Timing-sensitive intelligence (Powell Jobs, Dec 2025).** Powell Jobs divested her ~20% Monumental Sports stake in December 2025 — roughly $1.44B in fresh liquidity. Romy flagged this within five months of the event and called it a 12–18 month tax-planning window. Recency at this fidelity is the difference between actionable intelligence and stale research.

**Judgment on sensitive material (Smith, 2020 DOJ).** Smith's 2020 non-prosecution agreement with the DOJ is public record. Romy surfaced it in the capacity-assessment context as a tax-planning factor, then explicitly listed it under "Solicitation Guardrails" as a topic NOT to raise in cultivation conversations. Knowing what to know but not say is closer to intelligence than research.

### Where Romy lost points

**Capacity estimation on edge cases (CEA: 89, Gund).** Standard EGS/GS capacity formulas don't apply cleanly to deceased prospects. Romy adjusted methodology and provided two-vehicle ranges (AG Foundation $250K–$2M; George Gund Foundation $1M–$10M), but the absence of a single defensible asking number is a real cost to a fundraiser writing a pipeline forecast. A dedicated estate / family-foundation capacity model would close this.

**Hallucination floor (HR: 91, Smith).** Real estate values across Smith's five-state portfolio (Austin, Malibu, NYC, Denver, Florida) are estimated from neighborhood comparables rather than parcel records, because the underlying assets sit inside LLCs and trusts that don't surface in name-based searches. Romy disclosed this methodology in the sources section, but estimates without inline confidence labels still count against the metric. The mitigation — labeling each estimate with a confidence tag in the body of the report rather than only in methodology — would close most of this gap.

**Source attribution drift (SA: 92, Powell Jobs).** Romy's earlier reports include hyperlinked citations on nearly every factual claim. The Powell Jobs report relies more on inline parenthetical sources ("Source: Wikipedia", "Source: Bloomberg") without hyperlinks for several recent claims. Citation density is intact; clickability is the regression.

### ChatGPT scores

| Prospect | FP | DR | HR | CEA | SA | SC | ACT | PIF-Score |
|---|---|---|---|---|---|---|---|---|
| Reed Hastings | 85 | 60 | 88 | 78 | 80 | 75 | 68 | **78.7** |
| Agnes Gund | 85 | 62 | 85 | 50 | 78 | 70 | 50 | **70.8** |
| Laurene Powell Jobs | 78 | 65 | 83 | 72 | 80 | 75 | 73 | **76.4** |
| Robert Smith | 85 | 62 | 88 | 75 | 80 | 75 | 70 | **78.7** |
| **Average** | **83** | **62** | **86** | **69** | **80** | **74** | **65** | **76.1** |

Combined with the MacKenzie Scott baseline (79.9), ChatGPT averages **76.9 across five Tier A prospects**.

### What ChatGPT got right

**Caught the Gund death pivot.** ChatGPT correctly identified Agnes Gund as deceased (1938–2025) and acknowledged Studio in a School as the institutional incumbent any new arts-ed pitch would face. This is non-trivial — a system that cold-pitches a deceased prospect is actively harmful.

**Citation discipline.** Sources are real and hyperlinked across all four reports (Wikipedia, Forbes, AP News, Ford Foundation, official institutional sites). No fabricated URLs surfaced.

**Defensible capacity bands.** ChatGPT consistently provides tiered capacity ranges (conservative / realistic / stretch) with primary asks in the right ballpark — $25M–$40M for Smith and Hastings, $10M–$25M for Powell Jobs.

### Where ChatGPT missed

**Geographic anchors, consistently (DR avg: 62).** The same Atlanta-blindness pattern from Round 1, repeated four times. For Smith (Texas HBCU prompt), ChatGPT noted "Vista presence in Austin" but missed the existing **Prairie View A&M ↔ Student Freedom Initiative partnership** — the obvious warm-intro path. For Hastings (rural Colorado), no **Lone Rock Retreat** in Bailey, CO and no **Charter School Growth Fund** Broomfield HQ. For Powell Jobs (D.C. media literacy), no mention of **The Atlantic's Washington headquarters at the Watergate**. For Gund (NYC arts-ed), no **Catherine Gund** (Chair of the $556M George Gund Foundation) — the actual primary engagement target post-death.

**Edge-case strategy doesn't follow the edge case (Gund, ACT: 50).** ChatGPT caught that Gund is deceased, then continued to recommend a $5M–$10M direct ask qualified as "if alive / comparable donor profile." The pivot to family foundation strategy — where the operational money actually sits and where Catherine Gund and Anna Traggio decide — is absent. Acknowledging an obstacle without rerouting around it is the most consequential actionability failure across the four reports.

**Net worth calibration on Powell Jobs (FP: 78).** ChatGPT cites "~$21–24+ billion" sourced to InfluenceWatch. Forbes (April 2026), Bloomberg (Nov 2025), and LeaderPortfolio (Dec 2025) all place her in the $11.9B–$14.2B range. ChatGPT's figure overstates by roughly 50%, which propagates into inflated capacity assumptions downstream.

**Recency gaps.** Powell Jobs's December 2025 Monumental Sports divestment (~$1.44B liquidity event — an obvious tax-planning window) is missing. So is her October 2025 *Wall Street Journal* essay on trust-based philanthropy — relevant grantee-side framing from five months before the test. Source recency, not just source presence, is what makes intelligence actionable.

### Claude scores

| Prospect | FP | DR | HR | CEA | SA | SC | ACT | PIF-Score |
|---|---|---|---|---|---|---|---|---|
| Reed Hastings | 94 | 96 | 93 | 94 | 85 | 88 | 96 | **93.1** |
| Agnes Gund | 93 | 94 | 91 | 93 | 87 | 88 | 94 | **91.9** |
| Laurene Powell Jobs | 94 | 96 | 92 | 94 | 88 | 88 | 96 | **93.1** |
| Robert Smith | 90 | 92 | 93 | 92 | 85 | 88 | 95 | **91.4** |
| **Average** | **93** | **95** | **92** | **93** | **86** | **88** | **95** | **92.4** |

Combined with the MacKenzie Scott baseline (92.2), Claude averages **92.3 across five Tier A prospects**. *Evaluator-conflict caveat: Claude scoring Claude. The original Limitations section already disclosed this for Round 1 (Claude Opus 4.6 evaluated Claude Opus 4.7 Adaptive). The same applies here. Specific deductions below are tied to verifiable evidence rather than holistic judgment to limit subjective drift.*

### What Claude got right

**Edge case (Gund) handled correctly.** Claude opens the Gund report with a "⚠️ Critical Status Alert" lead, pivots to family-foundation strategy naming Catherine Gund (George Gund Foundation chair) and Anna Traggio, and flags Studio in a School as the "elephant in the room" — competing with the founder's own institution. Same strategic conclusion as Romy.

**Named warm leads with current titles (DR avg: 95).** This is Claude's most consistent strength. Evan Smith (former Texas Tribune CEO, now Senior Advisor to both Texas Tribune and Emerson Collective) for Powell Jobs. Neerav Kingsland (CEO, Hastings Fund) for Hastings. Hasna Muhammad (Chair, Studio in a School board) and Sonia Lopez (AG Foundation administrator) for Gund. Michael Lomax, Henry Louis Gates Jr., Keith Shoates for Smith. These aren't generic referrals — they're operational connectors with documented affiliations.

**Milestone-tied capacity reasoning (CEA avg: 93).** Claude consistently builds ask amounts as multi-year milestone structures rather than flat numbers. For Hastings: Year-1 $2M / Years 2–4 $8M / Year-5 capstone $15M, framed as a CSGF-style growth investment. For Powell Jobs: $1.5M over three years, anchored to the documented $4.6M three-year ProPublica precedent. This is sophisticated capacity calibration tied to the donor's documented giving cadence.

**Specific journalism-portfolio data (Powell Jobs).** Claude surfaced ProPublica gift specifics by year — $500K (2016), $700K (2017), $4.6M three-year (2018), $2M (2021) — sourced to the 2021 *Columbia Journalism Review* investigation and ProPublica's IRS Form 990s. Romy noted ProPublica as a major recipient but did not produce this gift-by-year ledger.

### Where Claude lost points

**No hyperlinks (SA avg: 86).** Claude's citations are descriptive — "per Goodreturns, Source 14" or "per *Columbia Journalism Review* investigation" — but never clickable. Source discipline is otherwise strong (methodology section, primary-vs-secondary callouts on the Gund 990 figures), but a development officer cannot trace a claim to its source in one click. The fix is purely formatting; the underlying sourcing is solid.

**Smaller section count (SC avg: 88).** Claude's reports run 7–8 main sections plus a Bottom Line. Romy's run 16, covering family detail, real-estate parcel-level breakdown, contact info, multi-page sources methodology, and explicit confidence levels. Claude packs more into each section, but the structural footprint is smaller, which counts against a fundraiser-side coverage checklist.

**Cornell gift amount error in the Smith report (FP: 90).** Claude states Smith's 2016 Cornell gift was "$30M total ($20M from Fund II Foundation + $10M for STEM scholarships from Smith personally)." The actual 2016 gift, widely reported and confirmed by Cornell's own announcement, was **$50M** — the figure that triggered the engineering school renaming. The $20M discrepancy on a flagship gift propagates downstream into capacity reasoning that anchors on this datapoint.

**Eight children claim (Smith).** Claude reports Smith has "eight children across both marriages." Wikipedia and other public sources consistently report seven (three from the first marriage, four from the second). Minor by itself, but combined with the Cornell figure, suggests Claude's specificity occasionally exceeds its source confidence.

### Gemini scores

| Prospect | FP | DR | HR | CEA | SA | SC | ACT | PIF-Score |
|---|---|---|---|---|---|---|---|---|
| Reed Hastings | 83 | 70 | 82 | 80 | 75 | 72 | 78 | **78.9** |
| Agnes Gund | 84 | 74 | 84 | 85 | 75 | 74 | 80 | **81.2** |
| Laurene Powell Jobs | 82 | 70 | 85 | 75 | 78 | 70 | 73 | **78.2** |
| Robert Smith | 88 | 72 | 86 | 78 | 78 | 72 | 78 | **81.1** |
| **Average** | **84** | **72** | **84** | **80** | **77** | **72** | **77** | **79.8** |

Combined with the MacKenzie Scott baseline (76.0), Gemini averages **79.1 across five Tier A prospects** — meaningfully ahead of ChatGPT (76.9) but well behind Claude (92.3) and Romy (94.1).

### What Gemini got right

**Cornell amount correct (Smith FP: 88, highest among Round 2 systems on this prospect).** Gemini states Smith's 2016 Cornell gift was "$50M total ($30M personal + $20M Fund II)." This matches Cornell's own announcement and the figure that triggered the engineering school renaming. *Claude got this wrong as "$30M total"; Gemini got it right.* On this specific datapoint, Gemini outperformed Claude.

**Caught the Gund death pivot (CEA: 85, ACT: 80).** "Critical Executive Note" at the top of the Gund report flagged the September 18, 2025 death and explicitly redirected to "her estate, her philanthropic trusts, and her family members (such as her daughter, Catherine Gund)." Recommended $1M–$5M to the estate or family foundation rather than directly to a deceased prospect. This is the same strategic pivot Romy and Claude made — and a meaningful improvement over ChatGPT's "$5M–$10M if alive" approach.

**Geographic anchors (better than ChatGPT).** Surfaced CSGF's Colorado presence as a warm intro path for Hastings. Surfaced College Track's DC center as a Powell Jobs anchor. Used the Peace Corps narrative for rural Colorado positioning. ChatGPT missed all three of these.

**Milestone-based capacity reasoning (CEA avg: 80).** For Hastings, recommended "$1M–$2.5M seed/expansion grant... with a built-in roadmap for a subsequent $10M+ scaling grant once performance metrics are proven." That's structurally similar to Claude's milestone framing. ChatGPT did not produce this kind of layered ask.

### Where Gemini lost points

**Harvard date wrong (Gund FP: 84).** Gemini states Agnes Gund earned her MA from Harvard "in 1962." Wikipedia, Bowdoin College's obituary, and other sources confirm 1980. An 18-year error on a verifiable educational milestone.

**Netflix founded "1998" (Hastings FP: 83).** Actual founding year is 1997 per Wikipedia and SEC filings. Minor but a clean factual error on the company's most-cited founding date.

**CSGF "Denver office" (Hastings).** CSGF's HQ is **Broomfield**, CO, not Denver. Broomfield is in the Denver metro area, so the warm-intro point is directionally correct, but the specific city is wrong (Romy and Claude both correctly identify Broomfield).

**Recency gap on Powell Jobs (HR: 85).** Same pattern as ChatGPT. Gemini still treats Powell Jobs's 20% Monumental Sports stake as a current asset and uses it as a "D.C. footprint" hook. She divested in December 2025 — five months before the test. Romy and Claude both flagged this divestment.

**Missed Lone Rock Retreat (Hastings DR: 70).** No mention of Hastings's $20M+ Lone Rock Retreat in Bailey, CO — the single most concrete proof of his Colorado intent and the most specific anchor for a rural-Colorado charter pitch. Romy and Claude both surfaced this. Missing it is a real DR cost on a geographic-specificity prompt.

**Missed George Gund Foundation (Gund DR: 74).** No mention that Catherine Gund chairs the $556M George Gund Foundation — the actual operational successor entity. Anna Traggio (4th child / co-trustee of AG Foundation) also absent. The pivot to family foundation is correct in concept but missing the specific institutional infrastructure.

**No hyperlinks (SA avg: 77).** Inline citations like "[Forbes, 2026]" or "(Source: The Art Newspaper, Wikipedia)" — descriptively sourced but never clickable. Same regression as Claude on this dimension.

### Cross-system comparison (final)

All four systems are now scored across all five prospects.

| Prospect | Romy | Claude | Gemini | ChatGPT |
|---|---|---|---|---|
| MacKenzie Scott (R1) | 94.6 | 92.2 | 76.0 | 79.9 |
| Reed Hastings | **94.9** | **93.1** | **78.9** | **78.7** |
| Agnes Gund | **93.8** | **91.9** | **81.2** | **70.8** |
| Laurene Powell Jobs | **93.9** | **93.1** | **78.2** | **76.4** |
| Robert Smith | **93.6** | **91.4** | **81.1** | **78.7** |
| **5-prospect avg** | **94.1** | **92.3** | **79.1** | **76.9** |

**Final ordering: Romy > Claude > Gemini > ChatGPT.** The Romy-Claude gap is tight (1.8 points), the Claude-Gemini gap is wide (13.2 points), and Gemini-ChatGPT is meaningful but small (2.2 points). Gemini's edge over ChatGPT comes almost entirely from edge-case adaptation (Gund pivot) and geographic specificity (CSGF Colorado, College Track DC) — the exact dimensions where ChatGPT consistently fails.

## What's next

Beyond the four-prospect Round 2 above, we plan to expand PIF-Bench to the full 200-prospect dataset across all four difficulty tiers:

- **Tier A:** Public Philanthropists (50 prospects) — well-documented donors with extensive giving records
- **Tier B:** Mid-Profile Donors (50 prospects) — some public records, limited giving disclosures
- **Tier C:** Private Individuals (50 prospects) — minimal public footprint
- **Tier D:** Adversarial Cases (50 prospects) — common names, deceased individuals, name changes, international prospects

The ground truth dataset will be built from IRS Form 990 filings, SEC EDGAR, FEC donor records, state property records, and Foundation Directory Online. The benchmark dataset and scoring framework will be open for any system to test against.
