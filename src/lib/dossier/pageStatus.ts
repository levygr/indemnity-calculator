/**
 * Métadonnées partagées des sections du dossier (sidebar + dashboard).
 * Centralise la logique `pageHasData` pour éviter la duplication.
 */
import type { DossierData } from "@/lib/calculs/types";

export interface SectionMeta {
  key: string;
  label: string;
  /** Route TanStack Router (avec `$id`). */
  route:
    | "/dossiers/$id"
    | "/dossiers/$id/patrimoniaux-temporaires"
    | "/dossiers/$id/extrapatrimoniaux-temporaires"
    | "/dossiers/$id/patrimoniaux-permanents"
    | "/dossiers/$id/extrapatrimoniaux-permanents"
    | "/dossiers/$id/deces"
    | "/dossiers/$id/survie-proches"
    | "/dossiers/$id/tiers-payeurs"
    | "/dossiers/$id/synthese"
    | "/dossiers/$id/comparateur"
    | "/dossiers/$id/interets"
    | "/dossiers/$id/activite";
  group: string;
}

export const SECTION_GROUPS: { title: string; items: SectionMeta[] }[] = [
  {
    title: "Identité",
    items: [{ key: "identite", label: "Dossier", route: "/dossiers/$id", group: "Identité" }],
  },
  {
    title: "Postes temporaires",
    items: [
      { key: "pt", label: "Préj. patrimoniaux temporaires", route: "/dossiers/$id/patrimoniaux-temporaires", group: "Postes temporaires" },
      { key: "ept", label: "Préj. extrapatrimoniaux temporaires", route: "/dossiers/$id/extrapatrimoniaux-temporaires", group: "Postes temporaires" },
    ],
  },
  {
    title: "Postes permanents",
    items: [
      { key: "pp", label: "Préj. patrimoniaux permanents", route: "/dossiers/$id/patrimoniaux-permanents", group: "Postes permanents" },
      { key: "epp", label: "Préj. extrapatrimoniaux permanents", route: "/dossiers/$id/extrapatrimoniaux-permanents", group: "Postes permanents" },
    ],
  },
  {
    title: "Décès & survie",
    items: [
      { key: "deces", label: "Victimes indirectes - décès", route: "/dossiers/$id/deces", group: "Décès & survie" },
      { key: "survie", label: "Victimes indirectes - survie", route: "/dossiers/$id/survie-proches", group: "Décès & survie" },
    ],
  },
  {
    title: "Recours & synthèse",
    items: [
      { key: "tp", label: "Tiers payeurs", route: "/dossiers/$id/tiers-payeurs", group: "Recours & synthèse" },
      { key: "synthese", label: "Synthèse", route: "/dossiers/$id/synthese", group: "Recours & synthèse" },
      { key: "comparateur", label: "Comparateur", route: "/dossiers/$id/comparateur", group: "Recours & synthèse" },
      { key: "interets", label: "Intérêts", route: "/dossiers/$id/interets", group: "Recours & synthèse" },
      { key: "activite", label: "Activité", route: "/dossiers/$id/activite", group: "Recours & synthèse" },
    ],
  },
];

export const SECTIONS: SectionMeta[] = SECTION_GROUPS.flatMap((g) => g.items);

/** Retourne true si la page comporte au moins une donnée saisie non triviale. */
export function pageHasData(key: string, d: DossierData | null): boolean {
  if (!d) return false;
  const pt = d.postesTemp;
  const pp = d.postesPerm as unknown as Record<string, unknown> | undefined;
  switch (key) {
    case "identite":
      return !!(d.reference && d.reference.trim().length > 0) || !!d.dateNaissance || !!d.dateAccident;
    case "pt":
      return (
        (pt?.dsaPonctuelles?.length ?? 0) > 0 ||
        (pt?.dsaRecurrentes?.length ?? 0) > 0 ||
        (pt?.fraisDivers?.length ?? 0) > 0 ||
        (pt?.atpTemp?.length ?? 0) > 0 ||
        !!pt?.pgpa?.methode
      );
    case "ept":
      return !!(pt?.dft?.tauxJournalier || pt?.se?.montant || pt?.pet?.montant);
    case "pp":
      return !!pp && Object.keys(pp).length > 0;
    case "epp":
      return !!pp && Object.keys(pp).length > 0;
    case "deces":
      return !!d.postesDeces && Object.keys(d.postesDeces as unknown as Record<string, unknown>).length > 0;
    case "survie":
      return !!d.postesSurvie && Object.keys(d.postesSurvie as unknown as Record<string, unknown>).length > 0;
    case "tp":
      return (d.organismesTP?.length ?? 0) > 0 || (d.creancesTP?.length ?? 0) > 0;
    case "interets":
      return (d.lignesInterets?.length ?? 0) > 0;
    default:
      return false;
  }
}
