/**
 * Prix de l'euro de rente (PER). Six barèmes 2025 (taux 0,5 %), au choix
 * stationnaire / prospectif combiné au sexe de la victime.
 *
 * Rentes différées :
 *  - "habituelle" : PER = PER viager à l'âge du début de rente.
 *  - "exacte"    : PER = PER viager(âge liquidation) − PER temporaire(liquidation → début).
 *
 * En prospectif, si l'âge de fin de rente > 90, on retombe sur le PER viager.
 * Aucune valeur `null` des JSON n'est utilisée.
 */

import bFemmeStat from "@/data/bareme_femme_stationnaire_2025.json";
import bHommeStat from "@/data/bareme_homme_stationnaire_2025.json";
import bIndetStat from "@/data/bareme_indetermine_stationnaire_2025.json";
import bFemmeProsp from "@/data/bareme_femme_prospectif_2025.json";
import bHommeProsp from "@/data/bareme_homme_prospectif_2025.json";
import bIndetProsp from "@/data/bareme_indetermine_prospectif_2025.json";
import type { BaremeType, MethodeRente, Sexe } from "./types";

interface BaremeJSON {
  colonne_viagere: number;
  ages_fin_de_rente: number[];
  lignes: Array<{ age_liquidation: number; prix: Array<number | null> }>;
}

const BAREMES: Record<BaremeType, Record<Sexe, BaremeJSON>> = {
  stationnaire: {
    F: bFemmeStat as BaremeJSON,
    M: bHommeStat as BaremeJSON,
    I: bIndetStat as BaremeJSON,
  },
  prospectif: {
    F: bFemmeProsp as BaremeJSON,
    M: bHommeProsp as BaremeJSON,
    I: bIndetProsp as BaremeJSON,
  },
};

function getBareme(bareme: BaremeType, sexe: Sexe): BaremeJSON {
  return BAREMES[bareme][sexe];
}

/** PER viager à l'âge donné. Retourne 0 si l'âge est hors table. */
export function perViager(
  ageLiquidation: number,
  bareme: BaremeType,
  sexe: Sexe,
): number {
  const b = getBareme(bareme, sexe);
  const ligne = b.lignes.find((l) => l.age_liquidation === Math.trunc(ageLiquidation));
  if (!ligne) return 0;
  const idx = b.ages_fin_de_rente.indexOf(b.colonne_viagere);
  if (idx < 0) return 0;
  const v = ligne.prix[idx];
  return typeof v === "number" ? v : 0;
}

/**
 * PER temporaire de l'âge liquidation jusqu'à l'âge de fin de rente (inclus).
 * En prospectif, si `ageFin > 90`, on retourne le PER viager (voir 5.7).
 */
export function perTemporaire(
  ageLiquidation: number,
  ageFin: number,
  bareme: BaremeType,
  sexe: Sexe,
): number {
  const b = getBareme(bareme, sexe);
  if (bareme === "prospectif" && ageFin > 90) {
    return perViager(ageLiquidation, bareme, sexe);
  }
  const ligne = b.lignes.find((l) => l.age_liquidation === Math.trunc(ageLiquidation));
  if (!ligne) return 0;
  const idx = b.ages_fin_de_rente.indexOf(Math.trunc(ageFin));
  if (idx < 0) return 0;
  const v = ligne.prix[idx];
  return typeof v === "number" ? v : 0;
}

/**
 * PER d'une rente différée (début à un âge > âge de liquidation).
 * @param ageLiquidation âge à la liquidation
 * @param ageDebut âge au début de la rente
 */
export function perRenteDifferee(
  ageLiquidation: number,
  ageDebut: number,
  bareme: BaremeType,
  sexe: Sexe,
  methode: MethodeRente,
): number {
  if (methode === "habituelle") {
    return perViager(ageDebut, bareme, sexe);
  }
  // méthode exacte
  const viager = perViager(ageLiquidation, bareme, sexe);
  const temp = perTemporaire(ageLiquidation, ageDebut, bareme, sexe);
  return viager - temp;
}
