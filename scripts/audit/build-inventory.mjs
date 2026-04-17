#!/usr/bin/env node
// Sprint A — PASS 1 : build a CSV inventory of all migrations.
// READ-ONLY. Writes to reports/sprint-a-migrations-inventory.csv
//
// Usage: node scripts/audit/build-inventory.mjs

import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = 'supabase/migrations';
const OUTPUT = 'reports/sprint-a-migrations-inventory.csv';
const LAST_APPLIED = '20260208024659';

function parseTimestamp(ts) {
  // Accept 14-char (YYYYMMDDHHMMSS) or 15-char (YYYYMMDDHHMMSSX) variants
  const norm = ts.slice(0, 14).padEnd(14, '0');
  const y = norm.slice(0, 4);
  const m = norm.slice(4, 6);
  const d = norm.slice(6, 8);
  const h = norm.slice(8, 10);
  const mi = norm.slice(10, 12);
  const s = norm.slice(12, 14);
  return `${y}-${m}-${d} ${h}:${mi}:${s}`;
}

function summarize(content) {
  const first = content.split('\n').slice(0, 50);
  const ops = new Set();
  for (const line of first) {
    const upper = line.toUpperCase();
    if (/\bCREATE\s+TABLE\b/.test(upper)) ops.add('CREATE TABLE');
    if (/\bALTER\s+TABLE\b/.test(upper)) ops.add('ALTER TABLE');
    if (/\bDROP\s+TABLE\b/.test(upper)) ops.add('DROP TABLE');
    if (/\bDROP\s+COLUMN\b/.test(upper)) ops.add('DROP COLUMN');
    if (/\bCREATE\s+POLICY\b/.test(upper)) ops.add('CREATE POLICY');
    if (/\bDROP\s+POLICY\b/.test(upper)) ops.add('DROP POLICY');
    if (/\bCREATE\s+(OR\s+REPLACE\s+)?FUNCTION\b/.test(upper)) ops.add('CREATE FUNCTION');
    if (/\bCREATE\s+TRIGGER\b/.test(upper)) ops.add('CREATE TRIGGER');
    if (/\bCREATE\s+INDEX\b/.test(upper)) ops.add('CREATE INDEX');
    if (/\bCREATE\s+(OR\s+REPLACE\s+)?VIEW\b/.test(upper)) ops.add('CREATE VIEW');
    if (/\bCREATE\s+EXTENSION\b/.test(upper)) ops.add('CREATE EXTENSION');
    if (/\bTRUNCATE\b/.test(upper)) ops.add('TRUNCATE');
    if (/\bDELETE\s+FROM\b/.test(upper)) ops.add('DELETE');
    if (/\bINSERT\s+INTO\b/.test(upper)) ops.add('INSERT');
    if (/\bUPDATE\s+/.test(upper) && !/\bUPDATE_/.test(upper)) ops.add('UPDATE');
    if (/cron\.schedule/.test(line)) ops.add('pg_cron schedule');
    if (/\bREVOKE\b/.test(upper)) ops.add('REVOKE');
    if (/\bGRANT\b/.test(upper)) ops.add('GRANT');
  }
  // Also inspect the header comment of the migration
  const commentLine = first.find((l) => l.trim().startsWith('--') && l.trim().length > 5);
  return { ops: [...ops].join('|'), comment: (commentLine || '').replace(/^--\s*/, '').slice(0, 120).trim() };
}

function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/--[^\n]*/g, ''); // line comments
}

