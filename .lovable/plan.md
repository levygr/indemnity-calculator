
# Plan global — 7 chantiers d'ergonomie et de sécurité

Aucun changement dans `src/lib/calculs/**`, `src/data/**`, ni dans les formats de stockage. Les tests existants (157) doivent passer à chaque phase ; de nouveaux tests sont ajoutés là où indiqué.

---

## Phase 1 — Composant `MontantInput` (critique)

**Objectif** : saisie tolérante et sûre des montants €, sans jamais convertir silencieusement une entrée invalide en `0`.

**Fichiers créés**
- `src/components/vp/MontantInput.tsx` — composant contrôlé, props :
  `value: number | null`, `onChange: (v: number | null) => void`,
  `id`, `aria-labelledby`/`aria-describedby`, `min?`, `max?`, `disabled?`, `placeholder?`, `autoFocus?`, `onBlur?`.
- `src/lib/format/parseMontant.ts` — parseur pur :
  - accepte virgule décimale, point décimal, espaces (normal, insécable U+00A0, fin U+202F), symbole `€`, signe `-`, `+`.
  - retourne `{ ok: true, value: number } | { ok: false }`.
  - `""` → `{ ok: true, value: null }` (vide explicite, distinct de `0`).
- `src/lib/format/__tests__/parseMontant.test.ts` — couvre : `"1 234,56 €"`, `"1\u00A0234,56"`, `"−42"`, `"0"`, `""`, `"abc"`, `"12.34"`, `"1,2,3"` (invalide), négatifs, très grands nombres.
- `src/components/vp/__tests__/MontantInput.test.tsx` — focus/blur transitions, aria-invalid quand texte invalide, propagation `null` vs `0`.

**Comportement**
- État interne : `text: string` + `focused: boolean`.
- Focus : montre valeur brute éditable (`1234.56` ou `""`).
- Blur : parse ; si `ok` → propage `onChange(value)` et affiche `formatEuros`-like sans symbole (via `formatNombre`) ; si non-`ok` → conserve `text`, `aria-invalid="true"`, bordure `border-destructive`, `<p role="alert">` court via `aria-describedby`. Aucun `onChange` propagé tant que non corrigé.
- Style : `text-right tabular-nums`, `inputMode="decimal"`, `autoComplete="off"`.

