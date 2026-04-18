#!/usr/bin/env node
// Sprint B1 — PASS 5
// Generate a rename plan for the 13 duplicate-timestamp groups.
//
// Rules:
// - Hashes all differ in every group (PASS 2 confirmed) → no pure
//   duplicates to delete. Every file stays. Only timestamps change.
// - Within a group, files are sorted by name (alphabetical). The
//   first keeps its timestamp; subsequent files get timestamp+1,
//   +2, ... seconds.
// - If PASS 3 had flagged one file as MATCHED (already in prod under
//   that exact timestamp), that file would keep the timestamp and
//   others would shift; in degraded mode (PASS 1 stub) we cannot
//   know, so we use alphabetical order and document the assumption.
// - We DO NOT execute renames — only propose them.

import fs from 'node:fs';

const fsSnap = JSON.parse(fs.readFileSync('reports/sprint-b1-filesystem-migrations.json', 'utf8'));
const matrix = JSON.parse(fs.readFileSync('reports/sprint-b1-reconciliation-matrix.json', 'utf8'));

function addSeconds(ts, n) {
  // ts is 14-digit YYYYMMDDHHMMSS. Interpret as UTC and add n seconds.
  const y = parseInt(ts.slice(0, 4), 10);
  const mo = parseInt(ts.slice(4, 6), 10) - 1;
  const d = parseInt(ts.slice(6, 8), 10);
  const h = parseInt(ts.slice(8, 10), 10);
  const mi = parseInt(ts.slice(10, 12), 10);
  const s = parseInt(ts.slice(12, 14), 10);
  const dt = new Date(Date.UTC(y, mo, d, h, mi, s + n));
  const pad = (x, w = 2) => String(x).padStart(w, '0');
  return (
    pad(dt.getUTCFullYear(), 4) +
    pad(dt.getUTCMonth() + 1) +
    pad(dt.getUTCDate()) +
    pad(dt.getUTCHours()) +
    pad(dt.getUTCMinutes()) +
    pad(dt.getUTCSeconds())
  );
}

// Build the plan
const plan = [];
const takenTimestamps = new Set(
  fsSnap.migrations.filter((m) => m.timestamp).map((m) => m.timestamp)
);

for (const group of fsSnap.duplicates) {
  const sortedFiles = [...group.files].sort();
  const baseTs = group.timestamp;

  // First file keeps its timestamp, others get +1, +2, ...
  sortedFiles.forEach((file, idx) => {
    if (idx === 0) {
      plan.push({
        timestamp: baseTs,
        file,
        new_filename: null,
        action: 'keep',
        reason: 'Alphabetically first — keeps the base timestamp',
        hash_prefix: fsSnap.migrations.find((m) => m.filename === file)?.sha256.slice(0, 12),
      });
      return;
    }
    let offset = idx;
    let candidate = addSeconds(baseTs, offset);
    // Avoid creating a new collision with an existing timestamp
    while (takenTimestamps.has(candidate)) {
      offset++;
      candidate = addSeconds(baseTs, offset);
    }
    takenTimestamps.add(candidate);
    const nameSuffix = file.replace(/^\d+_/, '');
    const newName = `${candidate}_${nameSuffix}`;
    plan.push({
      timestamp: baseTs,
      file,
      new_timestamp: candidate,
      new_filename: newName,
      offset_seconds: offset,
      action: 'rename',
      reason: `Alphabetical position #${idx + 1} — shifted by +${offset}s`,
      hash_prefix: fsSnap.migrations.find((m) => m.filename === file)?.sha256.slice(0, 12),
    });
  });
}

// Write markdown report
const md = [];
md.push('# Sprint B1 — PASS 5 : Plan de dédup des timestamps dupliqués');
md.push('');
md.push('## Stratégie');
md.push('');
md.push('Tous les 13 groupes ont des **hashes divergents** → ce sont de vraies migrations distinctes, aucune à supprimer. Le plan est donc uniquement un **renommage** :');
md.push('');
md.push('1. Dans chaque groupe, trier les fichiers par nom (alphabétique) → détermine l\'ordre d\'exécution logique');
md.push('2. Le premier garde son timestamp');
md.push('3. Les suivants sont décalés de +1s, +2s, ...');
md.push('4. Éviter les collisions avec d\'autres timestamps existants (pas un cas rencontré ici)');
md.push('5. **Renommages non exécutés** — voir `scripts/audit/apply-dedup-renames.sh`');
md.push('');

if (matrix._degraded) {
  md.push('> ⚠️ **Mode dégradé** (PASS 1 stub) : on ne peut pas savoir si l\'une des files d\'un groupe est déjà dans `supabase_migrations.schema_migrations`. Si c\'est le cas, elle **doit** garder son timestamp (ne pas renommer), sinon `schema_migrations` pointerait vers un fichier inexistant.');
  md.push('>');
  md.push('> **Pré-requis avant d\'appliquer** : re-run ce script après PASS 1 peuplé pour privilégier les fichiers MATCHED.');
  md.push('');
}

