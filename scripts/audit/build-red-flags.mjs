#!/usr/bin/env node
// PASS 8 — Red flags report. Scan all pending migrations for anomalies.

import fs from 'node:fs';

const pending = JSON.parse(fs.readFileSync('reports/sprint-a-pending-details.json', 'utf8'));
const DIR = 'supabase/migrations';
const pass1 = JSON.parse(fs.readFileSync('reports/sprint-a-pass1-stats.json', 'utf8'));

const flags = {
  auth_schema: [],
  needs_extension: {}, // ext -> [files]
  roles_grants: [],
  todos_fixmes: [],
  ai_leftover_comments: [],
  duplicate_timestamps: [],
  non_sql_files: [],
  feature_flag_mismatch: [],
  inconsistent_cutoff: false,
};

// Non-.sql files in migrations/
const allFiles = fs.readdirSync(DIR);
flags.non_sql_files = allFiles.filter((f) => !f.endsWith('.sql'));

// Scan each pending file
for (const m of pending) {
  const content = fs.readFileSync(`${DIR}/${m.file}`, 'utf8');
  const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');

  // 1. auth schema
  if (/\bauth\.\w+/i.test(stripped) && !/auth\.uid\(\)/.test(stripped)) {
    const m2 = stripped.match(/\bauth\.(\w+)/i);
    flags.auth_schema.push({ file: m.file, target: m2?.[0] });
  }

  // 2. extensions
  for (const ext of ['pg_cron', 'pg_net', 'vector', 'pgcrypto', 'pg_trgm', 'unaccent', 'postgis']) {
    const re = new RegExp(`CREATE\\s+EXTENSION\\s+(IF\\s+NOT\\s+EXISTS\\s+)?${ext}\\b`, 'i');
    if (re.test(stripped)) {
      (flags.needs_extension[ext] ||= []).push(m.file);
    }
  }

  // 3. unusual grants
  if (/\bGRANT\s+ALL\s+ON\s+SCHEMA\b/i.test(stripped)) {
    flags.roles_grants.push({ file: m.file, note: 'GRANT ALL ON SCHEMA' });
  }
  if (/\bALTER\s+ROLE\b/i.test(stripped)) {
    flags.roles_grants.push({ file: m.file, note: 'ALTER ROLE' });
  }

  // 4. TODO / FIXME
  const todoMatches = content.match(/(TODO|FIXME|XXX|HACK)[^\n]{0,80}/gi);
  if (todoMatches && todoMatches.length > 0) {
    flags.todos_fixmes.push({ file: m.file, hits: todoMatches.slice(0, 3) });
  }

  // 5. AI leftover markers
  if (/\b(Claude|ChatGPT|GPT-?4|GPT-?5|Anthropic|OpenAI|Copilot|Cursor)\b/i.test(content)) {
    flags.ai_leftover_comments.push(m.file);
  }
}

// Duplicate timestamps from PASS1
for (const [ts, files] of Object.entries(pass1.duplicates)) {
  flags.duplicate_timestamps.push({ timestamp: ts, files });
}

// Inconsistent cutoff: user said "168 pending, last applied 20260208024659"
// We found 223 pending, no file matches that timestamp exactly
flags.inconsistent_cutoff = pending.length !== 168;
const filesMatchingCutoff = allFiles.filter((f) => f.startsWith('20260208024659'));
flags.cutoff_matches_a_file = filesMatchingCutoff.length > 0;

// Feature flag mismatch — reference PLAN_LIMITS keys that don't exist
const planLimits = fs.readFileSync('lib/subscriptions/plan-limits.ts', 'utf8');
const knownFeatures = new Set(
  [...planLimits.matchAll(/(has[A-Z][a-zA-Z]+|max[A-Z][a-zA-Z]+)\s*:/g)].map((m) => m[1])
);
// Very narrow: only check SQL comments that mention PLAN_LIMITS keys
for (const m of pending) {
  const content = fs.readFileSync(`${DIR}/${m.file}`, 'utf8');
  const refs = [...content.matchAll(/PLAN_LIMITS[^\s;\n]*\.([a-zA-Z_]+)/g)].map((x) => x[1]);
  for (const r of refs) {
    if (!knownFeatures.has(r)) {
      flags.feature_flag_mismatch.push({ file: m.file, key: r });
    }
  }
}

// Build markdown
const md = [];
md.push('# Sprint A — PASS 8 : Red flags');
md.push('');
md.push('Points bloquants ou inhabituels à valider par Thomas AVANT d\'ouvrir Sprint B.');
md.push('');

md.push('## 🚨 Écart entre comptage annoncé et réel');
md.push('');
md.push(`- Prompt : **168 pending**, last applied = \`20260208024659\``);
md.push(`- Réalité repo : **${pending.length} pending** (cutoff appliqué = ${pass1.lastAppliedCutoff})`);
md.push(`- Écart : ${pending.length - 168} migrations supplémentaires vs annoncé`);
md.push(`- Fichier correspondant au cutoff \`20260208024659\` : ${flags.cutoff_matches_a_file ? '✅ existe' : '❌ **inexistant dans le repo**'}`);
md.push('');
md.push(
  '**Action requise** : confirmer la valeur exacte retournée par `supabase migration list --linked` ou `SELECT max(version) FROM supabase_migrations.schema_migrations`.'
);
md.push('');

md.push('## 🔴 Migrations touchant `auth.*` (schéma Supabase interne)');
md.push('');
if (flags.auth_schema.length === 0) {
  md.push('✅ Aucune migration pending ne touche le schéma `auth` (hors `auth.uid()`).');
} else {
  md.push(`${flags.auth_schema.length} occurrences :`);
  for (const f of flags.auth_schema.slice(0, 20)) md.push(`- \`${f.file}\` — ${f.target}`);
  if (flags.auth_schema.length > 20) md.push(`- _(+ ${flags.auth_schema.length - 20} autres)_`);
}
md.push('');

