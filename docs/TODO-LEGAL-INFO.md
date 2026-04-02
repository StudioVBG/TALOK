# Informations à fournir pour les pages légales de talok.fr

> Ce fichier liste toutes les informations manquantes marquées `[À REMPLIR]`
> dans les pages légales. Une fois que tu as ces infos, renseigne-les
> directement dans `/admin/site-content` (quand le CMS est actif) ou demande
> une mise à jour du code.

---

## URGENT — Mentions légales (obligatoire LCEN art. 6)

Sans ces informations, les mentions légales sont **non conformes** à la loi.

- [ ] **Raison sociale exacte** — ex : "Talok SAS", "VOLBERG Thomas (EI)", etc.
- [ ] **Forme juridique** — SAS, SARL, EURL, Auto-entrepreneur, Micro-entreprise…
- [ ] **Capital social** — si société (ex : "1 000 euros"). Non applicable si auto-entrepreneur.
- [ ] **Adresse complète du siège social** — ex : "12 rue des Flamboyants, 97200 Fort-de-France, Martinique"
- [ ] **SIRET** — 14 chiffres
- [ ] **RCS** — ex : "RCS Fort-de-France B 123 456 789"
- [ ] **N° TVA intracommunautaire** — ou mentionner "Non applicable (franchise en base de TVA)" si applicable
- [ ] **Numéro de téléphone de contact** — obligatoire pour un site commercial

---

## IMPORTANT — Politique de confidentialité (RGPD)

- [ ] **Raison sociale** (même que ci-dessus, utilisée dans "Responsable du traitement")
- [ ] **Adresse du siège** (même que ci-dessus)
- [ ] **Nom du DPO** — ou confirmer que c'est "Le responsable de traitement" (Thomas VOLBERG) si pas de DPO dédié

---

## RECOMMANDÉ — Page "À propos"

- [ ] **Date de création de Talok** — ex : "Fondé en 2022"
- [ ] **Photo du fondateur** (optionnel) — pour la page à propos
- [ ] **Texte "Notre histoire"** — un brouillon existe déjà, à personnaliser

---

## INFORMATIONS DÉJÀ RENSEIGNÉES (pas d'action requise)

| Information | Valeur | Source |
|---|---|---|
| Directeur de la publication | Thomas VOLBERG | Skill talok-context |
| Email contact | contact@talok.fr | Code existant |
| Email support | support@talok.fr | Code existant |
| Email DPO/RGPD | dpo@talok.fr | Code existant |
| Email juridique | legal@talok.fr | Code existant |
| Hébergeur web | Netlify, Inc. (San Francisco, CA) | Skill talok-context |
| Base de données | Supabase, Inc. (données en UE) | Skill talok-context |
| Localisation | Fort-de-France, Martinique | Skill talok-context |

---

## OÙ RENSEIGNER CES INFOS ?

1. **Option rapide** : Connecte-toi en admin sur talok.fr, va dans
   "Contenu du site" (`/admin/site-content`), et modifie les pages directement.

2. **Option code** : Les pages sont dans `app/legal/*/page.tsx`. Cherche
   `[À REMPLIR]` (en orange) et remplace par les bonnes valeurs.

---

*Fichier généré le 28 mars 2026*
