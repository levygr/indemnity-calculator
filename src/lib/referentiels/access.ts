/**
 * Couche d'accès aux référentiels — pure et client-safe.
 *
 * Bloc A : renvoie toujours la payload seedée (fichier bundlé). Aucune
 * signature ne dépend d'un contexte DB : les modules de calcul continuent
 * d'importer directement depuis `src/data/` et ne sont pas modifiés. Cette
 * couche est le point d'entrée qui, aux blocs suivants, saura prendre en
 * compte l'édition active persistée en base ou l'édition rattachée à un
 * dossier, avec repli automatique sur le fichier si la base est indisponible.
 *
 * L'API restera stable : mêmes fonctions, mêmes types de retour ; seule la
 * source des valeurs pourra changer selon le contexte fourni.
 */

import {
  REF_AIPP,
  REF_INDICES,
  REF_MORNET,
  REF_MORTALITE_2020,
  REF_MORTALITE_2023,
  REF_PER_FEMME_PROSP,
  REF_PER_FEMME_STAT,
  REF_PER_HOMME_PROSP,
  REF_PER_HOMME_STAT,
  REF_PER_INDET_PROSP,
  REF_PER_INDET_STAT,
  REF_TAUX_LEGAL,
  type AippPayload,
  type ReferentielDefinition,
  type ReferentielRow,
} from "./registry";

/** Contexte d'accès : optionnel, permet aux blocs suivants d'injecter les
 * lignes issues de la base sans changer les signatures. */
export interface ReferentielsSource {
  /** Table `code → lignes valeurs` de l'édition retenue pour ce contexte. */
  editionRows?: Record<string, ReferentielRow[]>;
}

function payloadOf<T>(def: ReferentielDefinition<T>, source?: ReferentielsSource): T {
  const rows = source?.editionRows?.[def.code];
  if (rows && rows.length > 0) {
    try {
      return def.fromRows(rows);
    } catch {
      // Repli silencieux sur le fichier si la reconstruction échoue.
      return def.payload;
    }
  }
  return def.payload;
}

export function getTauxLegal(source?: ReferentielsSource) {
  return payloadOf(REF_TAUX_LEGAL, source);
}

export function getIndicesAnnuels(source?: ReferentielsSource) {
  return payloadOf(REF_INDICES, source).indices_annuels;
}

export function getMortalite2020_2022(source?: ReferentielsSource) {
  return payloadOf(REF_MORTALITE_2020, source);
}

export function getMortalite2023_2025(source?: ReferentielsSource) {
  return payloadOf(REF_MORTALITE_2023, source);
}

export function getBaremePER(
  sexe: "femme" | "homme" | "indetermine",
  type: "stationnaire" | "prospectif",
  source?: ReferentielsSource,
) {
  const def = (() => {
    if (sexe === "femme")
      return type === "stationnaire" ? REF_PER_FEMME_STAT : REF_PER_FEMME_PROSP;
    if (sexe === "homme")
      return type === "stationnaire" ? REF_PER_HOMME_STAT : REF_PER_HOMME_PROSP;
    return type === "stationnaire" ? REF_PER_INDET_STAT : REF_PER_INDET_PROSP;
  })();
  return payloadOf(def, source);
}

export function getAIPP(source?: ReferentielsSource): AippPayload {
  return payloadOf(REF_AIPP, source);
}

export function getReferentielMornet(source?: ReferentielsSource) {
  return payloadOf(REF_MORNET, source);
}
