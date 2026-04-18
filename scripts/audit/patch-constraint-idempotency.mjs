#!/usr/bin/env node
// Bulk-patch ALTER TABLE ... ADD CONSTRAINT to be idempotent.
// Wrap each statement in DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;
// PostgreSQL doesn't support ADD CONSTRAINT IF NOT EXISTS.

import fs from 'node:fs';
import path from 'node:path';

const DIR = 'reports/batches';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

let totalPatched = 0;
let totalFiles = 0;

for (const f of files) {
  const full = path.join(DIR, f);
  const content = fs.readFileSync(full, 'utf8');

  // Match ALTER TABLE [IF EXISTS] table_name ADD CONSTRAINT name <stuff>;
  // Skip if already inside a DO block (lookback for "DO $$" without intervening "END $$;")
  const re = /^(\s*)(ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?[a-z_][a-z0-9_]*\s+ADD\s+CONSTRAINT\s+([a-z_][a-z0-9_]*)[\s\S]*?;)/gim;

  const matches = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    matches.push({
      index: m.index,
      length: m[0].length,
      indent: m[1],
      stmt: m[2],
      constraintName: m[3],
    });
  }

  if (matches.length === 0) continue;

  let patched = content;
  let count = 0;

  for (const match of matches.reverse()) {
    // Skip if already inside a DO block (rough check: look for "DO $$" before w/o matching END)
    const lookback = patched.slice(Math.max(0, match.index - 600), match.index);
    const doMatches = (lookback.match(/DO\s+\$\$/gi) || []).length;
    const endMatches = (lookback.match(/END\s+\$\$/gi) || []).length;
    if (doMatches > endMatches) continue; // already inside a DO block

    // Skip if next chars (rest of file) start with EXCEPTION (already wrapped)
    const lookforward = patched.slice(match.index + match.length, match.index + match.length + 200);
    if (/^\s*EXCEPTION\s+WHEN/i.test(lookforward)) continue;

    const wrapped = `${match.indent}DO $$ BEGIN
${match.indent}  ${match.stmt.trim()}
${match.indent}EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
${match.indent}END $$;`;
    patched = patched.slice(0, match.index) + wrapped + patched.slice(match.index + match.length);
    count++;
  }

  if (count > 0) {
    fs.writeFileSync(full, patched);
    console.log(`  ${f}: +${count} constraint guards`);
    totalPatched += count;
    totalFiles++;
  }
}

console.log(`\n${totalFiles} files patched, ${totalPatched} ALTER TABLE ADD CONSTRAINT wrapped.`);
