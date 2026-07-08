/**
 * Registre central des référentiels de l'application.
 *
 * Chaque entrée décrit :
 *  - son code stable (identifiant en base) ;
 *  - son libellé et sa description humaine ;
 *  - son `kind` : `monolithique` (bloc figé, remplacé en un tenant lors
 *    d'une nouvelle édition — grille PER, table de mortalité, AIPP…) ou
 *    `incremental` (nouvelles périodes ajoutées à l'existant — taux légal,
 *    IPC/SMIC…) ;
 *  - la source publique de la donnée (pour affichage et export) ;
 *  - la payload initiale, importée du fichier `src/data/` correspondant ;
 *  - la sérialisation en lignes `valeurs` (`toRows`) et la reconstruction
 *    inverse (`fromRows`).
 *
 * Règle : `fromRows(toRows(payload))` DOIT retrouver `payload` à l'identique
 * (JSON strictement égal). C'est ce que vérifie `parite.test.ts`.
 */

import tauxLegal from "@/data/taux_legal.json";
import indicesActualisation from "@/data/indices_actualisation.json";
import mortalite2020 from "@/data/mortalite_2020_2022.json";
import mortalite2023 from "@/data/mortalite_2023_2025.json";
import bFemmeStat from "@/data/bareme_femme_stationnaire_2025.json";
import bHommeStat from "@/data/bareme_homme_stationnaire_2025.json";
import bIndetStat from "@/data/bareme_indetermine_stationnaire_2025.json";
import bFemmeProsp from "@/data/bareme_femme_prospectif_2025.json";
import bHommeProsp from "@/data/bareme_homme_prospectif_2025.json";
import bIndetProsp from "@/data/bareme_indetermine_prospectif_2025.json";
import {
  AIPP_META,
  AIPP_TRANCHES_AGE,
  AIPP_TRANCHES_TAUX,
  AIPP_VALEURS_POINT,
} from "@/data/bareme_aipp";
import { REFERENTIEL } from "@/data/referentiel_evaluation";

export type ReferentielKind = "monolithique" | "incremental";

export interface ReferentielRow {
  cle: Record<string, unknown>;
  valeur: unknown;
  commentaire?: string | null;
}

export interface ReferentielDefinition<TPayload> {
  code: string;
  libelle: string;
  kind: ReferentielKind;
  source: string;
  description: string;
  /** Contenu par défaut (édition initiale seedée). */
  payload: TPayload;
  /** Sérialisation vers lignes `valeurs`. */
  toRows: (payload: TPayload) => ReferentielRow[];
  /** Reconstruction depuis lignes `valeurs`. */
  fromRows: (rows: ReferentielRow[]) => TPayload;
}

/* -------------------------------------------------------------------------- */
/*  Sérialisations                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Sérialisation « monolithique » : on stocke une unique ligne dont `cle` vaut
 * `{ type: "full" }` et `valeur` vaut le JSON complet. Garantit une parité
 * triviale. Sera raffiné (une ligne par cellule) pour PER et AIPP au
 * jalon 5 (import CSV avec diff par cellule).
 */
