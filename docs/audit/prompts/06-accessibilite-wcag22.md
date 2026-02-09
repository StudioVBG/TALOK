# Secteur 6 — Accessibilité WCAG 2.2

## Prompt

> **Contexte** : TALOK utilise shadcn/ui (basé sur Radix UI, qui fournit des primitives accessibles), Tailwind CSS, et Lucide Icons. Audit basé sur WCAG 2.2 niveau AA et RGAA 4.1.
>
> **Audite l'accessibilité de la capture d'écran selon les critères suivants :**
>
> 1. **Contraste texte — WCAG 1.4.3 (AA)**
>    - Texte normal (< 18px / < 14px bold) : ratio ≥ **4.5:1**
>    - Texte large (≥ 18px / ≥ 14px bold) : ratio ≥ **3:1**
>    - Pour chaque élément textuel visible, estimer le ratio de contraste
>    - Signaler tout texte sur fond coloré, gradient, ou image
>
> 2. **Contraste non-textuel — WCAG 1.4.11 (AA)**
>    - Composants interactifs (boutons, inputs, checkboxes) : ratio ≥ **3:1** contre l'arrière-plan adjacent
>    - Indicateurs graphiques (icônes signifiantes, jauges, badges) : ratio ≥ **3:1**
>    - Focus indicator visible : ratio ≥ **3:1** (WCAG 2.4.11 pour AAA, 2.4.7 pour AA)
>
> 3. **En-têtes et structure — WCAG 2.4.6 (AA)**
>    - Hiérarchie des headings (h1 → h2 → h3, pas de saut)
>    - Un seul h1 par page
>    - Les en-têtes décrivent-ils le contenu de leur section ?
>    - Structure des landmarks (header, nav, main, aside, footer)
>
> 4. **ARIA et rôles — WCAG 4.1.2 (A)**
>    - Les composants interactifs ont-ils un nom accessible ? (aria-label, aria-labelledby, texte visible)
>    - Les états dynamiques sont-ils annoncés ? (aria-expanded, aria-selected, aria-checked)
>    - Les icônes décoratives ont-elles `aria-hidden="true"` ?
>    - Les icônes signifiantes ont-elles un `aria-label` ?
>    - Les régions live sont-elles marquées ? (aria-live pour les notifications/toasts)
>
> 5. **Liens et navigation — WCAG 2.4.4 (A)**
>    - Chaque lien a-t-il un texte descriptif ? (pas de "cliquez ici", "en savoir plus" seul)
>    - Les liens ouvrant un nouvel onglet sont-ils signalés ? (icône externe + aria-label)
>    - Skip link ("Aller au contenu") en haut de page
>    - Breadcrumb avec `nav aria-label="Fil d'Ariane"`
>
> 6. **Clavier — WCAG 2.1.1 (A)**
>    - Tous les éléments interactifs sont-ils atteignables au clavier (Tab) ?
>    - L'ordre de tabulation est-il logique (gauche→droite, haut→bas) ?
>    - Les modales piègent-elles le focus ? (focus trap)
>    - Échap ferme les overlays ?
>    - Les menus déroulants sont-ils navigables aux flèches ?
>
> 7. **Nouveautés WCAG 2.2**
>    - **2.4.11 Focus Appearance (AA)** : L'indicateur de focus couvre au minimum 2px d'épaisseur avec ratio ≥ 3:1
>    - **2.4.12 Focus Not Obscured (AA)** : Le focus n'est pas caché par un sticky header/footer
>    - **2.4.13 Focus Not Obscured Enhanced (AAA)** : L'élément focusé est entièrement visible
>    - **3.2.6 Consistent Help (A)** : L'aide/contact est au même endroit sur chaque page
>    - **3.3.7 Redundant Entry (A)** : Les données déjà saisies ne sont pas redemandées
>    - **3.3.8 Accessible Authentication (AA)** : Pas de test cognitif pour s'authentifier (CAPTCHA)
>
> **Pour chaque critère, indiquer :**
> - ✅ Conforme / ⚠️ Partiellement conforme / ❌ Non conforme / ➖ Non applicable
> - Description du problème si non conforme
> - Correction technique (attribut ARIA, classe Tailwind, modification HTML)

---

## Checklist shadcn/ui spécifique

Les composants Radix UI sont accessibles par défaut **si correctement utilisés**. Vérifier :

| Composant | Point de vérification |
|-----------|----------------------|
| `Button` | Texte visible ou `aria-label` si icon-only |
| `Dialog` | Focus trap actif, Échap ferme, `aria-describedby` |
| `DropdownMenu` | Navigation flèches, Échap ferme, `aria-expanded` |
| `Select` | `aria-label` sur le trigger, options navigables |
| `Tabs` | `aria-selected`, navigation flèches gauche/droite |
| `Table` | `<th scope="col">`, caption ou `aria-label` |
| `Toast` | `aria-live="polite"` ou `role="status"` |
| `Tooltip` | `role="tooltip"`, déclenchable au focus |
| `Badge` | Si informatif : texte lisible par lecteur d'écran |
| `Card` | Structure sémantique (heading dans CardHeader) |
| `Input` | `<label>` associé par `htmlFor`, `aria-invalid` si erreur |
| `Checkbox` | `aria-checked`, label associé |

---

## Format de sortie attendu

```markdown
## Audit Accessibilité WCAG 2.2 — [Page]

### Synthèse par critère

| Critère WCAG | Niveau | Statut | Problème | Correction |
|-------------|--------|--------|----------|------------|
| 1.4.3 Contraste texte | AA | ❌ | Badge gris #999 sur blanc | `text-gray-700` min |
| 1.4.11 Contraste non-textuel | AA | ⚠️ | Border input trop claire | `border-gray-400` |
| 2.1.1 Clavier | A | ✅ | — | — |
| 2.4.4 Liens | A | ❌ | 3 liens "Voir plus" sans contexte | Ajouter `aria-label` |
| 2.4.6 En-têtes | AA | ⚠️ | Saut h1→h3 | Ajouter h2 intermédiaire |
| 2.4.11 Focus Appearance | AA | ❌ | Ring 1px, ratio 2:1 | `ring-2 ring-primary` |
| 3.3.8 Auth accessible | AA | ✅ | — | — |
| 4.1.2 Nom/Rôle/Valeur | A | ❌ | Icon button sans label | `aria-label="Fermer"` |

### Score accessibilité
- Critères A : X/Y conformes
- Critères AA : X/Y conformes
- **Score global : X%**

### Corrections prioritaires
1. [Critique] ...
2. [Majeur] ...
```
