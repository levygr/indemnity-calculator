
# Calculateur d'indemnisation en dommage corporel — Cabinet Victimes & Préjudices

Application web professionnelle reproduisant fidèlement la logique du fichier Excel (nomenclature Dintilhac). Priorité absolue : exactitude des calculs. Étant donné l'ampleur (7 pages de saisie, ~50 sous-postes, moteur de calcul complexe, capitalisation, revalorisation, tests), je propose une construction en **phases livrables**, chacune vérifiable, plutôt que de tout livrer d'un coup.

## Stack et architecture

- TanStack Start (React 19 + TS + Vite 7 + Tailwind v4) — stack déjà en place.
- **Lovable Cloud** (Supabase managé) pour l'auth email/mot de passe et la table `dossiers (id, reference, user_id, created_at, updated_at, data jsonb)` avec RLS par `user_id`.
- Persistance : tout le dossier dans `data jsonb`, sauvegarde auto debounce 2 s (mutation server function).
- Moteur de calcul isolé dans `src/lib/calculs/` — fonctions pures, aucune dépendance UI, testées avec Vitest.
- Données de référence figées dans `src/data/` (9 JSON importés tels quels, jamais modifiés).
- Charte : Poppins (titres) + Open Sans (texte), tokens sémantiques dans `src/styles.css` (rouge #B52026, ambre #FDAF19, vert #8EC33F, anthracite #2F3032, gris #F6F5F3).
- Navigation : sidebar fixe anthracite, une section = une route sous `_authenticated/dossiers/$id/...`, bandeau récap en haut de chaque page.

## Structure de code

```text
src/
  data/                          # 9 JSON de référence + bareme_aipp.ts
  lib/calculs/
    dates.ts                     # âges, durées (DATEDIF Y/d)
    esperance.ts                 # lookup EV mortalité
    fractions.ts                 # fFaute × fChance, répartition V/TP
    revalorisation.ts            # IPC annuel/mensuel
    actualisation.ts             # IPC/SMIC
    capitalisation.ts            # PER viager/temporaire, habituelle/exacte
    annualisation.ts             # /jour /semaine /mois /an
    postes/                      # une fonction par sous-poste
      depensesSante.ts, atp.ts, pgpa.ts, dft.ts, se.ts,
      depensesFutures.ts, atpPermanente.ts, pgpf.ts, ip.ts,
      dfp.ts, agrement.ts, esthetique.ts, sexuel.ts, etablissement.ts,
      deces.ts, survieProches.ts
    synthese.ts
    __tests__/                   # Vitest, incl. cas de contrôle 47,919 / 51,328
  components/
    ui/ (shadcn), layout/ (Sidebar, PosteHeader), inputs/ (DateFR, MontantEUR, PeriodeChainee), themia/ (LienThemia)
  routes/
    auth.tsx
    _authenticated/
      route.tsx (fourni par intégration Cloud)
      index.tsx                  # liste dossiers
      dossiers.$id.tsx           # layout (sidebar + Outlet + bandeau)
      dossiers.$id.index.tsx     # page 1 Dossier
      dossiers.$id.patrimoniaux-temporaires.tsx
      dossiers.$id.extrapatrimoniaux-temporaires.tsx
      dossiers.$id.patrimoniaux-permanents.tsx
      dossiers.$id.extrapatrimoniaux-permanents.tsx
      dossiers.$id.deces.tsx
      dossiers.$id.survie-proches.tsx
      dossiers.$id.synthese.tsx
```

## Phases livrables

**Phase 1 — Fondations (livrée en premier)**
1. Activation Lovable Cloud, migration `dossiers` + RLS, auth email/mot de passe.
2. Import des 9 JSON dans `src/data/`, tableau AIPP en dur.
3. Design system (Poppins/Open Sans via `<link>` dans `__root.tsx`, tokens oklch).
4. Moteur de calcul complet — TOUTES les fonctions pures listées ci-dessus, avec tests Vitest (cas de contrôle 47,919 et 51,328, revalorisation, répartition V/TP, PER habituelle/exacte, PGPF, viager du foyer).
5. Layout `_authenticated`, liste des dossiers (CRUD + duplication), sauvegarde auto debounce.
6. Page 1 — **Dossier** complète (identité, dates, fractions, périodes DFT chaînées, âges/EV calculés, note sexe indéterminé, note barèmes).

**Phase 2 — Préjudices temporaires**
7. Page 2 — Patrimoniaux temporaires (DSA ponctuelles/récurrentes, ATP temporaire, frais divers, PGPA 3 méthodes, autres).
8. Page 3 — Extrapatrimoniaux temporaires (DFT + agrément/sexuel temp par période, SE, PET, autres).

**Phase 3 — Préjudices permanents**
9. Page 4 — Patrimoniaux permanents (DSF, logement, véhicule, ATP perm, PGPF, IP avec reliquat TP, PSU, autres).
10. Page 5 — Extrapatrimoniaux permanents (DFP au point/au jour, agrément, PEP, PSE, établissement, PEP, pathologies évolutives).

**Phase 4 — Victimes indirectes**
11. Page 6 — Décès (obsèques, perte revenus foyer + enfants + conjoint, frais divers, accompagnement, affection 2 méthodes, autres).
12. Page 7 — Survie proches (perte revenus conjoint, frais divers, affection 2 méthodes, PEP, autres).

**Phase 5 — Synthèse et exports**
13. Page synthèse (tableau récap par poste, sous-totaux catégories, totaux généraux).
14. Export PDF charté V&P (via `@react-pdf/renderer`), export/import JSON du dossier.
15. Liens Themia contextuels (ATP, cotations SE/PET/PEP, relations affection/accompagnement, recherche décisions similaires ± 5 ans / ± 5 pts).

## Points techniques importants

- **Aucun arrondi intermédiaire** : calculs en `number` JS, arrondi uniquement à l'affichage (`Intl.NumberFormat('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2})`).
- **Dates** : ISO en stockage, saisie/affichage JJ/MM/AAAA via composant `DateFR` (natif `<input type="date">` + formatage FR pour affichage).
- **Répartition V/TP** : implémentée une seule fois dans `fractions.ts` et réutilisée partout.
- **Incohérence Excel corrigée** (ATP temporaire, facteur H/365 sur toutes les lignes) — commentée dans le code.
- **PER prospectif > 90** : bascule automatique sur viager, testée.
- **Champs vides** : les lignes incomplètes sont ignorées des totaux (jamais de NaN).
- **Tables JSON null** : jamais utilisées, filtrées à la lecture.

## Ce que je livre à la fin de cette réponse (Phase 1 uniquement)

Le prompt est trop dense pour livrer les 7 pages + synthèse + exports en une seule fois sans erreurs. Je propose de commencer par la **Phase 1 complète** (fondations + moteur de calcul intégralement testé + page Dossier + liste dossiers + auth + sauvegarde). Vous validez le socle (calculs, charte, ergonomie), puis j'enchaîne les Phases 2 à 5 sur les tours suivants — chacune ajoutant une ou deux pages entièrement fonctionnelles branchées sur le même moteur.

Confirmez-moi : **je démarre par la Phase 1** ? Ou vous préférez un autre ordre (par exemple prioriser une page métier spécifique) ?
