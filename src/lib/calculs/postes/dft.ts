/**
 * Déficit fonctionnel temporaire (DFT).
 * Montant = tauxJournalier × Σ (jours de la période × taux)
 * où taux ∈ [0,1] (1 = DFT total à 100 %).
 */

import type { PeriodeDFT } from "../types";
import { joursEntre } from "../dates";

export interface DFTResultat {
  joursTotaux: number;
  joursPonderes: number;
  montant: number;
  lignes: Array<{ id: string; jours: number; taux: number; montant: number }>;
}

export function calculerDFT(
  periodes: PeriodeDFT[],
  tauxJournalier: number,
): DFTResultat {
  let jT = 0;
  let jP = 0;
  const lignes: DFTResultat["lignes"] = [];
  const taux = isFinite(tauxJournalier) && tauxJournalier > 0 ? tauxJournalier : 0;
  for (const p of periodes) {
    const j = joursEntre(p.debut, p.fin);
    if (j == null || j < 0) continue;
    const jours = j + 1;
    const t = Math.min(1, Math.max(0, p.taux));
    const montant = jours * t * taux;
    lignes.push({ id: p.id, jours, taux: t, montant });
    jT += jours;
    jP += jours * t;
  }
  return { joursTotaux: jT, joursPonderes: jP, montant: jP * taux, lignes };
}
