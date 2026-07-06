/**
 * Types du domaine "dossier d'indemnisation" (nomenclature Dintilhac).
 * Toutes les dates sont stockées au format ISO (YYYY-MM-DD).
 */

export type Sexe = "F" | "M" | "I";
export type TableMortalite = "2020-2022" | "2023-2025";
export type BaremeType = "stationnaire" | "prospectif";
export type MethodeRente = "habituelle" | "exacte";

export type FaitGenerateur =
  | "circulation"
  | "medical"
  | "accident_travail"
  | "maladie_pro"
  | "infraction_penale"
  | "terrorisme"
  | "autre";

export interface PeriodeDFT {
  id: string;
  debut: string | null;
  fin: string | null;
  taux: number; // 0 à 1 (ex : 1 = 100%, 0.5 = 50%)
}

export interface DossierData {
  reference: string;
  faitGenerateur: FaitGenerateur;
  sexe: Sexe;
  tableMortalite: TableMortalite;
  bareme: BaremeType;
  methodeRente: MethodeRente;

  dateNaissance: string | null;
  dateAccident: string | null;
  dateConsolidation: string | null;
  dateLiquidation: string | null;

  tauxAIPP: number; // %
  souffrancesEndurees: number; // 0..7
  esthetiqueTemp: number; // 0..7
  esthetiquePerm: number; // 0..7

  fFaute: number; // 0..1
  fChance: number; // 0..1

  dftDebutLendemain: boolean; // false = jour même de l'accident
  periodesDFT: PeriodeDFT[];

  // Note : les données des postes (pages 2 à 7) seront ajoutées dans les
  // phases suivantes sous forme de champs typés dédiés (patrimoniauxTemp,
  // extrapatrimoniauxTemp, etc.), pour préserver la sérialisation stricte
  // exigée par TanStack Start.
}

export function defaultDossierData(): DossierData {
  return {
    reference: "Nouveau dossier",
    faitGenerateur: "circulation",
    sexe: "I",
    tableMortalite: "2023-2025",
    bareme: "stationnaire",
    methodeRente: "habituelle",
    dateNaissance: null,
    dateAccident: null,
    dateConsolidation: null,
    dateLiquidation: null,
    tauxAIPP: 0,
    souffrancesEndurees: 0,
    esthetiqueTemp: 0,
    esthetiquePerm: 0,
    fFaute: 1,
    fChance: 1,
    dftDebutLendemain: false,
    periodesDFT: [],
    postes: {},
  };
}
