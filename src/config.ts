/**
 * Who grades (`panel.json`) and who is graded (`candidates.json`). Both are
 * versioned files, not flags, so a published result can always say exactly
 * which judges and which model settings produced it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { ROOT } from './tasks'

const ProviderOptions = z.record(z.string(), z.record(z.string(), z.unknown())).optional()

export const JudgeSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/),
    model: z.string().includes('/'),
    family: z.string(),
    temperature: z.number().optional(),
    maxOutputTokens: z.number().int().positive().default(8000),
    providerOptions: ProviderOptions,
    /** Graded outside the harness (people, or agents on exported packets): never called through the gateway. */
    external: z.boolean().default(false),
  })
  .strict()
export type JudgeSpec = z.infer<typeof JudgeSchema>

export const PanelSchema = z
  .object({
    name: z.string(),
    judges: z.array(JudgeSchema).min(1),
  })
  .strict()
export type Panel = z.infer<typeof PanelSchema>

export const CandidateSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/),
    /** Gateway model id for API runs; absent for products whose outputs are imported. */
    model: z.string().includes('/').optional(),
    /** Model family, for the self-preference check (`anthropic`, `openai`, `google`, `romy`, …). */
    family: z.string(),
    label: z.string().optional(),
    temperature: z.number().optional(),
    maxOutputTokens: z.number().int().positive().default(32000),
    providerOptions: ProviderOptions,
  })
  .strict()
export type CandidateSpec = z.infer<typeof CandidateSchema>

export function loadPanel(file = join(ROOT, 'panel.json')): Panel {
  const panel = PanelSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
  const ids = panel.judges.map((j) => j.id)
  if (new Set(ids).size !== ids.length) throw new Error(`${file}: judge ids must be unique`)
  return panel
}

export function loadCandidates(file = join(ROOT, 'candidates.json')): CandidateSpec[] {
  const list = z.array(CandidateSchema).parse(JSON.parse(readFileSync(file, 'utf8')))
  const ids = list.map((c) => c.id)
  if (new Set(ids).size !== ids.length) throw new Error(`${file}: candidate ids must be unique`)
  return list
}
