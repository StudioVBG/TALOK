#!/usr/bin/env node
// Bulk-patch CREATE INDEX → CREATE INDEX IF NOT EXISTS (same for UNIQUE INDEX).
// Skips indexes already prefixed with IF NOT EXISTS or CONCURRENTLY (which has its own constraints).

import fs from 'node:fs';
import path from 'node:path';

const DIR = 'reports/batches';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

let totalPatched = 0;
let totalFiles = 0;

for (const f of files) {
  const full = path.join(DIR, f);
  const original = fs.readFileSync(full, 'utf8');

  // Match CREATE [UNIQUE] INDEX [CONCURRENTLY] without IF NOT EXISTS
  const re = /\bCREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS\b)(?!CONCURRENTLY\b)([a-z_][a-z0-9_]*)/gi;

  let count = 0;
  const patched = original.replace(re, (match, unique, name) => {
    count++;
    return `CREATE ${unique || ''}INDEX IF NOT EXISTS ${name}`;
  });

  if (count > 0) {
    fs.writeFileSync(full, patched);
    console.log(`  ${f}: +${count} IF NOT EXISTS`);
    totalPatched += count;
    totalFiles++;
  }
}

console.log(`\n${totalFiles} files patched, ${totalPatched} CREATE INDEX statements made idempotent.`);
