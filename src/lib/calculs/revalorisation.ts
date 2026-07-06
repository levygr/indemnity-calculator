/**
 * Revalorisation d'une dépense selon l'IPC (5.5) et actualisation d'un revenu (5.6).
 * Aucune valeur d'indice inventée : uniquement les JSON fournis.
 */

import indices from "@/data/indices_actualisation.json";
import { anneeDe, moisDe, parseISO } from "./dates";

interface IndiceAnnuel { annee: number; ipc: number; smic_horaire_brut: number }
interface IndiceMensuel { annee: number; mois: string; ipc_mensuel: number }

const ANNUELS: IndiceAnnuel[] = (indices as { indices_annuels: IndiceAnnuel[] }).indices_annuels;
const MENSUELS: IndiceMensuel[] = (indices as { indices_mensuels: IndiceMensuel[] }).indices_mensuels;

const MOIS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export function ipcAnnuel(annee: number | null | undefined): number | null {
  if (annee == null) return null;
  return ANNUELS.find((x) => x.annee === annee)?.ipc ?? null;
}

export function smicAnnuel(annee: number | null | undefined): number | null {
  if (annee == null) return null;
  return ANNUELS.find((x) => x.annee === annee)?.smic_horaire_brut ?? null;
}

export function ipcMensuel(annee: number | null, mois1a12: number | null): number | null {
  if (annee == null || mois1a12 == null) return null;
  const label = MOIS_FR[mois1a12 - 1];
  if (!label) return null;
  return MENSUELS.find((x) => x.annee === annee && x.mois === label)?.ipc_mensuel ?? null;
}

export type ModeRevalo = "non" | "annuel" | "mensuel";

/**
 * Revalorise un reste à charge de la date de dépense jusqu'à la date de liquidation.
 * "non" → retourne le reste tel quel.
 */
export function revaloriserReste(
  resteACharge: number,
  dateDepense: string | null,
  dateLiquidation: string | null,
  mode: ModeRevalo,
): number {
  if (!isFinite(resteACharge)) return 0;
  if (mode === "non") return resteACharge;
  const d = parseISO(dateDepense);
  const l = parseISO(dateLiquidation);
  if (!d || !l) return resteACharge;
  if (mode === "annuel") {
    const iDep = ipcAnnuel(anneeDe(dateDepense));
    const iLiq = ipcAnnuel(anneeDe(dateLiquidation));
    if (!iDep || !iLiq) return resteACharge;
    return resteACharge * (iLiq / iDep);
  }
  // mensuel
  const iDep = ipcMensuel(anneeDe(dateDepense), moisDe(dateDepense));
  const iLiq = ipcMensuel(anneeDe(dateLiquidation), moisDe(dateLiquidation));
  if (!iDep || !iLiq) return resteACharge;
  return resteACharge * (iLiq / iDep);
}

export type IndiceActualisation = "ipc" | "smic";

/**
 * Actualise un revenu d'une année vers l'année de liquidation.
 */
export function actualiserRevenu(
  revenu: number,
  anneeRevenu: number | null,
  anneeLiquidation: number | null,
  indice: IndiceActualisation,
): number {
  if (!isFinite(revenu) || anneeRevenu == null || anneeLiquidation == null) return revenu;
  const fn = indice === "smic" ? smicAnnuel : ipcAnnuel;
  const iR = fn(anneeRevenu);
  const iL = fn(anneeLiquidation);
  if (!iR || !iL) return revenu;
  return revenu * (iL / iR);
}
