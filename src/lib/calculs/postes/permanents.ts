/**
 * Postes permanents (Phase 3) — patrimoniaux et extrapatrimoniaux.
 *
 * Toutes les capitalisations utilisent les barèmes 2025 à 0,5 %
 * via `perViager`, `perTemporaire`, `perRenteDifferee`. Les lignes
 * incomplètes sont ignorées ; aucun arrondi intermédiaire.
 */

import type { BaremeType, MethodeRente, Sexe, TableMortalite } from "../types";
import {
  perRenteDifferee,
  perTemporaire,
  perViager,
} from "../capitalisation";
import { annualiser, type Periodicite } from "../annualisation";
import { anneesRevolues } from "../dates";
import { valeurPointAIPP } from "@/data/bareme_aipp";
import { esperanceVieAnnees } from "../esperance";

// ============================================================
// Types
// ============================================================

export type CapitalisationMode = "viager" | "temporaire" | "differee";

export interface DSFPonctuelle {
  id: string;
  libelle: string;
  montant: number;
  tiersPayeur: number;
}

export interface DSFRecurrente {
  id: string;
  libelle: string;
  montant: number;
  periodicite: Periodicite;
  tiersPayeur: number; // par an (créance TP annuelle)
  capitalisation: "viager" | "temporaire";
  ageFin: number | null; // requis si "temporaire"
}

export interface ATPPermData {
  heuresParJour: number;
  tauxHoraire: number;
  facteurJours: number; // usuel 412
  capitalisation: "viager" | "temporaire";
  ageFin: number | null;
  tiersPayeur: number; // rente annuelle TP (PCH etc.)
}

export interface PGPFData {
  renteAnnuelle: number;
  capitalisation: CapitalisationMode;
  ageDebut: number | null; // requis si "differee"
  ageFin: number | null; // requis si "temporaire"
  tiersPayeur: number; // rente annuelle TP (invalidité, pension)
}

export interface IPData {
  forfait: number; // dévalorisation / pénibilité (forfait)
  perteRetraiteRente: number; // rente annuelle
  perteRetraiteAgeDebut: number | null;
  perteRetraiteTP: number;
}

export interface AdaptationLigne {
  id: string;
  libelle: string;
  montant: number;
  recurrent: boolean;
  periodicite: Periodicite; // ignoré si !recurrent
  capitalisation: "viager" | "temporaire"; // ignoré si !recurrent
  ageFin: number | null;
  tiersPayeur: number;
}

export type DFPMethode = "point" | "capitalise";

export interface DFPData {
  methode: DFPMethode;
  valeurPointCustom: number | null; // si défini, remplace le barème AIPP
  montantCapitalise: number; // saisi si méthode "capitalise"
}

export interface ForfaitPoste {
  montant: number;
  cotation: number; // 0..7 (indicatif)
}

export interface PostesPermanents {
  dsfPonctuelles: DSFPonctuelle[];
  dsfRecurrentes: DSFRecurrente[];
  atpPerm: ATPPermData;
  pgpf: PGPFData;
  ip: IPData;
  logement: AdaptationLigne[];
  vehicule: AdaptationLigne[];
  dfp: DFPData;
  agrement: ForfaitPoste;
  sexuel: ForfaitPoste;
  esthetiquePerm: ForfaitPoste;
  etablissement: ForfaitPoste;
  pathologiesEvo: ForfaitPoste;
}

export function defaultPostesPermanents(): PostesPermanents {
  return {
    dsfPonctuelles: [],
    dsfRecurrentes: [],
    atpPerm: {
      heuresParJour: 0,
      tauxHoraire: 20,
      facteurJours: 412,
      capitalisation: "viager",
      ageFin: null,
      tiersPayeur: 0,
    },
    pgpf: {
      renteAnnuelle: 0,
      capitalisation: "viager",
      ageDebut: null,
      ageFin: null,
      tiersPayeur: 0,
    },
    ip: {
      forfait: 0,
      perteRetraiteRente: 0,
      perteRetraiteAgeDebut: null,
      perteRetraiteTP: 0,
    },
    logement: [],
    vehicule: [],
    dfp: { methode: "point", valeurPointCustom: null, montantCapitalise: 0 },
    agrement: { montant: 0, cotation: 0 },
    sexuel: { montant: 0, cotation: 0 },
    esthetiquePerm: { montant: 0, cotation: 0 },
    etablissement: { montant: 0, cotation: 0 },
    pathologiesEvo: { montant: 0, cotation: 0 },
  };
}

// ============================================================
// Contexte de capitalisation
// ============================================================

export interface CapitalisationContexte {
  ageLiquidation: number | null; // années révolues au jour de la liquidation
  ageConsolidation: number | null;
  bareme: BaremeType;
  sexe: Sexe;
  methodeRente: MethodeRente;
  tableMortalite: TableMortalite;
  tauxAIPP: number;
}

