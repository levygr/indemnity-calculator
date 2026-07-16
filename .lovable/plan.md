# Audit et corrections accessibilité (RGAA / WCAG 2.1 AA)

Objectif : rendre l'application conforme AA sans toucher au design général, aux formules de calcul, ni aux données de barèmes. Aucune modification dans `src/lib/calculs/**`, `src/data/**`, `src/lib/referentiels/**` sauf lecture.

## 1. Formulaires — labels, erreurs, aria-invalid

Fichier partagé `src/components/vp/Field.tsx` :
- Ajouter un prop optionnel `error?: string` et `required?: boolean`.
- Générer un `useId()` pour l'id du message d'erreur. Cloner l'enfant unique via `React.cloneElement` pour injecter automatiquement :
  - `id` si absent (fallback `htmlFor`),
  - `aria-invalid={!!error}`,
  - `aria-describedby` combinant l'id du hint (nouveau) et de l'erreur,
  - `aria-required` quand `required`.
- Rendre le message d'erreur sous le champ dans un `<p role="alert">` avec la couleur `text-destructive`.
- Le hint (Tooltip Info) devient aussi un texte visuellement caché en `sr-only` référencé via `aria-describedby` pour être annoncé au clavier (le bouton Tooltip reste focusable, `type="button"`, `aria-label="Aide"`).

Pages de saisie des postes (fichiers `src/routes/_authenticated/dossiers.$id.*.tsx` : `activite`, `deces`, `extrapatrimoniaux-*`, `patrimoniaux-*`, `survie-proches`, `tiers-payeurs`, `interets`, `index`) :
- Vérifier que chaque `<Input>`, `<Select>`, `<Textarea>`, `<Checkbox>` est enveloppé dans `<Field>` avec `htmlFor` renseigné, et transmettre `error` lorsque l'état de validation existe déjà. Aucun ajout de logique de validation : on ne câble `error` que là où un message existait déjà.
- Convertir les libellés « nus » qui accompagnent aujourd'hui un champ sans `htmlFor` (repérés via une passe `rg "<Label"` puis correction ciblée).

## 2. Régions live — RecalculBanner et totaux temps réel

- `src/components/vp/RecalculBanner.tsx` : envelopper le bandeau dans `<div role="status" aria-live="polite" aria-atomic="true">` et retirer l'annonce des sous-états de mutation.
- Nouveau composant `src/components/vp/LiveAnnouncer.tsx` : région visuellement cachée (`sr-only`) contrôlée par un hook `useDebouncedAnnounce(message, delay = 800)` qui met à jour le texte via `setTimeout` (annulé à chaque frappe).
- `SyntheseTotaux` (`src/components/vp/SyntheseTables.tsx`) : entourer les Recap d'un conteneur `aria-live="polite"` et injecter un `LiveAnnouncer` qui annonce « Total mis à jour : X € — part victime Y € » quand la synthèse change, débounce 800 ms.
- `SaveIndicator` (`src/routes/_authenticated/dossiers.$id.tsx`) : ajouter `role="status" aria-live="polite"` sur le conteneur (masqué visuellement en mobile mais accessible).

## 3. Tableaux — sémantique complète

