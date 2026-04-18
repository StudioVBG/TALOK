# PASS 5 — Red flags

Vérifications spécifiques autour du merge Sprint B2 (222 migrations) et de la cohérence DB/code/skill.

---

## RF-1 — `lease_charge_regularizations` — colonnes additionnelles inattendues

**Source** : migration 20260408130000 + migration Sprint 0.a.

Colonnes liées au cycle de vie qui ne figurent pas dans la doc du skill :
- `contested` BOOLEAN — champ distinct de `status='contested'` (le booléen peut être `true` alors que `status = 'sent'`, historique usage interne)
- `contest_reason` TEXT
- `contest_date` TIMESTAMPTZ
- `sent_at` TIMESTAMPTZ (✅ documenté skill)

⚠️ **Implication Sprint 2** : les transitions d'état doivent gérer à la fois `status` ET `contested` bool — doublon sémantique potentiel à clarifier. **Pas un bug bloquant**, juste un piège si on se fie uniquement à `status`.

Requête E.5 dans `queries.sql` pour confirmer.

---

## RF-2 — `charge_entries` n'a **PAS** de `regularization_id`

Le skill décrit :
```
charge_entries.regularization_id UUID FK → lease_charge_regularizations(id)
```

La réalité (migration 20260408130000) :
```
charge_entries.property_id UUID FK → properties(id)
charge_entries.fiscal_year INTEGER NOT NULL
-- AUCUN regularization_id
```

Les entries sont des dépenses annuelles par bien, pas des lignes attachées à une régul. La régul se calcule en agrégeant les `charge_entries` pour `(property_id, fiscal_year)` au moment du `calculateRegularization`.

⚠️ **Implication Sprint 2/3** : le template PDF décompte doit regrouper `charge_entries` par `(property_id, fiscal_year)` — pas filtrer sur un `regularization_id`.

**Pas un bug** mais divergence skill ↔ DB à acter.

---

## RF-3 — `charge_categories` scopées par `property_id`

Skill : "référentiel global des 8 catégories (teom, eau, chauffage, ascenseur, ...)"

Réalité (migration 20260408130000) :
```
charge_categories.property_id UUID FK → properties(id)
charge_categories.category TEXT CHECK (6 valeurs)
```

Les 6 valeurs autorisées par le CHECK sont :
`'ascenseurs', 'eau_chauffage', 'installations_individuelles', 'parties_communes', 'espaces_exterieurs', 'taxes_redevances'`

Soit **6 catégories agrégées**, pas les 8 catégories fines du skill (teom, eau, chauffage, ascenseur, entretien_commun, espaces_verts, syndic_recuperable, autre).

La table `charge_categories` contient donc **une ligne par bien × catégorie**, avec `annual_budget_cents` — c'est une table de budget prévisionnel, pas un référentiel.

⚠️ **Implication** : l'extraction OCR TEOM (Sprint 6) doit créer une `charge_entry` liée à la catégorie `taxes_redevances` du bien (que l'on crée ou récupère en amont), pas à une catégorie globale `teom`. Idem côté UI.

**Pas un bug** — la définition actuelle est plus riche (budget par bien) mais nécessite que le bien ait ses 6 catégories pré-créées (cf `CHARGE_CATEGORIES` dans `constants.ts`, prêt pour le seed au property create).

---

## RF-4 — 3 tables "régularisation" coexistent

| Entité | Type | Rôle |
|---|---|---|
| `lease_charge_regularizations` | TABLE | **Canonique** — décret 87-713, cibles des nouvelles features |
| `charge_regularizations` | TABLE | Legacy EN (period_start/period_end, provisions_paid_cents) — utilisée par `features/accounting/services/charge-regularization.service.ts` |
| `charge_regularisations` | VIEW (INSTEAD OF triggers) | Vue de compatibilité FR → redirige vers `charge_regularizations` (pas vers `lease_charge_regularizations` !) |
| `charge_regularisations_legacy` | TABLE renommée | Ancienne table FR — données historiques, ne plus toucher |

⚠️ **Attention skill** : le skill dit "vue `charge_regularisations` → pointe vers `lease_charge_regularizations`" — **c'est faux**. La vue pointe vers `charge_regularizations` (table EN legacy). Cette ambiguïté ne bloque rien tant qu'on n'utilise que la canonique, mais elle doit être corrigée dans la doc quand quelqu'un touchera le skill.

**Non bloquant pour Sprint 2** — toute nouvelle écriture va dans `lease_charge_regularizations`.

