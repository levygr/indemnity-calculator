# Refonte visuelle et ergonomique — plan

Aucune modification du moteur de calcul (`src/lib/calculs/`), des données (`src/data/`) ni de la logique métier. Charte inchangée : brique, ambre, vert, anthracite, fond ivoire, Poppins / Open Sans.

## État déjà acquis (passe précédente)

Rayons réduits, `vp-card` sans ombre, colonne de lecture ~52 rem, sidebar assagie avec liseré brique, tableau de bord en listes, `tabular-nums` global, bloc `@media print` complété. Le plan ci-dessous part de là et complète ce qui manque.

## Étape 1 — Tokens et primitives (`src/styles.css`)

- Échelle d'espacement éditoriale : utilitaires de séparation de sections (marge verticale généreuse + filet fin) pour remplacer l'empilement de cartes.
- Interlignage de lecture 1.65, tailles minimales garanties (14 px texte, 16 px saisie).
- Utilitaire d'encadré à liseré latéral gauche en trois tonalités sémantiques (ambre = vigilance, brique = dette / blocage, vert = validation), fond à peine teinté.
- Utilitaire de tableau sobre : filets horizontaux seuls, alternance très légère, colonne monétaire alignée à droite.
- Ambre interdit en couleur de texte : réservé au liseré et au fond. Focus visible homogène sur tous les contrôles.

## Étape 2 — Encadrés et boutons

- `RecalculBanner`, `RegimeVigilance`, `FourchetteHint` et les alertes passent au nouvel encadré à liseré, sans grosse icône.
- Un seul bouton plein brique par écran ; le reste en ghost ou lien souligné. Revue écran par écran.
- `RecalculBanner` : phrase explicite d'une ligne décrivant ce que le recalcul va changer avant confirmation.

## Étape 3 — Parcours guidé (`pageStatus`, sidebar, pied de page)

- Réordonner les sections dans l'ordre de liquidation : dossier → temporaires → permanents → décès et survie → tiers payeurs → intérêts → synthèse → comparateur → activité.
- Étendre `pageHasData` en un statut à trois valeurs : non commencée / en cours / complète, affiché en point discret + libellé accessible.
- Composant de pied de page « Étape suivante : … » sur chaque page du dossier, calculé depuis l'ordre des sections.

## Étape 4 — Langue et états vides

- Passe sur tous les libellés, boutons, messages d'erreur et états de validation : vocabulaire Dintilhac et pratique du dommage corporel, aucun jargon technique.
- Chaque tableau ou page vide reçoit une phrase courte : à quoi sert le poste, par quoi commencer.
- Aide contextuelle en texte atténué sous les champs techniques (barème de capitalisation, indices de revalorisation, taux), ou infobulle atteignable au clavier.

## Étape 5 — Sécurité de saisie et découvrabilité

- Indicateur d'enregistrement sobre près du titre du dossier : « Enregistré » / « Modifications non enregistrées », branché sur l'état existant et `useUnsavedChangesGuard`.
- Mention discrète « Rechercher — Ctrl + K » dans l'en-tête, ouvrant la `CommandPalette` existante au clic.

## Étape 6 — Chiffres, accessibilité, non-régression

- Montants : alignement à droite, séparateurs de milliers, symbole € systématique, totaux en semi-bold.
- Contrastes AA vérifiés, cibles tactiles ≥ 44 px, `useGridNav` et `LiveAnnouncer` conservés.
- Vérification finale : `bun run test` (168 tests), rendu impression, responsive mobile, authentification.

## Détails techniques

- Travail cantonné à `src/styles.css`, `src/components/vp/*`, `src/components/ui/*` et aux routes `src/routes/_authenticated/*`.
- `src/lib/dossier/pageStatus.ts` est le seul module logique touché : ordre des sections et calcul du statut à trois états, sans effet sur les calculs.
- Les tables larges restent hors de la colonne de lecture via leur conteneur défilant.
