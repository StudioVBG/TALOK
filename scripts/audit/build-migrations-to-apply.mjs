#!/usr/bin/env node
// Build the consolidated list of migrations to apply in Sprint B2.
// Merges PASS 3 pending + PASS 5 dedup-keep files + risk from Sprint A.

import fs from 'node:fs';

const matrix = JSON.parse(fs.readFileSync('reports/sprint-b1-reconciliation-matrix.json', 'utf8'));
const dedup = JSON.parse(fs.readFileSync('reports/sprint-b1-dedup-plan.json', 'utf8'));
const risk = JSON.parse(fs.readFileSync('reports/sprint-a-pending-details.json', 'utf8'));

// Map filename -> risk level
const riskByFile = new Map(risk.map((r) => [r.file, { level: r.level, why: r.why }]));

// 181 pending unique timestamps
const pending = matrix.categories.pending.map((p) => ({
  file: p.filename,
  timestamp: p.timestamp,
  action: 'apply',
  note: 'unique timestamp — apply directly',
}));

// 13 "keep" files from dedup groups (one per group, same timestamp)
const dupKeep = dedup.plan
  .filter((p) => p.action === 'keep')
  .map((p) => ({
    file: p.file,
    timestamp: p.timestamp,
    action: 'apply',
    note: `dup group (${p.timestamp}) — kept as-is`,
  }));

// 28 "rename" files — they need to be renamed AND applied after dedup is merged
const dupRename = dedup.plan
  .filter((p) => p.action === 'rename')
  .map((p) => ({
    file: p.file,
    timestamp: p.timestamp,
    new_filename: p.new_filename,
    new_timestamp: p.new_timestamp,
    action: 'rename-then-apply',
    note: `dup group (${p.timestamp}) — rename to ${p.new_timestamp} before applying`,
  }));

// Merge and sort by effective timestamp (use new_timestamp for renames)
const all = [...pending, ...dupKeep, ...dupRename].map((m) => ({
  ...m,
  effective_ts: m.new_timestamp || m.timestamp,
  risk: riskByFile.get(m.file)?.level || 'UNKNOWN',
  risk_why: riskByFile.get(m.file)?.why || '',
}));
all.sort((a, b) => a.effective_ts.localeCompare(b.effective_ts));

// Summary counts
const byLevel = { SAFE: 0, MODERE: 0, DANGEREUX: 0, CRITIQUE: 0, UNKNOWN: 0 };
const byAction = { apply: 0, 'rename-then-apply': 0 };
for (const m of all) {
  byLevel[m.risk] = (byLevel[m.risk] || 0) + 1;
  byAction[m.action] = (byAction[m.action] || 0) + 1;
}

// Markdown output
const md = [];
md.push('# Migrations à appliquer — Sprint B2');
md.push('');
md.push(`**Total : ${all.length}** migrations (${byAction.apply} apply + ${byAction['rename-then-apply']} rename-then-apply)`);
md.push('');
md.push('## Répartition par risque');
md.push('');
md.push('| Niveau | Nombre |');
md.push('|---|---:|');
for (const [k, v] of Object.entries(byLevel)) {
  if (v > 0) md.push(`| ${k} | ${v} |`);
}
md.push('');
md.push('## Liste ordonnée (par timestamp effectif après dédup)');
md.push('');
md.push('| # | Effective ts | Fichier actuel | Risque | Action |');
md.push('|---:|---|---|---|---|');
all.forEach((m, i) => {
  const fileCol = m.new_filename
    ? `\`${m.file}\`<br>→ \`${m.new_filename}\``
    : `\`${m.file}\``;
  const actionCol = m.action === 'apply' ? 'apply' : 'rename-then-apply';
  md.push(`| ${i + 1} | \`${m.effective_ts}\` | ${fileCol} | ${m.risk} | ${actionCol} |`);
});
md.push('');
md.push('## Protocole d\'application recommandé');
md.push('');
md.push('1. **Préalable** : exécuter `scripts/audit/apply-dedup-renames.sh` (après validation) pour les 28 fichiers à renommer');
md.push('2. Commit + merge de la branche `chore/migrations-dedup-timestamps`');
md.push('3. Appliquer les 194 migrations dans l\'ordre du tableau ci-dessus');
md.push('4. Ordre d\'exécution : SAFE → MODÉRÉ → DANGEREUX → CRITIQUE (cf. `sprint-a-application-plan.md` v2)');
md.push('');

fs.writeFileSync('reports/sprint-b2-migrations-to-apply.md', md.join('\n') + '\n');
fs.writeFileSync('reports/sprint-b2-migrations-to-apply.json', JSON.stringify({ _generated_at: new Date().toISOString(), counts: { total: all.length, byLevel, byAction }, migrations: all }, null, 2));

console.log(`Total: ${all.length}`);
console.log('By level:', byLevel);
console.log('By action:', byAction);
console.log('First 5:');
all.slice(0, 5).forEach((m) => console.log('  ', m.effective_ts, m.file, `[${m.risk}]`));
console.log('Last 5:');
all.slice(-5).forEach((m) => console.log('  ', m.effective_ts, m.file, `[${m.risk}]`));