---

## RF-5 — Trigger auto-sync statut (lease → lot) pour les charges

Mémoire évoque un "trigger auto-sync lease → lot" pour les baux. Rien d'équivalent n'existe pour les charges. Dans les faits, le module charges est **scopé au bien** (`property_id`), pas au lot, donc ce trigger n'a pas lieu d'être ici.

**Rien à faire** — checklist close.

---

## RF-6 — Pas de vue `charge_summary` / `charges_regularization_view`

Requête E.4 — aucune vue agrégée dans les migrations actuelles. Le skill n'en mentionne pas non plus. Si une feature future en demande une (dashboard owner), elle sera à créer.

**Rien à faire.**

---

## RF-7 — Fix-ups Sprint B2 du 18/04 (lendemain du merge PR #432)

- `66d5a71` touche `reports/batches/phase4-critique-batch-08.sql` : "wrap legacy charge_regularisations migration". C'est un **wrapper d'application de batch** dans le pipeline Sprint B2 — il n'altère pas le schéma, il empaquette la migration 20260408044152 pour qu'elle passe par le pipeline.
- `a6c9b96` touche `reports/batches/phase1-safe-batch-09.sql` : "inject epci_reference_table dep into batch 9". Injecte une dépendance pour que la migration 20260417090200 (table epci) tourne avant la 20260417090500 (seed epci).

**Pas de régression** sur le module. Ces fix-ups sont neutres côté schéma.

---

## RF-8 — Engine Sprint 1 écrit pour schéma RÉEL — pas théorique skill

L'engine `calculateRegularization` dans `lib/charges/engine.ts` utilise `fiscal_year`, `total_provisions_cents`, `balance_cents`, `detail_per_category` (le schéma prod) — **pas** `period_start/period_end/occupation_days/exercise_days` (le schéma skill théorique).

La fonction `computeRegularization` (Sprint 1) utilise un input camelCase totalement séparé (`RegularizationInput` avec `periodStart/periodEnd/provisionsEncaisseesCentimes/…`) — c'est une API pure, consommée par le caller, aucune liaison DB.

⚠️ **Implication Sprint 2** : l'API `/apply` devra transformer le record `lease_charge_regularizations` (fiscal_year → periodStart/periodEnd via dates début/fin d'exercice) avant d'appeler `computeRegularization`. Ou alors utiliser directement `calculateRegularization` (shape DB). Décision à prendre au démarrage Sprint 2.

**Pas un bug** — c'est une conséquence de la double-shape (DB / domain pur).

---

## RF-9 — `SettlementMethod` défini côté TS mais pas en DB

`lib/charges/types.ts:118` déclare :
```ts
export type SettlementMethod =
  | "stripe" | "next_rent" | "installments_12" | "deduction" | "waived";
```

Commentaire : *"Not backed by a DB enum yet (Sprint 2 will add a column)"*.

⚠️ **Implication Sprint 2** : prévoir une migration qui ajoute `settlement_method TEXT CHECK (…)` + `installment_count INTEGER DEFAULT 1` + `settled_at TIMESTAMPTZ` sur `lease_charge_regularizations`. Ces colonnes ne sont pas encore en DB.

**À acter au plan Sprint 2.**

---

## Synthèse red flags

| # | Nature | Gravité | Action |
|---|---|---|---|
| RF-1 | `contested` bool en doublon de `status` | Faible | Clarifier au Sprint 2 — probablement virer le bool |
| RF-2 | Pas de `regularization_id` sur charge_entries | Info | Documenter dans skill (drift) |
| RF-3 | charge_categories scopées par property | Info | Documenter dans skill (drift) |
| RF-4 | 3 tables régul coexistent | Info | Skill à corriger (vue FR pointe vers EN legacy, pas canonique) |
| RF-5 | Pas de trigger lease→lot | N/A | Rien à faire |
| RF-6 | Pas de vue agrégée | N/A | Rien à faire |
| RF-7 | Fix-ups Sprint B2 | Info | Vérifié neutres |
| RF-8 | Engine double-shape (DB + pur) | Info | Décision architecturale Sprint 2 |
| **RF-9** | **SettlementMethod pas en DB** | **Moyenne** | **Prévoir migration Sprint 2** |

**Aucune anomalie bloquante**. Deux points demandent action dès Sprint 2 : RF-9 (migration colonnes settle) et RF-8 (choix d'appel engine.ts → canonique ou pur).
