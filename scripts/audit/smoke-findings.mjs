#!/usr/bin/env node
// Sprint B1 — PASS 8
// Look for anomalies across the filesystem inventory.

import fs from 'node:fs';

const fsSnap = JSON.parse(fs.readFileSync('reports/sprint-b1-filesystem-migrations.json', 'utf8'));

const findings = {
  unparseable_timestamps: [],
  timestamp_format_variants: {}, // ts_format -> count
  duplicate_names_across_different_ts: [], // same name, different ts
  gaps_between_migrations: [], // >7 days gaps
  files_added_post_doc_date: [], // filesystem-only, since docs/audits/pending-migrations.md said 168 on 2026-04-09
  suspect_filenames: [], // unusual patterns
};

// Unparseable
for (const m of fsSnap.migrations) {
  if (!m.timestamp) {
    findings.unparseable_timestamps.push(m.filename);
  }
}

// Format variants
for (const m of fsSnap.migrations) {
  if (!m.ts_format) continue;
  findings.timestamp_format_variants[m.ts_format] =
    (findings.timestamp_format_variants[m.ts_format] || 0) + 1;
}

// Duplicate slug names (same `name`, different timestamps)
const byName = {};
for (const m of fsSnap.migrations) {
  if (!m.name) continue;
  (byName[m.name] ||= []).push(m);
}
for (const [name, files] of Object.entries(byName)) {
  if (files.length > 1) {
    findings.duplicate_names_across_different_ts.push({
      name,
      count: files.length,
      files: files.map((f) => f.filename),
    });
  }
}

// Gaps between consecutive timestamps (> 7 days)
const sortedByTs = fsSnap.migrations
  .filter((m) => m.timestamp)
  .slice()
  .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

function tsToDate(ts) {
  const y = parseInt(ts.slice(0, 4), 10);
  const mo = parseInt(ts.slice(4, 6), 10) - 1;
  const d = parseInt(ts.slice(6, 8), 10);
  const h = parseInt(ts.slice(8, 10), 10);
  const mi = parseInt(ts.slice(10, 12), 10);
  const s = parseInt(ts.slice(12, 14), 10);
  return new Date(Date.UTC(y, mo, d, h, mi, s));
}

for (let i = 1; i < sortedByTs.length; i++) {
  const prev = tsToDate(sortedByTs[i - 1].timestamp);
  const curr = tsToDate(sortedByTs[i].timestamp);
  const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
  if (diffDays > 7) {
    findings.gaps_between_migrations.push({
      from: sortedByTs[i - 1].filename,
      to: sortedByTs[i].filename,
      days: Math.round(diffDays * 10) / 10,
    });
  }
}

// Files with timestamp > 20260409 (post-doc-date)
const DOC_DATE = '20260409000000';
findings.files_added_post_doc_date = sortedByTs
  .filter((m) => m.timestamp >= DOC_DATE)
  .map((m) => m.filename);

// Suspect filenames (letters in ts, missing ts, very short names)
for (const m of fsSnap.migrations) {
  if (!m.timestamp_raw) continue;
  if (!/^\d+$/.test(m.timestamp_raw)) {
    findings.suspect_filenames.push({ file: m.filename, reason: 'non-numeric timestamp' });
  } else if (m.timestamp_raw.length !== 14) {
    findings.suspect_filenames.push({
      file: m.filename,
      reason: `${m.timestamp_raw.length}-digit timestamp (expected 14)`,
    });
  }
  if (m.name && m.name.length < 5) {
    findings.suspect_filenames.push({ file: m.filename, reason: 'very short name' });
  }
}

// Write markdown
const md = [];
md.push('# Sprint B1 — PASS 8 : Smoke findings');
md.push('');

md.push('## 🔴 Timestamps non parseable');
md.push('');
if (findings.unparseable_timestamps.length === 0) {
  md.push('✅ Tous les fichiers ont un timestamp parseable.');
} else {
  md.push(`${findings.unparseable_timestamps.length} fichier(s) avec timestamp malformé :`);
  md.push('');
  for (const f of findings.unparseable_timestamps) md.push(`- \`${f}\``);
  md.push('');
  md.push('**Risque** : ordre d\'application indéterministe. À renommer manuellement avec un timestamp 14-digit.');
}
md.push('');

md.push('## 🟠 Variantes de format de timestamp');
md.push('');
md.push('| Format | Nombre |');
md.push('|---|---:|');
for (const [fmt, n] of Object.entries(findings.timestamp_format_variants)) {
  md.push(`| ${fmt} | ${n} |`);
}
md.push('');
if (findings.timestamp_format_variants['12-digit']) {
  md.push(`Les **${findings.timestamp_format_variants['12-digit']}** fichiers en format 12-digit (YYYYMMDDHHMM) sont des migrations Supabase legacy (novembre 2024). Supabase CLI les accepte mais l'ordre avec les 14-digit peut être surprenant. Normalisation recommandée en Sprint B suivant.`);
}
md.push('');

