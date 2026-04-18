#!/usr/bin/env node
// PASS 7 — Build a phased application plan.
// Also proposes "squashable" candidates (duplicates / refactor-overrides).

import fs from 'node:fs';

const pending = JSON.parse(fs.readFileSync('reports/sprint-a-pending-details.json', 'utf8'));
const pass1 = JSON.parse(fs.readFileSync('reports/sprint-a-pass1-stats.json', 'utf8'));

// Sort chronologically
pending.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

const byLevel = { CRITIQUE: [], DANGEREUX: [], MODERE: [], SAFE: [] };
for (const p of pending) byLevel[p.level].push(p);

const md = [];
md.push('# Sprint A — PASS 7 : Plan d\'application phasé');
md.push('');
md.push(`Total pending : **${pending.length}** (du \`${pass1.firstPending}\` au \`${pass1.lastPending}\`).`);
md.push('');
md.push('> ⚠️ Toutes les estimations de temps sont indicatives. Faire précéder chaque phase d\'un snapshot DB (Supabase Dashboard → Database → Backups).');
md.push('');

md.push('## Phase 0 — Pré-requis');
md.push('');
md.push('- [ ] Backup prod (snapshot Supabase PITR) horodaté juste avant Phase 1');
md.push('- [ ] Staging Supabase disponible (cf. `sprint-a-staging-detection.md` → décision Option A/B/C)');
md.push('- [ ] Rollback script prêt : `pg_restore` depuis snapshot pour chaque phase');
md.push('- [ ] Cron secret configuré (`ALTER DATABASE postgres SET app.settings.cron_secret = ...`) — prérequis explicite de `20260304100000_activate_pg_cron_schedules.sql`');
md.push('- [ ] `app.settings.app_url` configuré (idem)');
md.push('- [ ] Extension pg_cron activée (sinon plusieurs migrations pending échoueront)');
md.push('- [ ] `TWILIO_VERIFY_SERVICE_SID` configuré dans Netlify (notre migration Sprint 1)');
md.push('- [ ] Annoncer maintenance window si Phase 4 exécutée (≥ 2h en heures creuses)');
md.push('');

function renderPhase(title, items, extraNotes = []) {
  md.push(`## ${title}`);
  md.push('');
  md.push(`**${items.length} migrations** à appliquer en ordre chronologique.`);
  md.push('');
  for (const note of extraNotes) md.push(`> ${note}`);
  if (extraNotes.length) md.push('');
  if (items.length === 0) {
    md.push('_Rien à faire._');
    md.push('');
    return;
  }
  md.push('<details><summary>Liste complète (cliquer pour déplier)</summary>');
  md.push('');
  md.push('| # | Migration | Raison |');
  md.push('|---:|---|---|');
  items.forEach((it, i) => {
    const why = it.why.length > 70 ? it.why.slice(0, 67) + '…' : it.why;
    md.push(`| ${i + 1} | \`${it.file}\` | ${why.replace(/\|/g, '\\|')} |`);
  });
  md.push('');
  md.push('</details>');
  md.push('');
}

const safe = byLevel.SAFE;
renderPhase('Phase 1 — SAFE batch (🟢 application directe)', safe, [
  'Temps estimé : ~15-25 min via `supabase db push` (tout ou rien) OU ~45 min une par une.',
  'Points de vérification : `SELECT count(*) FROM pg_tables WHERE schemaname=\'public\'` avant/après pour contrôler l\'ajout.',
  'Rollback : aucune donnée perdue, restore de snapshot si une migration échoue à mi-chemin.',
]);

const modere = byLevel.MODERE;
renderPhase('Phase 2 — MODÉRÉ batch (🟡 review manuelle)', modere, [
  'Temps estimé : 2-3h de review + 30 min d\'exécution.',
  'Pour chaque migration : lire le SQL, confirmer que les policies ne créent pas de recursion (patterns `profiles_owner_read_tenants`).',
  'Ordre chronologique strict — ne PAS grouper les policies d\'une même table avec des migrations de renames.',
  'Vérifications post-application : `SELECT policyname FROM pg_policies WHERE tablename=<table>;` pour chaque table touchée.',
]);

