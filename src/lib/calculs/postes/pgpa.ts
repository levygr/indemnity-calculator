/**
 * Pertes de gains professionnels actuels (PGPA) — 3 méthodes.
 *   1) référence  : revenu annuel net actualisé × durée d'arrêt (années)
 *   2) périodes   : somme des pertes déclarées par période
 *   3) forfait    : montant unique saisi
 * Les indemnités journalières perçues sont une créance TP (répartition ailleurs).
 */

import type { PGPAData } from "../types";
import { joursEntre, anneeDe } from "../dates";
import { actualiserRevenu } from "../revalorisation";

export interface PGPAResultat {
  perte: number; // perte brute totale
  tiersPayeur: number; // IJ
  resteACharge: number; // perte − IJ (≥ 0)
  detail: string;
}

export function calculerPGPA(data: PGPAData, dateLiquidation: string | null): PGPAResultat {
  let perte = 0;
  let detail = "";
  const anneeLiq = anneeDe(dateLiquidation);

  if (data.methode === "reference") {
    const j = joursEntre(data.debut, data.fin);
    if (j != null && j >= 0 && isFinite(data.revenuReference) && data.revenuReference > 0) {
      const revActu = actualiserRevenu(
        data.revenuReference,
        data.anneeReference,
        anneeLiq,
        data.indice,
      );
      const annees = (j + 1) / 365.25;
      perte = revActu * annees;
      detail = `Revenu de référence ${data.revenuReference} → actualisé ${revActu.toFixed(2)} × ${annees.toFixed(4)} an(s)`;
    }
  } else if (data.methode === "periodes") {
    for (const p of data.periodes) {
      if (!isFinite(p.perte) || p.perte <= 0) continue;
      const j = joursEntre(p.debut, p.fin);
      if (j == null || j < 0) continue;
      perte += p.perte;
    }
    detail = `${data.periodes.length} période(s)`;
  } else {
    // forfait
    if (isFinite(data.forfait) && data.forfait > 0) perte = data.forfait;
    detail = "Forfait saisi";
  }

  const tp = Math.max(0, data.ij || 0);
  const reste = Math.max(0, perte - tp);
  return { perte, tiersPayeur: tp, resteACharge: reste, detail };
}
