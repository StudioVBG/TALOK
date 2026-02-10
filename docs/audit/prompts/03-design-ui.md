# Secteur 3 — Design & UI

## Prompt

> **Contexte** : TALOK est un SaaS de gestion locative français utilisant shadcn/ui (Radix UI), Tailwind CSS 3.4, Lucide Icons, Framer Motion. Design system existant avec tokens CSS custom.
>
> **Réalise un audit visuel complet de la capture d'écran.**
>
> 1. **Contraste WCAG 2.2 AA**
>    - Ratio minimum texte normal : **4.5:1**
>    - Ratio minimum texte large (≥18px ou ≥14px bold) : **3:1**
>    - Ratio composants interactifs (boutons, inputs, liens) : **3:1** contre l'arrière-plan
>    - Pour chaque paire de couleurs identifiable, estimer le ratio et signaler si < seuil
>
> 2. **Palette et tokens**
>    - Couleurs dominantes utilisées (hex estimé)
>    - Cohérence avec la palette TALOK (primary: bleu, destructive: rouge, muted: gris)
>    - Nombre de couleurs distinctes (>7 = signal d'incohérence)
>    - Usage sémantique correct (rouge = erreur/danger uniquement, vert = succès, orange = warning)
>
> 3. **Icônes et sémantique**
>    - Chaque icône est-elle reconnaissable sans label ?
>    - Cohérence de la bibliothèque (Lucide partout, pas de mix FontAwesome/HeroIcons)
>    - Taille cohérente (16px inline, 20px boutons, 24px navigation)
>    - Icône ↔ métier immobilier (maison, clé, bail, locataire, euro)
>
> 4. **Layout et équilibre**
>    - Grille sous-jacente (12 colonnes, flex, CSS grid ?)
>    - Espacement cohérent (multiples de 4px : 4, 8, 12, 16, 24, 32, 48)
>    - Alignement horizontal et vertical
>    - Densité d'information (trop dense / trop aéré)
>    - Balance visuelle gauche/droite, haut/bas
>
> 5. **Hiérarchie visuelle**
>    - Titre > Sous-titre > Corps > Caption (tailles et poids distincts ?)
>    - Un seul point focal principal par écran
>    - Lecture en F-pattern ou Z-pattern respectée
>    - Les actions principales sont-elles les éléments les plus saillants ?
>
> 6. **Design system / Composants**
>    - Les composants correspondent-ils à shadcn/ui ? (Card, Button, Badge, Table, Dialog, etc.)
>    - Variantes utilisées correctement (variant="default|destructive|outline|secondary|ghost|link")
>    - Border-radius cohérent (rounded-md = 6px par défaut shadcn)
>    - Shadows cohérentes (shadow-sm, shadow-md)
>
> 7. **CTA et affordance**
>    - Bouton primaire clairement identifiable
>    - Un seul CTA primaire par section
>    - États hover/focus/disabled distinguables
>    - Taille tactile ≥ 44×44px sur mobile
>
> 8. **Responsive**
>    - L'écran est-il mobile-first ou desktop-first ?
>    - Les éléments débordent-ils du viewport ?
>    - La navigation est-elle adaptée (hamburger, bottom nav) ?
>    - Les tableaux sont-ils scrollables horizontalement ou empilés ?
>
> **Pour chaque problème détecté, fournir :**
> - Description précise
> - Solution concrète (code Tailwind si possible)
> - Priorité sprint : S1 (critique) / S2 (majeur) / S3 (optimisation)

---

## Tokens de référence TALOK

```css
/* Palette principale (HSL) */
--background: 0 0% 100%;
--foreground: 222.2 84% 4.9%;
--primary: 221.2 83.2% 53.3%;      /* Bleu TALOK */
--primary-foreground: 210 40% 98%;
--secondary: 210 40% 96%;
--muted: 210 40% 96%;
--muted-foreground: 215.4 16.3% 46.9%;
--accent: 210 40% 96%;
--destructive: 0 84.2% 60.2%;       /* Rouge erreur */
--border: 214.3 31.8% 91.4%;
--ring: 221.2 83.2% 53.3%;
--radius: 0.5rem;
```

```
/* Typographie */
Font: Inter (sans-serif)
H1: 36px / 700
H2: 30px / 600
H3: 24px / 600
Body: 16px / 400
Small: 14px / 400
Caption: 12px / 400
```

---

## Format de sortie attendu

```markdown
## Audit Design & UI — [Page]

### Contraste
| Paire | Ratio estimé | Seuil | Verdict |
|-------|-------------|-------|---------|
| Texte body / bg | ~12:1 | 4.5:1 | ✅ |
| Badge text / badge bg | ~2.5:1 | 4.5:1 | ❌ |

### Palette (N couleurs identifiées)
- Cohérence : [oui/non]
- Couleurs hors charte : [liste]

### Problèmes détectés

| # | Catégorie | Problème | Solution | Priorité |
|---|-----------|----------|----------|----------|
| 1 | Contraste | ... | `text-foreground` au lieu de `text-muted` | S1 |
| 2 | Layout | ... | `gap-4` → `gap-6` | S2 |

### Score Design : X/10
```
