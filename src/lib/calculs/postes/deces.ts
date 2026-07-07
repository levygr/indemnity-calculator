/**
 * Postes des victimes indirectes — décès (Phase 4, calcul séquencé).
 *
 * Perte de revenus du foyer :
 *  - Perte annuelle du foyer = max(0,
 *      (revenu défunt + revenu conjoint) × (1 − part consommée) − revenu conjoint)
 *  - Calcul par périodes : bornes définies par les âges de fin d'études des
 *    enfants éligibles ; répartition proportionnelle aux parts pour chaque
 *    période ; capitalisation par proche selon sa présence.
 *      · période bornée démarrant à la liquidation → PER temporaire
 *      · période intermédiaire → PER temp(→fin) − PER temp(→début)
 *      · période viagère finale (conjoint seul) → PER rente différée
 *        (méthode de rente du dossier)
 *  - Pension de réversion du conjoint imputée période par période.
 */

import type { BaremeType, MethodeRente, Sexe } from "../types";
import { perRenteDifferee, perTemporaire, perViager } from "../capitalisation";
import { anneesRevolues } from "../dates";

// ============================================================
// Types
// ============================================================

export type LienProche = "conjoint" | "enfant" | "parent" | "fratrie" | "autre";

export interface Proche {
  id: string;
  lien: LienProche;
  /** Code de lien dans le référentiel Mornet (aide à la saisie, n'entre dans aucun calcul). */
  lienReferentiel?: string;
  prenom: string;
  dateNaissance: string | null;
  sexe: Sexe;
  partFoyer: number;
  ageFinEtudes: number;
  affection: number;
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
  /** Revenu annuel net du conjoint survivant (maintenu après le décès). */
  revenuAnnuelConjoint: number;
  /** Part consommée par le défunt (0..1). */
  partConsommeeDefunt: number;

  proches: Proche[];
  fraisDivers: FraisDivers[];

  accompagnementFinDeVie: number;
  accompagnementTP: number;
}

