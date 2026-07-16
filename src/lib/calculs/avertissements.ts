/**
 * Avertissements de calcul : contrôles de cohérence non bloquants sur un dossier.
 *
 * Ces règles sont purement informatives ; elles ne modifient jamais les résultats
 * des postes. Elles servent à alerter l'utilisateur lorsqu'une saisie produit un
 * capital à zéro alors qu'une rente est renseignée, lorsque des dates ou périodes
 * sont incohérentes, ou lorsque le taux d'AIPP est hors bornes.
 *
 * Chaque avertissement porte, en plus de `poste` et `message`, la `route` cible
 * et l'`anchor` de la section du poste concerné pour permettre la navigation
 * directe depuis la synthèse.
 */

import type { DossierData } from "./types";
import { annualiser } from "./annualisation";
import {
  buildContexte,
  perFromMode,
} from "./postes/permanents";
import { AIPP_META } from "@/data/bareme_aipp";
import { REFERENTIEL } from "@/data/referentiel_evaluation";

export type AvertissementCode =
  | "PER_NUL"
  | "AGE_HORS_TABLE"
  | "DATES_INCOHERENTES"
  | "PERIODES_CHEVAUCHANTES"
  | "AIPP_HORS_BORNES"
  | "DONNEE_MANQUANTE"
  | "PROVISIONS_SUPERIEURES"
  | "ECART_CREANCES_TP"
  | "REFERENTIEL_NON_VERSIONNE"
  | "PART_CONSOMMEE_SUSPECTE";

export interface AvertissementCalcul {
  code: AvertissementCode;
  poste: string;
  message: string;
  /** Route cible relative au dossier (avec `/dossiers/$id`). */
  route: string;
  /** Identifiant de la section (`id` HTML) où scroller/mettre en évidence. */
  anchor: string;
}

/** Table de correspondance poste → localisation (route + ancre). */
const LOCATIONS: Record<string, { route: string; anchor: string }> = {
  "ATP permanente": { route: "/dossiers/$id/patrimoniaux-permanents", anchor: "poste-atp-permanente" },
  "PGPF": { route: "/dossiers/$id/patrimoniaux-permanents", anchor: "poste-pgpf" },
  "DSF récurrentes": { route: "/dossiers/$id/patrimoniaux-permanents", anchor: "poste-dsf-recurrentes" },
  "Logement adapté": { route: "/dossiers/$id/patrimoniaux-permanents", anchor: "poste-logement" },
  "Véhicule adapté": { route: "/dossiers/$id/patrimoniaux-permanents", anchor: "poste-vehicule" },
  "Incidence professionnelle": { route: "/dossiers/$id/patrimoniaux-permanents", anchor: "poste-ip" },
  "Perte de revenus du foyer": { route: "/dossiers/$id/deces", anchor: "poste-perte-foyer" },
  "Perte de revenus des proches": { route: "/dossiers/$id/survie-proches", anchor: "poste-perte-proches" },
  "Dossier": { route: "/dossiers/$id", anchor: "section-dates" },
  "DFT": { route: "/dossiers/$id", anchor: "section-periodes-dft" },
  "ATP temporaire": { route: "/dossiers/$id/patrimoniaux-temporaires", anchor: "poste-atp-temp" },
  "DSA récurrentes": { route: "/dossiers/$id/patrimoniaux-temporaires", anchor: "poste-dsa-recurrentes" },
  "Référentiels": { route: "/dossiers/$id/synthese", anchor: "section-referentiels" },
};

function locate(poste: string): { route: string; anchor: string } {
  return LOCATIONS[poste] ?? { route: "/dossiers/$id/synthese", anchor: "section-controles-coherence" };
}

function perNul(poste: string, detail: string): AvertissementCalcul {
  const loc = locate(poste);
  return {
    code: "PER_NUL",
    poste,
    message: `Rente saisie mais capital à zéro : ${detail}. Vérifiez la date de naissance, l'âge de fin et la table barémique.`,
    ...loc,
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
  const loc = locate(poste);
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
          ...loc,
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
    const revenuD = Math.max(0, pd.revenuAnnuelDefunt || 0);
    const revenuC = Math.max(0, pd.revenuAnnuelConjoint || 0);
    const partCons = Math.min(Math.max(0, pd.partConsommeeDefunt || 0), 1);
    const perteFoyer = Math.max(0, (revenuD + revenuC) * (1 - partCons) - revenuC);
    if (revenuD > 0 && perteFoyer === 0) {
      out.push({
        code: "PART_CONSOMMEE_SUSPECTE",
        poste: "Perte de revenus du foyer",
        message:
          "Perte annuelle du foyer nulle malgré un revenu du défunt : vérifiez la part d'autoconsommation et le revenu maintenu du conjoint.",
        ...locate("Perte de revenus du foyer"),
      });
    }
    if (perteFoyer > 0) {
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
          const rente = perteFoyer * (p.partFoyer / totalParts);
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
      ...locate("Dossier"),
    });
  }
  if (d.dateConsolidation && d.dateLiquidation && d.dateLiquidation < d.dateConsolidation) {
    out.push({
      code: "DATES_INCOHERENTES",
      poste: "Dossier",
      message: "Date de liquidation antérieure à la date de consolidation.",
      ...locate("Dossier"),
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
      ...locate("Dossier"),
    });
  }

  // ---- e) REFERENTIEL_NON_VERSIONNE ----
  const aippEdition: string | null | undefined = AIPP_META.edition;
  const refEdition: string | null | undefined = REFERENTIEL.edition;
  if (!aippEdition) {
    out.push({
      code: "REFERENTIEL_NON_VERSIONNE",
      poste: "Référentiels",
      message: `Édition du barème AIPP (${AIPP_META.source}) non renseignée : compléter src/data/bareme_aipp.ts avant tout usage juridique.`,
      ...locate("Référentiels"),
    });
  }
  if (!refEdition) {
    out.push({
      code: "REFERENTIEL_NON_VERSIONNE",
      poste: "Référentiels",
      message: `Édition du référentiel d'évaluation (${REFERENTIEL.nom}) non renseignée : compléter src/data/referentiel_evaluation.ts avant tout usage juridique.`,
      ...locate("Référentiels"),
    });
  }

  return out;
}
