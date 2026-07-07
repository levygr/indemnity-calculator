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
      fraisDivers: pickArray(srcPT.fraisDivers),
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
      psu: { ...base.postesPerm.psu, ...(isObject(srcPP.psu) ? srcPP.psu : {}) },
      dfp: { ...base.postesPerm.dfp, ...(isObject(srcPP.dfp) ? srcPP.dfp : {}) },
      agrement: { ...base.postesPerm.agrement, ...(isObject(srcPP.agrement) ? srcPP.agrement : {}) },
      sexuel: { ...base.postesPerm.sexuel, ...(isObject(srcPP.sexuel) ? srcPP.sexuel : {}) },
      esthetiquePerm: { ...base.postesPerm.esthetiquePerm, ...(isObject(srcPP.esthetiquePerm) ? srcPP.esthetiquePerm : {}) },
      etablissement: { ...base.postesPerm.etablissement, ...(isObject(srcPP.etablissement) ? srcPP.etablissement : {}) },
      // Migration : ancien poste unique pathologiesEvo → pathologiesEvolutives
      pathologiesEvolutives: {
        ...base.postesPerm.pathologiesEvolutives,
        ...(isObject(srcPP.pathologiesEvolutives)
          ? srcPP.pathologiesEvolutives
          : isObject(srcPP.pathologiesEvo)
          ? srcPP.pathologiesEvo
          : {}),
      },
      permanentExceptionnel: {
        ...base.postesPerm.permanentExceptionnel,
        ...(isObject(srcPP.permanentExceptionnel) ? srcPP.permanentExceptionnel : {}),
      },
    },
    postesDeces: {
      ...base.postesDeces,
      ...(srcPD as Partial<DossierData["postesDeces"]>),
      fraisDivers: pickArray(srcPD.fraisDivers),
      proches: pickArray<Partial<Proche>>(srcPD.proches).map((p) => ({
        pensionReversionAnnuelle: 0,
        lienReferentiel: "",
        ...p,
      })) as Proche[],
    },
    postesSurvie: {
      ...base.postesSurvie,
      ...(srcPS as Partial<DossierData["postesSurvie"]>),
      proches: pickArray<Partial<DossierData["postesSurvie"]["proches"][number]>>(srcPS.proches).map((p) => ({
        lienReferentiel: "",
        ...p,
      })) as DossierData["postesSurvie"]["proches"],
      fraisDivers: pickArray(srcPS.fraisDivers),
    },
    provisions: pickArray(src.provisions),
    organismesTP: pickArray(src.organismesTP),
    creancesTP: pickArray(src.creancesTP),
    lignesInterets: pickArray<Partial<DossierData["lignesInterets"][number]>>(
      src.lignesInterets,
    ).map((l) => ({
      id: l.id ?? crypto.randomUUID(),
      libelle: l.libelle ?? "",
      base: typeof l.base === "number" ? l.base : 0,
      categorieCreancier: l.categorieCreancier ?? "particulier",
      regime: l.regime ?? "taux_legal",
      dateDebut: l.dateDebut ?? null,
      dateFin: l.dateFin ?? null,
      anatocisme: !!l.anatocisme,
      dateAnatocisme: l.dateAnatocisme ?? null,
      dateDecision: l.dateDecision ?? null,
      dateExecutoire: l.dateExecutoire ?? null,
      delaiMajorationMois: typeof l.delaiMajorationMois === "number" ? l.delaiMajorationMois : 2,
      delaiBadinter1Mois: typeof l.delaiBadinter1Mois === "number" ? l.delaiBadinter1Mois : 2,
      delaiBadinter2Mois: typeof l.delaiBadinter2Mois === "number" ? l.delaiBadinter2Mois : 4,
    })) as DossierData["lignesInterets"],
  };

  return merged;
}