**Migration progressive** (même PR, pages à haute fréquence de saisie €) :
- `src/routes/_authenticated/dossiers.$id.index.tsx` (provisions)
- `src/routes/_authenticated/dossiers.$id.patrimoniaux-temporaires.tsx` (DSA ponctuelles/récurrentes, frais divers)
- `src/routes/_authenticated/dossiers.$id.tiers-payeurs.tsx` (créances)
- `src/routes/_authenticated/dossiers.$id.interets.tsx` (bases d'intérêts)
- Autres pages avec `<Input type="number">` sur des montants € : recherche `rg "type=\"number\"" src/routes` puis conversion ciblée aux montants uniquement (les taux %, jours, âges restent `type="number"`).

---

## Phase 2 — Protection contre la perte de données

**Import JSON (Synthèse)**
- Dans `dossiers.$id.synthese.tsx`, remplacer l'import direct par un `AlertDialog` (shadcn) :
  - Titre : « Remplacer le dossier « [référence] » ? »
  - Description : mention explicite d'écrasement complet.
  - Checkbox cochée par défaut : « Figer le chiffrage actuel avant l'import ».
  - Si cochée : appelle la server-fn snapshot existante avec libellé `Avant import du {formatDateFR(today)}` **avant** d'appliquer l'import.
  - Boutons : Annuler / Remplacer.

**Garde beforeunload**
- Dans `src/hooks/useDossier.ts`, exposer `status` déjà en place.
- Nouveau hook `src/hooks/useUnsavedChangesGuard.ts` : `useEffect` qui attache `beforeunload` quand `status === "dirty" || status === "saving"`, le retire sinon.
- Câbler dans `dossiers.$id.tsx` (layout dossier) une seule fois.

**Suppression provision avec annulation**
- Dans `dossiers.$id.index.tsx` (gestion des provisions), remplacer la suppression immédiate :
  1. Retirer la ligne de l'état local + programmer la persistance via le debounce existant.
  2. `toast.success("Provision supprimée", { action: { label: "Annuler", onClick: restaure } , duration: 5000 })`.
  3. `restaure` réinsère l'objet à son index d'origine dans les 5 s ; passé ce délai la sauvegarde a déjà eu lieu naturellement.
- Aucun changement des schémas de données.

---

## Phase 3 — Avertissements actionnables

**Enrichissement du type**
- `src/lib/calculs/avertissements.ts` : le type `Avertissement` gagne
  `route: string` (ex. `/dossiers/$id/patrimoniaux-permanents`) et `anchor: string` (ex. `poste-pgpf`).
- Chaque détection existante est enrichie avec ses métadonnées de navigation.
  **Aucune règle métier modifiée.**
- Mise à jour de `__tests__/avertissements.test.ts` pour asserter la présence de `route`/`anchor` sur chaque cas.

**UI**
- Dans le bandeau « Contrôles de cohérence » (Synthèse), chaque item devient un `<Link>` TanStack avec `hash={anchor}`.
- Ancres : ajout d'un attribut `id` sur les `<Section>` concernées (via prop `id` ajoutée à `Section`).
- `src/hooks/useAnchorHighlight.ts` : au montage, si `location.hash`, `scrollIntoView` puis `element.classList.add("vp-anchor-flash")`, retrait après ~2 s. Classe `.vp-anchor-flash` dans `src/styles.css` : fond `bg-primary/10` avec `transition: background-color 2s`.
- Badge sidebar avertissements dans `AppSidebar.tsx` : `Link` vers `/dossiers/$id/synthese#controles-coherence`.

---

## Phase 4 — Tableau de bord du dossier

**Extraction partagée**
- Nouveau module `src/lib/dossier/pageStatus.ts` : extrait `pageHasData` de `AppSidebar.tsx` (sections + libellés + fonction de détection), utilisé par sidebar ET dashboard.
- Types : `SectionMeta = { key, label, route, hasData(dossier) }`.

**UI dashboard** (`dossiers.$id.index.tsx`, au-dessus des champs identité)
- Grille de `Card` shadcn : une carte par section, chip « Renseignée » / « Vide », cliquable (Link) vers la route.
- Encart synthèse rapide :
  - Part victime courante (`formatEuros`).
  - Nb d'avertissements → Link vers synthèse#controles-coherence.
  - 3 derniers snapshots (query existante) : nom, date, montant part victime, tabular-nums.
- Sobre : pas d'animation, `tabular-nums` partout.

---

## Phase 5 — Saisie type Excel dans les tableaux

**Hook partagé**
- `src/hooks/useGridNav.ts` :
  - Attaché au conteneur `<table>` ou `<tbody>` via ref.
  - Sur `keydown Enter` dans un `<input>`/`<MontantInput>` : `preventDefault`, focus la même colonne (attribut `data-col`) sur la ligne suivante (attribut `data-row`).
  - Sur `Tab` depuis la dernière cellule éditable de la dernière ligne : appelle `onAppendRow()` fourni, puis au tick suivant focus la première cellule éditable de la nouvelle ligne.
- Convention : chaque `input` porte `data-row={index}` `data-col={name}`.
- Tab natif entre cellules **préservé** (aucun `preventDefault` sauf sur le dernier).

**Câblage**
- Provisions (`dossiers.$id.index.tsx`), DSA ponctuelles + récurrentes (`patrimoniaux-temporaires.tsx`), frais divers, créances tiers-payeurs (`tiers-payeurs.tsx`), lignes d'intérêts (`interets.tsx`).
- `MontantInput` accepte `data-row`/`data-col` via rest props.

Aucun changement de données.

---

## Phase 6 — Écarts entre chiffrages

- Dans la table « Chiffrages figés » (Synthèse), nouvelle colonne `<th scope="col">Écart vs actuel</th>`.
- Pour chaque snapshot :
  - Si `snapshot.data?.totals?.partVictime` existe → `ecart = actuel - snapshot`.
  - Format : signe explicite `+`/`−` (U+2212) devant, `formatEuros(|ecart|)`.
  - Classe : `text-emerald-700 dark:text-emerald-400` si `ecart > 0`, `text-destructive` si `< 0`, `text-muted-foreground` si `= 0`.
  - Sinon → `—`.
- Impression : le signe reste explicite, donc lisible en N&B. Ajout d'une règle `@media print { .ecart-positif, .ecart-negatif { color: #000 !important; font-weight: 600; } }`.
- `tabular-nums` sur la colonne.

---

## Phase 7 — Finitions

**Palette Ctrl/Cmd+K**
- Nouveau `src/components/vp/CommandPalette.tsx` avec `CommandDialog` shadcn (déjà présent).
- Écouteur global `keydown` (Ctrl/Cmd+K) monté dans `dossiers.$id.tsx`.
- Groupes :
  - « Sections du dossier » : liste depuis `pageStatus.ts` (phase 4).
  - « Autres dossiers » : `useQuery(["dossiers"])` déjà en cache, filtré par référence.
- Icône `Search` dans le header du layout dossier, `aria-label="Rechercher (Ctrl+K)"`.

**Tooltips sidebar**
- Dans `AppSidebar.tsx`, envelopper les libellés avec `Tooltip` shadcn (ouverture sur `hover` + `focus`). Contenu = libellé complet.

**Masquer postes à zéro (Synthèse)**
- `Switch` shadcn « Masquer les postes à zéro », état local persisté dans `sessionStorage` par dossier.
- Actif par défaut à l'impression : `@media print { [data-hide-zero-print] .row-zero { display: none } }` + attribut posé sur la racine synthèse.
- Chaque ligne à montant nul reçoit `className="row-zero"` (remplace l'opacité réduite actuelle, conservée hors filtre).

---

## Ordre d'exécution et validation

1. Phase 1 (fondation réutilisée par 2, 5).
2. Phase 2.
3. Phase 3 (types partagés par 4, 7).
4. Phase 4.
5. Phase 5.
6. Phase 6.
7. Phase 7.

À chaque phase : `bun run test` doit rester vert (157 tests + nouveaux) et le build passer. Aucune modification de `src/lib/calculs/**`, `src/data/**`, ni des barèmes.

## Détails techniques

- Parseur montants : normalise via `.replace(/[\s\u00A0\u202F€]/g, "").replace(",", ".")`, puis regex stricte `^-?\d+(\.\d+)?$` avant `Number()`.
- Hash navigation TanStack : `<Link to={route} hash={anchor} params={{ id }}>`. `useLocation().hash` pour déclencher `useAnchorHighlight`.
- `beforeunload` : `e.preventDefault(); e.returnValue = ""` — le navigateur affiche son propre message (non personnalisable).
- Snapshot pré-import : réutilise la server-fn existante côté snapshots ; aucun nouveau format.
- Grille clavier : sélection du prochain input via `container.querySelector('[data-row="N+1"][data-col="X"]')`, fallback sur la première cellule si absent.