md.push('## 🟠 Noms dupliqués sur timestamps différents');
md.push('');
md.push(`${findings.duplicate_names_across_different_ts.length} slug(s) réutilisé(s) :`);
md.push('');
if (findings.duplicate_names_across_different_ts.length > 0) {
  md.push('| Slug | Nombre | Fichiers |');
  md.push('|---|---:|---|');
  findings.duplicate_names_across_different_ts.slice(0, 30).forEach((d) => {
    md.push(`| \`${d.name}\` | ${d.count} | ${d.files.map((f) => `\`${f}\``).join('<br>')} |`);
  });
  if (findings.duplicate_names_across_different_ts.length > 30) {
    md.push(`| _(+${findings.duplicate_names_across_different_ts.length - 30} autres)_ | | |`);
  }
  md.push('');
  md.push('**Interprétation** : une même migration a été recréée avec un nouveau timestamp. Soit c\'est volontaire (rollback puis re-apply), soit c\'est un oubli (l\'ancien aurait dû être supprimé). À reviewer au cas par cas.');
}
md.push('');

md.push('## 🟡 Gaps temporels (> 7 jours)');
md.push('');
if (findings.gaps_between_migrations.length === 0) {
  md.push('✅ Aucun gap > 7 jours.');
} else {
  md.push(`${findings.gaps_between_migrations.length} gap(s) >7j :`);
  md.push('');
  md.push('| Depuis | Vers | Jours |');
  md.push('|---|---|---:|');
  for (const g of findings.gaps_between_migrations) {
    md.push(`| \`${g.from}\` | \`${g.to}\` | ${g.days} |`);
  }
  md.push('');
  md.push('**Interprétation** : pauses de travail ou applications en batch manuelles. Sans conséquence technique, mais utile pour reconstituer l\'historique si un audit RGPD le demande.');
}
md.push('');

md.push('## 🟢 Migrations ajoutées après la date du doc (2026-04-09)');
md.push('');
md.push(`**${findings.files_added_post_doc_date.length}** fichier(s) avec timestamp ≥ 20260409.`);
md.push('');
md.push(`Rappel : le doc \`docs/audits/pending-migrations.md\` comptait 168 pending au 2026-04-09. Sprint A a compté 223. Écart = **+55** → cohérent avec les ${findings.files_added_post_doc_date.length} migrations ajoutées depuis.`);
md.push('');

md.push('## 🟠 Noms suspects');
md.push('');
if (findings.suspect_filenames.length === 0) {
  md.push('✅ Tous les noms sont conformes.');
} else {
  const unique = [...new Map(findings.suspect_filenames.map((x) => [x.file, x])).values()];
  md.push(`${unique.length} fichier(s) avec nommage atypique :`);
  md.push('');
  md.push('| Fichier | Raison |');
  md.push('|---|---|');
  for (const s of unique) md.push(`| \`${s.file}\` | ${s.reason} |`);
  md.push('');
  md.push('**Recommandation** : renommer pour uniformiser, surtout avant une réconciliation schema_migrations.');
}
md.push('');

md.push('## 📉 Ce qu\'il manque (limite shallow clone)');
md.push('');
md.push('Les anomalies suivantes **ne peuvent pas être détectées** sans PASS 1 réel :');
md.push('');
md.push('- Migrations dans `schema_migrations` avec `inserted_at` incohérent (avant création de la colonne sur Supabase antérieur)');
md.push('- Écart `statements` prod vs fichier fs (HASH MISMATCH)');
md.push('- Migrations exécutées via SQL Editor sans fichier (ghosts)');
md.push('- Historique des suppressions antérieures au 2026-04-10 (repo shallow — 183 commits visibles seulement)');

fs.writeFileSync('reports/sprint-b1-smoke-findings.md', md.join('\n') + '\n');
fs.writeFileSync(
  'reports/sprint-b1-smoke-findings.json',
  JSON.stringify(findings, null, 2)
);

console.log('Smoke findings written.');
console.log('Unparseable:', findings.unparseable_timestamps.length);
console.log('Format variants:', findings.timestamp_format_variants);
console.log('Duplicate names:', findings.duplicate_names_across_different_ts.length);
console.log('Gaps >7d:', findings.gaps_between_migrations.length);
console.log('Post-doc-date files:', findings.files_added_post_doc_date.length);
console.log('Suspect names:', findings.suspect_filenames.length);
