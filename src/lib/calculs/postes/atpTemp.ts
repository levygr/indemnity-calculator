/**
 * Assistance tierce personne temporaire.
 * Formule V&P (correction incohérence Excel) : sur chaque période,
 *   montant = tauxHoraire × heuresParJour × jours × (facteurJours / 365)
 * Le facteur usuel est 412/365 ≈ 1,129 (congés, jours fériés) mais reste paramétrable.
 */

import type { ATPTempPeriode } from "../types";
import { joursEntre } from "../dates";

export interface LigneATP {
  id: string;
  jours: number;
  montant: number;
}

export function calculerATPTemp(periodes: ATPTempPeriode[]): {
  lignes: LigneATP[];
  total: number;
} {
  const lignes: LigneATP[] = [];
  let total = 0;
  for (const p of periodes) {
    const j = joursEntre(p.debut, p.fin);
    if (j == null || j < 0) continue;
    if (!isFinite(p.heuresParJour) || !isFinite(p.tauxHoraire)) continue;
    if (p.heuresParJour <= 0 || p.tauxHoraire <= 0) continue;
    const jours = j + 1;
    const facteur = p.facteurJours > 0 ? p.facteurJours : 365;
    const montant = p.tauxHoraire * p.heuresParJour * jours * (facteur / 365);
    lignes.push({ id: p.id, jours, montant });
    total += montant;
  }
  return { lignes, total };
}
