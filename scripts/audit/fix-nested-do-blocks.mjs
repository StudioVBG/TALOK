#!/usr/bin/env node
// Fix nested DO $$ ... END $$ blocks injected by constraint patcher.
// PostgreSQL doesn't allow same-delimiter dollar-tags to nest. Convert
// inner DO $$ BEGIN ... EXCEPTION ... END $$; to plain BEGIN ... END;
// (standard PL/pgSQL exception block — no DO needed when nested).

import fs from 'node:fs';
import path from 'node:path';

const DIR = 'reports/batches';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

let totalPatched = 0;
let totalFiles = 0;

for (const f of files) {
  const full = path.join(DIR, f);
  const content = fs.readFileSync(full, 'utf8');
  const lines = content.split('\n');

  let depth = 0;
  let inFnHeader = false;
  let modified = false;
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Detect function/procedure body markers (CREATE FUNCTION ... AS $$ ... $$;)
    // We only care about top-level DO $$ here; CREATE FUNCTION uses different patterns.

    // Match line starting (with possible indent) with "DO $$ BEGIN" or "DO $$"
    const isDoStart = /^\s*DO\s+\$\$\s*(?:BEGIN)?\s*$/i.test(line);
    const isEndDo = /^\s*END\s+\$\$\s*;?\s*$/i.test(line);

    if (isDoStart) {
      if (depth > 0) {
        // This is a nested DO $$ — convert to plain BEGIN
        line = line.replace(/DO\s+\$\$\s*(?:BEGIN)?\s*$/i, 'BEGIN');
        modified = true;
      }
      depth++;
    } else if (isEndDo) {
      depth--;
      if (depth > 0) {
        // This was the close of a nested DO $$ — convert to END;
        line = line.replace(/END\s+\$\$\s*;?\s*$/i, 'END;');
        modified = true;
      }
    }

    newLines.push(line);
  }

  if (modified) {
    fs.writeFileSync(full, newLines.join('\n'));
    console.log(`  ${f}: nested DO blocks unwrapped`);
    totalPatched++;
    totalFiles++;
  }
}

console.log(`\n${totalFiles} files patched.`);
