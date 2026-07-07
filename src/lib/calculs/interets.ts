/**
 * Moteur de calcul des intérêts au taux légal.
 *
 * Pur, testable, sans dépendance UI. Refuse silencieusement d'inventer
 * une valeur : tout segment traversant une période dont le taux applicable
 * est `null` provoque une erreur explicite.
 */

export interface LigneTauxLegal {
  debut: string; // ISO YYYY-MM-DD (inclus)
  fin: string; // ISO YYYY-MM-DD (inclus)
  tauxParticulier: number | null;
  tauxAutres: number | null;
  reference: string | null;
}

export type CategorieCreancier = "particulier" | "autres";

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
  tauxAnnuel: number; // en pourcentage (ex : 6.84)
  doublement: boolean;
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

// --- Helpers dates (pures, indépendantes de la locale) ---

function parseDate(iso: string): Date {
  // ISO YYYY-MM-DD à midi UTC pour éviter tout DST / bord de jour.
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
  // Nombre de jours entre deux dates inclusives.
  const a = parseDate(debut).getTime();
  const b = parseDate(fin).getTime();
  return Math.round((b - a) / 86400000) + 1;
}

function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

function maxISO(a: string, b: string): string {
  return a >= b ? a : b;
}
function minISO(a: string, b: string): string {
  return a <= b ? a : b;
}

/** Anniversaire annuel de `origine` dans l'année de `anchor`. */
function anniversaireDans(origine: string, annee: number): string {
  const [, m, d] = origine.split("-");
  return `${annee}-${m}-${d}`;
}

/**
 * Découpage de [debut, fin] en sous-périodes selon les segments de taux.
 * Retourne toutes les intersections non vides, dans l'ordre chronologique.
 */
function decouperParTaux(
  debut: string,
  fin: string,
  taux: LigneTauxLegal[],
): Array<{ debut: string; fin: string; ligne: LigneTauxLegal }> {
  const tri = [...taux].sort((a, b) => a.debut.localeCompare(b.debut));
  const out: Array<{ debut: string; fin: string; ligne: LigneTauxLegal }> = [];
  for (const l of tri) {
    const d = maxISO(l.debut, debut);
    const f = minISO(l.fin, fin);
    if (d <= f) out.push({ debut: d, fin: f, ligne: l });
  }
  return out;
}

export function calculerInterets(params: ParamsInterets): ResultatInterets {
  const {
    base: baseInitiale,
    dateDebut,
    dateFin,
    doublement,
    anatocisme,
    dateAnatocisme,
    categorieCreancier,
    taux,
  } = params;

  if (dateFin < dateDebut) {
    throw new Error("La date de fin doit être postérieure à la date de début.");
  }

  // Détermination des points de coupure pour l'anatocisme.
  // À chaque anniversaire annuel de dateAnatocisme situé strictement dans
  // (dateDebut, dateFin], on ferme la période courante et on capitalise
  // les intérêts échus depuis au moins un an.
  const echeancesAnatocisme: string[] = [];
  if (anatocisme && dateAnatocisme) {
    // Première échéance = dateAnatocisme + 1 an révolu.
    const origine = parseDate(dateAnatocisme);
    const startYear = origine.getUTCFullYear() + 1;
    for (let y = startYear; y <= parseDate(dateFin).getUTCFullYear() + 1; y++) {
      const cand = anniversaireDans(dateAnatocisme, y);
      if (cand > dateDebut && cand <= dateFin) echeancesAnatocisme.push(cand);
    }
  }

  // On construit la liste des périodes fermées par anatocisme.
  // Chaque période = [d, f] avec f = échéance - 1 jour (jour de capitalisation
  // marque la nouvelle base pour le jour même), sauf la dernière = dateFin.
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
    const decoupe = decouperParTaux(borne.debut, borne.fin, taux);
    // Vérifier que toute la période est couverte et que chaque taux est
    // renseigné. On additionne les jours couverts.
    const joursTotaux = joursEntre(borne.debut, borne.fin);
    const joursCouverts = decoupe.reduce(
      (s, d) => s + joursEntre(d.debut, d.fin),
      0,
    );
    if (joursCouverts < joursTotaux) {
      throw new TauxLegalManquantError(borne.debut, borne.fin);
    }
    for (const d of decoupe) {
      const tauxBrut =
        categorieCreancier === "particulier"
          ? d.ligne.tauxParticulier
          : d.ligne.tauxAutres;
      if (tauxBrut == null) {
        throw new TauxLegalManquantError(d.debut, d.fin);
      }
      const tauxAppliqueeAnnuel = doublement ? tauxBrut * 2 : tauxBrut;
      const jours = joursEntre(d.debut, d.fin);
      const interet = (base * tauxAppliqueeAnnuel * jours) / 100 / 365;
      segments.push({
        debut: d.debut,
        fin: d.fin,
        jours,
        base,
        tauxAnnuel: tauxAppliqueeAnnuel,
        doublement,
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

  const totalInterets =
    segments.reduce((s, x) => s + x.interets, 0) +
    // Le total des intérêts est la somme des segments : les capitalisations
    // ne créent pas d'intérêts supplémentaires, elles déplacent seulement la
    // base pour le calcul des segments suivants. Rien à ajouter ici.
    0;

  return {
    segments,
    capitalisations,
    totalInterets,
    references: Array.from(references),
    baseFinale: base + interetsCourus,
  };
}
