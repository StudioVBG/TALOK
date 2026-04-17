#!/usr/bin/env node
// PASS 4 — Refined risk categorization.
// READ-ONLY. Produces:
//   reports/sprint-a-migrations-by-risk.md
//   reports/sprint-a-pending-details.json (per-file op summary, used by PASS 5)

import fs from 'node:fs';
import path from 'node:path';

const LAST_APPLIED = '20260208024659';
const DIR = 'supabase/migrations';

function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
}

function extractOps(sql) {
  const code = stripComments(sql);
  const ops = {
    createTable: [],
    dropTable: [],
    alterTableAddColumn: [],
    alterTableDropColumn: [],
    alterTableRenameColumn: [],
    alterTableAlterColumn: [],
    createPolicy: [],
    dropPolicy: [],
    createTrigger: [],
    createFunction: [],
    createView: [],
    createIndex: [],
    createIndexConcurrently: [],
    createExtension: [],
    alterTypeAddValue: [],
    truncate: [],
    deleteNoWhere: [],
    updateNoWhere: [],
    updateAny: [],
    insertInto: [],
    touchesAuthUsers: false,
    touchesStripeTables: false,
    touchesCoreTablesDestructive: false,
    cronSchedule: false,
    revoke: false,
    grant: false,
    altersProfiles: false,
    altersSubscriptions: false,
    altersLeases: false,
    altersProperties: false,
  };

  const coreTables = ['profiles', 'subscriptions', 'leases', 'properties', 'tenants', 'invoices'];

  // CREATE TABLE
  for (const m of code.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
    ops.createTable.push(m[1].toLowerCase());
  }
  // DROP TABLE
  for (const m of code.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
    ops.dropTable.push(m[1].toLowerCase());
  }
  // ALTER TABLE X ADD COLUMN
  for (const m of code.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)[^;]*?\bADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)[^;]*/gi)) {
    ops.alterTableAddColumn.push(`${m[1].toLowerCase()}.${m[2].toLowerCase()}`);
  }
  // DROP COLUMN
  for (const m of code.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)[^;]*?\bDROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi)) {
    ops.alterTableDropColumn.push(`${m[1].toLowerCase()}.${m[2].toLowerCase()}`);
  }
  // RENAME COLUMN
  for (const m of code.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)[^;]*?\bRENAME\s+COLUMN\s+([a-z_][a-z0-9_]*)\s+TO\s+([a-z_][a-z0-9_]*)/gi)) {
    ops.alterTableRenameColumn.push(`${m[1].toLowerCase()}.${m[2].toLowerCase()} -> ${m[3].toLowerCase()}`);
  }
  // ALTER COLUMN (type / constraints)
  for (const m of code.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)[^;]*?\bALTER\s+COLUMN\s+([a-z_][a-z0-9_]*)/gi)) {
    ops.alterTableAlterColumn.push(`${m[1].toLowerCase()}.${m[2].toLowerCase()}`);
  }
  // CREATE POLICY
  for (const m of code.matchAll(/CREATE\s+POLICY\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?([a-z0-9_ ]+?)["']?\s+ON\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
    ops.createPolicy.push(`${m[2].toLowerCase()}:${m[1].toLowerCase().trim()}`);
  }
  // DROP POLICY
  for (const m of code.matchAll(/DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?["']?([a-z0-9_ ]+?)["']?\s+ON\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
    ops.dropPolicy.push(`${m[2].toLowerCase()}:${m[1].toLowerCase().trim()}`);
  }
  // CREATE TRIGGER
  for (const m of code.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([a-z_][a-z0-9_]*)/gi)) {
    ops.createTrigger.push(m[1].toLowerCase());
  }
  // CREATE FUNCTION
  for (const m of code.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
    ops.createFunction.push(m[1].toLowerCase());
  }
  // CREATE VIEW
  for (const m of code.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
    ops.createView.push(m[1].toLowerCase());
  }
  // CREATE INDEX
  for (const m of code.matchAll(/CREATE\s+(UNIQUE\s+)?INDEX\s+(CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi)) {
    if (m[2]) ops.createIndexConcurrently.push(m[3].toLowerCase());
    else ops.createIndex.push(m[3].toLowerCase());
  }
  // CREATE EXTENSION
  for (const m of code.matchAll(/CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi)) {
    ops.createExtension.push(m[1].toLowerCase());
  }
  // ALTER TYPE ADD VALUE
  for (const m of code.matchAll(/ALTER\s+TYPE\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+ADD\s+VALUE\s+(?:IF\s+NOT\s+EXISTS\s+)?'([^']+)'/gi)) {
    ops.alterTypeAddValue.push(`${m[1].toLowerCase()}:${m[2]}`);
  }
  // TRUNCATE
  for (const m of code.matchAll(/TRUNCATE\s+(?:TABLE\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
    ops.truncate.push(m[1].toLowerCase());
  }
  // DELETE FROM X ... (we want to flag no WHERE)
  for (const m of code.matchAll(/DELETE\s+FROM\s+(?:public\.)?([a-z_][a-z0-9_]*)([^;]*?)(?:;|$)/gis)) {
    const tail = m[2] || '';
    if (!/\bWHERE\b/i.test(tail)) {
      ops.deleteNoWhere.push(m[1].toLowerCase());
    }
  }
  // UPDATE X
  for (const m of code.matchAll(/\bUPDATE\s+(?:public\.)?([a-z_][a-z0-9_]*)([^;]*?)(?:;|$)/gis)) {
    const tail = m[2] || '';
    // Exclude "UPDATE ... SET" inside CREATE RULE / CREATE TRIGGER / functions → keep simple
    const tableName = m[1].toLowerCase();
    if (!/^[a-z_]+$/i.test(tableName)) continue;
    if (tableName === 'set') continue;
    ops.updateAny.push(tableName);
    if (!/\bWHERE\b/i.test(tail)) ops.updateNoWhere.push(tableName);
  }
  // INSERT INTO
  for (const m of code.matchAll(/INSERT\s+INTO\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
    ops.insertInto.push(m[1].toLowerCase());
  }

  ops.touchesAuthUsers = /\bauth\.users\b/i.test(code);
  ops.touchesStripeTables =
    /\b(ALTER|DROP)\s+TABLE\s+(IF\s+EXISTS\s+)?(public\.)?stripe_[a-z_]+/i.test(code) ||
    /\b(ALTER|DROP)\s+TABLE\s+(IF\s+EXISTS\s+)?(public\.)?(subscriptions|subscription_items|subscription_plans|subscription_addons)/i.test(
      code
    );
  ops.cronSchedule = /cron\.schedule/.test(code);
  ops.revoke = /\bREVOKE\b/i.test(code);
  ops.grant = /\bGRANT\b/i.test(code);

  // Core table destructive touches (DROP table or DROP column on core table)
  for (const t of coreTables) {
    if (ops.dropTable.includes(t)) ops.touchesCoreTablesDestructive = true;
    if (ops.alterTableDropColumn.some((c) => c.startsWith(`${t}.`))) ops.touchesCoreTablesDestructive = true;
    if (ops.truncate.includes(t)) ops.touchesCoreTablesDestructive = true;
  }

  ops.altersProfiles = ops.alterTableAddColumn.some((c) => c.startsWith('profiles.'))
    || ops.alterTableDropColumn.some((c) => c.startsWith('profiles.'))
    || ops.alterTableAlterColumn.some((c) => c.startsWith('profiles.'));
  ops.altersSubscriptions = ops.alterTableAddColumn.some((c) => c.startsWith('subscriptions.'))
    || ops.alterTableDropColumn.some((c) => c.startsWith('subscriptions.'))
    || ops.alterTableAlterColumn.some((c) => c.startsWith('subscriptions.'));
  ops.altersLeases = ops.alterTableAddColumn.some((c) => c.startsWith('leases.'))
    || ops.alterTableDropColumn.some((c) => c.startsWith('leases.'))
    || ops.alterTableAlterColumn.some((c) => c.startsWith('leases.'));
  ops.altersProperties = ops.alterTableAddColumn.some((c) => c.startsWith('properties.'))
    || ops.alterTableDropColumn.some((c) => c.startsWith('properties.'))
    || ops.alterTableAlterColumn.some((c) => c.startsWith('properties.'));

  return ops;
}

function classify(ops, filename) {
  // CRITIQUE
  if (ops.touchesAuthUsers) return { level: 'CRITIQUE', why: 'Touche auth.users' };
  if (ops.touchesStripeTables) return { level: 'CRITIQUE', why: 'ALTER/DROP sur table billing (stripe_* / subscriptions*)' };
  if (ops.touchesCoreTablesDestructive)
    return { level: 'CRITIQUE', why: 'DROP/TRUNCATE sur table core (profiles/leases/...)' };

  // DANGEREUX
  if (ops.dropTable.length > 0) return { level: 'DANGEREUX', why: `DROP TABLE : ${ops.dropTable.join(',')}` };
  if (ops.alterTableDropColumn.length > 0)
    return { level: 'DANGEREUX', why: `DROP COLUMN : ${ops.alterTableDropColumn.join(',')}` };
  if (ops.truncate.length > 0) return { level: 'DANGEREUX', why: `TRUNCATE : ${ops.truncate.join(',')}` };
  if (ops.deleteNoWhere.length > 0)
    return { level: 'DANGEREUX', why: `DELETE sans WHERE : ${ops.deleteNoWhere.join(',')}` };
  if (ops.updateNoWhere.length > 0)
    return { level: 'DANGEREUX', why: `UPDATE sans WHERE : ${ops.updateNoWhere.join(',')}` };

  // MODÉRÉ
  const reasons = [];
  if (ops.createPolicy.length > 0) reasons.push(`+${ops.createPolicy.length} policies`);
  if (ops.dropPolicy.length > 0) reasons.push(`-${ops.dropPolicy.length} policies`);
  if (ops.createTrigger.length > 0) reasons.push(`+${ops.createTrigger.length} triggers`);
  if (ops.alterTableRenameColumn.length > 0) reasons.push('RENAME column');
  if (ops.alterTableAlterColumn.length > 0) reasons.push('ALTER column (type/constraint)');
  if (ops.alterTypeAddValue.length > 0) reasons.push(`+${ops.alterTypeAddValue.length} enum values`);
  if (ops.updateAny.length > 0) reasons.push('UPDATE');
  // Add column NOT NULL without DEFAULT = risky
  // We already captured alterTableAddColumn names; we'd need the raw line — approximate check:
  if (reasons.length > 0) return { level: 'MODERE', why: reasons.join(', ') };

  // SAFE
  return { level: 'SAFE', why: 'Idempotent / structural only' };
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const allResults = [];
const pendingResults = [];

for (const f of files) {
  const content = fs.readFileSync(path.join(DIR, f), 'utf8');
  const ts = f.split('_')[0];
  const isPending = ts > LAST_APPLIED;
  const ops = extractOps(content);
  const { level, why } = classify(ops, f);
  const entry = { file: f, timestamp: ts, isPending, level, why, ops };
  allResults.push(entry);
  if (isPending) pendingResults.push(entry);
}

// Write per-file JSON for PASS 5
fs.writeFileSync(
  'reports/sprint-a-pending-details.json',
  JSON.stringify(pendingResults, null, 2)
);

// Build markdown report
const byLevel = { CRITIQUE: [], DANGEREUX: [], MODERE: [], SAFE: [] };
for (const r of pendingResults) byLevel[r.level].push(r);

const md = [];
md.push('# Sprint A — PASS 4 : Migrations pending par niveau de risque');
md.push('');
md.push(`Cutoff : appliquées = timestamp ≤ \`${LAST_APPLIED}\`.`);
md.push(`Total pending analysées : **${pendingResults.length}**.`);
md.push('');
md.push('| Niveau | Nombre | % |');
md.push('|---|---:|---:|');
for (const lvl of ['CRITIQUE', 'DANGEREUX', 'MODERE', 'SAFE']) {
  const n = byLevel[lvl].length;
  const pct = ((n / pendingResults.length) * 100).toFixed(1);
  md.push(`| ${lvl} | ${n} | ${pct}% |`);
}

md.push('');
md.push('---');
md.push('');

for (const lvl of ['CRITIQUE', 'DANGEREUX', 'MODERE', 'SAFE']) {
  md.push(`## 🔸 ${lvl} (${byLevel[lvl].length})`);
  md.push('');
  if (byLevel[lvl].length === 0) {
    md.push('_Aucune._');
    md.push('');
    continue;
  }
  md.push('| # | Migration | Raison |');
  md.push('|---:|---|---|');
  byLevel[lvl].forEach((r, i) => {
    const short = r.why.length > 80 ? r.why.slice(0, 77) + '…' : r.why;
    md.push(`| ${i + 1} | \`${r.file}\` | ${short.replace(/\|/g, '\\|')} |`);
  });
  md.push('');
}

fs.writeFileSync('reports/sprint-a-migrations-by-risk.md', md.join('\n') + '\n');

// Dump stats for summary
fs.writeFileSync(
  'reports/sprint-a-pass4-stats.json',
  JSON.stringify(
    {
      pendingCount: pendingResults.length,
      byLevel: Object.fromEntries(
        Object.entries(byLevel).map(([k, v]) => [k, v.length])
      ),
    },
    null,
    2
  )
);

console.log('Pending:', pendingResults.length);
for (const lvl of ['CRITIQUE', 'DANGEREUX', 'MODERE', 'SAFE']) {
  console.log(`  ${lvl}: ${byLevel[lvl].length}`);
}
