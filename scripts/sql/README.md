# Scripts SQL (Supabase)

Scripts à exécuter dans **Supabase → SQL Editor** (pas en local).

## fix-orphan-signer-volberg.sql

Corrige la rupture de liaison pour le locataire `volberg.thomas@hotmail.fr` :

1. Affiche les lignes `lease_signers` orphelines (diagnostic).
2. Lie le profil du locataire aux `lease_signers` (`profile_id`).
3. Marque les invitations comme utilisées.
4. Réaffiche les lignes pour vérifier que `profile_id` est renseigné.

**Comment faire :**

1. Ouvrir [Supabase Dashboard](https://supabase.com/dashboard) → votre projet → **SQL Editor**.
2. Coller le contenu de `fix-orphan-signer-volberg.sql`.
3. Exécuter (Run).
4. Recharger la page du bail côté app : l’aperçu et la section « Locataire » doivent afficher le bon nom.

Pour un autre email, dupliquer le script et remplacer `volberg.thomas@hotmail.fr` par l’email concerné, ou utiliser les requêtes de `docs/AUDIT_CONNEXION_COMPTES.md`.
