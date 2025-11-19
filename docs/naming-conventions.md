# Lexique & conventions de nommage — Projet Gestion locative

## Entités métier

- **Logement (FR)** = `Property` (code)
- **Propriétaire** = `Owner`
- **Locataire** = `Tenant`
- **Bail** = `Lease`
- **Annonce publique** = `Listing` (uniquement si on parle de diffusion publique)
- **Paiement** = `Payment`

## Règles

- On utilise **toujours** `Property` pour les logements dans le code, jamais :
  - `House`, `Home`, `Flat`, `RentalUnit`, `Accommodation`, etc.
- On utilise **toujours** `Owner` et `Tenant`, jamais `Landlord`, `Renter`, etc.
- Noms de fichiers :
  - pages: `owner-properties.tsx`, `property-wizard.tsx`
  - composants: `PropertyCard.tsx`, `PropertyForm.tsx`

## Règles strictes de refactoring

⚠️ **RÈGLE IMPORTANTE** :
- Tu n'as **PAS le droit** de renommer des fonctions, types, composants ou fichiers,
  sauf si demandé explicitement.
- Tu dois réutiliser **EXACTEMENT** le vocabulaire défini dans ce fichier.
- Si un nom te semble mauvais ou incohérent, tu le notes dans une section
  "Suggestions de renommage" mais tu ne touches **PAS** au code.

---

**Date de création** : 2025-01-XX
**Statut** : ✅ Référence canonique

