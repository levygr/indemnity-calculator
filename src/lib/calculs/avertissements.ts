/**
 * Avertissements de calcul : contrôles de cohérence non bloquants sur un dossier.
 *
 * Ces règles sont purement informatives ; elles ne modifient jamais les résultats
 * des postes. Elles servent à alerter l'utilisateur lorsqu'une saisie produit un
 * capital à zéro alors qu'une rente est renseignée, lorsque des dates ou périodes
 * sont incohérentes, ou lorsque le taux d'AIPP est hors bornes.
 */

import type { DossierData } from "./types";
import { annualiser } from "./annualisation";
import {
  buildContexte,
  perFromMode,
} from "./postes/permanents";

export type AvertissementCode =
  | "PER_NUL"
  | "AGE_HORS_TABLE"
  | "DATES_INCOHERENTES"
  | "PERIODES_CHEVAUCHANTES"
  | "AIPP_HORS_BORNES"
  | "DONNEE_MANQUANTE"
  | "PROVISIONS_SUPERIEURES";

export interface AvertissementCalcul {
  code: AvertissementCode;
  poste: string;
  message: string;
}

function perNul(poste: string, detail: string): AvertissementCalcul {
  return {
    code: "PER_NUL",
    poste,
    message: `Rente saisie mais capital à zéro : ${detail}. Vérifiez la date de naissance, l'âge de fin et la table barémique.`,
  };
}

/** Deux intervalles [a1,b1] et [a2,b2] se recouvrent d'au moins un jour. */
function chevauche(a1: string, b1: string, a2: string, b2: string): boolean {
  return a1 <= b2 && a2 <= b1;
}

interface Periode {
  debut: string | null;
  fin: string | null;
  label: string;
}

function detecterChevauchements(
  poste: string,
  periodes: Periode[],
): AvertissementCalcul[] {
  const out: AvertissementCalcul[] = [];
  const valid = periodes.filter(
    (p): p is Periode & { debut: string; fin: string } => !!p.debut && !!p.fin && p.debut <= p.fin,
  );
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const a = valid[i];
      const b = valid[j];
      if (chevauche(a.debut, a.fin, b.debut, b.fin)) {
        out.push({
          code: "PERIODES_CHEVAUCHANTES",
          poste,
          message: `Chevauchement détecté entre « ${a.label} » et « ${b.label} ».`,
        });
      }
    }
  }
  return out;
}