export function defaultPostesDeces(): PostesDeces {
  return {
    obsequesMontant: 0,
    obsequesTP: 0,
    revenuAnnuelDefunt: 0,
    revenuAnnuelConjoint: 0,
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
  methodeRente: MethodeRente;
}

// ============================================================
// Types du résultat
// ============================================================

export interface MembreDansPeriode {
  procheId: string;
  prenom: string;
  lien: LienProche;
  part: number; // fraction de la perteAnnuelleFoyer sur la période
  renteAnnuelle: number;
  per: number;
  capital: number;
  ageDebut: number;
  ageFin: number | null;
}

export interface PeriodeFoyer {
  index: number;
  /** Années écoulées depuis la liquidation. */
  debut: number;
  /** null = viager. */
  fin: number | null;
  ageConjointDebut: number | null;
  ageConjointFin: number | null;
  membres: MembreDansPeriode[];
  totalCapital: number;
}

export interface LigneProchePerte {
  procheId: string;
  prenom: string;
  lien: LienProche;
  age: number | null;
  part: number; // part relative (référence : première période)
  renteAnnuelle: number; // rente sur la première période
  per: number; // PER cumulé (somme sur les périodes de présence)
  capital: number;
  capitalTP: number;
  reste: number;
}

// ============================================================
// Perte de revenus du foyer — calcul séquencé
// ============================================================

export function calculerPerteRevenusFoyer(
  d: PostesDeces,
  ctx: ContexteDeces,
): {
  revenuFoyer: number;
  perteAnnuelleFoyer: number;
  periodes: PeriodeFoyer[];
  lignes: LigneProchePerte[];
  totalPartsUtiles: number;
  totalCapital: number;
  totalTP: number;
  totalReste: number;
} {
  const revenuD = Math.max(0, d.revenuAnnuelDefunt || 0);
  const revenuC = Math.max(0, d.revenuAnnuelConjoint || 0);
  const partCons = Math.min(Math.max(0, d.partConsommeeDefunt || 0), 1);
  const perteAnnuelleFoyer = Math.max(
    0,
    (revenuD + revenuC) * (1 - partCons) - revenuC,
  );

  const eligibles = d.proches.filter(
    (p) => (p.lien === "conjoint" || p.lien === "enfant") && p.partFoyer > 0,
  );
  const totalParts = eligibles.reduce((a, p) => a + (p.partFoyer || 0), 0);

  const empty = {
    revenuFoyer: perteAnnuelleFoyer,
    perteAnnuelleFoyer,
    periodes: [] as PeriodeFoyer[],
    lignes: [] as LigneProchePerte[],
    totalPartsUtiles: totalParts,
    totalCapital: 0,
    totalTP: 0,
    totalReste: 0,
  };
  if (perteAnnuelleFoyer <= 0 || totalParts <= 0) return empty;

  // Calcul des âges à la liquidation
  const membres = eligibles
    .map((p) => ({
      p,
      age: anneesRevolues(p.dateNaissance, ctx.dateLiquidation),
    }))
    .filter((m): m is { p: Proche; age: number } => m.age != null);
  if (membres.length === 0) return empty;

  const conjoints = membres.filter((m) => m.p.lien === "conjoint");
  const enfants = membres.filter((m) => m.p.lien === "enfant");

  // Deltas de sortie des enfants (en années depuis la liquidation)
  const enfantExit = new Map<string, number>();
  for (const e of enfants) {
    const ageFinE = e.p.ageFinEtudes > 0 ? e.p.ageFinEtudes : 25;
    const delta = ageFinE - e.age;
    if (delta > 0) enfantExit.set(e.p.id, delta);
  }
  const uniqueDeltas = Array.from(new Set(enfantExit.values())).sort(
    (a, b) => a - b,
  );

  // Construction des périodes
  const periodes: PeriodeFoyer[] = [];
  let debut = 0;
  for (const delta of uniqueDeltas) {
    periodes.push({
      index: periodes.length + 1,
      debut,
      fin: delta,
      ageConjointDebut: null,
      ageConjointFin: null,
      membres: [],
      totalCapital: 0,
    });
    debut = delta;
  }
  if (conjoints.length > 0) {
    periodes.push({
      index: periodes.length + 1,
      debut,
      fin: null,
      ageConjointDebut: null,
      ageConjointFin: null,
      membres: [],
      totalCapital: 0,
    });
  }
  if (periodes.length === 0) return empty;

  // PER sur une période pour un proche donné
  function perPeriode(ageAtLiq: number, sexe: Sexe, debutP: number, finP: number | null): number {
    if (finP == null) {
      if (debutP <= 0) return perViager(ageAtLiq, ctx.bareme, sexe);
      return perRenteDifferee(
        ageAtLiq,
        ageAtLiq + debutP,
        ctx.bareme,
        sexe,
        ctx.methodeRente,
      );
    }
    if (debutP <= 0) {
      return perTemporaire(ageAtLiq, ageAtLiq + finP, ctx.bareme, sexe);
    }
    return (
      perTemporaire(ageAtLiq, ageAtLiq + finP, ctx.bareme, sexe) -
      perTemporaire(ageAtLiq, ageAtLiq + debutP, ctx.bareme, sexe)
    );
  }

  // Agrégats par proche
  const parProche = new Map<string, LigneProchePerte>();
  for (const m of membres) {
    parProche.set(m.p.id, {
      procheId: m.p.id,
      prenom: m.p.prenom,
      lien: m.p.lien,
      age: m.age,
      part: 0,
      renteAnnuelle: 0,
      per: 0,
      capital: 0,
      capitalTP: 0,
      reste: 0,
    });
  }

  const conjoint0 = conjoints[0] ?? null;
  let totalCap = 0;
  let totalTP = 0;

  for (const per of periodes) {
    // Membres présents sur la période
    const presents: { m: { p: Proche; age: number } }[] = [];
    for (const c of conjoints) {
      if (per.fin == null || per.fin > 0) presents.push({ m: c });
    }
    for (const e of enfants) {
      const exit = enfantExit.get(e.p.id);
      if (exit == null) continue;
      if (per.fin == null) continue; // les enfants ne survivent pas au viager conjoint
      if (exit >= per.fin) presents.push({ m: e });
    }
    const totalPartsPer = presents.reduce((a, x) => a + (x.m.p.partFoyer || 0), 0);
    if (totalPartsPer <= 0) continue;

    if (conjoint0) {
      per.ageConjointDebut = conjoint0.age + per.debut;
      per.ageConjointFin = per.fin == null ? null : conjoint0.age + per.fin;
    }

    for (const { m } of presents) {
      const fraction = (m.p.partFoyer || 0) / totalPartsPer;
      const rente = perteAnnuelleFoyer * fraction;
      const perVal = perPeriode(m.age, m.p.sexe, per.debut, per.fin);
      const capital = rente * perVal;
      per.membres.push({
        procheId: m.p.id,
        prenom: m.p.prenom,
        lien: m.p.lien,
        part: fraction,
        renteAnnuelle: rente,
        per: perVal,
        capital,
        ageDebut: m.age + per.debut,
        ageFin: per.fin == null ? null : m.age + per.fin,
      });
      per.totalCapital += capital;

      const agg = parProche.get(m.p.id)!;
      agg.capital += capital;
      agg.per += perVal;
      if (per.index === 1) {
        agg.renteAnnuelle = rente;
        agg.part = fraction;
      }

      // Créance TP réversion : uniquement conjoint
      if (m.p.lien === "conjoint") {
        const pension = Math.max(0, m.p.pensionReversionAnnuelle || 0);
        if (pension > 0) {
          const capTP = pension * perVal;
          agg.capitalTP += capTP;
          totalTP += capTP;
        }
      }
    }
    totalCap += per.totalCapital;
  }

  const lignes = Array.from(parProche.values()).filter((l) => l.capital > 0);
  for (const l of lignes) {
    l.reste = Math.max(0, l.capital - l.capitalTP);
  }
  const totalReste = Math.max(0, totalCap - totalTP);

  return {
    revenuFoyer: perteAnnuelleFoyer,
    perteAnnuelleFoyer,
    periodes,
    lignes,
    totalPartsUtiles: totalParts,
    totalCapital: totalCap,
    totalTP,
    totalReste,
  };
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
