# Secteur 4 — Conformité Légale FR

## Prompt

> **Contexte** : TALOK est un SaaS de gestion locative opérant en France métropolitaine et DROM. Cible B2B/B2C (propriétaires, agences, syndics). Paiement via Stripe. Hébergement Supabase (EU). Juridiction française.
>
> **Vérifie la conformité légale de la capture d'écran selon les textes suivants :**
>
> 1. **Facturation — L441-3 Code de Commerce**
>    - Numéro de facture séquentiel sans rupture
>    - Date d'émission
>    - Identité vendeur (raison sociale, SIRET, adresse)
>    - Identité acheteur
>    - Désignation précise du service
>    - Montant HT, taux de TVA, montant TVA, montant TTC
>    - Conditions de règlement et pénalités de retard
>    - Mention "TVA non applicable, article 293 B du CGI" si micro-entreprise
>
> 2. **Affichage des prix — L112-1 Code de la Consommation**
>    - Prix TTC visible et prédominant pour les consommateurs (B2C)
>    - Si B2B : HT acceptable mais TTC doit être calculable
>    - Devise clairement indiquée (€)
>    - Prix par unité de mesure si applicable (prix/bien/mois)
>
> 3. **Droit de rétractation — L221-18 Code de la Consommation**
>    - Délai de 14 jours clairement mentionné pour les ventes à distance
>    - Formulaire de rétractation type accessible
>    - Information pré-contractuelle sur le droit de rétractation
>    - Exception : si le service commence avant les 14 jours avec accord explicite
>
> 4. **RGPD — Règlement UE 2016/679**
>    - **Art. 13** : Information sur le traitement (finalité, base légale, durée)
>    - **Art. 15** : Droit d'accès aux données personnelles
>    - **Art. 17** : Droit à l'effacement
>    - **Art. 20** : Droit à la portabilité (export des données en format structuré)
>    - Bouton d'export des données accessible depuis les paramètres
>    - Consentement cookies (bannière conforme CNIL)
>    - Politique de confidentialité accessible depuis chaque page
>
> 5. **CGV/CGU — LCEN (Loi pour la Confiance dans l'Économie Numérique)**
>    - CGV accessibles avant validation de commande
>    - Mentions légales complètes (éditeur, hébergeur, DPO)
>    - Double clic de confirmation pour les achats en ligne (L221-14)
>    - Accusé de réception de commande par email
>
> 6. **Accessibilité — RGAA 4.1 (transposition directive UE 2016/2102)**
>    - Déclaration d'accessibilité obligatoire pour les services publics et entreprises > 250M€ CA
>    - Bonne pratique pour toute entreprise : conformité RGAA niveau AA
>    - Lien vers la déclaration d'accessibilité en footer
>
> 7. **TVA DOM-TOM**
>    - Martinique / Guadeloupe / Réunion : **8.5%** (taux réduit)
>    - Guyane / Mayotte : **0%** (exonération)
>    - Saint-Martin / Saint-Barthélemy : hors champ TVA française
>    - Le taux appliqué doit correspondre à l'adresse de facturation
>
> **Pour chaque manquement, fournir :**
> - Article de loi ou règlement violé
> - Description précise du manquement
> - Risque encouru (amende, nullité, sanction CNIL)
> - Action corrective avec priorité

---

## Checklist par page

### Page Pricing (/pricing)
- [ ] Prix TTC affiché pour particuliers
- [ ] Mention durée d'engagement
- [ ] Conditions de résiliation visibles
- [ ] Droit de rétractation mentionné
- [ ] Lien vers CGV

### Page Checkout
- [ ] Récapitulatif avant paiement
- [ ] Double confirmation (L221-14)
- [ ] CGV cochées explicitement
- [ ] Montant TTC final clair
- [ ] Mention Stripe comme processeur de paiement

### Factures (/owner/billing, /admin/billing)
- [ ] Numérotation séquentielle
- [ ] Toutes mentions obligatoires L441-3
- [ ] TVA correcte selon territoire
- [ ] Téléchargement PDF disponible

### Paramètres (/settings)
- [ ] Export des données (portabilité RGPD art. 20)
- [ ] Suppression de compte (effacement RGPD art. 17)
- [ ] Gestion des notifications (consentement)
- [ ] Lien politique de confidentialité

### Footer global
- [ ] Mentions légales
- [ ] Politique de confidentialité
- [ ] CGV/CGU
- [ ] Gestion des cookies
- [ ] Déclaration d'accessibilité (RGAA)

---

## Barème de risque

| Niveau | Risque | Exemples |
|--------|--------|----------|
| 🔴 Critique | Sanction financière / nullité contrat | Facture non conforme L441-3, absence CGV |
| 🟠 Majeur | Mise en demeure CNIL / DGCCRF | Pas de portabilité RGPD, prix HT uniquement B2C |
| 🟡 Mineur | Non-conformité sans sanction immédiate | Déclaration RGAA manquante, mention rétractation incomplète |

---

## Format de sortie attendu

```markdown
## Audit Conformité Légale FR — [Page]

### Manquements détectés

| # | Sévérité | Article | Manquement | Risque | Action corrective |
|---|----------|---------|------------|--------|-------------------|
| 1 | 🔴 | L441-3 CC | Numéro de facture absent | Amende 75K€ | Ajouter numérotation séquentielle |
| 2 | 🟠 | Art. 20 RGPD | Pas d'export données | Sanction CNIL | Bouton export JSON/CSV dans /settings |

### Conformité TVA DOM-TOM
| Territoire | Taux attendu | Taux appliqué | Verdict |
|------------|-------------|---------------|---------|
| Métropole | 20% | ... | ... |
| Martinique | 8.5% | ... | ... |

### Score conformité : X/10
```
