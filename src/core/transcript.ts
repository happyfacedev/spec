// What a role's transcript (JSONL) reports about its stage: the model that ran it and what it cost.

export interface StageUsage {
  readonly model?: string;
  readonly cost_usd?: number;
}

/** Whether a model may be written to a stage record or ticket history (PIP-025/R3). */
export function isRecordedModel(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 100) return false;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code > 0x7e) return false;
  }
  return true;
}

/** Whether a transcript cost may be written to a stage record or ticket history (PIP-025/R3). */
export function isRecordedCost(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1_000_000;
}

/** The last model an assistant line names and the last `total_cost_usd` a result line reports. */
export function readUsage(jsonl: string): StageUsage {
  let model: string | undefined;
  let cost: number | undefined;
  for (const line of jsonl.split('\n')) {
    if (line.trim() === '') continue;
    let v: unknown;
    try {
      v = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof v !== 'object' || v === null) continue;
    const o = v as { message?: { model?: unknown } | null; total_cost_usd?: unknown };
    if (isRecordedModel(o.message?.model)) model = o.message.model;
    if (isRecordedCost(o.total_cost_usd)) cost = o.total_cost_usd;
  }
  return { ...(model === undefined ? {} : { model }), ...(cost === undefined ? {} : { cost_usd: cost }) };
}
