/**
 * Synthèse transversale (Phase 5).
 *
 * Agrège tous les postes du dossier en lignes normalisées :
 *   { poste, categorie, montant, tiersPayeur, dette, partVictime, partTP }
 * puis produit les sous-totaux par catégorie et les totaux généraux.
 *
 * Règles :
 *  - `dette = montant × fFaute × fChance`
 *  - `répartition` applique le droit de préférence de la victime
 *  - Lignes à 0 conservées si sous-total ≠ 0 côté catégorie (sinon filtrées).
 *  - Aucun arrondi intermédiaire.
 */

import type { DossierData } from "../types";
import { detteResponsable, repartition } from "../fractions";
import { calculerDSAPonctuelles, calculerDSARecurrentes } from "./dsa";
import { calculerATPTemp } from "./atpTemp";
import { calculerPGPA } from "./pgpa";
import { calculerDFT } from "./dft";
import {
  buildContexte,
  calculerAdaptation,
  calculerATPPerm,
  calculerDFP,
  calculerDSFPonctuelles,
  calculerDSFRecurrentes,
  calculerIP,
  calculerPGPF,
} from "./permanents";
import {
  calculerFraisDivers,
  calculerPerteRevenusFoyer,
  totalAffection,
} from "./deces";
import {
  calculerPerteRevenusSurvie,
  totalAffectionSurvie,
  totalPEPSurvie,
} from "./survieProches";

export type Categorie =
  | "PT" // Patrimoniaux temporaires
  | "EPT" // Extrapatrimoniaux temporaires
  | "PP" // Patrimoniaux permanents
  | "EPP" // Extrapatrimoniaux permanents
  | "DECES" // Décès (proches)
  | "SURVIE"; // Survie (proches)

export const CATEGORIE_LABEL: Record<Categorie, string> = {
  PT: "Préjudices patrimoniaux temporaires",
  EPT: "Préjudices extrapatrimoniaux temporaires",
  PP: "Préjudices patrimoniaux permanents",
  EPP: "Préjudices extrapatrimoniaux permanents",
  DECES: "Victimes indirectes — décès",
  SURVIE: "Victimes indirectes — survie",
};

export interface LigneSynthese {
  poste: string;
  code: string;
  categorie: Categorie;
  montant: number;
  tiersPayeur: number;
  dette: number;
  partVictime: number;
  partTP: number;
}

export interface SousTotal {
  categorie: Categorie;
  label: string;
  montant: number;
  tiersPayeur: number;
  dette: number;
  partVictime: number;
  partTP: number;
}

export interface Synthese {
  lignes: LigneSynthese[];
  sousTotaux: SousTotal[];
  totalMontant: number;
  totalTP: number;
  totalDette: number;
  totalVictime: number;
  totalTPRepartition: number;
}

function ligne(
  code: string,
  poste: string,
  categorie: Categorie,
  montant: number,
  tp: number,
  fFaute: number,
  fChance: number,
): LigneSynthese {
  const dette = detteResponsable(montant, fFaute, fChance);
  const r = repartition(montant, tp, dette);
  return {
    code,
    poste,
    categorie,
    montant,
    tiersPayeur: tp,
    dette,
    partVictime: r.victime,
    partTP: r.tiersPayeur,
  };
}