function riskLevel(opSet, contentStripped) {
  const set = opSet.split('|').filter(Boolean);
  const up = contentStripped.toUpperCase();

  // CRITIQUE: core tables / auth schema / Stripe tables
  const touchesAuth = /\bAUTH\.USERS\b/.test(up);
  const touchesStripe = /\bSTRIPE_[A-Z_]+\b/.test(up) && /\b(ALTER|DROP)\b/.test(up);
  const coreTableTouched =
    (/\b(DROP|ALTER|TRUNCATE|DELETE)\b/.test(up) &&
      /\b(PROFILES|SUBSCRIPTIONS|LEASES|PROPERTIES|TENANTS|INVOICES)\b/.test(up));
  if (touchesAuth || touchesStripe) return 'CRITIQUE';

  // DANGEREUX
  if (set.includes('DROP TABLE') || set.includes('DROP COLUMN') || set.includes('TRUNCATE')) return 'DANGEREUX';
  if (set.includes('DELETE') && !/\bDELETE\s+FROM\s+[A-Z_.]+\s+WHERE\b/.test(up)) return 'DANGEREUX';
  if (set.includes('DROP POLICY')) return 'DANGEREUX';
  if (coreTableTouched) return 'DANGEREUX';

  // MODÉRÉ
  if (set.includes('CREATE POLICY') || set.includes('CREATE TRIGGER')) return 'MODERE';
  if (/\bADD\s+COLUMN\b(?![^;]*IF\s+NOT\s+EXISTS)[^;]*NOT\s+NULL[^;]*(?!DEFAULT)/i.test(up)) return 'MODERE';
  if (/\bALTER\s+TYPE\b[^;]*\bADD\s+VALUE\b/i.test(up)) return 'MODERE';
  if (/\bRENAME\s+(COLUMN|TO)\b/i.test(up)) return 'MODERE';
  if (set.includes('UPDATE')) return 'MODERE';

  // SAFE par défaut
  return 'SAFE';
}

function csvEscape(s) {
  if (s == null) return '';
  const str = String(s).replace(/"/g, '""');
  if (/[",\n]/.test(str)) return `"${str}"`;
  return str;
}

const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

const rows = [];
rows.push([
  'filename',
  'timestamp',
  'date_readable',
  'size_lines',
  'size_bytes',
  'applied_status',
  'risk_level',
  'ops_detected',
  'summary',
].join(','));

const stats = {
  total: 0,
  applied: 0,
  pending: 0,
  risk: { SAFE: 0, MODERE: 0, DANGEREUX: 0, CRITIQUE: 0 },
  firstPending: null,
  lastPending: null,
  lastApplied: null,
  timestamps: new Map(),
};

for (const f of files) {
  const full = path.join(MIGRATIONS_DIR, f);
  const content = fs.readFileSync(full, 'utf8');
  const lines = content.split('\n').length;
  const bytes = Buffer.byteLength(content, 'utf8');
  const ts = f.split('_')[0];
  const date = parseTimestamp(ts);
  const applied = ts <= LAST_APPLIED ? 'applied' : 'pending';
  const { ops, comment } = summarize(content);
  const stripped = stripComments(content);
  const risk = riskLevel(ops, stripped);

  stats.total++;
  if (applied === 'applied') stats.applied++;
  else {
    stats.pending++;
    if (!stats.firstPending) stats.firstPending = f;
    stats.lastPending = f;
  }
  if (applied === 'applied') stats.lastApplied = f;
  stats.risk[risk] = (stats.risk[risk] || 0) + 1;

  // Track duplicate timestamps
  const existing = stats.timestamps.get(ts) || [];
  existing.push(f);
  stats.timestamps.set(ts, existing);

  rows.push(
    [
      csvEscape(f),
      csvEscape(ts),
      csvEscape(date),
      csvEscape(lines),
      csvEscape(bytes),
      csvEscape(applied),
      csvEscape(risk),
      csvEscape(ops),
      csvEscape(comment),
    ].join(',')
  );
}

fs.writeFileSync(OUTPUT, rows.join('\n') + '\n', 'utf8');

// Dump duplicate timestamps
const dupes = [...stats.timestamps.entries()].filter(([, v]) => v.length > 1);

// Summary JSON for other passes to consume
const dupesObj = Object.fromEntries(dupes);
fs.writeFileSync(
  'reports/sprint-a-pass1-stats.json',
  JSON.stringify(
    {
      total: stats.total,
      applied: stats.applied,
      pending: stats.pending,
      lastAppliedCutoff: LAST_APPLIED,
      lastAppliedFile: stats.lastApplied,
      firstPending: stats.firstPending,
      lastPending: stats.lastPending,
      risk: stats.risk,
      duplicateTimestampsCount: dupes.length,
      duplicates: dupesObj,
    },
    null,
    2
  )
);

console.log(`Wrote ${OUTPUT} with ${stats.total} rows`);
console.log('Applied:', stats.applied, '| Pending:', stats.pending);
console.log('Risk:', stats.risk);
console.log('Duplicate timestamps:', dupes.length);
console.log('First pending:', stats.firstPending);
console.log('Last pending:', stats.lastPending);
