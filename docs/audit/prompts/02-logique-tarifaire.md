# Secteur 2 — Logique Tarifaire

## Prompt

> **Contexte** : TALOK est un SaaS de gestion locative français (Next.js 14, Stripe). Cible : propriétaires bailleurs, agences immobilières, syndics. Marché : France métropolitaine + DROM.
>
> **Analyse le forfait / la page pricing affichée dans la capture d'écran.**
>
> 1. **Décomposition du forfait visible**
>    - Nom du plan, prix mensuel/annuel, devise, TVA incluse ou non
>    - Limites affichées : nombre de biens, utilisateurs, stockage, fonctionnalités
>    - CTA (texte du bouton, couleur, position)
>    - Indicateurs de popularité ("Recommandé", "Best value", badge)
>
> 2. **Cohérence prix / limites / positionnement**
>    - Le prix est-il justifié par les limites ? (ex: 9€/mois pour 3 biens = 3€/bien)
>    - Les paliers sont-ils logiques ? (pas de saut de 9€ à 99€ sans intermédiaire)
>    - Le forfait gratuit (s'il existe) est-il suffisamment limité pour convertir ?
>    - Le forfait premium justifie-t-il le delta de prix ?
>
> 3. **Benchmark marché SaaS B2B France (gestion locative)**
>
> | Concurrent | Prix entrée | Prix pro | Modèle | ARPU estimé |
> |------------|-------------|----------|--------|-------------|
> | Rentila | Gratuit | 6,90€/mois | Par bien | ~15€ |
> | Smovin | 9€/mois | 29€/mois | Par palier | ~20€ |
> | Ublo | Sur devis | Sur devis | Enterprise | >100€ |
> | Qalimo | Gratuit | 7,90€/mois | Par bien | ~12€ |
> | Gérance Online | 9,90€/mois | 24,90€/mois | Par palier | ~18€ |
> | **TALOK** | ? | ? | ? | ? |
>
> 4. **Grille tarifaire recommandée**
>
> | | Starter | Pro | Business | Enterprise |
> |---|---------|-----|----------|------------|
> | Prix mensuel | ... | ... | ... | Sur devis |
> | Prix annuel (-20%) | ... | ... | ... | Sur devis |
> | Biens inclus | ... | ... | ... | Illimité |
> | Utilisateurs | ... | ... | ... | Illimité |
> | Sweet spot | ... | ... | ... | ... |
>
> 5. **Risques de churn identifiés**
>    - Friction au passage d'un palier à l'autre
>    - Feature gating trop agressif / trop lâche
>    - Absence de toggle mensuel/annuel
>    - Prix d'appel vs valeur perçue
>    - Coût par bien vs concurrence directe

---

## Points de contrôle spécifiques TALOK

### Page /pricing
- Toggle mensuel/annuel visible et fonctionnel
- Économie annuelle affichée en pourcentage et en montant
- Forfait recommandé mis en évidence (border, badge, shadow)
- CTA différenciés par plan (couleur, texte)
- Comparaison features en tableau scrollable sur mobile
- FAQ pricing en bas de page

### Checkout Stripe
- Prix affiché dans le checkout = prix affiché sur la page
- TVA calculée selon le pays/territoire
- Mention légale du droit de rétractation (14 jours, L221-18)
- Récapitulatif commande avant paiement

### Dashboard facturation
- Historique factures avec numérotation séquentielle
- Montant facture = prix du forfait actif au moment de la facturation
- Prochain renouvellement clairement indiqué
- Bouton de résiliation accessible (pas masqué)

---

## Format de sortie attendu

```markdown
## Audit Logique Tarifaire — [Page analysée]

### Forfait(s) affiché(s)
| Plan | Prix | Biens | Features clés | CTA |
|------|------|-------|---------------|-----|
| ... | ... | ... | ... | ... |

### Analyse de cohérence
- Prix/bien : ...€
- Delta entre paliers : ...
- Sweet spot identifié : plan [X] à [Y]€

### Benchmark concurrentiel
| Critère | TALOK | Moyenne marché | Écart |
|---------|-------|----------------|-------|
| Prix entrée | ... | ~8€ | ... |
| Prix/bien | ... | ~3€ | ... |

### Recommandations
1. ...

### Risques de churn : [faible/modéré/élevé]
```
