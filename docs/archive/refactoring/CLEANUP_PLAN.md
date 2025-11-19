# Plan de Nettoyage - Code Mort

## ✅ Fichiers à Supprimer (Non Utilisés)

### Pages Vendor non liées dans la navigation
- ❌ `app/vendor/invoices/page.tsx` - Pas de route API, pas de lien dans navigation
- ❌ `app/vendor/jobs/page.tsx` - Pas de lien dans navigation (utilise `/work-orders` à la place)
- ⚠️ `app/vendor/dashboard/page.tsx` - Pas de lien dans navigation (utilise `/app/provider` à la place)

**Note**: Les pages vendor semblent être des versions obsolètes. La navigation utilise `/app/provider` pour les prestataires.

### Routes API de test temporaires
- ❌ `app/api/properties/test/route.ts` - Endpoint de test temporaire mentionné dans plusieurs docs mais non utilisé en production

## ✅ Fichiers à Garder (Utilisés)

### Composants utilisés
- ✅ `components/debug/properties-debug.tsx` - Utilisé dans `app/admin/integrations/page.tsx`

### Routes API mockées mais utilisées
- ✅ `app/api/emails/send/route.ts` - Utilisé par `features/notifications/services/email.service.ts`
- ✅ `app/api/payments/create-intent/route.ts` - Peut être utilisé par le frontend
- ✅ `app/api/meters/[id]/photo-ocr/route.ts` - Fonctionnalité partielle mais utilisée

## 📝 Actions à Effectuer

1. **Supprimer les pages vendor obsolètes** (3 fichiers)
2. **Supprimer la route de test** (1 fichier)
3. **Archiver les fichiers markdown temporaires** (optionnel, à faire manuellement)

## ⚠️ Précautions

- Vérifier que les pages vendor ne sont pas référencées ailleurs avant suppression
- Vérifier que `/api/properties/test` n'est pas utilisé en production avant suppression

