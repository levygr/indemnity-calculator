/**
 * Types du domaine "dossier d'indemnisation" (nomenclature Dintilhac).
 * Toutes les dates sont stockées au format ISO (YYYY-MM-DD).
 */

import type { ModeRevalo, IndiceActualisation } from "./revalorisation";
import type { Periodicite } from "./annualisation";

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

// ---- Postes temporaires (Phase 2) --------------------------------------

/** Dépense de santé actuelle ponctuelle (une facture ponctuelle). */
export interface DSAPonctuelle {
  id: string;
  date: string | null;
  libelle: string;
  depense: number; // montant total de la dépense (brut)
  tiersPayeur: number; // créance TP (indemnisée)
  modeRevalo: ModeRevalo;
}

/** Dépense de santé actuelle récurrente (ex. transports mensuels). */
export interface DSARecurrente {
  id: string;
  debut: string | null;
  fin: string | null;
  libelle: string;
  montant: number; // montant par période
  periodicite: Periodicite;
  tiersPayeur: number; // TP total sur la période
  modeRevalo: ModeRevalo;
}

/** Période d'assistance tierce personne temporaire. */
export interface ATPTempPeriode {
  id: string;
  debut: string | null;
  fin: string | null;
  heuresParJour: number;
  tauxHoraire: number; // €/h
  facteurJours: number; // par défaut 412 (H/365 corrigé) selon plan ; sinon 365
}

export type PGPAMethode = "reference" | "periodes" | "forfait";

export interface PGPAPeriode {
  id: string;
  debut: string | null;
  fin: string | null;
  perte: number; // montant total de perte nette sur la période
}

export interface PGPAData {
  methode: PGPAMethode;
  // Méthode 1 (référence) : revenu annuel net actualisé × durée d'arrêt
  revenuReference: number;
  anneeReference: number | null;
  indice: IndiceActualisation;
  debut: string | null;
  fin: string | null;
  // Méthode 2 (périodes)
  periodes: PGPAPeriode[];
  // Méthode 3 (forfait)
  forfait: number;
  // Indemnités journalières perçues (créance TP)
  ij: number;
}

export interface DFTMontant {
  tauxJournalier: number; // €/j pour 100 % de DFT (défaut 30)
}

export interface SEMontant {
  montant: number; // €
}

export interface PETMontant {
  montant: number; // €
}

export interface PostesTemporaires {
  dsaPonctuelles: DSAPonctuelle[];
  dsaRecurrentes: DSARecurrente[];
  atpTemp: ATPTempPeriode[];
  pgpa: PGPAData;
  dft: DFTMontant;
  se: SEMontant;
  pet: PETMontant;
}

export function defaultPostesTemporaires(): PostesTemporaires {
  return {
    dsaPonctuelles: [],
    dsaRecurrentes: [],
    atpTemp: [],
    pgpa: {
      methode: "reference",
      revenuReference: 0,
      anneeReference: null,
      indice: "ipc",
      debut: null,
      fin: null,
      periodes: [],
      forfait: 0,
      ij: 0,
    },
    dft: { tauxJournalier: 30 },
    se: { montant: 0 },
    pet: { montant: 0 },
  };
}

import {
  defaultPostesPermanents,
  type PostesPermanents,
} from "./postes/permanents";
import { defaultPostesDeces, type PostesDeces } from "./postes/deces";
import { defaultPostesSurvie, type PostesSurvie } from "./postes/survieProches";


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

  dftDebutLendemain: boolean;
  periodesDFT: PeriodeDFT[];

  postesTemp: PostesTemporaires;
  postesPerm: PostesPermanents;
  postesDeces: PostesDeces;
  postesSurvie: PostesSurvie;
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
    postesTemp: defaultPostesTemporaires(),
    postesPerm: defaultPostesPermanents(),
    postesDeces: defaultPostesDeces(),
    postesSurvie: defaultPostesSurvie(),
  };
}


