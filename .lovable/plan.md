# Correction des erreurs de navigation dans le dossier

## Diagnostic

Chaque page interne d'un dossier (postes temporaires, permanents, décès, survie) crashe avec :

> `Rendered more hooks than during the previous render.`

Toutes ces pages suivent le même anti-pattern React :

```tsx
const { dossier, update } = useDossier(id);
if (!dossier) return null;      // ← early return AVANT les hooks

const ctx = useMemo(...);       // ← ces hooks ne sont pas appelés au 1er render
const dsaP = useMemo(...);
// ...
```

Au premier rendu `dossier` est `undefined` → la fonction retourne `null` avant d'atteindre les `useMemo`. Au rendu suivant, `dossier` arrive → les `useMemo` s'exécutent → React voit plus de hooks qu'au rendu précédent et fait tomber le composant dans l'`errorComponent`. C'est pourquoi *tout* clic sur un item du menu affiche une erreur.

La page `synthese.tsx` fait déjà correctement : `useMemo` d'abord (avec garde `dossier ? ... : null`), puis `if (!dossier) return null;`.

## Fichiers à corriger (même pattern dans tous)

- `src/routes/_authenticated/dossiers.$id.patrimoniaux-temporaires.tsx`
- `src/routes/_authenticated/dossiers.$id.extrapatrimoniaux-temporaires.tsx`
- `src/routes/_authenticated/dossiers.$id.patrimoniaux-permanents.tsx`
- `src/routes/_authenticated/dossiers.$id.extrapatrimoniaux-permanents.tsx`
- `src/routes/_authenticated/dossiers.$id.deces.tsx`
- `src/routes/_authenticated/dossiers.$id.survie-proches.tsx`

## Correction

Dans chaque `Page()` :

1. Déplacer le `if (!dossier) return null;` **après** tous les `useMemo`.
2. Rendre chaque `useMemo` tolérant à `dossier === undefined` : lire les sous‑objets via optional chaining et retourner une valeur neutre quand le dossier n'est pas encore chargé, par exemple :

```tsx
const { dossier, update } = useDossier(id);
const pt = dossier?.postesPT;
const ctx = useMemo(() => (dossier ? buildContexte(dossier) : null), [dossier]);
const dsaPCalc = useMemo(
  () => (pt ? calculerDSAPonctuelles(pt.dsaPonctuelles) : null),
  [pt],
);
// ... tous les autres useMemo suivent le même schéma
if (!dossier || !ctx) return null;
```

Ainsi la liste et l'ordre des hooks appelés restent identiques entre les rendus, ce qui supprime l'erreur React et permet l'affichage normal de chaque page.

## Vérification

- Recharger le dossier, cliquer successivement sur chaque item du menu latéral.
- Chaque page doit s'afficher sans tomber dans l'`errorComponent`.
- Aucune régression fonctionnelle attendue : les calculs restent inchangés une fois le dossier chargé.
