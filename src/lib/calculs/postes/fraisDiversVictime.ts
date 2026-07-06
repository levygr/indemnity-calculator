/**
 * Frais divers de la victime directe (FD) — préjudice patrimonial temporaire.
 *
 * Honoraires du médecin-conseil, frais de déplacement aux expertises,
 * garde d'enfants, frais administratifs et tous frais restés à charge en
 * lien avec le dommage avant consolidation.
 *
 * Calcul identique aux DSA ponctuelles : dépense et créance TP revalorisées
 * au même mode, reste = différence. Lignes incomplètes ignorées.
 */

import type { FraisDiversVictime } from "../types";
import { revaloriserReste } from "../revalorisation";

export interface LigneFDVictime {
  id: string;
  libelle: string;
  depense: number;
  depenseRevalorisee: number;
  tiersPayeur: number;
  tpRevalorise: number;
  resteRevalorise: number;
}

export interface TotauxFDVictime {
  lignes: LigneFDVictime[];
  totalDepense: number;
  totalDepenseRevalorisee: number;
  totalTP: number;
  totalTpRevalorise: number;
  totalResteRevalorise: number;
}

export function calculerFraisDiversVictime(
  lignes: FraisDiversVictime[],
  dateLiquidation: string | null,
): TotauxFDVictime {
  const out: LigneFDVictime[] = [];
  let tD = 0, tDR = 0, tTP = 0, tTPR = 0, tR = 0;
  for (const l of lignes) {
    if (!l.date || !isFinite(l.montant) || l.montant <= 0) continue;
    const depense = l.montant;
    const tp = Math.max(0, l.tiersPayeur || 0);
    const depenseRevalorisee = revaloriserReste(depense, l.date, dateLiquidation, l.modeRevalo);
    const tpRevalorise = revaloriserReste(tp, l.date, dateLiquidation, l.modeRevalo);
    const resteRevalorise = Math.max(0, depenseRevalorisee - tpRevalorise);
    out.push({
      id: l.id,
      libelle: l.libelle,
      depense,
      depenseRevalorisee,
      tiersPayeur: tp,
      tpRevalorise,
      resteRevalorise,
    });
    tD += depense; tDR += depenseRevalorisee;
    tTP += tp; tTPR += tpRevalorise; tR += resteRevalorise;
  }
  return {
    lignes: out,
    totalDepense: tD,
    totalDepenseRevalorisee: tDR,
    totalTP: tTP,
    totalTpRevalorise: tTPR,
    totalResteRevalorise: tR,
  };
}
