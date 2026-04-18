#!/usr/bin/env node
// Preventive patch v2: inject DROP POLICY IF EXISTS before every CREATE POLICY,
// supporting multi-line CREATE POLICY "name" \n ON table.

import fs from 'node:fs';
import path from 'node:path';

const DIR = 'reports/batches';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

let totalPatched = 0;
let totalFiles = 0;

for (const f of files) {
  const full = path.join(DIR, f);
  const content = fs.readFileSync(full, 'utf8');

  // Multi-line regex: capture full CREATE POLICY statement up to ON table.
  // Use [\s\S]*? to allow any chars (incl newlines) between name and ON.
  const re = /CREATE\s+POLICY\s+(?:IF\s+NOT\s+EXISTS\s+)?("[^"]+"|[a-z_][a-z0-9_]*)[\s\S]*?\s+ON\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi;

  // Process matches in reverse order to preserve offsets when patching
  const matches = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    matches.push({
      index: m.index,
      length: m[0].length,
      policyName: m[1],
      tableName: m[2],
    });
  }

  if (matches.length === 0) continue;

  let patched = content;
  let count = 0;

  // Reverse so injections don't shift earlier indices
  for (const match of matches.reverse()) {
    // Look back ~600 chars before the CREATE POLICY for an existing DROP POLICY IF EXISTS
    const lookbackStart = Math.max(0, match.index - 600);
    const lookback = patched.slice(lookbackStart, match.index);
    const escapedName = match.policyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dropRe = new RegExp(
      `DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+${escapedName}\\s+ON\\s+(?:public\\.)?${match.tableName}\\s*;`,
      'i'
    );
    if (dropRe.test(lookback)) continue; // already guarded

    // Inject just before the CREATE POLICY line.
    // Find the start of the line containing match.index.
    let lineStart = match.index;
    while (lineStart > 0 && patched[lineStart - 1] !== '\n') lineStart--;
    const indent = patched.slice(lineStart, match.index);
    const guard = `${indent}DROP POLICY IF EXISTS ${match.policyName} ON ${match.tableName};\n`;
    patched = patched.slice(0, lineStart) + guard + patched.slice(lineStart);
    count++;
  }

  if (count > 0) {
    fs.writeFileSync(full, patched);
    console.log(`  ${f}: +${count} guards`);
    totalPatched += count;
    totalFiles++;
  }
}

console.log(`\n${totalFiles} files patched, ${totalPatched} guards injected.`);
