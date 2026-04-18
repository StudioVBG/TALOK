#!/usr/bin/env node
// Fix patcher injections of DROP TRIGGER ... ON <schema_only>
// (auth, storage, cron, etc.) where schema-prefixed table was truncated.
// Replace with the full schema.table from the next CREATE TRIGGER.

import fs from 'node:fs';
import path from 'node:path';

const DIR = 'reports/batches';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

let totalPatched = 0;

for (const f of files) {
  const full = path.join(DIR, f);
  let content = fs.readFileSync(full, 'utf8');

  // Match malformed DROP TRIGGER lines pointing at a bare schema name
  // (auth/storage/cron). Find the next CREATE TRIGGER ... ON <schema>.<table>
  // and use the full table name.
  const lines = content.split('\n');
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)DROP TRIGGER IF EXISTS (\S+) ON (auth|storage|cron);/);
    if (!m) continue;
    const [, indent, triggerName, schema] = m;

    // Look ahead for CREATE TRIGGER <triggerName> ... ON <schema>.<table>
    const lookahead = lines.slice(i + 1, i + 30).join('\n');
    const createMatch = lookahead.match(
      new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?TRIGGER\\s+${triggerName}[\\s\\S]*?\\s+ON\\s+${schema}\\.([a-z_][a-z0-9_]*)`, 'i')
    );
    if (createMatch) {
      const fullTable = `${schema}.${createMatch[1]}`;
      lines[i] = `${indent}DROP TRIGGER IF EXISTS ${triggerName} ON ${fullTable};`;
      modified = true;
      totalPatched++;
    } else {
      // Can't find target — comment the line out
      lines[i] = `${indent}-- patch sprint-b2: removed broken DROP TRIGGER ON ${schema} (no .table)`;
      modified = true;
      totalPatched++;
    }
  }

  if (modified) {
    fs.writeFileSync(full, lines.join('\n'));
    console.log(`  ${f}: patched`);
  }
}

console.log(`\n${totalPatched} bare-schema DROP TRIGGER lines patched.`);