export function perFromMode(
  mode: "viager" | "temporaire" | "differee",
  ctx: CapitalisationContexte,
  ageFin: number | null,
  ageDebut: number | null,
): number {
  if (ctx.ageLiquidation == null) return 0;
  if (mode === "viager") {
    return perViager(ctx.ageLiquidation, ctx.bareme, ctx.sexe);
  }
  if (mode === "temporaire") {
    if (ageFin == null || ageFin <= ctx.ageLiquidation) return 0;
    return perTemporaire(ctx.ageLiquidation, ageFin, ctx.bareme, ctx.sexe);
  }
  // différée
  if (ageDebut == null || ageDebut <= ctx.ageLiquidation) return 0;
  return perRenteDifferee(
    ctx.ageLiquidation,
    ageDebut,
    ctx.bareme,
    ctx.sexe,
    ctx.methodeRente,
  );
}

// ============================================================
// DSF
// ============================================================

export interface LigneDSFPonctuelle {
  id: string;
  libelle: string;
  montant: number;
  tiersPayeur: number;
  resteACharge: number;
}
export interface LigneDSFRecurrente {
  id: string;
  libelle: string;
  renteAnnuelle: number;
  per: number;
  capitalDette: number;
  capitalTP: number;
  capitalReste: number;
}

export function calculerDSFPonctuelles(lignes: DSFPonctuelle[]): {
  lignes: LigneDSFPonctuelle[];
  totalMontant: number;
  totalTP: number;
  totalReste: number;
} {
  const out: LigneDSFPonctuelle[] = [];
  let tM = 0, tT = 0, tR = 0;
  for (const l of lignes) {
    if (!isFinite(l.montant) || l.montant <= 0) continue;
    const tp = Math.max(0, l.tiersPayeur || 0);
    const reste = Math.max(0, l.montant - tp);
    out.push({ id: l.id, libelle: l.libelle, montant: l.montant, tiersPayeur: tp, resteACharge: reste });
    tM += l.montant; tT += tp; tR += reste;
  }
  return { lignes: out, totalMontant: tM, totalTP: tT, totalReste: tR };
}

export function calculerDSFRecurrentes(
  lignes: DSFRecurrente[],
  ctx: CapitalisationContexte,
): {
  lignes: LigneDSFRecurrente[];
  totalDette: number;
  totalTP: number;
  totalReste: number;
} {
  const out: LigneDSFRecurrente[] = [];
  let tD = 0, tT = 0, tR = 0;
  for (const l of lignes) {
    if (!isFinite(l.montant) || l.montant <= 0) continue;
    const annuel = annualiser(l.montant, l.periodicite);
    const per = perFromMode(l.capitalisation, ctx, l.ageFin, null);
    if (per <= 0) continue;
    const capital = annuel * per;
    const capitalTP = Math.max(0, (l.tiersPayeur || 0) * per);
    const reste = Math.max(0, capital - capitalTP);
    out.push({
      id: l.id, libelle: l.libelle, renteAnnuelle: annuel, per,
      capitalDette: capital, capitalTP, capitalReste: reste,
    });
    tD += capital; tT += capitalTP; tR += reste;
  }
  return { lignes: out, totalDette: tD, totalTP: tT, totalReste: tR };
}

// ============================================================
// ATP permanente
// ============================================================

export function calculerATPPerm(
  d: ATPPermData,
  ctx: CapitalisationContexte,
): { renteAnnuelle: number; per: number; capital: number; capitalTP: number; reste: number } {
  if (!isFinite(d.heuresParJour) || !isFinite(d.tauxHoraire)) return zeroCap();
  if (d.heuresParJour <= 0 || d.tauxHoraire <= 0) return zeroCap();
  const facteur = d.facteurJours > 0 ? d.facteurJours : 365;
  const renteAnnuelle = d.tauxHoraire * d.heuresParJour * facteur;
  const per = perFromMode(d.capitalisation, ctx, d.ageFin, null);
  const capital = renteAnnuelle * per;
  const capitalTP = Math.max(0, (d.tiersPayeur || 0) * per);
  const reste = Math.max(0, capital - capitalTP);
  return { renteAnnuelle, per, capital, capitalTP, reste };
}

// ============================================================
// PGPF
// ============================================================

export function calculerPGPF(
  d: PGPFData,
  ctx: CapitalisationContexte,
): { per: number; capital: number; capitalTP: number; reste: number } {
  if (!isFinite(d.renteAnnuelle) || d.renteAnnuelle <= 0) return zeroCap2();
  const per = perFromMode(d.capitalisation, ctx, d.ageFin, d.ageDebut);
  const capital = d.renteAnnuelle * per;
  const capitalTP = Math.max(0, (d.tiersPayeur || 0) * per);
  const reste = Math.max(0, capital - capitalTP);
  return { per, capital, capitalTP, reste };
}

