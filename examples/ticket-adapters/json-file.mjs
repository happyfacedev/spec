#!/usr/bin/env node
// A complete ticket adapter: a "tracker" that is one JSON file, { "<ID>": "<ticket text>" }.
// Copy it as the start of an adapter for GitHub Issues, Linear, Jira or anything else: only the
// two functions that load and save change. Protocol: docs/TICKETS.md.
//
//   config.json:  "tickets": { "adapter": "command", "command": "node tools/json-file.mjs tickets.json" }
//
//   <command> list         prints {"tickets":[{"id","text"}]}
//   <command> put <ID>     reads {"id","text","previous","note"} on stdin, saves text, prints {"ok":true}
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [db, op, id] = process.argv.slice(2);
if (!db || !op) {
  process.stderr.write('usage: json-file.mjs <file.json> list | put <ID>\n');
  process.exit(2);
}

const load = () => (existsSync(db) ? JSON.parse(readFileSync(db, 'utf8')) : {});
const save = (all) => writeFileSync(db, `${JSON.stringify(all, null, 2)}\n`);

if (op === 'list') {
  const all = load();
  process.stdout.write(JSON.stringify({ tickets: Object.entries(all).map(([key, text]) => ({ id: key, text })) }));
} else if (op === 'put' && id) {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const all = load();
  // Compare-and-swap: refuse when someone else changed the ticket since the CLI read it.
  if (all[id] !== undefined && input.previous !== null && all[id] !== input.previous) {
    process.stdout.write(JSON.stringify({ ok: false, error: `${id} changed since it was read` }));
  } else {
    all[id] = input.text;
    save(all);
    process.stdout.write(JSON.stringify({ ok: true }));
  }
} else {
  process.stderr.write(`unknown operation ${op}\n`);
  process.exit(2);
}