function monolithique<T>(): Pick<ReferentielDefinition<T>, "toRows" | "fromRows"> {
  return {
    toRows: (payload) => [{ cle: { type: "full" }, valeur: payload as unknown }],
    fromRows: (rows) => {
      const full = rows.find(
        (r) => r.cle && (r.cle as { type?: string }).type === "full",
      );
      if (!full) throw new Error("Ligne 'full' manquante");
      return full.valeur as T;
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Définitions                                                               */
/* -------------------------------------------------------------------------- */

type TauxLegalPayload = typeof tauxLegal;

export const REF_TAUX_LEGAL: ReferentielDefinition<TauxLegalPayload> = {
  code: "taux_legal",
  libelle: "Taux d'intérêt légal",
  kind: "incremental",
  source: tauxLegal.source,
  description: tauxLegal.note,
  payload: tauxLegal as TauxLegalPayload,
  toRows: (payload) => {
    const meta: ReferentielRow = {
      cle: { type: "meta" },
      valeur: { source: payload.source, note: payload.note },
    };
    const periodes = payload.taux.map((t) => ({
      cle: { debut: t.debut },
      valeur: {
        fin: t.fin,
        tauxParticulier: t.tauxParticulier,
        tauxAutres: t.tauxAutres,
        reference: t.reference,
      },
    }));
    return [meta, ...periodes];
  },
  fromRows: (rows) => {
    const meta = rows.find(
      (r) => (r.cle as { type?: string }).type === "meta",
    );
    if (!meta) throw new Error("Meta taux_legal manquante");
    const m = meta.valeur as { source: string; note: string };
    const periodes = rows
      .filter((r) => (r.cle as { debut?: string }).debut != null)
      .map((r) => {
        const v = r.valeur as {
          fin: string;
          tauxParticulier: number | null;
          tauxAutres: number | null;
          reference: string | null;
        };
        return {
          debut: (r.cle as { debut: string }).debut,
          fin: v.fin,
          tauxParticulier: v.tauxParticulier,
          tauxAutres: v.tauxAutres,
          reference: v.reference,
        };
      })
      .sort((a, b) => a.debut.localeCompare(b.debut));
    return { source: m.source, note: m.note, taux: periodes } as TauxLegalPayload;
  },
};

type IndicesPayload = typeof indicesActualisation;

export const REF_INDICES: ReferentielDefinition<IndicesPayload> = {
  code: "indices_actualisation",
  libelle: "Indices annuels (IPC et SMIC horaire)",
  kind: "incremental",
  source: "INSEE (IPC) et publications officielles du SMIC",
  description:
    "Indice des prix à la consommation et SMIC horaire brut, publiés annuellement. Utilisés pour l'actualisation des postes de préjudice.",
  payload: indicesActualisation as IndicesPayload,
  toRows: (payload) => {
    const annuels: ReferentielRow[] = payload.indices_annuels.map((ligne) => ({
      cle: { type: "annuel", annee: ligne.annee },
      valeur: { ipc: ligne.ipc, smic_horaire_brut: ligne.smic_horaire_brut },
    }));
    const mensuels: ReferentielRow[] = payload.indices_mensuels.map((ligne) => ({
      cle: { type: "mensuel", annee: ligne.annee, mois: ligne.mois },
      valeur: { ipc_mensuel: ligne.ipc_mensuel },
    }));
    return [...annuels, ...mensuels];
  },
  fromRows: (rows) => {
    const annuels = rows
      .filter((r) => (r.cle as { type?: string }).type === "annuel")
      .map((r) => {
        const c = r.cle as { annee: number };
        const v = r.valeur as { ipc: number; smic_horaire_brut: number };
        return { annee: c.annee, ipc: v.ipc, smic_horaire_brut: v.smic_horaire_brut };
      })
      .sort((a, b) => a.annee - b.annee);
    const mensuels = rows
      .filter((r) => (r.cle as { type?: string }).type === "mensuel")
      .map((r) => {
        const c = r.cle as { annee: number; mois: string };
        const v = r.valeur as { ipc_mensuel: number };
        return { annee: c.annee, mois: c.mois, ipc_mensuel: v.ipc_mensuel };
      });
    // Conserver l'ordre du fichier source (annee croissante, mois dans l'ordre publié)
    return { indices_annuels: annuels, indices_mensuels: mensuels } as IndicesPayload;
  },
};

/* -- Tables de mortalité (stockage monolithique pour le Bloc A) ------------ */

type Mortalite = typeof mortalite2020;

export const REF_MORTALITE_2020: ReferentielDefinition<Mortalite> = {
  code: "mortalite_2020_2022",
  libelle: "Table de mortalité INSEE 2020-2022",
  kind: "monolithique",
  source: "INSEE — Table de mortalité 2020-2022",
  description: "Table de mortalité par âge et par sexe, publiée par l'INSEE pour la période 2020-2022.",
  payload: mortalite2020 as Mortalite,
  ...monolithique<Mortalite>(),
};

export const REF_MORTALITE_2023: ReferentielDefinition<Mortalite> = {
  code: "mortalite_2023_2025",
  libelle: "Table de mortalité INSEE 2023-2025",
  kind: "monolithique",
  source: "INSEE — Table de mortalité 2023-2025",
  description: "Table de mortalité par âge et par sexe, publiée par l'INSEE pour la période 2023-2025.",
  payload: mortalite2023 as Mortalite,
  ...monolithique<Mortalite>(),
};

/* -- Barèmes PER 2025 (Gazette du Palais) ---------------------------------- */

type BaremePer = typeof bFemmeStat;

const PER_SOURCE = "Gazette du Palais — Barème de capitalisation 2025";

function defPer(
  code: string,
  libelle: string,
  payload: BaremePer,
): ReferentielDefinition<BaremePer> {
  return {
    code,
    libelle,
    kind: "monolithique",
    source: PER_SOURCE,
    description: `${libelle}. Source : ${PER_SOURCE}. Utilisé pour capitaliser les rentes et les pertes futures.`,
    payload,
    ...monolithique<BaremePer>(),
  };
}

export const REF_PER_FEMME_STAT = defPer(
  "bareme_femme_stationnaire_2025",
  "Barème PER 2025 — Femme, stationnaire",
  bFemmeStat as BaremePer,
);
export const REF_PER_FEMME_PROSP = defPer(
  "bareme_femme_prospectif_2025",
  "Barème PER 2025 — Femme, prospectif",
  bFemmeProsp as BaremePer,
);
export const REF_PER_HOMME_STAT = defPer(
  "bareme_homme_stationnaire_2025",
  "Barème PER 2025 — Homme, stationnaire",
  bHommeStat as BaremePer,
);
export const REF_PER_HOMME_PROSP = defPer(
  "bareme_homme_prospectif_2025",
  "Barème PER 2025 — Homme, prospectif",
  bHommeProsp as BaremePer,
);
export const REF_PER_INDET_STAT = defPer(
  "bareme_indetermine_stationnaire_2025",
  "Barème PER 2025 — Indéterminé, stationnaire",
  bIndetStat as BaremePer,
);
export const REF_PER_INDET_PROSP = defPer(
  "bareme_indetermine_prospectif_2025",
  "Barème PER 2025 — Indéterminé, prospectif",
  bIndetProsp as BaremePer,
);

/* -- AIPP (référentiel Mornet) --------------------------------------------- */

export interface AippPayload {
  meta: typeof AIPP_META;
  tranchesTaux: typeof AIPP_TRANCHES_TAUX;
  tranchesAge: typeof AIPP_TRANCHES_AGE;
  valeursPoint: number[][];
}

const AIPP_PAYLOAD: AippPayload = {
  meta: AIPP_META,
  tranchesTaux: AIPP_TRANCHES_TAUX,
  tranchesAge: AIPP_TRANCHES_AGE,
  valeursPoint: AIPP_VALEURS_POINT,
};

export const REF_AIPP: ReferentielDefinition<AippPayload> = {
  code: "bareme_aipp",
  libelle: "Valeur du point d'AIPP (référentiel Mornet)",
  kind: "monolithique",
  source: AIPP_META.source,
  description: `${AIPP_META.source} — édition ${AIPP_META.edition}.`,
  payload: AIPP_PAYLOAD,
  ...monolithique<AippPayload>(),
};

/* -- Référentiel Mornet (fourchettes) -------------------------------------- */

type ReferentielMornet = typeof REFERENTIEL;

export const REF_MORNET: ReferentielDefinition<ReferentielMornet> = {
  code: "referentiel_evaluation",
  libelle: "Fourchettes indicatives (référentiel Mornet)",
  kind: "monolithique",
  source: REFERENTIEL.nom,
  description: `${REFERENTIEL.nom} — édition ${REFERENTIEL.edition}.`,
  payload: REFERENTIEL as ReferentielMornet,
  ...monolithique<ReferentielMornet>(),
};

/* -------------------------------------------------------------------------- */
/*  Registre exposé                                                           */
/* -------------------------------------------------------------------------- */

export const REGISTRY: ReadonlyArray<ReferentielDefinition<unknown>> = [
  REF_TAUX_LEGAL,
  REF_INDICES,
  REF_MORTALITE_2020,
  REF_MORTALITE_2023,
  REF_PER_FEMME_STAT,
  REF_PER_FEMME_PROSP,
  REF_PER_HOMME_STAT,
  REF_PER_HOMME_PROSP,
  REF_PER_INDET_STAT,
  REF_PER_INDET_PROSP,
  REF_AIPP,
  REF_MORNET,
] as ReadonlyArray<ReferentielDefinition<unknown>>;

export function getDefinition(code: string): ReferentielDefinition<unknown> | undefined {
  return REGISTRY.find((r) => r.code === code);
}
