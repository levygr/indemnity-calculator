/**
 * Moteur de calcul des intérêts au taux légal.
 *
 * Modèle par PHASES : une ligne d'intérêts est calculée à partir d'un
 * profil ordonné { aPartirDe, multiplicateur, majorationPoints }.
 * Le taux effectif d'un jour = taux légal (selon catégorie) × multiplicateur
 * + majorationPoints. Le découpage combine les frontières des phases ET les
 * frontières semestrielles du taux légal ; l'anatocisme s'applique ensuite.
 *
 * Règle absolue : ne jamais inventer un taux. Tout segment traversant un
 * taux `null` provoque `TauxLegalManquantError`.
 */

export interface LigneTauxLegal {
  debut: string; // ISO YYYY-MM-DD (inclus)
  fin: string; // ISO YYYY-MM-DD (inclus)
  tauxParticulier: number | null;
  tauxAutres: number | null;
  reference: string | null;
}

export type CategorieCreancier = "particulier" | "autres";

/** Phase du profil de taux. `aPartirDe` = date ISO à partir de laquelle
 * cette phase s'applique (incluse). Les phases doivent être triées. */
export interface PhaseTaux {
  aPartirDe: string;
  multiplicateur: number;
  majorationPoints: number;
}

export interface ParamsLigneInterets {
  base: number;
  dateDebut: string;
  dateFin: string;
  phases: PhaseTaux[];
  anatocisme: boolean;
  dateAnatocisme: string | null;
  categorieCreancier: CategorieCreancier;
  taux: LigneTauxLegal[];
}

/** Ancienne signature (rétrocompatibilité). */
export interface ParamsInterets {
  base: number;
  dateDebut: string;
  dateFin: string;
  doublement: boolean;
  anatocisme: boolean;
  dateAnatocisme: string | null;
  categorieCreancier: CategorieCreancier;
  taux: LigneTauxLegal[];
}

export interface SegmentInteret {
  debut: string;
  fin: string;
  jours: number;
  base: number;
  tauxLegalBase: number; // taux légal brut du semestre
  multiplicateur: number;
  majorationPoints: number;
  tauxAnnuel: number; // taux effectif : base × mult + maj
  doublement: boolean; // pratique = (multiplicateur === 2 && maj === 0)
  reference: string | null;
  interets: number;
}

export interface CapitalisationEvent {
  date: string;
  interetsIncorpores: number;
  nouvelleBase: number;
}

export interface ResultatInterets {
  segments: SegmentInteret[];
  capitalisations: CapitalisationEvent[];
  totalInterets: number;
  references: string[];
  baseFinale: number;
}

export class TauxLegalManquantError extends Error {
  constructor(public periodeDebut: string, public periodeFin: string) {
    super(
      `Taux légal non renseigné pour la période ${periodeDebut} - ${periodeFin}. Complétez-le depuis l'écran Taux légal.`,
    );
    this.name = "TauxLegalManquantError";
  }
}

// --- Helpers dates ---

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}
function toISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function joursEntre(debut: string, fin: string): number {
  const a = parseDate(debut).getTime();
  const b = parseDate(fin).getTime();
  return Math.round((b - a) / 86400000) + 1;
}
function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}
function maxISO(a: string, b: string): string { return a >= b ? a : b; }
function minISO(a: string, b: string): string { return a <= b ? a : b; }

function ajouterMois(iso: string, mois: number): string {
  const d = parseDate(iso);
  const jour = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + mois);
  // Clamp jour si le mois de destination est plus court.
  const dernierJour = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(jour, dernierJour));
  return toISO(d);
}

function anniversaireDans(origine: string, annee: number): string {
  const [, m, d] = origine.split("-");
  return `${annee}-${m}-${d}`;
}

/** Phase active à une date donnée = dernière phase dont aPartirDe <= date. */
function phaseA(date: string, phases: PhaseTaux[]): PhaseTaux {
  let active = phases[0];
  for (const p of phases) {
    if (p.aPartirDe <= date) active = p;
    else break;
  }
  return active;
}

