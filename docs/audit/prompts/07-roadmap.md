# Secteur 7 — Roadmap

## Prompt

> **Contexte** : Ce prompt synthétise les résultats des secteurs 1 à 6 pour produire une roadmap actionnable en 3 sprints. Si certains secteurs n'ont pas été exécutés, ignorer les catégories correspondantes.
>
> **À partir de tous les audits réalisés (secteurs 1 à 6), produis une roadmap structurée.**
>
> 1. **Consolidation des anomalies**
>    - Regrouper toutes les anomalies détectées dans les secteurs précédents
>    - Dédupliquer (une même anomalie peut apparaître dans plusieurs secteurs)
>    - Reclasser par sévérité consolidée : 🔴 Critique / 🟠 Majeur / 🟡 Mineur
>
> 2. **Sprint 1 — Critiques (🔴)**
>    - Bloquants légaux (conformité L441-3, RGPD, CGV)
>    - Données incohérentes visibles par l'utilisateur
>    - Accessibilité niveau A manquante
>    - Bugs visuels critiques (texte illisible, CTA invisible)
>    - Estimation par action : S (< 0.5j) / M (0.5-1j) / L (1-2j)
>
> 3. **Sprint 2 — Majeurs (🟠)**
>    - Conformité WCAG AA manquante
>    - Incohérences tarifaires
>    - Features manquantes présentes chez 3+ concurrents (quick wins)
>    - Design system inconsistencies
>    - Estimation par action : S / M / L
>
> 4. **Sprint 3 — Optimisations (🟡)**
>    - Améliorations UX non bloquantes
>    - Features SOTA "nice to have"
>    - Polish visuel (animations, micro-interactions)
>    - Optimisations performance perçue
>    - Estimation par action : S / M / L
>
> 5. **Métriques de succès**
>    - Score de cohérence données : avant → cible
>    - Score accessibilité : avant → cible
>    - Score design : avant → cible
>    - Taux de couverture SOTA : avant → cible
>    - Score conformité légale : avant → cible

---

## Template de sprint

```markdown
### Sprint [N] — [Thème] (N actions, ~X jours-dev estimés)

| # | Action | Secteur | Sévérité | Effort | Fichier(s) concerné(s) |
|---|--------|---------|----------|--------|----------------------|
| 1.1 | ... | Données | 🔴 | S | `components/dashboard/...` |
| 1.2 | ... | Légal | 🔴 | M | `app/pricing/page.tsx` |
| 1.3 | ... | A11y | 🔴 | S | `components/ui/button.tsx` |
```

---

## Format de sortie attendu

```markdown
## Roadmap Audit UX/UI — TALOK

### Scores avant audit
| Secteur | Score |
|---------|-------|
| Données & Cohérence | X/10 |
| Logique Tarifaire | X/10 |
| Design & UI | X/10 |
| Conformité Légale FR | X/10 |
| Benchmarks SOTA 2026 | X% |
| Accessibilité WCAG 2.2 | X% |

---

### Sprint 1 — Critiques 🔴 (N actions, ~X j-dev)

| # | Action | Secteur | Effort |
|---|--------|---------|--------|
| 1.1 | ... | ... | S |
| 1.2 | ... | ... | M |

**Total Sprint 1 : ~X jours-dev**

---

### Sprint 2 — Majeurs 🟠 (N actions, ~X j-dev)

| # | Action | Secteur | Effort |
|---|--------|---------|--------|
| 2.1 | ... | ... | S |
| 2.2 | ... | ... | M |

**Total Sprint 2 : ~X jours-dev**

---

### Sprint 3 — Optimisations 🟡 (N actions, ~X j-dev)

| # | Action | Secteur | Effort |
|---|--------|---------|--------|
| 3.1 | ... | ... | S |
| 3.2 | ... | ... | M |

**Total Sprint 3 : ~X jours-dev**

---

### Scores cibles après roadmap
| Secteur | Avant | Après Sprint 1 | Après Sprint 2 | Après Sprint 3 |
|---------|-------|-----------------|-----------------|-----------------|
| Données & Cohérence | X/10 | X/10 | X/10 | X/10 |
| Conformité Légale FR | X/10 | X/10 | X/10 | X/10 |
| Accessibilité WCAG 2.2 | X% | X% | X% | X% |
| Benchmarks SOTA | X% | X% | X% | X% |

### Total roadmap : ~X jours-dev sur 3 sprints
```