export function calculerSynthese(d: DossierData): Synthese {
  const f = d.fFaute;
  const c = d.fChance;
  const ctx = buildContexte(d);
  const lignes: LigneSynthese[] = [];

  // ----- Patrimoniaux temporaires -----
  const dsaP = calculerDSAPonctuelles(d.postesTemp.dsaPonctuelles, d.dateLiquidation);
  const dsaR = calculerDSARecurrentes(d.postesTemp.dsaRecurrentes, d.dateLiquidation);
  lignes.push(ligne("DSA", "Dépenses de santé actuelles",
    "PT", dsaP.totalRevalo + dsaR.totalRevalo + (dsaP.totalTP + dsaR.totalTP),
    dsaP.totalTP + dsaR.totalTP, f, c));

  const atpT = calculerATPTemp(d.postesTemp.atpTemp);
  lignes.push(ligne("ATP-T", "Assistance tierce personne (temporaire)", "PT", atpT.total, 0, f, c));

  const pgpa = calculerPGPA(d.postesTemp.pgpa, d.dateLiquidation);
  lignes.push(ligne("PGPA", "Perte de gains professionnels actuels", "PT", pgpa.perte, pgpa.tiersPayeur, f, c));

  // ----- Extrapatrimoniaux temporaires -----
  const dft = calculerDFT(d.periodesDFT, d.postesTemp.dft.tauxJournalier);
  lignes.push(ligne("DFT", "Déficit fonctionnel temporaire", "EPT", dft.montant, 0, f, c));
  lignes.push(ligne("SE", "Souffrances endurées", "EPT", Math.max(0, d.postesTemp.se.montant || 0), 0, f, c));
  lignes.push(ligne("PET", "Préjudice esthétique temporaire", "EPT", Math.max(0, d.postesTemp.pet.montant || 0), 0, f, c));

  // ----- Patrimoniaux permanents -----
  const pp = d.postesPerm;
  const dsfP = calculerDSFPonctuelles(pp.dsfPonctuelles);
  const dsfR = calculerDSFRecurrentes(pp.dsfRecurrentes, ctx);
  lignes.push(ligne("DSF", "Dépenses de santé futures", "PP",
    dsfP.totalMontant + dsfR.totalDette, dsfP.totalTP + dsfR.totalTP, f, c));

  const atpP = calculerATPPerm(pp.atpPerm, ctx);
  lignes.push(ligne("ATP-P", "Assistance tierce personne permanente", "PP", atpP.capital, atpP.capitalTP, f, c));

  const pgpf = calculerPGPF(pp.pgpf, ctx);
  lignes.push(ligne("PGPF", "Perte de gains professionnels futurs", "PP", pgpf.capital, pgpf.capitalTP, f, c));

  const ip = calculerIP(pp.ip, ctx);
  lignes.push(ligne("IP", "Incidence professionnelle", "PP", ip.total, ip.totalTP, f, c));

  const log = calculerAdaptation(pp.logement, ctx);
  lignes.push(ligne("LOG", "Frais de logement adapté", "PP", log.total, log.totalTP, f, c));

  const veh = calculerAdaptation(pp.vehicule, ctx);
  lignes.push(ligne("VEH", "Frais de véhicule adapté", "PP", veh.total, veh.totalTP, f, c));

  // ----- Extrapatrimoniaux permanents -----
  const dfp = calculerDFP(pp.dfp, ctx);
  lignes.push(ligne("DFP", "Déficit fonctionnel permanent", "EPP", dfp.montant, 0, f, c));
  lignes.push(ligne("PA", "Préjudice d'agrément", "EPP", Math.max(0, pp.agrement.montant || 0), 0, f, c));
  lignes.push(ligne("PSex", "Préjudice sexuel", "EPP", Math.max(0, pp.sexuel.montant || 0), 0, f, c));
  lignes.push(ligne("PEP", "Préjudice esthétique permanent", "EPP", Math.max(0, pp.esthetiquePerm.montant || 0), 0, f, c));
  lignes.push(ligne("PE", "Préjudice d'établissement", "EPP", Math.max(0, pp.etablissement.montant || 0), 0, f, c));
  lignes.push(ligne("PathEvo", "Pathologies évolutives / anxiété", "EPP", Math.max(0, pp.pathologiesEvo.montant || 0), 0, f, c));

  // ----- Victimes indirectes — décès -----
  const pd = d.postesDeces;
  lignes.push(ligne("OBS", "Frais d'obsèques", "DECES", Math.max(0, pd.obsequesMontant || 0), Math.max(0, pd.obsequesTP || 0), f, c));

  const foyer = calculerPerteRevenusFoyer(pd, { dateLiquidation: d.dateLiquidation, bareme: d.bareme });
  lignes.push(ligne("PRF", "Perte de revenus du foyer", "DECES", foyer.totalCapital, 0, f, c));

  const fraisD = calculerFraisDivers(pd.fraisDivers);
  lignes.push(ligne("FD-D", "Frais divers des proches", "DECES", fraisD.totalMontant, fraisD.totalTP, f, c));

  lignes.push(ligne("ACC", "Accompagnement de fin de vie", "DECES", Math.max(0, pd.accompagnementFinDeVie || 0), Math.max(0, pd.accompagnementTP || 0), f, c));

  lignes.push(ligne("AFF-D", "Préjudice d'affection (décès)", "DECES", totalAffection(pd.proches), 0, f, c));

  // ----- Victimes indirectes — survie -----
  const ps = d.postesSurvie;
  const perteS = calculerPerteRevenusSurvie(ps.proches, { dateLiquidation: d.dateLiquidation, bareme: d.bareme });
  lignes.push(ligne("PRS", "Perte de revenus (proches)", "SURVIE", perteS.totalCapital, perteS.totalTP, f, c));

  const fraisS = calculerFraisDivers(ps.fraisDivers);
  lignes.push(ligne("FD-S", "Frais divers des proches", "SURVIE", fraisS.totalMontant, fraisS.totalTP, f, c));

  lignes.push(ligne("AFF-S", "Préjudice d'affection", "SURVIE", totalAffectionSurvie(ps.proches), 0, f, c));
  lignes.push(ligne("PEP-S", "Préjudice extrapatrimonial exceptionnel", "SURVIE", totalPEPSurvie(ps.proches), 0, f, c));

  // ----- Sous-totaux -----
  const cats: Categorie[] = ["PT", "EPT", "PP", "EPP", "DECES", "SURVIE"];
  const sousTotaux: SousTotal[] = cats.map((cat) => {
    const filtres = lignes.filter((l) => l.categorie === cat);
    const s = {
      categorie: cat,
      label: CATEGORIE_LABEL[cat],
      montant: sum(filtres, "montant"),
      tiersPayeur: sum(filtres, "tiersPayeur"),
      dette: sum(filtres, "dette"),
      partVictime: sum(filtres, "partVictime"),
      partTP: sum(filtres, "partTP"),
    };
    return s;
  });

  return {
    lignes,
    sousTotaux,
    totalMontant: sum(lignes, "montant"),
    totalTP: sum(lignes, "tiersPayeur"),
    totalDette: sum(lignes, "dette"),
    totalVictime: sum(lignes, "partVictime"),
    totalTPRepartition: sum(lignes, "partTP"),
  };
}

function sum<T>(arr: T[], key: keyof T): number {
  let s = 0;
  for (const x of arr) {
    const v = x[key] as unknown as number;
    if (typeof v === "number" && isFinite(v)) s += v;
  }
  return s;
}
