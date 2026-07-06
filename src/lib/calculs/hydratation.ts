/**
 * Hydratation d'un dossier : merge profond d'un JSON partiel (base de données
 * ou import utilisateur) sur les valeurs par défaut de `defaultDossierData`.
 *
 * Objectifs :
 * - Compatibilité rétroactive avec les dossiers anciens dont certains
 *   sous-objets ou champs n'existaient pas.
 * - Tous les tableaux (périodes, lignes DSA/DSF, proches, frais divers…)
 *   absents sont remplacés par un tableau vide plutôt que `undefined`.
 * - Aucun calcul n'est effectué ici : c'est une pure transformation de forme.
 */

import { defaultDossierData, type DossierData } from "./types";
import type { Proche } from "./postes/deces";

type UnknownRecord = Record<string, unknown>;

function isObject(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function hydraterDossier(raw: unknown): DossierData {
  const base = defaultDossierData();
  const src: UnknownRecord = isObject(raw) ? raw : {};

  const srcPT = isObject(src.postesTemp) ? src.postesTemp : {};
  const srcPP = isObject(src.postesPerm) ? src.postesPerm : {};
  const srcPD = isObject(src.postesDeces) ? src.postesDeces : {};
  const srcPS = isObject(src.postesSurvie) ? src.postesSurvie : {};

  const srcPgpa = isObject(srcPT.pgpa) ? srcPT.pgpa : {};

  const merged: DossierData = {
    ...base,
    ...(src as Partial<DossierData>),
    periodesDFT: pickArray(src.periodesDFT),
    postesTemp: {
      ...base.postesTemp,
      ...(srcPT as Partial<DossierData["postesTemp"]>),
      dsaPonctuelles: pickArray(srcPT.dsaPonctuelles),
      dsaRecurrentes: pickArray(srcPT.dsaRecurrentes),
      atpTemp: pickArray(srcPT.atpTemp),
      pgpa: {
        ...base.postesTemp.pgpa,
        ...(srcPgpa as Partial<DossierData["postesTemp"]["pgpa"]>),
        periodes: pickArray(srcPgpa.periodes),
      },
      dft: { ...base.postesTemp.dft, ...(isObject(srcPT.dft) ? srcPT.dft : {}) },
      se: { ...base.postesTemp.se, ...(isObject(srcPT.se) ? srcPT.se : {}) },
      pet: { ...base.postesTemp.pet, ...(isObject(srcPT.pet) ? srcPT.pet : {}) },
    },
    postesPerm: {
      ...base.postesPerm,
      ...(srcPP as Partial<DossierData["postesPerm"]>),
      dsfPonctuelles: pickArray(srcPP.dsfPonctuelles),
      dsfRecurrentes: pickArray(srcPP.dsfRecurrentes),
      logement: pickArray(srcPP.logement),
      vehicule: pickArray(srcPP.vehicule),
      atpPerm: { ...base.postesPerm.atpPerm, ...(isObject(srcPP.atpPerm) ? srcPP.atpPerm : {}) },
      pgpf: { ...base.postesPerm.pgpf, ...(isObject(srcPP.pgpf) ? srcPP.pgpf : {}) },
      ip: { ...base.postesPerm.ip, ...(isObject(srcPP.ip) ? srcPP.ip : {}) },
      dfp: { ...base.postesPerm.dfp, ...(isObject(srcPP.dfp) ? srcPP.dfp : {}) },
      agrement: { ...base.postesPerm.agrement, ...(isObject(srcPP.agrement) ? srcPP.agrement : {}) },
      sexuel: { ...base.postesPerm.sexuel, ...(isObject(srcPP.sexuel) ? srcPP.sexuel : {}) },
      esthetiquePerm: { ...base.postesPerm.esthetiquePerm, ...(isObject(srcPP.esthetiquePerm) ? srcPP.esthetiquePerm : {}) },
      etablissement: { ...base.postesPerm.etablissement, ...(isObject(srcPP.etablissement) ? srcPP.etablissement : {}) },
      pathologiesEvo: { ...base.postesPerm.pathologiesEvo, ...(isObject(srcPP.pathologiesEvo) ? srcPP.pathologiesEvo : {}) },
    },
    postesDeces: {
      ...base.postesDeces,
      ...(srcPD as Partial<DossierData["postesDeces"]>),
      fraisDivers: pickArray(srcPD.fraisDivers),
      proches: pickArray<Partial<Proche>>(srcPD.proches).map((p) => ({
        pensionReversionAnnuelle: 0,
        ...p,
      })) as Proche[],
    },
    postesSurvie: {
      ...base.postesSurvie,
      ...(srcPS as Partial<DossierData["postesSurvie"]>),
      proches: pickArray(srcPS.proches),
      fraisDivers: pickArray(srcPS.fraisDivers),
    },
  };

  return merged;
}