// ============================================================
// IP (Incidence professionnelle)
// ============================================================

export function calculerIP(
  d: IPData,
  ctx: CapitalisationContexte,
): { forfait: number; retraite: { per: number; capital: number; capitalTP: number; reste: number }; total: number; totalTP: number; totalReste: number } {
  const forfait = Math.max(0, d.forfait || 0);
  let per = 0, capital = 0, capitalTP = 0, reste = 0;
  if (isFinite(d.perteRetraiteRente) && d.perteRetraiteRente > 0 && d.perteRetraiteAgeDebut != null) {
    per = perFromMode("differee", ctx, null, d.perteRetraiteAgeDebut);
    capital = d.perteRetraiteRente * per;
    capitalTP = Math.max(0, (d.perteRetraiteTP || 0) * per);
    reste = Math.max(0, capital - capitalTP);
  }
  return {
    forfait,
    retraite: { per, capital, capitalTP, reste },
    total: forfait + capital,
    totalTP: capitalTP,
    totalReste: forfait + reste,
  };
}

// ============================================================
// Adaptations (logement / véhicule)
// ============================================================

export interface LigneAdaptation {
  id: string;
  libelle: string;
  montantOuRente: number;
  per: number; // 1 pour ponctuel
  capital: number;
  capitalTP: number;
  reste: number;
}

export function calculerAdaptation(
  lignes: AdaptationLigne[],
  ctx: CapitalisationContexte,
): { lignes: LigneAdaptation[]; total: number; totalTP: number; totalReste: number } {
  const out: LigneAdaptation[] = [];
  let tC = 0, tT = 0, tR = 0;
  for (const l of lignes) {
    if (!isFinite(l.montant) || l.montant <= 0) continue;
    if (l.recurrent) {
      const annuel = annualiser(l.montant, l.periodicite);
      const per = perFromMode(l.capitalisation, ctx, l.ageFin, null);
      if (per <= 0) continue;
      const cap = annuel * per;
      const tp = Math.max(0, (l.tiersPayeur || 0) * per);
      const r = Math.max(0, cap - tp);
      out.push({ id: l.id, libelle: l.libelle, montantOuRente: annuel, per, capital: cap, capitalTP: tp, reste: r });
      tC += cap; tT += tp; tR += r;
    } else {
      const tp = Math.max(0, l.tiersPayeur || 0);
      const r = Math.max(0, l.montant - tp);
      out.push({ id: l.id, libelle: l.libelle, montantOuRente: l.montant, per: 1, capital: l.montant, capitalTP: tp, reste: r });
      tC += l.montant; tT += tp; tR += r;
    }
  }
  return { lignes: out, total: tC, totalTP: tT, totalReste: tR };
}

// ============================================================
// DFP
// ============================================================

export function calculerDFP(
  d: DFPData,
  ctx: CapitalisationContexte,
): { valeurPoint: number; montant: number } {
  if (d.methode === "capitalise") {
    return { valeurPoint: 0, montant: Math.max(0, d.montantCapitalise || 0) };
  }
  if (ctx.tauxAIPP <= 0) return { valeurPoint: 0, montant: 0 };
  const ageRef = ctx.ageConsolidation ?? ctx.ageLiquidation ?? 0;
  const valeur = d.valeurPointCustom != null && d.valeurPointCustom > 0
    ? d.valeurPointCustom
    : valeurPointAIPP(ctx.tauxAIPP, ageRef);
  return { valeurPoint: valeur, montant: valeur * ctx.tauxAIPP };
}

// ============================================================
// Utilitaires
// ============================================================

function zeroCap() {
  return { renteAnnuelle: 0, per: 0, capital: 0, capitalTP: 0, reste: 0 };
}
function zeroCap2() {
  return { per: 0, capital: 0, capitalTP: 0, reste: 0 };
}

export function buildContexte(d: {
  dateNaissance: string | null;
  dateConsolidation: string | null;
  dateLiquidation: string | null;
  bareme: BaremeType;
  sexe: Sexe;
  methodeRente: MethodeRente;
  tableMortalite: TableMortalite;
  tauxAIPP: number;
}): CapitalisationContexte {
  return {
    ageLiquidation: anneesRevolues(d.dateNaissance, d.dateLiquidation),
    ageConsolidation: anneesRevolues(d.dateNaissance, d.dateConsolidation),
    bareme: d.bareme,
    sexe: d.sexe,
    methodeRente: d.methodeRente,
    tableMortalite: d.tableMortalite,
    tauxAIPP: d.tauxAIPP,
  };
}

/** Espérance de vie utile (jours restants) — pour affichage DFP capitalisé au jour. */
export function esperanceRestante(ctx: CapitalisationContexte): number | null {
  return esperanceVieAnnees(ctx.ageLiquidation, ctx.sexe, ctx.tableMortalite);
}
