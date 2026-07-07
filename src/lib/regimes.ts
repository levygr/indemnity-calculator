// Aides internes à la qualification du régime juridique en fonction du fait
// générateur. Ces textes sont des repères qualitatifs destinés à l'équipe
// du cabinet. Ils doivent être relus et validés par un avocat avant tout
// usage dans une réclamation ou un échange avec la partie adverse.
//
// Ne comportent volontairement AUCUN montant, seuil ou pourcentage chiffré :
// ce module n'est pas un moteur de calcul alternatif.

import type { FaitGenerateur } from "@/lib/calculs/types";

export interface RegimeInfo {
  libelle: string;
  alertes: string[];
  pointsDeVigilance: string[];
}

export const REGIMES: Record<FaitGenerateur, RegimeInfo> = {
  circulation: {
    libelle: "Accident de la circulation (loi du 5 juillet 1985)",
    alertes: [
      "La limitation ou l'exclusion d'indemnisation pour faute de la victime ne concerne que la victime conductrice. Utiliser le champ « fraction de faute » uniquement au regard de cette distinction conducteur / non-conducteur.",
      "En cas d'offre tardive de l'assureur, des sanctions spécifiques (doublement du taux légal) peuvent s'appliquer : voir le module Intérêts.",
    ],
    pointsDeVigilance: [
      "Qualifier précisément la qualité de la victime (conducteur, passager, piéton, cycliste).",
      "Vérifier les délais légaux de l'offre d'indemnisation et leur point de départ.",
      "Contrôler l'imputabilité des postes au fait accidentel (état antérieur, causalité).",
    ],
  },
  medical: {
    libelle: "Accident médical",
    alertes: [
      "Distinguer la responsabilité pour faute (professionnel ou établissement de santé) de l'accident médical non fautif relevant de la solidarité nationale.",
      "L'ONIAM applique son propre référentiel indicatif, généralement inférieur aux évaluations judiciaires : vérifier les conditions et les seuils en vigueur avant d'orienter le dossier vers cette voie.",
    ],
    pointsDeVigilance: [
      "Vérifier l'éligibilité aux dispositifs CCI / ONIAM (conditions de gravité, imputabilité).",
      "Anticiper l'articulation entre voie amiable, voie judiciaire et solidarité nationale.",
      "Recueillir l'entier dossier médical et, le cas échéant, solliciter une expertise.",
    ],
  },
  infraction_penale: {
    libelle: "Infraction pénale",
    alertes: [
      "La voie de la Commission d'indemnisation des victimes d'infractions (CIVI) est ouverte pour certaines infractions, sous conditions propres qu'il convient de vérifier au cas par cas.",
      "L'articulation avec l'action civile devant la juridiction pénale et l'action devant le SARVI doit être examinée avant tout choix procédural.",
    ],
    pointsDeVigilance: [
      "Vérifier la nature de l'infraction et les conditions d'accès à la CIVI.",
      "Contrôler les délais de saisine et la subrogation du Fonds de garantie.",
      "Prévoir la production des pièces pénales (jugement, procès-verbaux).",
    ],
  },
  terrorisme: {
    libelle: "Acte de terrorisme",
    alertes: [
      "Le Fonds de garantie des victimes des actes de terrorisme et d'autres infractions (FGTI) est compétent pour l'indemnisation, selon des règles propres qu'il convient de vérifier.",
    ],
    pointsDeVigilance: [
      "Vérifier l'inscription de la victime sur la liste unique des victimes.",
      "Anticiper la spécificité des postes indemnisés (PESVT, préjudice d'attente, etc.).",
      "Contrôler l'articulation avec les recours des tiers payeurs.",
    ],
  },
  accident_travail: {
    libelle: "Accident du travail",
    alertes: [
      "Le livre IV du code de la sécurité sociale déroge au droit commun de la réparation intégrale.",
      "La nomenclature Dintilhac ne s'applique pleinement qu'en cas de faute inexcusable de l'employeur ou de recours contre un tiers responsable : vérifier le fondement de l'action avant toute évaluation poste par poste.",
    ],
    pointsDeVigilance: [
      "Qualifier précisément le fondement de l'action (droit commun, faute inexcusable, tiers responsable).",
      "Contrôler l'existence de prestations servies par la caisse et leur imputation.",
      "Vérifier les délais de prescription et la juridiction compétente.",
    ],
  },
  maladie_pro: {
    libelle: "Maladie professionnelle",
    alertes: [
      "Le livre IV du code de la sécurité sociale déroge au droit commun de la réparation intégrale.",
      "La nomenclature Dintilhac ne s'applique pleinement qu'en cas de faute inexcusable de l'employeur ou de recours contre un tiers responsable : vérifier le fondement de l'action avant toute évaluation poste par poste.",
    ],
    pointsDeVigilance: [
      "Vérifier l'inscription au tableau des maladies professionnelles ou la reconnaissance hors tableau.",
      "Contrôler la date de première constatation médicale et son incidence sur la prescription.",
      "Anticiper la coexistence avec un éventuel recours contre un tiers.",
    ],
  },
  autre: {
    libelle: "Autre régime",
    alertes: [
      "Le régime applicable n'a pas été qualifié : identifier le fondement juridique de l'action avant toute évaluation, afin de vérifier l'applicabilité pleine et entière de la nomenclature Dintilhac.",
    ],
    pointsDeVigilance: [
      "Qualifier le fondement de la responsabilité (contractuelle, délictuelle, sans faute, régime spécial).",
      "Vérifier l'existence de règles dérogatoires (barème, plafond, référentiel indicatif).",
      "Contrôler la juridiction compétente et les délais de prescription.",
    ],
  },
};

export function regimePour(fg: FaitGenerateur): RegimeInfo {
  return REGIMES[fg] ?? REGIMES.autre;
}
