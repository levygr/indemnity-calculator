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
import { collecterAvertissements, type AvertissementCalcul } from "../avertissements";
import { calculerRecoursTP, type RecoursTP } from "../recoursTP";
import { calculerDSAPonctuelles, calculerDSARecurrentes } from "./dsa";
import { calculerFraisDiversVictime } from "./fraisDiversVictime";
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
  echus?: { montant: number; tp: number };
  aEchoir?: { montant: number; tp: number };
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
  totalProvisions: number;
  soldeVictime: number;
  avertissements: AvertissementCalcul[];
  recoursTP: RecoursTP;
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
    "PT",
    dsaP.totalDepenseRevalorisee + dsaR.totalDepenseRevalorisee,
    dsaP.totalTpRevalorise + dsaR.totalTpRevalorise, f, c));

  const fdV = calculerFraisDiversVictime(d.postesTemp.fraisDivers, d.dateLiquidation);
  lignes.push(ligne("FD", "Frais divers", "PT",
    fdV.totalDepenseRevalorisee, fdV.totalTpRevalorise, f, c));

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
  const dsfLine = ligne("DSF", "Dépenses de santé futures", "PP",
    dsfP.totalMontant + dsfR.totalDette, dsfP.totalTP + dsfR.totalTP, f, c);
  dsfLine.echus = { montant: dsfR.totalEchus.montant, tp: dsfR.totalEchus.tp };
  dsfLine.aEchoir = { montant: dsfP.totalMontant + dsfR.totalAEchoir.montant, tp: dsfP.totalTP + dsfR.totalAEchoir.tp };
  lignes.push(dsfLine);

  const atpP = calculerATPPerm(pp.atpPerm, ctx);
  const atpLine = ligne("ATP-P", "Assistance tierce personne permanente", "PP", atpP.total.montant, atpP.total.tp, f, c);
  atpLine.echus = { montant: atpP.echus.montant, tp: atpP.echus.tp };
  atpLine.aEchoir = { montant: atpP.aEchoir.capital, tp: atpP.aEchoir.capitalTP };
  lignes.push(atpLine);

  const pgpf = calculerPGPF(pp.pgpf, ctx);
  const pgpfLine = ligne("PGPF", "Perte de gains professionnels futurs", "PP", pgpf.total.montant, pgpf.total.tp, f, c);
  pgpfLine.echus = { montant: pgpf.echus.montant, tp: pgpf.echus.tp };
  pgpfLine.aEchoir = { montant: pgpf.aEchoir.capital, tp: pgpf.aEchoir.capitalTP };
  lignes.push(pgpfLine);

  const ip = calculerIP(pp.ip, ctx);
  lignes.push(ligne("IP", "Incidence professionnelle", "PP", ip.total, ip.totalTP, f, c));

  lignes.push(ligne("PSU", "Préjudice scolaire, universitaire ou de formation",
    "PP", Math.max(0, pp.psu.montant || 0), 0, f, c));

  const log = calculerAdaptation(pp.logement, ctx);
  const logLine = ligne("LOG", "Frais de logement adapté", "PP", log.total, log.totalTP, f, c);
  logLine.echus = { montant: log.totalEchus.montant, tp: log.totalEchus.tp };
  logLine.aEchoir = { montant: log.totalAEchoir.montant, tp: log.totalAEchoir.tp };
  lignes.push(logLine);

  const veh = calculerAdaptation(pp.vehicule, ctx);
  const vehLine = ligne("VEH", "Frais de véhicule adapté", "PP", veh.total, veh.totalTP, f, c);
  vehLine.echus = { montant: veh.totalEchus.montant, tp: veh.totalEchus.tp };
  vehLine.aEchoir = { montant: veh.totalAEchoir.montant, tp: veh.totalAEchoir.tp };
  lignes.push(vehLine);

  // ----- Extrapatrimoniaux permanents -----
  const dfp = calculerDFP(pp.dfp, ctx);
  lignes.push(ligne("DFP", "Déficit fonctionnel permanent", "EPP", dfp.montant, 0, f, c));
  lignes.push(ligne("PA", "Préjudice d'agrément", "EPP", Math.max(0, pp.agrement.montant || 0), 0, f, c));
  lignes.push(ligne("PSex", "Préjudice sexuel", "EPP", Math.max(0, pp.sexuel.montant || 0), 0, f, c));
  lignes.push(ligne("PEP", "Préjudice esthétique permanent", "EPP", Math.max(0, pp.esthetiquePerm.montant || 0), 0, f, c));
  lignes.push(ligne("PE", "Préjudice d'établissement", "EPP", Math.max(0, pp.etablissement.montant || 0), 0, f, c));
  lignes.push(ligne("PEV", "Préjudices liés à des pathologies évolutives", "EPP", Math.max(0, pp.pathologiesEvolutives.montant || 0), 0, f, c));
  lignes.push(ligne("PPE", "Préjudice permanent exceptionnel", "EPP", Math.max(0, pp.permanentExceptionnel.montant || 0), 0, f, c));

  // ----- Victimes indirectes — décès -----
  const pd = d.postesDeces;
  lignes.push(ligne("OBS", "Frais d'obsèques", "DECES", Math.max(0, pd.obsequesMontant || 0), Math.max(0, pd.obsequesTP || 0), f, c));

  const foyer = calculerPerteRevenusFoyer(pd, { dateLiquidation: d.dateLiquidation, bareme: d.bareme, methodeRente: d.methodeRente });
  lignes.push(ligne("PRF", "Perte de revenus du foyer", "DECES", foyer.totalCapital, foyer.totalTP, f, c));

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

  const totalVictime = sum(lignes, "partVictime");
  const totalProvisions = (d.provisions || []).reduce(
    (a, p) => a + (isFinite(p.montant) && p.montant > 0 ? p.montant : 0),
    0,
  );

  const avertissements = collecterAvertissements(d);
  if (totalProvisions > totalVictime) {
    avertissements.push({
      code: "PROVISIONS_SUPERIEURES",
      poste: "Provisions",
      message: "Le total des provisions excède la part revenant à la victime.",
      route: "/dossiers/$id/synthese",
      anchor: "section-provisions",
    });
  }

  // Recours des tiers payeurs par organisme × poste + contrôles de cohérence.
  const syntheseSansRecours: Synthese = {
    lignes,
    sousTotaux,
    totalMontant: sum(lignes, "montant"),
    totalTP: sum(lignes, "tiersPayeur"),
    totalDette: sum(lignes, "dette"),
    totalVictime,
    totalTPRepartition: sum(lignes, "partTP"),
    totalProvisions,
    soldeVictime: totalVictime - totalProvisions,
    avertissements,
    recoursTP: { parOrganisme: [], parPoste: [], totalGeneral: { echu: 0, aEchoir: 0, total: 0 }, ecarts: [] },
  };
  const recoursTP = calculerRecoursTP(d, syntheseSansRecours);
  for (const e of recoursTP.ecarts) {
    avertissements.push({
      code: "ECART_CREANCES_TP",
      poste: e.posteCode,
      message: `Créances ventilées (${e.ventile.toFixed(2)} €) ≠ TP retenu dans la synthèse (${e.tpSynthese.toFixed(2)} €) pour ${e.libelle}.`,
      route: "/dossiers/$id/tiers-payeurs",
      anchor: "section-creances-tp",
    });
  }

  return { ...syntheseSansRecours, recoursTP };
}

function sum<T>(arr: T[], key: keyof T): number {
  let s = 0;
  for (const x of arr) {
    const v = x[key] as unknown as number;
    if (typeof v === "number" && isFinite(v)) s += v;
  }
  return s;
}
