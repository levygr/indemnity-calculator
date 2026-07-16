# Lisibilité chiffres + impression + hiérarchie des titres

Objectif : améliorations ciblées, sans refonte visuelle ni changement des formules. Aucune modification de `src/lib/calculs/**` ou `src/data/**`.

## 1. Chiffres alignés — `tabular-nums` généralisé

Le format FR de `formatEuros` / `formatNombre` (`Intl.NumberFormat("fr-FR")`) émet déjà l'espace insécable fine pour les milliers, la virgule décimale et le symbole €. Rien à changer côté formatage — seulement l'alignement CSS.

- `src/styles.css` : ajouter une règle globale
  ```
  table td, table th { font-variant-numeric: tabular-nums; }
  .tabular { font-variant-numeric: tabular-nums; }
  ```
  Ainsi toutes les tables (synthèse, intérêts, référentiels, comparateur, tiers-payeurs, snapshots) héritent de l'alignement, sans avoir à ajouter `tabular-nums` sur chaque cellule.
- Cellules montants et taux : vérifier `text-right tabular-nums` déjà présent. Ajouter `text-right` là où il manque (repérer via `rg "formatEuros|formatPourcentage" src/routes src/components` et corriger les rares cas — au moins dans `dossiers.$id.comparateur.tsx` et `ReferentielTables.tsx`).
- Aucun changement dans `format.ts` : l'espace insécable + virgule sont déjà produits par `Intl`.

## 2. Impression — Synthèse et Comparateur

Compléter le bloc `@media print` de `src/styles.css` (déjà présent, minimal) :

- Masquer les surfaces non pertinentes : `aside`, `header[role="banner"]`, `header.sticky`, `nav`, `[role="alert"]`, `.print\:hidden`, boutons d'action (`button:not(.print\:visible)`), la RecalculBanner, le SaveIndicator et le footer Précédent/Suivant.
- Fond blanc + texte noir : `body, .vp-card, section { background: white !important; color: black !important; box-shadow: none !important; }` ; forcer `color-scheme: light`.
- Ruptures : `tr, tbody, thead, section, .vp-card { break-inside: avoid; page-break-inside: avoid; } thead { display: table-header-group; }` pour répéter les en-têtes sur chaque page ; `h1, h2, h3 { break-after: avoid; }` (déjà là).
- Bordures lisibles à l'impression : `table, th, td { border-color: #000 !important; }` ; conserver alignement à droite des montants.
- En-tête imprimé (nom du dossier + date d'édition) via nouveau composant `src/components/vp/PrintHeader.tsx` :
  - Rend un bloc `<header className="print-header hidden print:block">` avec libellé du cabinet (déjà dans le logo), référence du dossier (`dossier.reference`), sous-titre du document (« Synthèse » / « Comparateur ») et date d'édition (`new Date().toLocaleDateString("fr-FR")`).
  - Utilise `Intl` : cohérent avec le reste.
  - Inséré en haut de `src/routes/_authenticated/dossiers.$id.synthese.tsx` et `src/routes/_authenticated/dossiers.$id.comparateur.tsx` avec le titre approprié en prop.
  - CSS `.print-header` : `display: none;` en écran, `display: block;` en print, avec petite ligne de séparation.

- Marge et taille papier : conserver `@page { margin: 15mm; size: A4; }`.
- Ajout d'une classe utilitaire `.print-only` (visible uniquement en impression) et confirmation que `print:hidden` est bien câblée sur les boutons d'export / recalcul de la synthèse et du comparateur (ajouts ciblés dans les deux routes).

Impression validée en aperçu (Ctrl/⌘+P) : la sidebar, la bannière de recalcul et les boutons disparaissent ; les tableaux ne se coupent pas au milieu d'une ligne ; l'en-tête montre `Référence dossier — Synthèse — imprimé le JJ/MM/AAAA`.

## 3. Hiérarchie des titres de sections

État actuel : le composant `Section` (`src/components/vp/Field.tsx`) émet déjà `<h2 className="font-display text-lg font-semibold">`. Beaucoup de pages de postes l'utilisent, mais certaines (page Intérêts, page Comparateur, page Snapshots, page Tiers-payeurs) mélangent `text-base`, `text-xl`, `font-medium` sur des `<h2>`/`<h3>` manuels.

- Standardiser l'API :
  - `Section` (h2) : `font-display text-lg font-semibold text-foreground` — conservé.
  - Ajouter une sous-section `SectionSub` (h3) : `font-display text-base font-semibold text-foreground/90` pour les regroupements internes (ex. sous-titres au sein d'une Section).
- Passer en revue les fichiers `src/routes/_authenticated/dossiers.$id.*.tsx` et remplacer les `<h2>`/`<h3>` ad hoc par `Section` / `SectionSub`. Cibles concrètes :
  - `dossiers.$id.index.tsx` (Identité)
  - `dossiers.$id.patrimoniaux-temporaires.tsx` (DSA, ATP, PGPA, frais divers)
  - `dossiers.$id.extrapatrimoniaux-temporaires.tsx` (DFT, SE, PET)
  - `dossiers.$id.patrimoniaux-permanents.tsx` et `extrapatrimoniaux-permanents.tsx`
  - `dossiers.$id.deces.tsx`, `dossiers.$id.survie-proches.tsx`
  - `dossiers.$id.tiers-payeurs.tsx`, `dossiers.$id.interets.tsx`, `dossiers.$id.comparateur.tsx`
- Aucune modification des libellés ni de la structure : uniquement tailles / graisses / balise.

## Vérification

- `bun run test` : 157 tests inchangés (aucun changement dans `src/lib/calculs`).
- Aperçu impression manuelle sur Synthèse et Comparateur.
- Passe visuelle rapide sur chaque page de poste pour confirmer que les titres sont homogènes.

## Hors périmètre

- Pas de refonte visuelle ni de changement de palette.
- Pas de modification du moteur de calcul, des barèmes, ni des formats numériques (déjà FR conforme).
- Pas de génération PDF côté serveur ; on s'appuie sur le rendu navigateur (Ctrl/⌘+P).
