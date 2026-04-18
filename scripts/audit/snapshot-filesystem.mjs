#!/usr/bin/env node
// Sprint B1 — PASS 2
// Read-only snapshot of supabase/migrations/*.sql with SHA-256 hash
// and first real SQL operation.
//
// Output: reports/sprint-b1-filesystem-migrations.json

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DIR = 'supabase/migrations';
const OUTPUT = 'reports/sprint-b1-filesystem-migrations.json';

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function firstOperation(content) {
  // strip comments
  const code = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
  const lines = code.split('\n');
  const patterns = [
    /^\s*CREATE\s+TABLE\b/i,
    /^\s*CREATE\s+INDEX\b/i,
    /^\s*CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\b/i,
    /^\s*CREATE\s+(OR\s+REPLACE\s+)?VIEW\b/i,
    /^\s*CREATE\s+(OR\s+REPLACE\s+)?TRIGGER\b/i,
    /^\s*CREATE\s+POLICY\b/i,
    /^\s*CREATE\s+EXTENSION\b/i,
    /^\s*CREATE\s+TYPE\b/i,
    /^\s*CREATE\s+SEQUENCE\b/i,
    /^\s*ALTER\s+TABLE\b/i,
    /^\s*ALTER\s+TYPE\b/i,
    /^\s*DROP\s+TABLE\b/i,
    /^\s*DROP\s+COLUMN\b/i,
    /^\s*DROP\s+POLICY\b/i,
    /^\s*DROP\s+FUNCTION\b/i,
    /^\s*INSERT\s+INTO\b/i,
    /^\s*UPDATE\s+/i,
    /^\s*DELETE\s+FROM\b/i,
    /^\s*TRUNCATE\b/i,
    /^\s*DO\s+\$\$/i,
    /^\s*SELECT\s+cron\.schedule/i,
    /^\s*GRANT\b/i,
    /^\s*REVOKE\b/i,
  ];
  for (const line of lines) {
    for (const pat of patterns) {
      if (pat.test(line)) {
        const match = line.match(/^\s*([A-Z]+(?:\s+[A-Z]+){0,3})/i);
        return match ? match[1].trim().toUpperCase() : line.trim().slice(0, 40);
      }
    }
  }
  return 'UNKNOWN';
}

function parseFilename(f) {
  // Accept both 14-digit (YYYYMMDDHHMMSS) and 12-digit (YYYYMMDDHHMM)
  // legacy formats. Normalize 12-digit to 14-digit by appending "00".
  const m = f.match(/^(\d{12,16})_(.+)\.sql$/);
  if (!m) return { timestamp: null, timestamp_raw: null, name: f.replace(/\.sql$/, ''), ts_format: 'unknown' };
  const raw = m[1];
  let normalized = raw;
  let format = raw.length + '-digit';
  if (raw.length === 12) normalized = raw + '00';
  else if (raw.length === 13) normalized = raw + '0';
  else if (raw.length === 15) normalized = raw.slice(0, 14); // trim 1 trailing
  else if (raw.length === 16) normalized = raw.slice(0, 14); // trim 2 trailing
  return { timestamp: normalized, timestamp_raw: raw, name: m[2], ts_format: format };
}

const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const rows = [];
for (const f of files) {
  const full = path.join(DIR, f);
  const buf = fs.readFileSync(full);
  const content = buf.toString('utf8');
  const { timestamp, timestamp_raw, name, ts_format } = parseFilename(f);
  rows.push({
    filename: f,
    timestamp,
    timestamp_raw,
    ts_format,
    name,
    size_bytes: buf.length,
    size_lines: content.split('\n').length,
    sha256: sha256(buf),
    first_operation: firstOperation(content),
  });
}

// Duplicates by timestamp
const byTs = {};
for (const r of rows) {
  if (!r.timestamp) continue;
  (byTs[r.timestamp] ||= []).push(r);
}
const duplicates = Object.entries(byTs)
  .filter(([, arr]) => arr.length > 1)
  .map(([ts, arr]) => ({
    timestamp: ts,
    count: arr.length,
    files: arr.map((r) => r.filename),
    all_hashes_identical: new Set(arr.map((r) => r.sha256)).size === 1,
    hashes: arr.map((r) => ({ file: r.filename, sha256: r.sha256 })),
  }));

const out = {
  _generated_at: new Date().toISOString(),
  _source: 'supabase/migrations/*.sql',
  total_files: rows.length,
  unique_timestamps: Object.keys(byTs).length,
  duplicates_count: duplicates.length,
  duplicates,
  migrations: rows,
};

fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2));
console.log(`Wrote ${OUTPUT}`);
console.log(`Files: ${rows.length}`);
console.log(`Unique timestamps: ${Object.keys(byTs).length}`);
console.log(`Duplicate timestamp groups: ${duplicates.length}`);
for (const d of duplicates) {
  console.log(
    `  - ${d.timestamp}: ${d.count} files, hashes ${d.all_hashes_identical ? 'IDENTICAL' : 'DIFFER'}`
  );
}
