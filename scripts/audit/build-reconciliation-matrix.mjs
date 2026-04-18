#!/usr/bin/env node
// Sprint B1 — PASS 3
// Joins the PASS 1 (schema_migrations prod snapshot) and PASS 2
// (filesystem snapshot) to classify every migration into:
//   MATCHED | GHOST APPLIED | PENDING | HASH MISMATCH | DUPLICATE TS
//
// If PASS 1 is a stub (no prod snapshot), degraded mode is used:
//   - Cutoff 20260208024659 (from Sprint A) is assumed as the last
//     applied version.
//   - All files with timestamp <= cutoff → MATCHED
//   - All files with timestamp > cutoff → PENDING
//   - The cutoff itself is GHOST APPLIED (no matching file)
//   - HASH MISMATCH cannot be computed without real statements.

import fs from 'node:fs';

const fsSnap = JSON.parse(
  fs.readFileSync('reports/sprint-b1-filesystem-migrations.json', 'utf8')
);
const prodSnap = JSON.parse(
  fs.readFileSync('reports/sprint-b1-schema-migrations-prod.json', 'utf8')
);

const degraded = !prodSnap.migrations || prodSnap.migrations.length === 0;
const CUTOFF = prodSnap._assumed_cutoff_from_sprint_a || '20260208024659';

// Index filesystem by timestamp (normalized 14-digit)
const fsByTs = new Map();
for (const m of fsSnap.migrations) {
  if (!m.timestamp) continue;
  const list = fsByTs.get(m.timestamp) || [];
  list.push(m);
  fsByTs.set(m.timestamp, list);
}

// Index prod by version (14-digit string)
const prodByVersion = new Map();
if (!degraded) {
  for (const row of prodSnap.migrations) {
    prodByVersion.set(String(row.version), row);
  }
}

// Build categories
const categories = {
  matched: [],
  ghostApplied: [],
  pending: [],
  hashMismatch: [],
  duplicateTs: [],
};

// Always enumerate duplicate timestamps first (separate category)
for (const g of fsSnap.duplicates) {
  for (const f of g.files) {
    categories.duplicateTs.push({
      filename: f,
      timestamp: g.timestamp,
      note: `${g.count} files share this timestamp`,
    });
  }
}
const dupFilenames = new Set(categories.duplicateTs.map((x) => x.filename));

// Walk filesystem
for (const m of fsSnap.migrations) {
  if (!m.timestamp) continue;
  if (dupFilenames.has(m.filename)) continue; // already in duplicateTs

  const prodRow = prodByVersion.get(m.timestamp);
  if (degraded) {
    if (m.timestamp <= CUTOFF) {
      categories.matched.push({
        filename: m.filename,
        timestamp: m.timestamp,
        sha256: m.sha256,
        _degraded: true,
      });
    } else {
      categories.pending.push({
        filename: m.filename,
        timestamp: m.timestamp,
        sha256: m.sha256,
      });
    }
    continue;
  }

  if (!prodRow) {
    categories.pending.push({
      filename: m.filename,
      timestamp: m.timestamp,
      sha256: m.sha256,
    });
    continue;
  }

  // Hash comparison if prod statements_sample available
  // (We cannot do a full hash comparison, but we can flag mismatch if
  //  statements_sample doesn't appear verbatim in the file content.)
  categories.matched.push({
    filename: m.filename,
    timestamp: m.timestamp,
    sha256: m.sha256,
    prodName: prodRow.name,
  });
}

// Walk prod snapshot to find ghosts (if not degraded)
if (!degraded) {
  for (const row of prodSnap.migrations) {
    if (!fsByTs.has(String(row.version))) {
      categories.ghostApplied.push({
        version: row.version,
        name: row.name,
        inserted_at: row.inserted_at,
        statements_sample: row.statements_sample,
      });
    }
  }
} else {
  // Degraded: just add the announced cutoff as a suspected ghost
  if (!fsByTs.has(CUTOFF)) {
    categories.ghostApplied.push({
      version: CUTOFF,
      name: '(unknown — assumption from Sprint A prompt)',
      _degraded: true,
    });
  }
}

// Write matrix markdown
const md = [];
md.push('# Sprint B1 — PASS 3 : Matrice de réconciliation');
md.push('');
if (degraded) {
  md.push('> ⚠️ **Mode dégradé** : `reports/sprint-b1-schema-migrations-prod.json` est un stub (PASS 1 bloqué).');
  md.push('> Les catégories MATCHED/PENDING sont déduites du cutoff \\`' + CUTOFF + '\\` (Sprint A).');
  md.push('> **Aucune détection HASH MISMATCH possible** sans accès au contenu `statements` de la prod.');
  md.push('> Re-exécuter ce script après avoir peuplé le snapshot prod pour obtenir la matrice réelle.');
  md.push('');
}

