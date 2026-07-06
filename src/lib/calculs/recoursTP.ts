/**
 * Recours des tiers payeurs (art. L. 376-1 CSS, art. 31 loi 5 juillet 1985).
 *
 * Modélise la ventilation des créances TP par organisme et par poste, en
 * complément (et non en remplacement) des champs `tiersPayeur` figurant sur
 * chaque poste. Fournit également un contrôle de cohérence entre la somme
 * ventilée par poste et le TP retenu dans la synthèse.
 */

import type { CreanceTP, DossierData, OrganismeTP } from "./types";
import type { Synthese } from "./postes/synthese";

export interface RecoursCellule {
  echu: number;
  aEchoir: number;
  total: number;
}

export interface RecoursPosteAgg {
  code: string;
  libelle: string;
  totaux: RecoursCellule;
  tpSynthese: number;
  ecart: number;
}

export interface RecoursOrganismeAgg {
  organisme: OrganismeTP;
  parPoste: Record<string, RecoursCellule>;
  totaux: RecoursCellule;
}

export interface EcartCreance {
  posteCode: string;
  libelle: string;
  ventile: number;
  tpSynthese: number;
}

export interface RecoursTP {
  parOrganisme: RecoursOrganismeAgg[];
  parPoste: RecoursPosteAgg[];
  totalGeneral: RecoursCellule;
  ecarts: EcartCreance[];
}

function zero(): RecoursCellule {
  return { echu: 0, aEchoir: 0, total: 0 };
}

function add(a: RecoursCellule, echu: number, aEchoir: number): void {
  const e = isFinite(echu) ? echu : 0;
  const f = isFinite(aEchoir) ? aEchoir : 0;
  a.echu += e;
  a.aEchoir += f;
  a.total += e + f;
}

export function calculerRecoursTP(
  dossier: DossierData,
  synthese: Synthese,
): RecoursTP {
  const organismes: OrganismeTP[] = dossier.organismesTP || [];
  const creances: CreanceTP[] = dossier.creancesTP || [];

  // Index organisme
  const parOrganisme: RecoursOrganismeAgg[] = organismes.map((o) => ({
    organisme: o,
    parPoste: {},
    totaux: zero(),
  }));
  const mapOrg = new Map(parOrganisme.map((x) => [x.organisme.id, x]));

  // Agrégation par poste (tous organismes confondus)
  const parPosteMap = new Map<string, RecoursPosteAgg>();

  for (const c of creances) {
    const org = mapOrg.get(c.organismeId);
    if (org) {
      const cell = org.parPoste[c.posteCode] ?? zero();
      add(cell, c.montantEchu, c.montantAEchoir);
      org.parPoste[c.posteCode] = cell;
      add(org.totaux, c.montantEchu, c.montantAEchoir);
    }

    const ligneSynth = synthese.lignes.find((l) => l.code === c.posteCode);
    const libelle = ligneSynth?.poste || c.libelle || c.posteCode;
    const agg = parPosteMap.get(c.posteCode) ?? {
      code: c.posteCode,
      libelle,
      totaux: zero(),
      tpSynthese: ligneSynth?.tiersPayeur ?? 0,
      ecart: 0,
    };
    add(agg.totaux, c.montantEchu, c.montantAEchoir);
    parPosteMap.set(c.posteCode, agg);
  }

  const parPoste = Array.from(parPosteMap.values()).map((p) => ({
    ...p,
    ecart: p.totaux.total - p.tpSynthese,
  }));

  const totalGeneral = zero();
  for (const o of parOrganisme) {
    totalGeneral.echu += o.totaux.echu;
    totalGeneral.aEchoir += o.totaux.aEchoir;
    totalGeneral.total += o.totaux.total;
  }

  const ecarts: EcartCreance[] = parPoste
    .filter((p) => Math.abs(p.ecart) > 1)
    .map((p) => ({
      posteCode: p.code,
      libelle: p.libelle,
      ventile: p.totaux.total,
      tpSynthese: p.tpSynthese,
    }));

  return { parOrganisme, parPoste, totalGeneral, ecarts };
}
