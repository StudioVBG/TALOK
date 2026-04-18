#!/usr/bin/env node
// Preventive patch: inject DROP POLICY IF EXISTS before every CREATE POLICY
// in all remaining batch files (idempotency guard).

import fs from 'node:fs';
import path from 'node:path';

const DIR = 'reports/batches';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

let totalPatched = 0;
let totalFiles = 0;

for (const f of files) {
  const full = path.join(DIR, f);
  const content = fs.readFileSync(full, 'utf8');

  // Match CREATE POLICY "name" ON [schema.]table — capture name, table.
  // Allow optional newlines/whitespace between "ON" and table.
  const re = /CREATE\s+POLICY\s+(?:IF\s+NOT\s+EXISTS\s+)?("([^"]+)"|([a-z_][a-z0-9_]*))\s+ON\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi;

  let patched = content;
  let count = 0;
  const lines = patched.split('\n');
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^\s*CREATE\s+POLICY\s+(?:IF\s+NOT\s+EXISTS\s+)?("[^"]+"|[a-z_][a-z0-9_]*)\s+ON\s+(?:public\.)?([a-z_][a-z0-9_]*)/i);
    if (match) {
      const policyName = match[1]; // includes quotes if present
      const tableName = match[2];
      // Check if previous non-blank line is already a DROP POLICY for the same name+table
      let j = i - 1;
      while (j >= 0 && lines[j].trim() === '') j--;
      const prevLine = j >= 0 ? lines[j] : '';
      const dropRe = new RegExp(
        `DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+${policyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+ON\\s+(public\\.)?${tableName}`,
        'i'
      );
      if (!dropRe.test(prevLine)) {
        // Inject DROP POLICY IF EXISTS before this CREATE POLICY
        const indent = line.match(/^\s*/)[0];
        newLines.push(`${indent}DROP POLICY IF EXISTS ${policyName} ON ${tableName};`);
        count++;
      }
    }
    newLines.push(line);
  }

  if (count > 0) {
    fs.writeFileSync(full, newLines.join('\n'));
    console.log(`  ${f}: +${count} DROP POLICY IF EXISTS`);
    totalPatched += count;
    totalFiles++;
  }
}

console.log(`\nDone. ${totalFiles} files patched, ${totalPatched} guards injected.`);
