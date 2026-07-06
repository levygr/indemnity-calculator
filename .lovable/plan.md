
# Compléter le calculateur — Phases 3, 4 et 5

Le moteur est déjà en place (dates, revalorisation, capitalisation PER stationnaire/prospectif, fractions, tests 26/26 verts) et les pages 1 à 3 fonctionnent. Il reste à ajouter les postes viagers (permanents), les victimes indirectes, et la synthèse/exports.

## Ce qui va être ajouté au moteur (`src/lib/calculs/postes/`)

- `dsf.ts` — Dépenses de santé futures : lignes ponctuelles et récurrentes (capitalisées viager ou temporaire).
- `atpPerm.ts` — Assistance tierce personne permanente : capitalisation PER viager ou différée (méthode habituelle / exacte selon le dossier).
- `pgpf.ts` — Perte de gains professionnels futurs : méthode capitalisée (rente annuelle × PER) + reliquat éventuel d'IJ/pension.
- `ip.ts` — Incidence professionnelle (dévalorisation, pénibilité, perte de retraite capitalisée).
- `dfp.ts` — Déficit fonctionnel permanent : valeur du point (barème AIPP déjà fourni dans `src/data/bareme_aipp.ts`, interpolé par âge et taux).
- `agrement.ts` / `sexuel.ts` / `esthetiquePerm.ts` / `etablissement.ts` — postes forfaitaires avec cotation → montant.
- `pathologiesEvo.ts` — préjudice d'anxiété / pathologies évolutives (forfait).
- `logementVehicule.ts` — adaptation logement (ponctuel + récurrent capitalisé) et véhicule.
- `deces.ts` — obsèques, perte de revenus du foyer (méthode conjoint + enfants avec parts, capitalisation viagère), frais divers, accompagnement, préjudice d'affection (2 méthodes : cotation ou barème).
- `survieProches.ts` — perte de revenus du conjoint survivant, frais divers, affection, préjudice extrapatrimonial exceptionnel.
- `synthese.ts` — agrégation transversale par poste, sous-totaux par catégorie (patrimoniaux/extrapatrimoniaux × temporaires/permanents + victimes indirectes), totaux généraux dette / TP / victime avec droit de préférence.

Chaque module reste une fonction pure testée (une suite Vitest par poste : valeurs limites, lignes incomplètes ignorées, capitalisation viager vs différée).

## Extension du type `DossierData`

Ajout d'une sous-structure `postesPerm`, `postesDeces`, `postesSurvie` en jsonb, initialisées vides. Aucun changement de schéma DB (tout tient dans la colonne `data`). Hydratation deep-merge déjà en place dans `useDossier` — il suffit d'étendre le merge.

## Pages et navigation

Nouvelles routes sous `_authenticated/dossiers.$id.` :

- `patrimoniaux-permanents.tsx` — DSF, adaptation logement/véhicule, ATP perm, PGPF, IP, PSU.
- `extrapatrimoniaux-permanents.tsx` — DFP (point AIPP), agrément, PEP, PSE, établissement, pathologies évolutives.
- `deces.tsx` — obsèques, perte revenus foyer, frais divers, accompagnement, affection.
- `survie-proches.tsx` — perte revenus conjoint, frais divers, affection, PEP.
- `synthese.tsx` — tableau récap par poste, sous-totaux, totaux généraux, avec surlignage victime / tiers payeur.

La sidebar bascule ces entrées de « Phase X » à actives. Chaque page suit le même patron que les pages 2/3 (Section + Field + Table + auto-save).

## Exports (page synthèse)

- Export JSON du dossier (bouton `Télécharger le dossier`).
- Import JSON (upload → validation Zod → écrasement contrôlé).
- Export PDF charté V&P via `@react-pdf/renderer` (à installer). Composant `<DossierPDF>` reprenant la synthèse + détail par poste. Sortie A4 avec en-tête cabinet.

## Liens Themia (page synthèse et fiches postes)

Helper `themiaLink(poste, params)` → construit une URL de recherche vers Themia avec les critères contextuels (cotation ± 1 point, âge ± 5 ans, taux AIPP ± 5 points, mots-clés fait générateur). Rendu en bouton discret « Rechercher des décisions similaires ».

## Découpage en tours

Vu le volume (≈ 12 modules moteur + 5 pages + synthèse + exports), je propose de livrer en 3 tours :

1. **Ce tour** : moteur permanents (DSF, ATP perm, PGPF, IP, DFP, agrément, PEP, PSE, étab., pathologies, logement/véhicule) + pages 4 et 5 (Patrimoniaux/Extrapatrimoniaux permanents) + tests. Sidebar Phase 3 activée.
2. **Tour suivant** : victimes indirectes (décès + survie proches), moteur et pages 6/7. Sidebar Phase 4 activée.
3. **Dernier tour** : synthèse, exports PDF/JSON, liens Themia. Sidebar Phase 5 activée. App complète.

## Points techniques importants (rappels du prompt)

- Aucun arrondi intermédiaire : `number` JS, arrondi à l'affichage uniquement.
- Capitalisation viager = `perViager(âgeLiquidation, bareme, sexe)`. Rente différée = `perRenteDifferee(...)` avec méthode `habituelle` ou `exacte` selon le dossier. Prospectif > 90 ans → retombe sur viager (déjà géré et testé).
- DFP capitalisé (au jour) = valeur du point × jours restants / EV ; DFP au point = valeur point × taux AIPP (interpolée par âge).
- Répartition victime / tiers payeur toujours via `fractions.repartition` (droit de préférence).
- Perte de revenus du foyer : parts conjoint / enfants, méthode arithmétique, capitalisation viagère par tête sur EV commune.
- Lignes incomplètes ignorées, jamais de NaN affiché.
- Aucune valeur inventée : uniquement les barèmes et indices déjà présents dans `src/data/`. Les valeurs monétaires (point DFP hors table AIPP, SE, PET, affection, agrément forfait) restent saisies par l'utilisateur.

## Livraison de ce tour

Je démarre immédiatement le tour 1 (permanents) : moteur + tests + 2 pages + activation sidebar. Puis je vous laisse tester, avant de continuer avec les victimes indirectes et la synthèse.
