/**
 * Référentiel indicatif de l'indemnisation du préjudice corporel des cours d'appel
 * (dit « référentiel Mornet »), édition de septembre 2025.
 *
 * Valeurs saisies manuellement depuis l'édition officielle (PDF, septembre 2025)
 * et vérifiées par double lecture. Ces montants sont STRICTEMENT INDICATIFS :
 * ils ne lient ni le juge ni les parties. Le cabinet plaide la réparation
 * intégrale in concreto ; ces fourchettes servent de repère, pas de plafond.
 *
 * NE PAS MODIFIER CES VALEURS SANS SE REPORTER À L'ÉDITION OFFICIELLE.
 * À réviser à chaque nouvelle édition (parution annuelle, généralement en septembre).
 */

export interface FourchetteDegre {
  degre: number; // cotation médico-légale sur 7 ; 8 = « exceptionnel »
  label: string;
  min: number | null; // null = pas de borne publiée
  max: number | null; // null = pas de plafond publié (« et plus »)
}

export interface FourchetteLien {
  code: string;
  label: string;
  min: number | null;
  max: number | null;
  note?: string;
}

export interface ReferentielEvaluation {
  nom: string;
  edition: string;
  fourchettesDegre: {
    SE: FourchetteDegre[]; // souffrances endurées
    PEP: FourchetteDegre[]; // préjudice esthétique permanent
    PET: FourchetteDegre[] | null; // préjudice esthétique temporaire
  };
  dftIndicatif: {
    parMoisMin: number;
    parMoisMax: number;
    parJourMin: number;
    parJourMax: number;
    note: string;
  };
  affectionDeces: FourchetteLien[];
}

/**
 * Échelle publiée pour les souffrances endurées (cotation 1/7 à 7/7,
 * plus la catégorie « exceptionnel »).
 * Le référentiel précise que l'échelle du préjudice esthétique permanent
 * est sensiblement la même : elle est reprise à l'identique ci-dessous.
 * Pour une cotation intermédiaire (par exemple 3,5/7), se référer aux
 * fourchettes des deux degrés encadrants.
 */
const ECHELLE_SE_PEP: FourchetteDegre[] = [
  { degre: 1, label: "1/7 très léger", min: null, max: 2000 },
  { degre: 2, label: "2/7 léger", min: 2000, max: 4000 },
  { degre: 3, label: "3/7 modéré", min: 4000, max: 8000 },
  { degre: 4, label: "4/7 moyen", min: 8000, max: 20000 },
  { degre: 5, label: "5/7 assez important", min: 20000, max: 35000 },
  { degre: 6, label: "6/7 important", min: 35000, max: 50000 },
  { degre: 7, label: "7/7 très important", min: 50000, max: 80000 },
  { degre: 8, label: "Exceptionnel", min: 80000, max: null },
];

export const REFERENTIEL: ReferentielEvaluation = {
  nom: "Référentiel indicatif de l'indemnisation du préjudice corporel des cours d'appel (référentiel Mornet)",
  edition: "septembre 2025",

  fourchettesDegre: {
    SE: ECHELLE_SE_PEP,
    PEP: ECHELLE_SE_PEP.map((f) => ({ ...f })),
    // Le référentiel ne publie pas de grille chiffrée pour le préjudice
    // esthétique temporaire : poste autonome, apprécié in concreto
    // (photos, durée, exposition au regard des tiers). Ne rien inventer.
    PET: null,
  },

  dftIndicatif: {
    // Déficit fonctionnel temporaire total : indemnisation constatée
    // par les cours d'appel, à réduire proportionnellement au taux
    // pour un DFT partiel.
    parMoisMin: 750,
    parMoisMax: 1000,
    parJourMin: 25,
    parJourMax: 33,
    note:
      "DFT total : entre 750 et 1 000 € par mois, soit entre 25 et 33 € par jour, " +
      "réduit proportionnellement en cas d'incapacité partielle.",
  },

  affectionDeces: [
    {
      code: "conjoint",
      label: "Conjoint ou concubin (décès de l'autre conjoint)",
      min: 20000,
      max: 30000,
    },
    {
      code: "enfant_mineur",
      label: "Enfant mineur (décès du père ou de la mère)",
      min: 25000,
      max: 30000,
      note: "Majoration de 40 % à 60 % si l'enfant mineur est déjà orphelin de l'autre parent.",
    },
    {
      code: "enfant_majeur_foyer",
      label: "Enfant majeur vivant au foyer",
      min: 15000,
      max: 25000,
    },
    {
      code: "enfant_majeur_hors_foyer",
      label: "Enfant majeur vivant hors du foyer",
      min: 11000,
      max: 15000,
    },
    {
      code: "parent_perte_enfant",
      label: "Parent (perte d'un enfant)",
      min: 20000,
      max: 30000,
    },
    {
      code: "fratrie_meme_foyer",
      label: "Frère ou sœur vivant au sein du même foyer",
      min: 15000,
      max: 25000,
    },
    {
      code: "fratrie_hors_foyer",
      label: "Frère ou sœur ne vivant pas au même foyer",
      min: 11000,
      max: 15000,
    },
    {
      code: "grand_parent_relations_frequentes",
      label: "Grand-parent (perte d'un petit-enfant), relations fréquentes",
      min: 11000,
      max: 14000,
    },
    {
      code: "grand_parent_relations_peu_frequentes",
      label: "Grand-parent (perte d'un petit-enfant), relations peu fréquentes",
      min: 7000,
      max: 10000,
    },
    {
      code: "petit_enfant_relations_frequentes",
      label: "Petit-enfant (perte d'un grand-parent), relations fréquentes",
      min: 6000,
      max: 10000,
    },
    {
      code: "petit_enfant_relations_peu_frequentes",
      label: "Petit-enfant (perte d'un grand-parent), relations peu fréquentes",
      min: 3000,
      max: 7000,
    },
    {
      code: "autre_proche",
      label: "Autre parent ou proche (lien affectif spécifique à prouver)",
      min: null,
      max: 3000,
      note: "L'indemnisation ne dépasse qu'exceptionnellement 3 000 € ; la preuve d'un lien affectif spécifique est exigée.",
    },
  ],
};

/**
 * Fourchette indicative pour une cotation donnée (SE ou PEP).
 * Pour une cotation intermédiaire (ex. 3,5), retourne l'enveloppe des deux
 * degrés encadrants : min du degré inférieur, max du degré supérieur.
 * Retourne null si aucune grille n'est publiée pour le poste (cas du PET).
 */
export function fourchettePourDegre(
  poste: "SE" | "PEP" | "PET",
  degre: number
): { min: number | null; max: number | null; approximation: boolean } | null {
  const grille = REFERENTIEL.fourchettesDegre[poste];
  if (!grille || !(degre > 0)) return null;
  const bas = grille.find((f) => f.degre === Math.floor(degre));
  const haut = grille.find((f) => f.degre === Math.ceil(Math.min(degre, 8)));
  if (!bas || !haut) return null;
  if (bas.degre === haut.degre) {
    return { min: bas.min, max: bas.max, approximation: false };
  }
  return { min: bas.min, max: haut.max, approximation: true };
}

/** Fourchette indicative du préjudice d'affection pour un lien donné. */
export function fourchetteAffection(code: string): FourchetteLien | null {
  return REFERENTIEL.affectionDeces.find((f) => f.code === code) ?? null;
}
