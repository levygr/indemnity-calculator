/**
 * Référentiel d'évaluation des postes forfaitaires (SE, PET, PEP,
 * préjudice d'affection). Les valeurs chiffrées ne doivent JAMAIS être
 * inventées : elles restent à null tant qu'elles n'ont pas été renseignées
 * depuis l'édition officielle du référentiel utilisé (ex. Référentiel
 * Mornet).
 *
 * Ne jamais inventer de montant.
 */

export interface FourchetteDegre {
  degre: number;
  min: number | null;
  max: number | null;
}

export interface FourchetteAffection {
  lien: string;
  min: number | null;
  max: number | null;
}

export interface ReferentielEvaluation {
  nom: string;
  edition: string | null;
  fourchettesDegre: Record<"SE" | "PET" | "PEP", FourchetteDegre[]>;
  affectionIndicative: FourchetteAffection[];
}

/** Degrés 0,5 → 7 par pas de 0,5 (14 valeurs). */
function degres(): FourchetteDegre[] {
  const out: FourchetteDegre[] = [];
  for (let i = 1; i <= 14; i++) {
    out.push({ degre: i * 0.5, min: null, max: null });
  }
  return out;
}

export const REFERENTIEL: ReferentielEvaluation = {
  nom: "Référentiel Mornet",
  edition: null, // À renseigner (ex. "septembre 2025"). Ne jamais inventer.
  fourchettesDegre: {
    SE: degres(),
    PET: degres(),
    PEP: degres(),
  },
  affectionIndicative: [
    { lien: "conjoint", min: null, max: null },
    { lien: "enfant", min: null, max: null },
    { lien: "parent", min: null, max: null },
    { lien: "fratrie", min: null, max: null },
    { lien: "autre", min: null, max: null },
  ],
};

/** Retourne la fourchette pour un poste et un degré, ou null si non renseignée. */
export function fourchetteDegre(
  poste: "SE" | "PET" | "PEP",
  degre: number,
): FourchetteDegre | null {
  const arr = REFERENTIEL.fourchettesDegre[poste];
  const f = arr.find((x) => Math.abs(x.degre - degre) < 1e-9);
  if (!f) return null;
  if (f.min == null && f.max == null) return null;
  return f;
}

/** Retourne la fourchette d'affection pour un lien, ou null si non renseignée. */
export function fourchetteAffection(lien: string): FourchetteAffection | null {
  const norm = (lien || "").toLowerCase();
  const f = REFERENTIEL.affectionIndicative.find((x) => x.lien === norm);
  if (!f) return null;
  if (f.min == null && f.max == null) return null;
  return f;
}
