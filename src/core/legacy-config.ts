// L028 warns that old dispatch-only config keys are accepted but ignored (X139).
import { type Finding, finding } from './findings';

export function legacyConfigFindings(config: { dispatchCommand?: string; models?: unknown } | null): Finding[] {
  if (config === null) return [];
  const findings: Finding[] = [];
  if (config.dispatchCommand !== undefined) {
    findings.push(finding('L028', 'config.json', 1, null, 'dispatchCommand is ignored since X139; the session drives stages with spec next', 'remove dispatchCommand from config.json', 'warning'));
  }
  if (config.models !== undefined) {
    findings.push(finding('L028', 'config.json', 1, null, 'models is ignored since X139; the session drives stages with spec next', 'remove models from config.json', 'warning'));
  }
  return findings;
}
