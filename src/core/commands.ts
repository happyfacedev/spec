// The user's spec commands: harness-neutral templates in templates/commands/, expanded for one project.

export const COMMANDS = ['spec-init', 'feature', 'change', 'bug', 'run'] as const;

/**
 * One command template, filled in: the shared interview rules, the project's CLI path and name,
 * and permission to run that CLI (its injected context runs it before the model sees anything).
 */
export function expandCommand(template: string, interview: string, drive: string, cli: string, project: string): string {
  // {ask}: only how to ask, for commands that file no ticket.
  const ask = interview.split(/\nHow to file it:/)[0] ?? interview;
  return template
    .replace('{interview}', interview.trim())
    .replace('{drive}', drive.trim())
    .replace('{ask}', ask.trim())
    .replace(/^(argument-hint: .*)$/m, `$1\nallowed-tools: Bash(${cli} *), Bash(exec ${cli} brief --stdin *)`)
    .replaceAll('{cli}', cli)
    .replaceAll('{project}', project);
}