/**
 * Découpe [debut, fin] par les frontières des taux légaux ET des phases.
 * Retourne des tranches à taux légal et phase constants.
 */
function decouper(
  debut: string,
  fin: string,
  taux: LigneTauxLegal[],
  phases: PhaseTaux[],
): Array<{ debut: string; fin: string; ligne: LigneTauxLegal; phase: PhaseTaux }> {
  const trie = [...taux].sort((a, b) => a.debut.localeCompare(b.debut));
  const phasesTriees = [...phases].sort((a, b) => a.aPartirDe.localeCompare(b.aPartirDe));
  const out: Array<{ debut: string; fin: string; ligne: LigneTauxLegal; phase: PhaseTaux }> = [];
  for (const l of trie) {
    const d0 = maxISO(l.debut, debut);
    const f0 = minISO(l.fin, fin);
    if (d0 > f0) continue;
    // Redécoupe par phases à l'intérieur de la tranche de taux.
    const cuts = new Set<string>([d0]);
    for (const p of phasesTriees) {
      if (p.aPartirDe > d0 && p.aPartirDe <= f0) cuts.add(p.aPartirDe);
    }
    const bornes = Array.from(cuts).sort();
    for (let i = 0; i < bornes.length; i++) {
      const d = bornes[i];
      const f = i + 1 < bornes.length ? addDays(bornes[i + 1], -1) : f0;
      if (d > f) continue;
      out.push({ debut: d, fin: f, ligne: l, phase: phaseA(d, phasesTriees) });
    }
  }
  out.sort((a, b) => a.debut.localeCompare(b.debut));
  return out;
}

export function calculerLigneInterets(params: ParamsLigneInterets): ResultatInterets {
  const {
    base: baseInitiale,
    dateDebut,
    dateFin,
    phases,
    anatocisme,
    dateAnatocisme,
    categorieCreancier,
    taux,
  } = params;

  if (dateFin < dateDebut) {
    throw new Error("La date de fin doit être postérieure à la date de début.");
  }
  if (!phases.length) {
    throw new Error("Aucune phase de taux fournie.");
  }

  // Anatocisme : coupures annuelles à partir de dateAnatocisme.
  const echeancesAnatocisme: string[] = [];
  if (anatocisme && dateAnatocisme) {
    const origine = parseDate(dateAnatocisme);
    const startYear = origine.getUTCFullYear() + 1;
    for (let y = startYear; y <= parseDate(dateFin).getUTCFullYear() + 1; y++) {
      const cand = anniversaireDans(dateAnatocisme, y);
      if (cand > dateDebut && cand <= dateFin) echeancesAnatocisme.push(cand);
    }
  }

  const bornes: Array<{ debut: string; fin: string; capitaliseA: string | null }> = [];
  let cursor = dateDebut;
  for (const ech of echeancesAnatocisme) {
    const f = addDays(ech, -1);
    if (f < cursor) continue;
    bornes.push({ debut: cursor, fin: f, capitaliseA: ech });
    cursor = ech;
  }
  bornes.push({ debut: cursor, fin: dateFin, capitaliseA: null });

  const segments: SegmentInteret[] = [];
  const capitalisations: CapitalisationEvent[] = [];
  const references = new Set<string>();
  let base = baseInitiale;
  let interetsCourus = 0;

  for (const borne of bornes) {
    const decoupe = decouper(borne.debut, borne.fin, taux, phases);
    const joursTotaux = joursEntre(borne.debut, borne.fin);
    const joursCouverts = decoupe.reduce((s, d) => s + joursEntre(d.debut, d.fin), 0);
    if (joursCouverts < joursTotaux) {
      throw new TauxLegalManquantError(borne.debut, borne.fin);
    }
    for (const d of decoupe) {
      const tauxBrut = categorieCreancier === "particulier"
        ? d.ligne.tauxParticulier
        : d.ligne.tauxAutres;
      if (tauxBrut == null) {
        throw new TauxLegalManquantError(d.debut, d.fin);
      }
      const tauxEffectif = tauxBrut * d.phase.multiplicateur + d.phase.majorationPoints;
      const jours = joursEntre(d.debut, d.fin);
      const interet = (base * tauxEffectif * jours) / 100 / 365;
      segments.push({
        debut: d.debut,
        fin: d.fin,
        jours,
        base,
        tauxLegalBase: tauxBrut,
        multiplicateur: d.phase.multiplicateur,
        majorationPoints: d.phase.majorationPoints,
        tauxAnnuel: tauxEffectif,
        doublement: d.phase.multiplicateur === 2 && d.phase.majorationPoints === 0,
        reference: d.ligne.reference,
        interets: interet,
      });
      if (d.ligne.reference) references.add(d.ligne.reference);
      interetsCourus += interet;
    }
    if (borne.capitaliseA) {
      const nouvelleBase = base + interetsCourus;
      capitalisations.push({
        date: borne.capitaliseA,
        interetsIncorpores: interetsCourus,
        nouvelleBase,
      });
      base = nouvelleBase;
      interetsCourus = 0;
    }
  }

  return {
    segments,
    capitalisations,
    totalInterets: segments.reduce((s, x) => s + x.interets, 0),
    references: Array.from(references),
    baseFinale: base + interetsCourus,
  };
}

