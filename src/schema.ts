/**
 * The task contract. One `task.json` per task directory; the rubric lives
 * inline as a list of equally weighted pass/fail criteria, the same shape as
 * Harvey's Legal Agent Benchmark (LAB), with three additions for this domain:
 *
 *   - `track`     — `packet` tasks are closed-world (every fact the task needs
 *                   is in `documents/`, so the right answer is known by
 *                   construction); `live` tasks are about real public figures
 *                   and are graded against dated, sourced facts.
 *   - `red_line`  — a diagnostic tag on criteria whose failure would harm a
 *                   donor relationship or the organisation (soliciting the
 *                   dead, conflating two people, inventing a gift, breaching a
 *                   privacy rule). It never changes the score; it is reported
 *                   alongside it.
 *   - `evidence`  — on live tasks, the primary-source URLs behind the fact a
 *                   criterion tests. Required there, so every live criterion
 *                   can be audited by anyone.
 */
import { z } from 'zod'

export const AREAS = [
  'prospect-research',
  'foundation-grants',
  'gift-compliance',
  'major-gifts',
  'donor-data',
  'finance-governance',
  'live-prospects',
] as const
export type Area = (typeof AREAS)[number]

export const CriterionSchema = z
  .object({
    id: z.string().regex(/^C-\d{3}$/, 'criterion ids look like C-001'),
    title: z.string().min(8),
    match_criteria: z.string().min(40),
    /** Task-relative paths (documents/… or references/…) the judge reads as ground truth for this criterion. */
    sources: z.array(z.string()).default([]),
    red_line: z.boolean().default(false),
    evidence: z.array(z.url()).default([]),
  })
  .strict()
export type Criterion = z.infer<typeof CriterionSchema>

export const TaskSchema = z
  .object({
    title: z.string().min(10),
    track: z.enum(['packet', 'live']),
    work_type: z.enum(['research', 'analyze', 'calculate', 'draft', 'review']),
    /** The scenario's "today". Live tasks are graded on facts true as of this date. */
    as_of: z.iso.date(),
    /** Prospect difficulty tier (A public philanthropist … D adversarial), where it applies. */
    tier: z.enum(['A', 'B', 'C', 'D']).optional(),
    tags: z.array(z.string()).default([]),
    instructions: z.string().min(40),
    /** The single Markdown file the system must produce. */
    deliverable: z.string().regex(/^[a-z0-9][a-z0-9-]*\.md$/, 'deliverable is a kebab-case .md filename'),
    criteria: z.array(CriterionSchema).min(5).max(60),
  })
  .strict()
export type TaskSpec = z.infer<typeof TaskSchema>

/** fixtures/expected.json — which criteria each fixture deliverable must fail. Everything else must pass. */
export const ExpectedSchema = z
  .object({
    reference: z.object({ fail: z.array(z.string()) }).strict(),
    flawed: z.object({ fail: z.array(z.string()).min(1) }).strict(),
  })
  .strict()
export type Expected = z.infer<typeof ExpectedSchema>
