#!/usr/bin/env node
// Bulk-patch CREATE TRIGGER → preceded by DROP TRIGGER IF EXISTS.
// PostgreSQL doesn't support CREATE TRIGGER IF NOT EXISTS, so we inject
// DROP TRIGGER IF EXISTS before every CREATE TRIGGER (except where one
// already exists right above).

import fs from 'node:fs';
import path from 'node:path';

const DIR = 'reports/batches';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

let totalPatched = 0;
let totalFiles = 0;

for (const f of files) {
  const full = path.join(DIR, f);
  const content = fs.readFileSync(full, 'utf8');

  // Match CREATE [OR REPLACE] TRIGGER name [\n] [BEFORE|AFTER|...] ON table
  // (allow newlines between trigger name and ON via [\s\S]*?)
  const re = /CREATE\s+(OR\s+REPLACE\s+)?TRIGGER\s+([a-z_][a-z0-9_]*)[\s\S]*?\s+ON\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi;

  const matches = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    matches.push({
      index: m.index,
      triggerName: m[2],
      tableName: m[3],
    });
  }

  if (matches.length === 0) continue;

  let patched = content;
  let count = 0;

  for (const match of matches.reverse()) {
    const lookbackStart = Math.max(0, match.index - 500);
    const lookback = patched.slice(lookbackStart, match.index);
    const dropRe = new RegExp(
      `DROP\\s+TRIGGER\\s+IF\\s+EXISTS\\s+${match.triggerName}\\s+ON\\s+(?:public\\.)?${match.tableName}\\s*;`,
      'i'
    );
    if (dropRe.test(lookback)) continue;

    let lineStart = match.index;
    while (lineStart > 0 && patched[lineStart - 1] !== '\n') lineStart--;
    const indent = patched.slice(lineStart, match.index);
    const guard = `${indent}DROP TRIGGER IF EXISTS ${match.triggerName} ON ${match.tableName};\n`;
    patched = patched.slice(0, lineStart) + guard + patched.slice(lineStart);
    count++;
  }

  if (count > 0) {
    fs.writeFileSync(full, patched);
    console.log(`  ${f}: +${count} DROP TRIGGER IF EXISTS`);
    totalPatched += count;
    totalFiles++;
  }
}

console.log(`\n${totalFiles} files patched, ${totalPatched} triggers guarded.`);