md.push('## 🟠 Extensions requises par les migrations pending');
md.push('');
if (Object.keys(flags.needs_extension).length === 0) {
  md.push('Aucune CREATE EXTENSION détectée (probable : toutes déjà activées).');
} else {
  md.push('| Extension | Fichiers | Action |');
  md.push('|---|---|---|');
  for (const [ext, files] of Object.entries(flags.needs_extension)) {
    md.push(`| \`${ext}\` | ${files.length} | Vérifier \`SELECT * FROM pg_extension WHERE extname='${ext}'\` avant Phase 1 |`);
  }
}
md.push('');

md.push('## 🟠 Grants / rôles inhabituels');
md.push('');
if (flags.roles_grants.length === 0) {
  md.push('✅ Aucun GRANT ALL ON SCHEMA ou ALTER ROLE détecté.');
} else {
  for (const r of flags.roles_grants) md.push(`- \`${r.file}\` — ${r.note}`);
}
md.push('');

md.push('## 🟡 TODO / FIXME dans le SQL');
md.push('');
md.push(`${flags.todos_fixmes.length} migrations contiennent au moins un marqueur.`);
if (flags.todos_fixmes.length > 0) {
  md.push('');
  md.push('<details><summary>Extraits (cliquer)</summary>');
  md.push('');
  for (const t of flags.todos_fixmes.slice(0, 25)) {
    md.push(`- \`${t.file}\` : ${t.hits.map((h) => `_${h.replace(/\|/g, '\\|')}_`).join(' · ')}`);
  }
  if (flags.todos_fixmes.length > 25) md.push(`- _(+${flags.todos_fixmes.length - 25} autres)_`);
  md.push('');
  md.push('</details>');
}
md.push('');

md.push('## 🟡 Commentaires AI non nettoyés');
md.push('');
md.push(`${flags.ai_leftover_comments.length} migrations mentionnent Claude / GPT / ChatGPT / Anthropic / OpenAI / Copilot / Cursor.`);
if (flags.ai_leftover_comments.length > 0 && flags.ai_leftover_comments.length <= 30) {
  for (const f of flags.ai_leftover_comments) md.push(`- \`${f}\``);
} else if (flags.ai_leftover_comments.length > 30) {
  md.push(`Liste tronquée, voir \`reports/sprint-a-pass8-raw.json\`.`);
}
md.push('');

md.push('## 🟠 Timestamps dupliqués');
md.push('');
md.push(`${flags.duplicate_timestamps.length} paires/groupes :`);
md.push('');
md.push('| Timestamp | Fichiers |');
md.push('|---|---|');
for (const d of flags.duplicate_timestamps) {
  md.push(`| \`${d.timestamp}\` | ${d.files.map((f) => `\`${f}\``).join('<br>')} |`);
}
md.push('');
md.push('**Risque** : l\'ordre d\'application entre deux fichiers avec même timestamp est déterminé par tri lexicographique du nom de fichier. À inspecter un par un pour confirmer que les deux fichiers ne se contredisent pas.');
md.push('');

md.push('## 🟡 Fichiers non-.sql dans `supabase/migrations/`');
md.push('');
if (flags.non_sql_files.length === 0) {
  md.push('✅ Dossier propre, que des .sql.');
} else {
  for (const f of flags.non_sql_files) md.push(`- \`${f}\``);
}
md.push('');

md.push('## 🟡 Références à des clés `PLAN_LIMITS` inconnues');
md.push('');
if (flags.feature_flag_mismatch.length === 0) {
  md.push('✅ Aucune incohérence détectée.');
} else {
  md.push('| Fichier | Clé |');
  md.push('|---|---|');
  for (const f of flags.feature_flag_mismatch) md.push(`| \`${f.file}\` | \`${f.key}\` |`);
}
md.push('');

md.push('## Red flags à valider avec Thomas avant Sprint B');
md.push('');
md.push('1. **Cutoff réel** : confirmer la dernière migration appliquée en prod (via Supabase Dashboard).');
md.push('2. **Staging** : Option A (projet dédié) vs B (shadow locale) vs C (direct prod avec backup) — décision business.');
md.push('3. **Extensions** : s\'assurer que les extensions requises sont actives en prod (pg_cron, pg_net, etc.).');
md.push(`4. **Phase files** : confirmer si les 5 scripts \`APPLY_PENDING_*\` sont obsolètes ou réapplicables.`);
md.push('5. **Timestamps dupliqués** : décider lesquels garder (risque de régression sinon).');
md.push('6. **Migrations AI-generated** : relire au moins les CRITIQUE + DANGEREUX avant exécution.');
md.push('7. **Window de maintenance** : planifier une fenêtre ≥2h pour la Phase 4 (CRITIQUE).');
md.push('');

fs.writeFileSync('reports/sprint-a-red-flags.md', md.join('\n') + '\n');
fs.writeFileSync('reports/sprint-a-pass8-raw.json', JSON.stringify(flags, null, 2));
console.log('Wrote reports/sprint-a-red-flags.md');
console.log('Flags summary:');
console.log('  auth_schema:', flags.auth_schema.length);
console.log('  extensions:', Object.keys(flags.needs_extension).length);
console.log('  todos/fixmes:', flags.todos_fixmes.length);
console.log('  ai comments:', flags.ai_leftover_comments.length);
console.log('  dup timestamps:', flags.duplicate_timestamps.length);
console.log('  non-sql files:', flags.non_sql_files.length);