/** Rétrocompatibilité : ancienne API à booléen `doublement`. */
export function calculerInterets(params: ParamsInterets): ResultatInterets {
  return calculerLigneInterets({
    base: params.base,
    dateDebut: params.dateDebut,
    dateFin: params.dateFin,
    anatocisme: params.anatocisme,
    dateAnatocisme: params.dateAnatocisme,
    categorieCreancier: params.categorieCreancier,
    taux: params.taux,
    phases: [
      {
        aPartirDe: params.dateDebut,
        multiplicateur: params.doublement ? 2 : 1,
        majorationPoints: 0,
      },
    ],
  });
}

// --- Régimes ---

/**
 * Régimes disponibles.
 *
 * Le module ne gère que les intérêts **antérieurs au jugement** :
 *  - `taux_legal`     : taux légal simple ;
 *  - `badinter_avant` : doublement Badinter avant jugement
 *    (art. L. 211-13 C. assur.).
 *
 * Toute logique postérieure au jugement (art. L. 211-17 C. assur.,
 * majoration L. 313-3 C. mon. fin.) a été retirée du calculateur.
 */
export type RegimeInterets = "taux_legal" | "badinter_avant";

export interface LigneInterets {
  id: string;
  libelle: string;
  base: number;
  categorieCreancier: CategorieCreancier;
  regime: RegimeInterets;
  dateDebut: string | null;
  dateFin: string | null;
  anatocisme: boolean;
  dateAnatocisme: string | null;
}

export function defaultLigneInterets(id: string): LigneInterets {
  return {
    id,
    libelle: "",
    base: 0,
    categorieCreancier: "particulier",
    regime: "taux_legal",
    dateDebut: null,
    dateFin: null,
    anatocisme: false,
    dateAnatocisme: null,
  };
}

export const LIBELLES_REGIME: Record<RegimeInterets, string> = {
  taux_legal: "Taux légal simple",
  badinter_avant: "Doublement Badinter avant jugement (art. L. 211-9 / L. 211-13 C. assur.)",
};

/**
 * Construit le profil de phases pour une ligne, à partir de son régime.
 * Ne pose aucune valeur par défaut sur les dates : renvoie null si la ligne
 * n'a pas assez d'informations pour être calculée.
 */
export function phasesPourLigne(ligne: LigneInterets): PhaseTaux[] | null {
  if (!ligne.dateDebut) return null;
  const debut = ligne.dateDebut;
  switch (ligne.regime) {
    case "taux_legal":
      return [{ aPartirDe: debut, multiplicateur: 1, majorationPoints: 0 }];
    case "badinter_avant":
      return [{ aPartirDe: debut, multiplicateur: 2, majorationPoints: 0 }];
  }
}