- `src/components/ui/table.tsx` : ajouter le prop `scope` par défaut sur `TableHead` (`scope="col"`), sans casser les usages qui passent déjà `scope`. Pas d'autre changement de style.
- `src/components/vp/SyntheseTables.tsx` :
  - Ajouter un `<TableCaption className="sr-only">` descriptif par tableau (« Synthèse — {catégorie} »).
  - Aligner à droite les en-têtes de colonnes montants (`text-right` déjà présent, ajouter `scope="col"` explicite et un `<span className="sr-only">` là où l'en-tête est purement numérique).
  - Passer les cellules « Poste » en `<th scope="row">` (via un rendu adapté en `TableCell` avec prop `component="th"` local, ou wrapper simple).
- `src/components/vp/ReferentielTables.tsx` : même traitement (caption sr-only, `scope="col"`, `scope="row"` sur la première colonne libellé, montants à droite conservés).
- Tables du dossier (`SyntheseCategories`, `dossiers.$id.interets.tsx` liste des segments, `dossiers.$id.tiers-payeurs.tsx`, `dossiers.$id.snapshots.$snapshotId.tsx`) : mêmes ajouts minimaux.

## 4. Navigation clavier

- `src/components/vp/AppSidebar.tsx` :
  - Vérifier que la sidebar est un `<nav aria-label="Navigation du dossier">` avec `<ul>/<li>` et liens `<Link>` (pas de `div onClick`). Ajouter `aria-current="page"` sur le lien actif.
  - Ajouter un style focus visible : `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` sur les items (via classes utilitaires, sans changer les couleurs).
- Onglets d'un dossier : conserver la structure `<Link>` existante (le composant est déjà une nav) — s'assurer que les Précédent/Suivant du footer restent atteignables et ordonnés dans le DOM.
- Lignes d'intérêts (`dossiers.$id.interets.tsx`) :
  - Chaque ligne est un groupe. Ajouter `role="group" aria-label="Ligne d'intérêts N"` et rendre les boutons d'action (supprimer, dupliquer) accessibles au clavier avec `aria-label` explicite s'ils sont icon-only.
  - Ordre de tabulation : suivre l'ordre visuel actuel. Aucune modification `tabIndex`.
- Focus dialogues :
  - Sheet mobile de la sidebar (déjà `SheetContent` Radix — focus géré) : vérifier qu'après fermeture, le focus revient sur le `SheetTrigger` (Radix par défaut).
  - Dialogs de confirmation (si présents pour suppression de dossier / ligne) : utiliser `AlertDialog` shadcn au lieu de logique custom si trouvé.
- Ajouter un « Skip to main content » dans `src/routes/__root.tsx` : lien caché révélé au focus, cible `#main-content`. Ajouter `id="main-content"` sur le `<main>` du layout dossier.

## 5. Contrastes

Audit ciblé sur les tokens qui alimentent les textes secondaires :
- `text-muted-foreground` sur `bg-background` et `bg-card` : vérifier le ratio via valeurs HSL dans `src/styles.css`. Si < 4,5:1, éclaircir (mode sombre) ou assombrir (mode clair) la variable `--muted-foreground` sans changer la teinte.
- Hints `text-[11px] text-muted-foreground` (`FourchetteHint.tsx`) : passer à `text-xs` (12 px) minimum et vérifier ratio.
- Badges `warning` / `success` : vérifier que `text-warning-foreground` sur `bg-warning/15` et `text-success` sur `bg-background` atteignent 4,5:1 (WCAG texte < 18 pt). Ajuster la variable `--warning-foreground` / `--success` si nécessaire, en gardant la palette.
- SaveIndicator sur `bg-card` : mêmes vérifications.

Mesures via un petit utilitaire local hors du bundle (`node -e` avec formule WCAG relative luminance) pour justifier chaque ajustement. Documenter les ratios avant/après dans un commentaire du CSS.

## 6. Vérification

- `bun run test` : la suite d'accessibilité existante (aucune) n'est pas ajoutée ; s'assurer que les 157 tests passent inchangés (aucune modification `src/lib/calculs`).
- Type-check et lint verts.
- Passe manuelle rapide via Playwright headless : screenshot de la page intérêts et de la synthèse, dump ARIA (`page.accessibility.snapshot()`), grep pour absence de `aria-invalid` non attendu et présence des captions.

## Hors périmètre

- Aucune modification des formules d'intérêts (`interets.ts`), des postes, de la synthèse, des barèmes JSON, ni des règles métier.
- Pas de refonte visuelle : couleurs de la palette seulement ajustées si un ratio échoue.
- Pas d'ajout de tests unitaires nouveaux ; les corrections a11y sont validées manuellement.