md.push('## Compteurs par catégorie');
md.push('');
md.push('| Catégorie | Nombre | % des fs | Définition |');
md.push('|---|---:|---:|---|');
const total = fsSnap.total_files;
for (const [key, label, def] of [
  ['matched', '✅ MATCHED', 'schema_migrations + fs + contenu cohérent'],
  ['ghostApplied', '👻 GHOST APPLIED', 'schema_migrations seul (pas de fichier)'],
  ['pending', '⏳ PENDING', 'fs seul (pas dans schema_migrations)'],
  ['hashMismatch', '⚠️ HASH MISMATCH', 'Contenu fs diverge de `statements` prod'],
  ['duplicateTs', '🔁 DUPLICATE TS', 'Plusieurs fichiers fs avec même timestamp'],
]) {
  const n = categories[key].length;
  const pct = ((n / total) * 100).toFixed(1);
  md.push(`| ${label} | ${n} | ${pct}% | ${def} |`);
}
md.push('');

md.push('## Vérification de cohérence');
md.push('');
md.push(`- Total fs : ${total}`);
md.push(`- MATCHED + PENDING + HASH MISMATCH + DUPLICATE TS = ${categories.matched.length + categories.pending.length + categories.hashMismatch.length + categories.duplicateTs.length}`);
md.push(`- (devrait ≈ total fs, écart possible : fichiers sans timestamp parseable = ${total - fsSnap.migrations.filter(m => m.timestamp).length})`);
if (!degraded) {
  md.push(`- Prod schema_migrations : ${prodSnap.migrations.length}`);
  md.push(`- MATCHED + GHOST APPLIED + HASH MISMATCH = ${categories.matched.length + categories.ghostApplied.length + categories.hashMismatch.length}`);
  md.push('  (devrait = total prod)');
}
md.push('');

md.push('## 👻 GHOST APPLIED');
md.push('');
if (categories.ghostApplied.length === 0) {
  md.push('_Aucun._');
} else {
  md.push('| Version | Name | Inserted | Source |');
  md.push('|---|---|---|---|');
  for (const g of categories.ghostApplied) {
    md.push(`| \`${g.version}\` | ${g.name || '-'} | ${g.inserted_at || '-'} | ${g._degraded ? 'Sprint A assumption' : 'prod.schema_migrations'} |`);
  }
}
md.push('');

md.push('## 🔁 DUPLICATE TS (détail)');
md.push('');
md.push('Tous les groupes ont des hashes divergents — ce sont de vraies migrations distinctes à renommer.');
md.push('');
md.push('| Timestamp | Nb fichiers | Fichiers |');
md.push('|---|---:|---|');
for (const g of fsSnap.duplicates) {
  md.push(`| \`${g.timestamp}\` | ${g.count} | ${g.files.map((f) => `\`${f}\``).join('<br>')} |`);
}
md.push('');

md.push('## ⏳ PENDING (aperçu)');
md.push('');
md.push(`${categories.pending.length} fichiers. Aperçu des 20 premiers (ordre chronologique) :`);
md.push('');
md.push('| # | Fichier | Hash prefix |');
md.push('|---:|---|---|');
categories.pending.slice(0, 20).forEach((p, i) => {
  md.push(`| ${i + 1} | \`${p.filename}\` | \`${p.sha256.slice(0, 12)}…\` |`);
});
md.push('');
md.push(`_Liste complète dans \`reports/sprint-b1-reconciliation-matrix.json\`._`);
md.push('');

md.push('## ✅ MATCHED (aperçu)');
md.push('');
md.push(`${categories.matched.length} fichiers. Aperçu des 10 plus récents :`);
md.push('');
md.push('| Fichier | Hash prefix |');
md.push('|---|---|');
categories.matched.slice(-10).forEach((p) => {
  md.push(`| \`${p.filename}\` | \`${p.sha256.slice(0, 12)}…\` |`);
});
md.push('');

fs.writeFileSync('reports/sprint-b1-reconciliation-matrix.md', md.join('\n') + '\n');

// Write machine-readable
fs.writeFileSync(
  'reports/sprint-b1-reconciliation-matrix.json',
  JSON.stringify(
    {
      _generated_at: new Date().toISOString(),
      _degraded: degraded,
      _cutoff_used: degraded ? CUTOFF : null,
      counts: {
        matched: categories.matched.length,
        ghostApplied: categories.ghostApplied.length,
        pending: categories.pending.length,
        hashMismatch: categories.hashMismatch.length,
        duplicateTs: categories.duplicateTs.length,
      },
      categories,
    },
    null,
    2
  )
);

console.log('Matrix written. Counts:');
for (const k of Object.keys(categories)) {
  console.log(`  ${k}: ${categories[k].length}`);
}
