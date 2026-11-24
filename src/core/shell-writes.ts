// Which paths a shell command plainly writes (INS-016/R16, R17). A small, conservative reading of the
// text: it runs nothing, and anything it cannot read with certainty (a substitution, a subshell, an
// unclosed quote, a nested shell, a script) is left out, since a missed write beats refusing a build.

/** One word of a command; `plain` is false when the shell would have to expand it (`$`, `~`, a glob). */
interface Word {
  readonly text: string;
  readonly plain: boolean;
}

interface Simple {
  readonly words: Word[];
  readonly redirects: Word[];
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const ABSOLUTE = /^([A-Za-z]:)?[\\/]/;

/** The command split into simple commands at `;`, `&&`, `||`, `|`, `&` and newlines; null when it is not plainly readable. */
function split(command: string): Simple[] | null {
  const commands: Simple[] = [];
  let current: Simple = { words: [], redirects: [] };
  let text = '';
  let started = false;
  let plain = true;
  let pending: 'out' | 'skip' | 'heredoc' | null = null;
  let strip = false;
  const heredocs: { delimiter: string; strip: boolean }[] = [];

  const endWord = (): void => {
    if (!started) return;
    if (pending === 'out') current.redirects.push({ text, plain });
    else if (pending === 'heredoc') heredocs.push({ delimiter: text, strip });
    else if (pending === null) current.words.push({ text, plain });
    pending = null;
    text = '';
    started = false;
    plain = true;
  };
  const endCommand = (): void => {
    endWord();
    pending = null;
    if (current.words.length > 0 || current.redirects.length > 0) commands.push(current);
    current = { words: [], redirects: [] };
  };
  /** A file descriptor number glued to a redirection (`2>`) is not a word. */
  const dropDescriptor = (): void => {
    if (started && plain && /^\d+$/.test(text)) {
      text = '';
      started = false;
    }
  };
  const add = (c: string, expands: boolean): void => {
    text += c;
    started = true;
    if (expands) plain = false;
  };

  for (let i = 0; i < command.length; i++) {
    const c = command.charAt(i);
    const next = command.charAt(i + 1);
    switch (c) {
      case ' ':
      case '\t':
        endWord();
        break;
      case '\n': {
        endCommand();
        let at = i + 1;
        for (const h of heredocs.splice(0)) {
          while (at < command.length) {
            const end = command.indexOf('\n', at);
            const line = command.slice(at, end < 0 ? command.length : end);
            at = end < 0 ? command.length : end + 1;
            if ((h.strip ? line.replace(/^\t+/, '') : line) === h.delimiter) break;
          }
        }
        i = at - 1;
        break;
      }
      case "'": {
        const end = command.indexOf("'", i + 1);
        if (end < 0) return null;
        text += command.slice(i + 1, end);
        started = true;
        i = end;
        break;
      }
      case '"': {
        started = true;
        let j = i + 1;
        for (; ; j++) {
          if (j >= command.length) return null;
          const d = command.charAt(j);
          if (d === '"') break;
          if (d === '\\' && '$`"\\\n'.includes(command.charAt(j + 1)) && j + 1 < command.length) {
            j++;
            if (command.charAt(j) !== '\n') text += command.charAt(j);
          } else {
            text += d;
            if (d === '$' || d === '`') plain = false;
          }
        }
        i = j;
        break;
      }
      case '\\':
        if (next === '\n') i++;
        else if (next !== '') {
          add(next, false);
          i++;
        } else add(c, false);
        break;
      case '#':
        if (started) add(c, false);
        else {
          const end = command.indexOf('\n', i);
          i = (end < 0 ? command.length : end) - 1;
        }
        break;
      case '(':
      case ')':
      case '`':
        return null;
      case ';':
        endCommand();
        break;
      case '|':
        endCommand();
        if (next === '|') i++;
        break;
      case '&':
        if (next === '>') {
          endWord();
          pending = 'out';
          i += command.charAt(i + 2) === '>' ? 2 : 1;
        } else {
          endCommand();
          if (next === '&') i++;
        }
        break;
      case '>':
        dropDescriptor();
        endWord();
        pending = next === '&' ? 'skip' : 'out';
        if (next === '>' || next === '&' || next === '|') i++;
        break;
      case '<':
        dropDescriptor();
        endWord();
        if (next === '<' && command.charAt(i + 2) !== '<') {
          strip = command.charAt(i + 2) === '-';
          pending = 'heredoc';
          i += strip ? 2 : 1;
        } else {
          pending = 'skip';
          if (next === '<') i += 2;
          else if (next === '>' || next === '&') i++;
        }
        break;
      case '$':
      case '~':
      case '*':
      case '?':
      case '[':
        add(c, true);
        break;
      default:
        add(c, false);
    }
  }
  endCommand();
  return commands;
}

/** Whether `args` of a sed or perl command ask for editing in place. */
function editsInPlace(command: 'sed' | 'perl', args: readonly Word[]): boolean {
  for (const { text } of args) {
    if (text === '--') return false;
    if (command === 'sed' && text.startsWith('--')) {
      if (text.startsWith('--in-place')) return true;
      continue;
    }
    if (!/^-[A-Za-z]/.test(text)) continue;
    for (const ch of text.slice(1)) {
      if (ch === 'i') return true;
      // The rest of the cluster is this option's argument; sed takes -e, -f and -l, perl -e and -E.
      if (command === 'sed' ? 'efl'.includes(ch) : 'eE'.includes(ch)) break;
      if (!/[A-Za-z]/.test(ch)) break;
    }
  }
  return false;
}

/**
 * The paths the command plainly writes, as written: those of an output redirection, of `tee`, of
 * `sed -i` and of `perl -i`. A target the shell would expand, and a relative one after a `cd` or
 * `pushd` earlier in the command, are left out, as is everything inside a nested shell or script.
 */
export function plainWrites(command: string): string[] {
  const commands = split(command);
  if (commands === null) return [];
  const targets: string[] = [];
  let moved = false;
  for (const simple of commands) {
    const at = simple.words.findIndex((w) => !ASSIGNMENT.test(w.text));
    const name = at < 0 ? undefined : simple.words[at]?.text;
    const args = at < 0 ? [] : simple.words.slice(at + 1);
    const written = [...simple.redirects];
    const files = () => args.filter((w) => !w.text.startsWith('-'));
    if (name === 'tee') written.push(...args);
    else if (name === 'sed' && editsInPlace('sed', args)) written.push(...files());
    else if (name === 'perl' && editsInPlace('perl', args)) written.push(...files());
    for (const w of written) {
      if (w.plain && w.text !== '' && (ABSOLUTE.test(w.text) || !moved)) targets.push(w.text);
    }
    if (name === 'cd' || name === 'pushd') moved = true;
  }
  return targets;
}
