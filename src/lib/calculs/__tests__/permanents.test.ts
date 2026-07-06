import { describe, it, expect } from "vitest";
import {
  buildContexte,
  calculerATPPerm,
  calculerDFP,
  calculerDSFRecurrentes,
  calculerIP,
  calculerPGPF,
  defaultPostesPermanents,
  perViager,
  perTemporaire,
  perRenteDifferee,
} from "@/lib/calculs";

// Contexte type : homme, 30 ans à la liquidation, prospectif.
const ctxProsp30M = buildContexte({
  dateNaissance: "1995-01-01",
  dateConsolidation: "2025-01-01",
  dateLiquidation: "2025-01-01",
  bareme: "prospectif",
  sexe: "M",
  methodeRente: "habituelle",
  tableMortalite: "2023-2025",
  tauxAIPP: 20,
});

describe("Permanents — capitalisation", () => {
  it("PER viager H30 prospectif = 51.328 (contrôle JSON)", () => {
    expect(perViager(30, "prospectif", "M")).toBeCloseTo(51.328, 3);
  });

  it("PER viager F30 prospectif = 47.919 (contrôle JSON)", () => {
    expect(perViager(30, "prospectif", "F")).toBeCloseTo(47.919, 3);
  });

  it("PER temporaire : fin > 90 en prospectif retombe sur viager", () => {
    const t = perTemporaire(30, 95, "prospectif", "M");
    expect(t).toBeCloseTo(perViager(30, "prospectif", "M"), 6);
  });

  it("PER différée habituelle = PER viager au début de rente", () => {
    const d = perRenteDifferee(30, 62, "prospectif", "M", "habituelle");
    expect(d).toBeCloseTo(perViager(62, "prospectif", "M"), 6);
  });

  it("PER différée exacte = viager(liq) − temporaire(liq→début)", () => {
    const d = perRenteDifferee(30, 62, "prospectif", "M", "exacte");
    const attendu = perViager(30, "prospectif", "M") - perTemporaire(30, 62, "prospectif", "M");
    expect(d).toBeCloseTo(attendu, 6);
  });
});

describe("PGPF", () => {
  it("PGPF viager : capital = rente × PER viager", () => {
    const p = calculerPGPF({ renteAnnuelle: 20000, capitalisation: "viager", ageDebut: null, ageFin: null, tiersPayeur: 0 }, ctxProsp30M);
    expect(p.capital).toBeCloseTo(20000 * perViager(30, "prospectif", "M"), 3);
  });

  it("PGPF ignore rente <= 0", () => {
    const p = calculerPGPF({ renteAnnuelle: 0, capitalisation: "viager", ageDebut: null, ageFin: null, tiersPayeur: 0 }, ctxProsp30M);
    expect(p.capital).toBe(0);
  });

  it("PGPF temporaire avec ageFin manquant → 0", () => {
    const p = calculerPGPF({ renteAnnuelle: 10000, capitalisation: "temporaire", ageDebut: null, ageFin: null, tiersPayeur: 0 }, ctxProsp30M);
    expect(p.per).toBe(0);
    expect(p.capital).toBe(0);
  });

  it("PGPF applique droit de préférence : reste = capital − capitalTP", () => {
    const p = calculerPGPF({ renteAnnuelle: 20000, capitalisation: "viager", ageDebut: null, ageFin: null, tiersPayeur: 5000 }, ctxProsp30M);
    const per = perViager(30, "prospectif", "M");
    expect(p.capitalTP).toBeCloseTo(5000 * per, 3);
    expect(p.reste).toBeCloseTo(20000 * per - 5000 * per, 3);
  });
});

describe("ATP perm et DSF", () => {
  it("ATP perm : rente = taux × h/j × facteur ; capital = rente × PER", () => {
    const a = calculerATPPerm({ heuresParJour: 4, tauxHoraire: 20, facteurJours: 412, capitalisation: "viager", ageFin: null, tiersPayeur: 0 }, ctxProsp30M);
    expect(a.renteAnnuelle).toBeCloseTo(20 * 4 * 412, 3);
    expect(a.capital).toBeCloseTo(a.renteAnnuelle * perViager(30, "prospectif", "M"), 3);
  });

  it("DSF récurrente annualise puis capitalise", () => {
    const r = calculerDSFRecurrentes(
      [{ id: "x", libelle: "kiné", montant: 100, periodicite: "mois", tiersPayeur: 0, capitalisation: "viager", ageFin: null }],
      ctxProsp30M,
    );
    expect(r.lignes[0].renteAnnuelle).toBeCloseTo(1200, 3);
    expect(r.totalDette).toBeCloseTo(1200 * perViager(30, "prospectif", "M"), 3);
  });
});

describe("DFP", () => {
  it("DFP au point : montant = valeur point × taux", () => {
    const r = calculerDFP({ methode: "point", valeurPointCustom: null, montantCapitalise: 0 }, ctxProsp30M);
    // Taux 20 → tranche 16-20 (i=3), âge 30 → tranche 21-30 (j=2), valeur = 2560
    expect(r.valeurPoint).toBe(2560);
    expect(r.montant).toBe(2560 * 20);
  });

  it("DFP capitalisé : renvoie le montant saisi", () => {
    const r = calculerDFP({ methode: "capitalise", valeurPointCustom: null, montantCapitalise: 45000 }, ctxProsp30M);
    expect(r.montant).toBe(45000);
  });

  it("DFP au point avec valeur custom prioritaire", () => {
    const r = calculerDFP({ methode: "point", valeurPointCustom: 3000, montantCapitalise: 0 }, ctxProsp30M);
    expect(r.valeurPoint).toBe(3000);
    expect(r.montant).toBe(60000);
  });
});

describe("IP", () => {
  it("IP forfait seul", () => {
    const r = calculerIP({ forfait: 15000, perteRetraiteRente: 0, perteRetraiteAgeDebut: null, perteRetraiteTP: 0 }, ctxProsp30M);
    expect(r.total).toBe(15000);
    expect(r.retraite.capital).toBe(0);
  });

  it("IP perte de retraite : rente différée à 62 ans", () => {
    const r = calculerIP({ forfait: 0, perteRetraiteRente: 5000, perteRetraiteAgeDebut: 62, perteRetraiteTP: 0 }, ctxProsp30M);
    expect(r.retraite.per).toBeCloseTo(perViager(62, "prospectif", "M"), 6);
    expect(r.retraite.capital).toBeCloseTo(5000 * perViager(62, "prospectif", "M"), 3);
  });
});

describe("defaults", () => {
  it("defaultPostesPermanents ne contient aucun NaN et aucune ligne", () => {
    const d = defaultPostesPermanents();
    expect(d.dsfPonctuelles).toHaveLength(0);
    expect(d.dsfRecurrentes).toHaveLength(0);
    expect(d.logement).toHaveLength(0);
    expect(d.dfp.methode).toBe("point");
  });
});
