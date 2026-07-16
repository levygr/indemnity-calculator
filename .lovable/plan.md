## Objectif

Supprimer entièrement le régime « Après décision de justice » (L. 211-17 C. assur. + L. 313-3 C. mon. fin.) du module intérêts, en conservant intacts :
- le **taux légal simple** (avant jugement) ;
- le **doublement Badinter avant jugement** (L. 211-13 C. assur.).

## Changements

### 1. `src/lib/calculs/interets.ts`
- Retirer `"apres_decision"` de `RegimeInterets` → ne garder que `"taux_legal" | "badinter_avant"`.
- Supprimer de `LigneInterets` tous les champs liés au post-jugement : `dateDecision`, `dateExecutoire`, `dateExecutoireManuelle`, `dateSignification`, `delaiRecours`, `l211_17Actif`, `delaiBadinter1Mois`, `delaiBadinter2Mois`, `l313_3Actif`, `delaiMajorationMois`, `pointsMajoration`.
- Nettoyer `defaultLigneInterets` en conséquence.
- Retirer l'entrée `apres_decision` de `LIBELLES_REGIME`.
- Supprimer les helpers devenus inutiles : `phasesApresDecision`, `calculerDateExecutoire`, `resoudreDateExecutoire`, `delaiRecoursEnJours`, le type `DelaiRecours`, et l'export `ajouterMois` s'il n'est plus utilisé ailleurs (à vérifier).
- Réduire `phasesPourLigne` aux deux régimes conservés.
- Conserver inchangés : moteur `calculerLigneInterets`, découpage semestriel, anatocisme, `TauxLegalManquantError`, ainsi que la formule et les phases `taux_legal` / `badinter_avant`.

### 2. `src/lib/calculs/hydratation.ts`
- Dans la migration des lignes existantes : convertir toute ligne stockée avec l'ancien régime post-jugement (`apres_decision`, `decision_5pts`, `badinter_apres`) vers `taux_legal` en repartant de `dateDebut`/`dateFin` déjà saisies, et purger les champs supprimés. Aucun total historique n'est préservé pour ces lignes : c'est le comportement attendu puisque la fonctionnalité disparaît. Les lignes `taux_legal` et `badinter_avant` restent strictement inchangées.

### 3. `src/routes/_authenticated/dossiers.$id.interets.tsx`
- Retirer du sélecteur de régime l'option « Après décision de justice ».
- Supprimer tout le bloc UI post-jugement : dates de décision / signification / exécutoire, délai de recours, assistant de calcul de la date exécutoire, switches L. 211-17 et L. 313-3, champs de délais et de points de majoration.
- Simplifier la colonne « Formule » du tableau des segments : afficher uniquement `T` (taux légal) ou `T ×2` (doublement Badinter) ; supprimer les cas ×1,5 et « + n pts ».
- Vérifier que les totaux par ligne et le récapitulatif du dossier n'agrègent plus rien issu du régime supprimé (mécanique : les lignes migrées deviennent `taux_legal`, donc les totaux se recalculent automatiquement via le moteur inchangé).

### 4. Tests
- `src/lib/calculs/__tests__/interets-lignes.test.ts` : supprimer les scénarios `apres_decision` (cumul L. 211-17 / L. 313-3, assistant date exécutoire, migration des anciens régimes post-jugement). Conserver les scénarios `taux_legal` et `badinter_avant`. Ajouter un test de migration vérifiant qu'une ligne stockée en ancien régime post-jugement est réécrite en `taux_legal` sans champs résiduels.
- `src/lib/calculs/__tests__/interets.test.ts` : aucun changement (ne couvre que taux légal simple, doublement, anatocisme, catégorie créancier).
- Lancer `bun run test` et corriger jusqu'au vert, sans toucher aux formules conservées.

## Hors périmètre

- Aucune modification des données `src/data/taux_legal.json`.
- Aucune modification du moteur de découpage semestriel ni de l'anatocisme.
- Aucune modification des autres postes du dossier ni de la synthèse (qui consomme seulement `totalInterets` par ligne).

## Points à confirmer

Aucun — la demande est explicite : suppression complète de la fonctionnalité post-jugement, conservation stricte du taux légal simple et du doublement Badinter avant jugement.