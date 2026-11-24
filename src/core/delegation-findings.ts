import { FORMAT_VERSION, type Delegation, STAGE_ROLES } from './schemas';
import { hasSupportedModel, isSupportedModel, modelChoices } from './delegation';
import { type Finding, finding } from './findings';

const KNOWN_HARNESSES = new Set(['claude-code', 'astro']);

export function delegationFindings(delegation: Delegation): Finding[] {
  const findings: Finding[] = [];
  for (const [harness, models] of Object.entries(delegation)) {
    if (!KNOWN_HARNESSES.has(harness)) {
      findings.push(finding(
        'L029',
        'config.json',
        1,
        null,
        'unknown delegation harness ' + harness,
        'use claude-code or astro, or add a supported harness adapter',
        'warning',
      ));
    }
    for (const role of STAGE_ROLES) {
      const setting = models[role];
      for (const { model } of modelChoices(setting)) {
        if (isSupportedModel(harness, model)) continue;
        findings.push(finding(
          'L032',
          'config.json',
          1,
          null,
          `delegation.claude-code has unsupported model ${model} for ${role}`,
          'use sonnet, opus, haiku or fable as the Claude Code model',
          'warning',
        ));
      }
      // A missing spec-review model is never an L030: the reviewer's covers it (FMT-015/R6).
      if (role !== 'spec-review' && !hasSupportedModel(harness, setting)) {
        findings.push(finding(
          'L030',
          'config.json',
          1,
          null,
          'delegation.' + harness + (setting === undefined ? ' has no model for ' : ' has no valid model for ') + role,
          'set delegation.' + harness + '.' + role + ' in config.json or config.local.json',
          'warning',
        ));
      }
    }
  }
  return findings;
}

export function requiredDelegationFindings(delegation: Delegation, formatVersion: number | undefined, ci: boolean): Finding[] {
  if (!ci || formatVersion === undefined || formatVersion < FORMAT_VERSION || Object.keys(delegation).length > 0) return [];
  return [finding(
    'L031',
    'config.json',
    1,
    null,
    'delegation is required for current-format projects; local-only teams may use config.local.json',
    'set a model for every stage role under the active harness (use --local for local-only teams)',
    'warning',
  )];
}
