// One contender for tests/io/lock.test.ts: says it is ready, waits for the go file, then takes the
// lock `rounds` times, holding it each time for a while. While it holds the lock it reads the
// shared counter file, naps, writes the counter plus one and appends the value it read to the log:
// holds that overlapped would read the same value, so the log would repeat one. No clock is used.
// It never releases: it leaves the lock holding a dead pid, as a process that died would, so every
// acquisition after the first is a takeover. Removing a lock file is slowed by 2 ms, so contenders
// that decided to take over the same dead lock really do overlap in time, as on a loaded machine.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire, syncBuiltinESMExports } from 'node:module';

const [lock = '', log = '', counter = '', ready = '', go = '', rounds = '1', deadPid = '99999999'] = process.argv.slice(2);
const nap = new Int32Array(new SharedArrayBuffer(4));
const sleep = (ms: number) => Atomics.wait(nap, 0, 0, ms);

// The CommonJS fs object; syncBuiltinESMExports carries the change to every `import { rmSync }`.
const cjsFs = createRequire(import.meta.url)('node:fs') as { rmSync: (path: string, options?: object) => void };
const rm = cjsFs.rmSync;
cjsFs.rmSync = (path, options) => {
  if (path === lock) sleep(2);
  rm(path, options);
};
syncBuiltinESMExports();
const { tryLock } = await import('../../src/io/lock');

writeFileSync(ready, '');
while (!existsSync(go)) sleep(1);
for (let i = 0; i < Number(rounds); i++) {
  for (;;) {
    if (!tryLock(lock).ok) continue;
    const seen = existsSync(counter) ? Number(readFileSync(counter, 'utf8')) : 0;
    sleep(5);
    writeFileSync(counter, String(seen + 1));
    appendFileSync(log, `${String(seen)}\n`);
    writeFileSync(lock, `${deadPid} died\n`);
    break;
  }
}