const dangereux = byLevel.DANGEREUX;
renderPhase('Phase 3 — DANGEREUX batch (🔴 un par un, snapshot avant chaque)', dangereux, [
  'Temps estimé : 4-6h (5-10 min par migration + snapshot = compter 15 min/unit).',
  'Snapshot Supabase AVANT CHAQUE migration (restore rapide si incident).',
  'Pour les DROP TABLE : vérifier qu\'aucune code applicatif ne référence la table (cf. `grep -r \'from.*\\\'<table>\\\'\' app/ lib/`).',
  'Pour les DELETE/UPDATE : vérifier le WHERE dans le SQL, et compter les rows impactées avant en SELECT.',
]);

const critique = byLevel.CRITIQUE;
renderPhase('Phase 4 — CRITIQUE (🚨 maintenance window, hors horaires)', critique, [
  'Temps estimé : ~2h avec maintenance window annoncée 48h avant.',
  'Communication utilisateurs : email/banner 48h avant + banner actif pendant.',
  'Double backup avant + pendant + après.',
  'Smoke tests post-application : login, /api/tenant/dashboard, /api/owner/properties, tests paiement Stripe en mode test, envoi d\'un OTP via Twilio Verify.',
  'Plan de rollback détaillé par migration AVANT exécution.',
]);

md.push('## Candidats à squasher (NON exécuté dans ce sprint)');
md.push('');
md.push('Migrations probablement redondantes, à fusionner/supprimer lors du **Sprint B squash** — candidats détectés par :');
md.push('');
md.push('1. **Timestamps dupliqués** (2 migrations même seconde)');
md.push(`   → ${pass1.duplicateTimestampsCount} paires. Exemples :`);
for (const [ts, files] of Object.entries(pass1.duplicates).slice(0, 5)) {
  md.push(`   - \`${ts}\` : ${files.map((f) => `\`${f}\``).join(' + ')}`);
}
md.push('   → Action : choisir la version "canonique" pour chaque paire, soit en comparant leur contenu, soit en gardant la plus récente par convention (mais attention à l\'ordre d\'application).');
md.push('');

md.push('2. **Migrations "fix" qui annulent une précédente**');
md.push('   Pattern typique dans les noms : `*_fix_*`, `*_rollback_*`. Exemples trouvés dans les pending :');
const fixPatterns = pending.filter((p) =>
  /fix|rollback|revert|undo|correct|repair/i.test(p.file)
);
md.push(`   → ${fixPatterns.length} fichiers matchent. À examiner individuellement pour identifier les couples migration+fix squashables.`);
md.push('');

md.push('3. **Oscillations ADD/DROP colonne** — à résoudre en fusion sémantique.');
md.push('   (Cf. `sprint-a-conflicts-report.md` pour la liste complète.)');
md.push('');

md.push('## Stratégie recommandée');
md.push('');
md.push('### Option stricte (sécurité max, recommandée)');
md.push('1. Créer staging Supabase (Option A)');
md.push('2. Appliquer la totalité en staging (ordre chronologique, 223 migrations)');
md.push('3. Si tout passe : backup prod + répliquer en prod en 4 phases');
md.push('4. Après stabilisation (2 semaines) : Sprint B squash des 223 → ~50 consolidées');
md.push('');
md.push('### Option pragmatique (plus rapide, risque modéré)');
md.push('1. Shadow DB locale (`supabase start`)');
md.push('2. Valider la syntaxe (toutes les migrations passent sans erreur)');
md.push('3. Backup prod + appliquer Phase 1 (SAFE) direct en prod');
md.push('4. Pour Phases 2-4 : staging dédié obligatoire');
md.push('');
md.push('### Option urgente (NE PAS RECOMMANDER sauf feu vert Thomas)');
md.push('1. Backup prod');
md.push('2. `supabase db push` en prod (toutes les 223 d\'un coup)');
md.push('3. Rollback via restore si échec — perte de toute activité prod du laps de temps');
md.push('4. ❌ Déconseillé : impossible d\'identifier le coupable en cas d\'échec cascade');
md.push('');

fs.writeFileSync('reports/sprint-a-application-plan.md', md.join('\n') + '\n');
console.log('Wrote reports/sprint-a-application-plan.md');
