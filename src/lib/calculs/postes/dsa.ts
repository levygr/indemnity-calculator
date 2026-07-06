/**
 * Dépenses de santé actuelles (DSA) — ponctuelles et récurrentes.
 *
 * Assiette homogène : la dépense totale ET la créance du tiers payeur sont
 * revalorisées à la date de liquidation avec le MÊME mode de revalorisation,
 * puis le reste à charge revalorisé est la différence.
 * Les lignes incomplètes (montant nul ou date manquante) sont ignorées.
 */

import type { DSAPonctuelle, DSARecurrente } from "../types";
import { revaloriserReste } from "../revalorisation";
import { joursEntre } from "../dates";
import { annualiser, type Periodicite } from "../annualisation";

export interface LigneCalculee {
  id: string;
  libelle: string;
  depense: number;
  depenseRevalorisee: number;
  tiersPayeur: number;
  tpRevalorise: number;
  resteRevalorise: number;
}

export interface TotauxDSA {
  lignes: LigneCalculee[];
  totalDepense: number;
  totalDepenseRevalorisee: number;
  totalTP: number;
  totalTpRevalorise: number;
  totalResteRevalorise: number;
}

export function calculerDSAPonctuelles(
  lignes: DSAPonctuelle[],
  dateLiquidation: string | null,
): TotauxDSA {
  const out: LigneCalculee[] = [];
  let tD = 0, tDR = 0, tTP = 0, tTPR = 0, tR = 0;
  for (const l of lignes) {
    if (!l.date || !isFinite(l.depense) || l.depense <= 0) continue;
    const depense = l.depense;
    const tp = Math.max(0, l.tiersPayeur || 0);
    const depenseRevalorisee = revaloriserReste(depense, l.date, dateLiquidation, l.modeRevalo);
    const tpRevalorise = revaloriserReste(tp, l.date, dateLiquidation, l.modeRevalo);
    const resteRevalorise = Math.max(0, depenseRevalorisee - tpRevalorise);
    out.push({
      id: l.id, libelle: l.libelle,
      depense, depenseRevalorisee, tiersPayeur: tp, tpRevalorise, resteRevalorise,
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

/**
 * Approxime la durée d'une DSA récurrente. On convertit la période en jours,
 * on annualise le montant puis on multiplie par la fraction d'année.
 */
function dureeAnnees(debut: string | null, fin: string | null): number | null {
  const j = joursEntre(debut, fin);
  if (j == null || j < 0) return null;
  return (j + 1) / 365.25;
}

export function calculerDSARecurrentes(
  lignes: DSARecurrente[],
  dateLiquidation: string | null,
): TotauxDSA {
  const out: LigneCalculee[] = [];
  let tD = 0, tDR = 0, tTP = 0, tTPR = 0, tR = 0;
  for (const l of lignes) {
    const annees = dureeAnnees(l.debut, l.fin);
    if (annees == null || !isFinite(l.montant) || l.montant <= 0) continue;
    const annuel = annualiser(l.montant, l.periodicite as Periodicite);
    const depense = annuel * annees;
    const tp = Math.max(0, l.tiersPayeur || 0);
    // Revalorisation depuis le milieu de la période (approximation usuelle)
    const milieu = milieuPeriode(l.debut!, l.fin!);
    const depenseRevalorisee = revaloriserReste(depense, milieu, dateLiquidation, l.modeRevalo);
    const tpRevalorise = revaloriserReste(tp, milieu, dateLiquidation, l.modeRevalo);
    const resteRevalorise = Math.max(0, depenseRevalorisee - tpRevalorise);
    out.push({
      id: l.id, libelle: l.libelle,
      depense, depenseRevalorisee, tiersPayeur: tp, tpRevalorise, resteRevalorise,
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

function milieuPeriode(debutISO: string, finISO: string): string {
  const a = Date.parse(debutISO);
  const b = Date.parse(finISO);
  if (isNaN(a) || isNaN(b)) return debutISO;
  const m = new Date((a + b) / 2);
  return m.toISOString().slice(0, 10);
}
