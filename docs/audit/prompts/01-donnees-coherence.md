# Secteur 1 — Données & Cohérence

## Prompt

> **Contexte** : TALOK est un SaaS de gestion locative français (Next.js 14, shadcn/ui, Supabase). Rôles : Propriétaire, Locataire, Prestataire, Garant, Agence, Syndic, Admin.
>
> **Analyse la capture d'écran.**
>
> 1. **Inventaire exhaustif** — Liste chaque élément visible : textes, valeurs numériques, boutons, badges, jauges, icônes, états (actif/inactif/erreur), timestamps.
>
> 2. **Vérification croisée** — Pour chaque donnée, vérifie la cohérence logique :
>    - Dates affichées vs date du jour (données périmées, baux expirés non signalés)
>    - Forfait actif vs factures visibles (montant facture ≠ prix forfait)
>    - Usage affiché vs limites du forfait (jauge à 150% sans alerte)
>    - Statut bail vs statut locataire (bail résilié mais locataire "actif")
>    - Montant loyer vs quittances générées
>    - Nombre de biens affichés vs compteur dans le header/sidebar
>    - Solde comptable vs somme des lignes détaillées
>
> 3. **Classification des anomalies**
>
> | Sévérité | Élément | Valeur affichée | Valeur attendue | Impact |
> |----------|---------|-----------------|-----------------|--------|
> | 🔴 Critique | ... | ... | ... | Perte financière / donnée erronée |
> | 🟠 Majeur | ... | ... | ... | Confusion utilisateur |
> | 🟡 Mineur | ... | ... | ... | Incohérence cosmétique |
>
> 4. **Données manquantes** — Identifie les informations qui devraient être présentes sur cet écran mais qui n'apparaissent pas (ex: date de dernière mise à jour, indicateur de statut, lien vers le détail).

---

## Points de contrôle spécifiques TALOK

### Dashboard Propriétaire
- Revenus affichés = somme des loyers encaissés du mois
- Nombre de biens = count réel en base
- Taux d'occupation = biens loués / biens total × 100
- Prochaines échéances = baux arrivant à terme dans 90 jours

### Dashboard Locataire
- Loyer affiché = montant du bail actif
- Prochaine échéance = date d'appel du mois courant/suivant
- Solde = somme des impayés
- Documents = compteur cohérent avec la liste

### Facturation
- Montant HT + TVA = TTC (vérifier taux TVA selon territoire)
- Numérotation séquentielle sans trou (L441-3 Code Commerce)
- Dates de facture ≤ date du jour
- Statut paiement cohérent avec relevé Stripe

### Baux
- Date début < Date fin
- Locataire assigné existe et a le rôle correct
- Montant loyer > 0
- Dépôt de garantie ≤ 2 mois de loyer (meublé) ou 1 mois (nu)

---

## Format de sortie attendu

```markdown
## Audit Données & Cohérence — [Nom de la page]

### Inventaire des éléments (N éléments identifiés)
1. [élément] — [valeur] — [type]
...

### Anomalies détectées (N anomalies)

| # | Sévérité | Élément | Constat | Attendu | Impact | Correction |
|---|----------|---------|---------|---------|--------|------------|
| 1 | 🔴 | ... | ... | ... | ... | ... |

### Données manquantes
- [ ] ...

### Score de cohérence : X/10
```
