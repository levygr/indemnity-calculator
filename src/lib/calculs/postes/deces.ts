/**
 * Postes des victimes indirectes — décès (Phase 4).
 *
 * Reproduit la nomenclature Dintilhac appliquée par le cabinet V&P :
 *  - Frais d'obsèques (ponctuel)
 *  - Perte de revenus du foyer : revenu du foyer = revenu défunt × (1 − part consommée)
 *    puis répartition en parts (conjoint + enfants), capitalisation par tête.
 *  - Frais divers (liste)
 *  - Accompagnement de fin de vie (forfait)
 *  - Préjudice d'affection (par proche, forfait)
 *
 * Chaque proche a son propre âge et sexe ; on utilise son PER individuel.
 * Enfants : capitalisation temporaire jusqu'à l'âge de fin des études (par défaut 25).
 * Conjoint : capitalisation viagère.
 * Aucun arrondi intermédiaire ; les lignes incomplètes sont ignorées.
 */

import type { BaremeType, Sexe } from "../types";
import { perTemporaire, perViager } from "../capitalisation";
import { anneesRevolues } from "../dates";

// ============================================================
// Types
// ============================================================

export type LienProche = "conjoint" | "enfant" | "parent" | "fratrie" | "autre";

export interface Proche {
  id: string;
  lien: LienProche;
  prenom: string;
  dateNaissance: string | null;
  sexe: Sexe;
  /** Part attribuée dans la répartition des revenus du foyer (0..1). Uniquement conjoint & enfants. */
  partFoyer: number;
  /** Âge de fin d'études (utilisé pour capitalisation temporaire des enfants). */
  ageFinEtudes: number; // 25 par défaut
  affection: number; // montant forfaitaire
  /**
   * Créance annuelle du tiers payeur versée à ce proche
   * (pension de réversion, rente d'ayant droit AT/MP…). 0 par défaut.
   * Imputée sur la perte de revenus du foyer (art. L. 376-1 CSS).
   */
  pensionReversionAnnuelle: number;
}

export interface FraisDivers {
  id: string;
  libelle: string;
  montant: number;
  tiersPayeur: number;
}

export interface PostesDeces {
  obsequesMontant: number;
  obsequesTP: number;

  revenuAnnuelDefunt: number;
  /** Part consommée par le défunt (0..1). Ex : 0,3 pour couple avec 2 enfants. */
  partConsommeeDefunt: number;

  proches: Proche[];
  fraisDivers: FraisDivers[];

  accompagnementFinDeVie: number; // forfait
  accompagnementTP: number;
}

export function defaultPostesDeces(): PostesDeces {
  return {
    obsequesMontant: 0,
    obsequesTP: 0,
    revenuAnnuelDefunt: 0,
    partConsommeeDefunt: 0.3,
    proches: [],
    fraisDivers: [],
    accompagnementFinDeVie: 0,
    accompagnementTP: 0,
  };
}

// ============================================================
// Contexte
// ============================================================

export interface ContexteDeces {
  dateLiquidation: string | null;
  bareme: BaremeType;
}

// ============================================================
// Calculs
// ============================================================

export interface LigneProchePerte {
  procheId: string;
  prenom: string;
  lien: LienProche;
  age: number | null;
  part: number;
  renteAnnuelle: number;
  per: number;
  capital: number;
  capitalTP: number;
  reste: number;
}

export function calculerPerteRevenusFoyer(
  d: PostesDeces,
  ctx: ContexteDeces,
): {
  revenuFoyer: number;
  lignes: LigneProchePerte[];
  totalPartsUtiles: number;
  totalCapital: number;
  totalTP: number;
  totalReste: number;
} {
  const revenu = Math.max(0, d.revenuAnnuelDefunt || 0);
  const partCons = Math.min(Math.max(0, d.partConsommeeDefunt || 0), 1);
  const revenuFoyer = revenu * (1 - partCons);

  const eligibles = d.proches.filter(
    (p) => (p.lien === "conjoint" || p.lien === "enfant") && p.partFoyer > 0,
  );
  const totalParts = eligibles.reduce((a, p) => a + (p.partFoyer || 0), 0);

  const lignes: LigneProchePerte[] = [];
  let totalCap = 0;
  let totalTP = 0;
  let totalReste = 0;
  if (revenuFoyer <= 0 || totalParts <= 0) {
    return { revenuFoyer, lignes, totalPartsUtiles: totalParts, totalCapital: 0, totalTP: 0, totalReste: 0 };
  }
  for (const p of eligibles) {
    const age = anneesRevolues(p.dateNaissance, ctx.dateLiquidation);
    if (age == null) continue;
    const rente = revenuFoyer * (p.partFoyer / totalParts);
    let per = 0;
    if (p.lien === "conjoint") {
      per = perViager(age, ctx.bareme, p.sexe);
    } else {
      const ageFin = p.ageFinEtudes > 0 ? p.ageFinEtudes : 25;
      if (ageFin > age) per = perTemporaire(age, ageFin, ctx.bareme, p.sexe);
    }
    const capital = rente * per;
    const pension = Math.max(0, p.pensionReversionAnnuelle || 0);
    const capitalTP = pension * per;
    const reste = Math.max(0, capital - capitalTP);
    lignes.push({
      procheId: p.id,
      prenom: p.prenom,
      lien: p.lien,
      age,
      part: p.partFoyer / totalParts,
      renteAnnuelle: rente,
      per,
      capital,
      capitalTP,
      reste,
    });
    totalCap += capital;
    totalTP += capitalTP;
    totalReste += reste;
  }
  return { revenuFoyer, lignes, totalPartsUtiles: totalParts, totalCapital: totalCap, totalTP, totalReste };
}

export function calculerFraisDivers(lignes: FraisDivers[]): {
  totalMontant: number;
  totalTP: number;
  totalReste: number;
} {
  let m = 0, t = 0;
  for (const l of lignes) {
    if (!isFinite(l.montant) || l.montant <= 0) continue;
    const tp = Math.max(0, l.tiersPayeur || 0);
    m += l.montant;
    t += tp;
  }
  return { totalMontant: m, totalTP: t, totalReste: Math.max(0, m - t) };
}

export function totalAffection(proches: Proche[]): number {
  let t = 0;
  for (const p of proches) {
    if (isFinite(p.affection) && p.affection > 0) t += p.affection;
  }
  return t;
}