md.push('## Aperçu par groupe');
md.push('');

for (const group of fsSnap.duplicates) {
  md.push(`### \`${group.timestamp}\` — ${group.count} fichiers`);
  md.push('');
  md.push('| Rôle | Fichier actuel | Nouveau nom | Hash prefix |');
  md.push('|---|---|---|---|');
  const groupPlan = plan.filter((p) => p.timestamp === group.timestamp);
  for (const p of groupPlan) {
    const newName = p.action === 'keep' ? '_(inchangé)_' : `\`${p.new_filename}\``;
    md.push(`| ${p.action} | \`${p.file}\` | ${newName} | \`${p.hash_prefix}…\` |`);
  }
  md.push('');
}

md.push('## Plan consolidé');
md.push('');
md.push(`- Total fichiers concernés : **${plan.length}**`);
md.push(`- Action \`keep\` : **${plan.filter((p) => p.action === 'keep').length}**`);
md.push(`- Action \`rename\` : **${plan.filter((p) => p.action === 'rename').length}**`);
md.push('');

md.push('## Exécution proposée (pour Thomas)');
md.push('');
md.push('Le script `scripts/audit/apply-dedup-renames.sh` contient les commandes `git mv` **commentées**. Protocole :');
md.push('');
md.push('1. PASS 1 exécuté → confirmer qu\'aucun des fichiers "rename" n\'est déjà dans `schema_migrations` avec ce timestamp');
md.push('2. Ouvrir `apply-dedup-renames.sh`, décommenter les lignes une par une');
md.push('3. Créer une branche `chore/migrations-dedup-timestamps`');
md.push('4. Exécuter les `git mv`');
md.push('5. Pour chaque renommage, si le fichier source est déjà dans `schema_migrations` prod : ajouter une ligne `UPDATE supabase_migrations.schema_migrations SET version = \'<nouveau>\' WHERE version = \'<ancien>\';` dans `sprint-b1-reconciliation-sql.sql` (PASS 6)');
md.push('6. Commit + review + merge');
md.push('');

fs.writeFileSync('reports/sprint-b1-dedup-plan.md', md.join('\n') + '\n');
fs.writeFileSync(
  'reports/sprint-b1-dedup-plan.json',
  JSON.stringify({ _generated_at: new Date().toISOString(), plan }, null, 2)
);

// Write the NON-EXECUTABLE shell script (chmod -x)
const sh = [];
sh.push('#!/usr/bin/env bash');
sh.push('# Sprint B1 — PASS 5 : renommage des 13 groupes de timestamps dupliqués');
sh.push('#');
sh.push('# ⚠️ NE PAS EXÉCUTER SANS VALIDATION HUMAINE');
sh.push('# ⚠️ PRÉ-REQUIS :');
sh.push('#   1. PASS 1 (schema_migrations snapshot) exécuté et validé');
sh.push('#   2. Aucun des fichiers ci-dessous n\'est MATCHED en prod (sinon le');
sh.push('#      renommage casserait `supabase_migrations.schema_migrations`)');
sh.push('#   3. Branche dédiée : `git checkout -b chore/migrations-dedup-timestamps`');
sh.push('#   4. Décommenter les lignes une par une et inspecter le diff');
sh.push('#');
sh.push('# Pour chaque rename, si le fichier source est déjà appliqué en prod :');
sh.push('#   UPDATE supabase_migrations.schema_migrations');
sh.push('#     SET version = \'<nouveau>\' WHERE version = \'<ancien>\';');
sh.push('# (cf. reports/sprint-b1-reconciliation-sql.sql — PASS 6)');
sh.push('');
sh.push('set -euo pipefail');
sh.push('');
sh.push('echo "This script is in dry-run mode by default. Exit to confirm you read it."');
sh.push('read -p "Press Enter to see the plan (no writes): "');
sh.push('');
const grouped = {};
for (const p of plan) {
  (grouped[p.timestamp] ||= []).push(p);
}
for (const [ts, items] of Object.entries(grouped)) {
  sh.push(`# ========== ${ts} (${items.length} fichiers) ==========`);
  for (const p of items) {
    if (p.action === 'keep') {
      sh.push(`# keep:   supabase/migrations/${p.file}`);
    } else {
      sh.push(`# rename: supabase/migrations/${p.file}`);
      sh.push(`#     →   supabase/migrations/${p.new_filename}`);
      sh.push(`# git mv "supabase/migrations/${p.file}" "supabase/migrations/${p.new_filename}"`);
    }
  }
  sh.push('');
}
fs.writeFileSync('scripts/audit/apply-dedup-renames.sh', sh.join('\n') + '\n');
// chmod 0644 explicitly (not executable)
fs.chmodSync('scripts/audit/apply-dedup-renames.sh', 0o644);

console.log(`Wrote dedup plan. ${plan.length} files: ${plan.filter(p => p.action === 'keep').length} keep, ${plan.filter(p => p.action === 'rename').length} rename.`);
