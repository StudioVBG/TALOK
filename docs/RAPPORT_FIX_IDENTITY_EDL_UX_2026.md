# Rapport — Fix vérification identité EDL + correctifs UX (fév. 2026)

## Modifications effectuées

1. **lib/helpers/identity-check.ts**  
   - `isIdentityValidForSignature()` : lorsque `cni_expiry_date` est null ou vide avec `requireNotExpired: true`, la fonction retourne désormais `true` (au lieu de `false`).  
   - Un locataire dont l’identité est vérifiée (kyc_status=verified, cni_verified_at, cni_number) peut signer l’EDL même si l’OCR n’a pas extrait la date d’expiration.

2. **tests/unit/identity-check.test.ts**  
   - Le test « retourne false si identité vérifiée mais cni_expiry_date manquant » a été adapté pour attendre `true` et renommé en « retourne true si identité vérifiée mais cni_expiry_date manquant (OCR non extrait) ».

3. **app/signature-edl/[token]/EDLSignatureClient.tsx**  
   - Ligne 172 : `"Vérification d&apos;identité requise"` → `"Vérification d'identité requise"`.  
   - Ligne 177 : `"Avant de signer l&apos;état des lieux..."` → `"Avant de signer l'état des lieux..."`.  
   - Les apostrophes s’affichent correctement sur la page de signature EDL.

## Vérifications réalisées

- `npx tsc --noEmit` : OK  
- Tests unitaires `tests/unit/identity-check.test.ts` : 17 tests passés  
- `npm run build` (Next.js) : OK  
- Aucune erreur de lint sur les fichiers modifiés  

---

## Points forts

- **Logique d’identité centralisée** : Un seul helper (`identity-check.ts`) pour EDL, bail, dashboard, settings ; cohérence et maintenance facilitée.
- **Tests unitaires** : Couverture claire pour `isIdentityVerified`, `isIdentityValidForSignature`, `isCniExpiredOrExpiringSoon` ; les cas limites (date manquante, expirée, grace days) sont couverts.
- **Sécurité conservée** : L’identité doit rester vérifiée (kyc_status, cni_verified_at, cni_number). La date d’expiration ne fait que renforcer le contrôle quand elle est présente ; son absence ne bloque plus à tort.
- **UX immédiate** : Plus de blocage « Vérification d’identité requise » pour un utilisateur déjà vérifié dont l’OCR n’a pas extrait la date. Texte affiché sans entité HTML mal rendue.

---

## Faiblesses / limites

- **Date d’expiration non obligatoire en base** : Si l’OCR échoue systématiquement, `cni_expiry_date` reste null. Les rappels d’expiration (cron CNI) ne s’appliquent pas à ces profils. Pas de contournement volontaire identifié, mais la donnée est incomplète.
- **OCR comme source unique pour la date** : Les routes d’upload (tenant/identity/upload, signature/upload-cni) ne proposent pas de saisie manuelle de la date d’expiration en fallback ; amélioration possible côté UX.
- **Autres `&apos;` dans le projet** : Seules les 2 chaînes JS de la page EDL ont été corrigées. D’autres fichiers utilisent `&apos;` en contenu JSX (correct) ; aucun autre correctif n’était nécessaire pour ce plan.

---

## Améliorations recommandées (SOTA 2026)

1. **Fallback saisie manuelle de la date d’expiration**  
   Si l’OCR ne renvoie pas de date (ou format invalide), proposer un champ « Date d’expiration de la CNI » sur la page d’upload / renouvellement identité, puis enregistrer en `tenant_profiles.cni_expiry_date`. Cela améliore les rappels et la cohérence des données.

2. **Accessibilité (a11y)**  
   - Page signature EDL : `title` / `aria-label` sur l’iframe d’aperçu, stepper avec `aria-label` / `role="progressbar"`, CTA avec `aria-describedby` si besoin.  
   - SignaturePad : canvas avec `aria-label`, boutons avec états `aria-pressed` où pertinent.

3. **Feedback utilisateur**  
   - Après signature EDL réussie : message de confirmation court (toast ou bandeau) avant redirection.  
   - En cas d’erreur de chargement d’aperçu : message explicite + possibilité de réessayer.

4. **Mobile**  
   - Vérifier zones tactiles ≥ 44px, dialogs et formulaires identité/EDL sur petits écrans (< 375px).  
   - Ajuster si besoin la hauteur min de l’iframe d’aperçu sur mobile pour éviter scroll excessif.

5. **Qualité de code (hors scope actuel)**  
   - Réduire les `any` (ESLint no-explicit-any) dans les routes API et composants EDL/signature.  
   - Corriger les dépendances manquantes dans les `useEffect` signalées par react-hooks/exhaustive-deps là où c’est pertinent.

---

*Rapport généré après implémentation du plan « Fix verification identite EDL + correctifs UX ».*
