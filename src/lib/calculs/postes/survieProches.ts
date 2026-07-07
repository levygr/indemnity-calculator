/**
 * Postes des victimes indirectes — survie de la victime directe (Phase 4).
 *
 * Un proche peut subir :
 *  - Une perte de revenus (ex. conjoint qui a réduit son activité) : rente annuelle
 *    capitalisée en viager sur son propre âge.
 *  - Frais divers exposés en raison du handicap du proche direct.
 *  - Préjudice d'affection.
 *  - Préjudice extrapatrimonial exceptionnel (PEP).
 *
 * Chaque ligne incomplète est ignorée ; aucun arrondi intermédiaire.
 */

import type { BaremeType, Sexe } from "../types";
import { perViager } from "../capitalisation";
import { anneesRevolues } from "../dates";
import type { FraisDivers } from "./deces";


export interface ProcheSurvie {
  id: string;
  prenom: string;
  lien: string;
  /** Code de lien dans le référentiel Mornet (aide à la saisie, n'entre dans aucun calcul). */
  lienReferentiel?: string;
  dateNaissance: string | null;
  sexe: Sexe;
  perteRevenusAnnuelle: number;
  perteRevenusTP: number;
  affection: number;
  pep: number;
}

export interface PostesSurvie {
  proches: ProcheSurvie[];
  fraisDivers: FraisDivers[];
}

export function defaultPostesSurvie(): PostesSurvie {
  return { proches: [], fraisDivers: [] };
}

export interface ContexteSurvie {
  dateLiquidation: string | null;
  bareme: BaremeType;
}

export interface LigneSurviePerte {
  procheId: string;
  prenom: string;
  age: number | null;
  renteAnnuelle: number;
  per: number;
  capital: number;
  capitalTP: number;
  reste: number;
}

export function calculerPerteRevenusSurvie(
  proches: ProcheSurvie[],
  ctx: ContexteSurvie,
): { lignes: LigneSurviePerte[]; totalCapital: number; totalTP: number; totalReste: number } {
  const lignes: LigneSurviePerte[] = [];
  let tC = 0, tT = 0, tR = 0;
  for (const p of proches) {
    if (!isFinite(p.perteRevenusAnnuelle) || p.perteRevenusAnnuelle <= 0) continue;
    const age = anneesRevolues(p.dateNaissance, ctx.dateLiquidation);
    if (age == null) continue;
    const per = perViager(age, ctx.bareme, p.sexe);
    if (per <= 0) continue;
    const capital = p.perteRevenusAnnuelle * per;
    const capitalTP = Math.max(0, (p.perteRevenusTP || 0) * per);
    const reste = Math.max(0, capital - capitalTP);
    lignes.push({
      procheId: p.id,
      prenom: p.prenom,
      age,
      renteAnnuelle: p.perteRevenusAnnuelle,
      per,
      capital,
      capitalTP,
      reste,
    });
    tC += capital; tT += capitalTP; tR += reste;
  }
  return { lignes, totalCapital: tC, totalTP: tT, totalReste: tR };
}

export function totalAffectionSurvie(proches: ProcheSurvie[]): number {
  let t = 0;
  for (const p of proches) if (isFinite(p.affection) && p.affection > 0) t += p.affection;
  return t;
}

export function totalPEPSurvie(proches: ProcheSurvie[]): number {
  let t = 0;
  for (const p of proches) if (isFinite(p.pep) && p.pep > 0) t += p.pep;
  return t;
}
