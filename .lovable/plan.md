## Objectif
Intégrer le logo fourni (feuilles jaune + rouge) comme identité visuelle de l'application Victimes & Préjudices.

## Étapes

1. **Ajouter le logo en tant qu'asset Lovable**
   - Créer `src/assets/logo-vp.png.asset.json` via `lovable-assets create` depuis `/mnt/user-uploads/Hervé_Gerbi.png`.
   - L'asset sera servi via CDN (pas de binaire dans le repo).

2. **Favicon**
   - Copier le PNG dans `public/favicon.png`.
   - Mettre à jour `src/routes/__root.tsx` : remplacer l'entrée `{ rel: "icon", href: "/favicon.ico" }` par `{ rel: "icon", type: "image/png", href: "/favicon.png" }`.
   - Supprimer `public/favicon.ico` (favicon Lovable par défaut).

3. **Sidebar (`src/components/vp/AppSidebar.tsx`)**
   - Ajouter le logo à côté du titre "VICTIMES & PRÉJUDICES" dans l'en-tête (petit format ~28-32px, aligné à gauche du texte).
   - Importer le pointeur JSON de l'asset et l'utiliser dans un `<img>` avec `alt="Victimes & Préjudices"`.

4. **Page de connexion / listing dossiers** (si présent un en-tête de marque)
   - Vérifier `src/routes/auth.tsx` et `src/routes/_authenticated/dossiers.index.tsx` pour ajouter le logo si un branding est déjà affiché — sinon laisser tel quel.

## Ce qui ne change pas
- Aucun changement de palette de couleurs ou de typographie (le logo utilise jaune/rouge, mais la refonte du thème n'est pas demandée).
- Aucune modification de logique métier.
