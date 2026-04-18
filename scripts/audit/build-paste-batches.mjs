#!/usr/bin/env node
// Build ready-to-paste SQL batches for Sprint B2.
// Each batch: 5 migrations wrapped with progress NOTICE + schema_migrations tracking.

import fs from 'node:fs';
import path from 'node:path';

const BATCH_SIZE = 5;
const data = JSON.parse(fs.readFileSync('reports/sprint-b2-migrations-to-apply.json', 'utf8'));

const phases = { SAFE: [], MODERE: [], DANGEREUX: [], CRITIQUE: [] };
for (const m of data.migrations) {
  (phases[m.risk] || []).push(m);
}

const phaseOrder = ['SAFE', 'MODERE', 'DANGEREUX', 'CRITIQUE'];
const phaseNum = { SAFE: 1, MODERE: 2, DANGEREUX: 3, CRITIQUE: 4 };

const outDir = 'reports/batches';
fs.mkdirSync(outDir, { recursive: true });

// Clean existing
for (const f of fs.readdirSync(outDir)) {
  if (f.endsWith('.sql')) fs.unlinkSync(path.join(outDir, f));
}

const index = [];

for (const phase of phaseOrder) {
  const migrations = phases[phase];
  const totalBatches = Math.ceil(migrations.length / BATCH_SIZE);

  for (let b = 0; b < totalBatches; b++) {
    const batch = migrations.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
    const batchNum = String(b + 1).padStart(2, '0');
    const fname = `phase${phaseNum[phase]}-${phase.toLowerCase()}-batch-${batchNum}.sql`;

    const lines = [];
    lines.push('-- ====================================================================');
    lines.push(`-- Sprint B2 — Phase ${phaseNum[phase]} ${phase} — Batch ${b + 1}/${totalBatches}`);
    lines.push(`-- ${batch.length} migrations`);
    lines.push('--');
    lines.push('-- COMMENT UTILISER :');
    lines.push('--   1. Ouvrir Supabase Dashboard → SQL Editor → New query');
    lines.push('--   2. Coller CE FICHIER ENTIER');
    lines.push('--   3. Cliquer Run');
    lines.push('--   4. Vérifier que les messages NOTICE affichent toutes les migrations en succès');
    lines.push('--   5. Signaler "suivant" pour recevoir le batch suivant');
    lines.push('--');
    lines.push('-- En cas d\'échec : toute la transaction est rollback. Le message d\'erreur indique');
    lines.push('-- la migration fautive. Corriger manuellement puis re-coller ce batch.');
    lines.push('-- ====================================================================');
    lines.push('');
    lines.push('BEGIN;');
    lines.push('');

    for (const m of batch) {
      const content = fs.readFileSync(path.join('supabase/migrations', m.file), 'utf8');
      const version = m.new_timestamp || m.timestamp;
      const name = (m.new_filename || m.file).replace(/^\d+_/, '').replace(/\.sql$/, '');

      lines.push('-- --------------------------------------------------------------------');
      lines.push(`-- Migration: ${m.file}`);
      if (m.new_filename) {
        lines.push(`-- Note: file on disk is ${m.file} but will be renamed to ${m.new_filename}`);
      }
      lines.push(`-- Risk: ${m.risk}`);
      if (m.risk_why) lines.push(`-- Why: ${m.risk_why}`);
      lines.push('-- --------------------------------------------------------------------');
      lines.push(`DO $pre$ BEGIN RAISE NOTICE '▶ Applying ${m.file}'; END $pre$;`);
      lines.push('');
      lines.push(content.trimEnd());
      lines.push('');
      // Track in schema_migrations (idempotent)
      lines.push(`INSERT INTO supabase_migrations.schema_migrations (version, name)`);
      lines.push(`VALUES ('${version}', '${name.replace(/'/g, "''")}')`);
      lines.push(`ON CONFLICT (version) DO NOTHING;`);
      lines.push('');
      lines.push(`DO $post$ BEGIN RAISE NOTICE '✓ Applied  ${m.file}'; END $post$;`);
      lines.push('');
    }

    lines.push('COMMIT;');
    lines.push('');
    lines.push(`-- END OF BATCH ${b + 1}/${totalBatches} (Phase ${phaseNum[phase]} ${phase})`);

    fs.writeFileSync(path.join(outDir, fname), lines.join('\n') + '\n');
    const stats = fs.statSync(path.join(outDir, fname));
    index.push({
      file: fname,
      phase,
      phaseNum: phaseNum[phase],
      batch: b + 1,
      totalBatches,
      migrations: batch.length,
      bytes: stats.size,
    });
  }
}

// Write index
const indexMd = [];
indexMd.push('# Sprint B2 — Index des batches à coller');
indexMd.push('');
indexMd.push(`**${index.length} batches** à appliquer dans l\'ordre.`);
indexMd.push('');
indexMd.push('| # | Phase | Batch | Fichier | Migrations | Taille |');
indexMd.push('|---:|---|---|---|---:|---:|');
index.forEach((b, i) => {
  indexMd.push(`| ${i + 1} | ${b.phase} | ${b.batch}/${b.totalBatches} | \`${b.file}\` | ${b.migrations} | ${(b.bytes / 1024).toFixed(1)} KB |`);
});
indexMd.push('');
indexMd.push('## Protocole par batch');
indexMd.push('');
indexMd.push('1. Ouvrir `reports/batches/<filename>`');
indexMd.push('2. Copier intégralement');
indexMd.push('3. Supabase Dashboard → SQL Editor → Run');
indexMd.push('4. Si succès (NOTICE "✓ Applied" pour chaque migration) → "suivant"');
indexMd.push('5. Si échec → rollback automatique (BEGIN/COMMIT), me signaler l\'erreur');
fs.writeFileSync('reports/batches/INDEX.md', indexMd.join('\n') + '\n');

console.log(`Wrote ${index.length} batches in ${outDir}/`);
console.log('Phase breakdown:');
for (const phase of phaseOrder) {
  const n = index.filter((b) => b.phase === phase).length;
  console.log(`  ${phase}: ${n} batches`);
}
