/**
 * Dépenses de santé actuelles (DSA) — ponctuelles et récurrentes.
 * Chaque dépense est revalorisée à la date de liquidation puis nette du TP.
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
  tiersPayeur: number;
  resteACharge: number;
  revalorise: number; // reste revalorisé à la liquidation
}

export function calculerDSAPonctuelles(
  lignes: DSAPonctuelle[],
  dateLiquidation: string | null,
): { lignes: LigneCalculee[]; totalDepense: number; totalTP: number; totalRevalo: number } {
  const out: LigneCalculee[] = [];
  let tD = 0, tT = 0, tR = 0;
  for (const l of lignes) {
    if (!l.date || !isFinite(l.depense) || l.depense <= 0) continue;
    const depense = l.depense;
    const tp = Math.max(0, l.tiersPayeur || 0);
    const reste = Math.max(0, depense - tp);
    const rev = revaloriserReste(reste, l.date, dateLiquidation, l.modeRevalo);
    out.push({ id: l.id, libelle: l.libelle, depense, tiersPayeur: tp, resteACharge: reste, revalorise: rev });
    tD += depense; tT += tp; tR += rev;
  }
  return { lignes: out, totalDepense: tD, totalTP: tT, totalRevalo: tR };
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
): { lignes: LigneCalculee[]; totalDepense: number; totalTP: number; totalRevalo: number } {
  const out: LigneCalculee[] = [];
  let tD = 0, tT = 0, tR = 0;
  for (const l of lignes) {
    const annees = dureeAnnees(l.debut, l.fin);
    if (annees == null || !isFinite(l.montant) || l.montant <= 0) continue;
    const annuel = annualiser(l.montant, l.periodicite as Periodicite);
    const depense = annuel * annees;
    const tp = Math.max(0, l.tiersPayeur || 0);
    const reste = Math.max(0, depense - tp);
    // Revalorisation prise du milieu de la période (approximation usuelle)
    const milieu = milieuPeriode(l.debut!, l.fin!);
    const rev = revaloriserReste(reste, milieu, dateLiquidation, l.modeRevalo);
    out.push({ id: l.id, libelle: l.libelle, depense, tiersPayeur: tp, resteACharge: reste, revalorise: rev });
    tD += depense; tT += tp; tR += rev;
  }
  return { lignes: out, totalDepense: tD, totalTP: tT, totalRevalo: tR };
}

function milieuPeriode(debutISO: string, finISO: string): string {
  const a = Date.parse(debutISO);
  const b = Date.parse(finISO);
  if (isNaN(a) || isNaN(b)) return debutISO;
  const m = new Date((a + b) / 2);
  return m.toISOString().slice(0, 10);
}