export function collecterAvertissements(d: DossierData): AvertissementCalcul[] {
  const out: AvertissementCalcul[] = [];
  const ctx = buildContexte(d);

  // ---- a) PER_NUL sur toutes les capitalisations ----
  const pp = d.postesPerm;

  // ATP permanente
  {
    const rente =
      (pp.atpPerm.heuresParJour || 0) *
      (pp.atpPerm.tauxHoraire || 0) *
      (pp.atpPerm.facteurJours > 0 ? pp.atpPerm.facteurJours : 365);
    if (rente > 0) {
      const per = perFromMode(pp.atpPerm.capitalisation, ctx, pp.atpPerm.ageFin, null);
      if (per <= 0) out.push(perNul("ATP permanente", "rente annuelle capitalisée à 0"));
    }
  }

  // PGPF
  if ((pp.pgpf.renteAnnuelle || 0) > 0) {
    const per = perFromMode(pp.pgpf.capitalisation, ctx, pp.pgpf.ageFin, pp.pgpf.ageDebut);
    if (per <= 0) out.push(perNul("PGPF", "perte de gains professionnels futurs"));
  }

  // DSF récurrentes
  for (const l of pp.dsfRecurrentes) {
    if (!isFinite(l.montant) || l.montant <= 0) continue;
    const annuel = annualiser(l.montant, l.periodicite);
    if (annuel <= 0) continue;
    const per = perFromMode(l.capitalisation, ctx, l.ageFin, null);
    if (per <= 0) out.push(perNul("DSF récurrentes", l.libelle || "ligne sans libellé"));
  }

  // Adaptations logement / véhicule (lignes récurrentes uniquement)
  for (const l of pp.logement) {
    if (!l.recurrent) continue;
    if (!isFinite(l.montant) || l.montant <= 0) continue;
    const annuel = annualiser(l.montant, l.periodicite);
    if (annuel <= 0) continue;
    const per = perFromMode(l.capitalisation, ctx, l.ageFin, null);
    if (per <= 0) out.push(perNul("Logement adapté", l.libelle || "ligne sans libellé"));
  }
  for (const l of pp.vehicule) {
    if (!l.recurrent) continue;
    if (!isFinite(l.montant) || l.montant <= 0) continue;
    const annuel = annualiser(l.montant, l.periodicite);
    if (annuel <= 0) continue;
    const per = perFromMode(l.capitalisation, ctx, l.ageFin, null);
    if (per <= 0) out.push(perNul("Véhicule adapté", l.libelle || "ligne sans libellé"));
  }

  // IP — perte de retraite (rente différée)
  if ((pp.ip.perteRetraiteRente || 0) > 0) {
    const per = perFromMode("differee", ctx, null, pp.ip.perteRetraiteAgeDebut);
    if (per <= 0) out.push(perNul("Incidence professionnelle", "perte de retraite"));
  }

  // Perte de revenus du foyer (décès)
  {
    const pd = d.postesDeces;
    const revenu = Math.max(0, pd.revenuAnnuelDefunt || 0);
    const partCons = Math.min(Math.max(0, pd.partConsommeeDefunt || 0), 1);
    const revenuFoyer = revenu * (1 - partCons);
    if (revenuFoyer > 0) {
      const eligibles = pd.proches.filter(
        (p) => (p.lien === "conjoint" || p.lien === "enfant") && p.partFoyer > 0,
      );
      const totalParts = eligibles.reduce((a, p) => a + (p.partFoyer || 0), 0);
      if (totalParts > 0) {
        for (const p of eligibles) {
          const ctxP = buildContexte({
            dateNaissance: p.dateNaissance,
            dateConsolidation: null,
            dateLiquidation: d.dateLiquidation,
            bareme: d.bareme,
            sexe: p.sexe,
            methodeRente: d.methodeRente,
            tableMortalite: d.tableMortalite,
            tauxAIPP: 0,
          });
          const mode: "viager" | "temporaire" = p.lien === "conjoint" ? "viager" : "temporaire";
          const ageFin = mode === "temporaire" ? (p.ageFinEtudes > 0 ? p.ageFinEtudes : 25) : null;
          const per = perFromMode(mode, ctxP, ageFin, null);
          const rente = revenuFoyer * (p.partFoyer / totalParts);
          if (rente > 0 && per <= 0) {
            out.push(perNul("Perte de revenus du foyer", `part de ${p.prenom || "proche"}`));
          }
        }
      }
    }
  }

  // Perte de revenus des proches (survie)
  for (const p of d.postesSurvie.proches) {
    if (!isFinite(p.perteRevenusAnnuelle) || p.perteRevenusAnnuelle <= 0) continue;
    const ctxP = buildContexte({
      dateNaissance: p.dateNaissance,
      dateConsolidation: null,
      dateLiquidation: d.dateLiquidation,
      bareme: d.bareme,
      sexe: p.sexe,
      methodeRente: d.methodeRente,
      tableMortalite: d.tableMortalite,
      tauxAIPP: 0,
    });
    const per = perFromMode("viager", ctxP, null, null);
    if (per <= 0) {
      out.push(perNul("Perte de revenus des proches", p.prenom || "proche"));
    }
  }

  // ---- b) DATES_INCOHERENTES ----
  if (d.dateAccident && d.dateConsolidation && d.dateConsolidation < d.dateAccident) {
    out.push({
      code: "DATES_INCOHERENTES",
      poste: "Dossier",
      message: "Date de consolidation antérieure à la date d'accident.",
    });
  }
  if (d.dateConsolidation && d.dateLiquidation && d.dateLiquidation < d.dateConsolidation) {
    out.push({
      code: "DATES_INCOHERENTES",
      poste: "Dossier",
      message: "Date de liquidation antérieure à la date de consolidation.",
    });
  }

  // ---- c) PERIODES_CHEVAUCHANTES ----
  out.push(
    ...detecterChevauchements(
      "DFT",
      d.periodesDFT.map((p, i) => ({
        debut: p.debut,
        fin: p.fin,
        label: `période ${i + 1}`,
      })),
    ),
  );
  out.push(
    ...detecterChevauchements(
      "ATP temporaire",
      d.postesTemp.atpTemp.map((p, i) => ({
        debut: p.debut,
        fin: p.fin,
        label: `période ${i + 1}`,
      })),
    ),
  );
  out.push(
    ...detecterChevauchements(
      "DSA récurrentes",
      d.postesTemp.dsaRecurrentes.map((p, i) => ({
        debut: p.debut,
        fin: p.fin,
        label: p.libelle || `ligne ${i + 1}`,
      })),
    ),
  );

  // ---- d) AIPP_HORS_BORNES ----
  if (!isFinite(d.tauxAIPP) || d.tauxAIPP < 0 || d.tauxAIPP > 100) {
    out.push({
      code: "AIPP_HORS_BORNES",
      poste: "Dossier",
      message: `Taux d'AIPP hors de la plage [0, 100] : ${d.tauxAIPP}.`,
    });
  }

  return out;
}
