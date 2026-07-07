import { describe, it, expect } from "vitest";
import {
  calculerInterets,
  TauxLegalManquantError,
  type LigneTauxLegal,
} from "@/lib/calculs/interets";
import tauxData from "@/data/taux_legal.json";

// Fixture à taux constant 5 % sur toute la période 2015-2030 (non seedée
// avec des valeurs réelles : sert uniquement de support arithmétique).
const fixtureConstante5: LigneTauxLegal[] = [];
for (let y = 2015; y <= 2030; y++) {
  fixtureConstante5.push({
    debut: `${y}-01-01`,
    fin: `${y}-06-30`,
    tauxParticulier: 5,
    tauxAutres: 5,
    reference: "Fixture 5%",
  });
  fixtureConstante5.push({
    debut: `${y}-07-01`,
    fin: `${y}-12-31`,
    tauxParticulier: 5,
    tauxAutres: 5,
    reference: "Fixture 5%",
  });
}

const fixtureChevauchante: LigneTauxLegal[] = [
  {
    debut: "2017-01-01",
    fin: "2017-06-30",
    tauxParticulier: 4,
    tauxAutres: 4,
    reference: "Fixture S1",
  },
  {
    debut: "2017-07-01",
    fin: "2017-12-31",
    tauxParticulier: 6,
    tauxAutres: 6,
    reference: "Fixture S2",
  },
];

const fixtureTrouee: LigneTauxLegal[] = [
  {
    debut: "2015-01-01",
    fin: "2015-06-30",
    tauxParticulier: null,
    tauxAutres: null,
    reference: null,
  },
  {
    debut: "2015-07-01",
    fin: "2015-12-31",
    tauxParticulier: 3,
    tauxAutres: 3,
    reference: "Fixture partielle",
  },
];

describe("calculerInterets — cas simples", () => {
  it("100 000 € sur un an à 5 % = 5 000 € sans doublement", () => {
    const r = calculerInterets({
      base: 100000,
      dateDebut: "2017-01-01",
      dateFin: "2017-12-31",
      doublement: false,
      anatocisme: false,
      dateAnatocisme: null,
      categorieCreancier: "particulier",
      taux: fixtureConstante5,
    });
    expect(r.totalInterets).toBeCloseTo(5000, 6);
  });

  it("100 000 € sur un an à 5 % = 10 000 € avec doublement", () => {
    const r = calculerInterets({
      base: 100000,
      dateDebut: "2017-01-01",
      dateFin: "2017-12-31",
      doublement: true,
      anatocisme: false,
      dateAnatocisme: null,
      categorieCreancier: "particulier",
      taux: fixtureConstante5,
    });
    expect(r.totalInterets).toBeCloseTo(10000, 6);
  });

  it("prorate correctement deux semestres à taux différents", () => {
    const r = calculerInterets({
      base: 100000,
      dateDebut: "2017-01-01",
      dateFin: "2017-12-31",
      doublement: false,
      anatocisme: false,
      dateAnatocisme: null,
      categorieCreancier: "particulier",
      taux: fixtureChevauchante,
    });
    // 181 jours S1 à 4 % + 184 jours S2 à 6 %
    const attendu = (100000 * 4 * 181) / 100 / 365 + (100000 * 6 * 184) / 100 / 365;
    expect(r.totalInterets).toBeCloseTo(attendu, 6);
    expect(r.segments).toHaveLength(2);
  });
});

describe("calculerInterets — taux manquant", () => {
  it("retourne une erreur explicite si un segment traverse un taux null", () => {
    expect(() =>
      calculerInterets({
        base: 100000,
        dateDebut: "2015-01-01",
        dateFin: "2015-12-31",
        doublement: false,
        anatocisme: false,
        dateAnatocisme: null,
        categorieCreancier: "particulier",
        taux: fixtureTrouee,
      }),
    ).toThrow(TauxLegalManquantError);
  });
});

describe("calculerInterets — anatocisme", () => {
  it("les intérêts de l'année 1 sont incorporés à la base de l'année 2", () => {
    const r = calculerInterets({
      base: 100000,
      dateDebut: "2017-01-01",
      dateFin: "2018-12-31",
      doublement: false,
      anatocisme: true,
      dateAnatocisme: "2017-01-01",
      categorieCreancier: "particulier",
      taux: fixtureConstante5,
    });
    // Année 1 : 5 000 € puis capitalisation le 2018-01-01
    // Année 2 : base 105 000 × 5 % = 5 250 €
    expect(r.capitalisations).toHaveLength(1);
    expect(r.capitalisations[0].date).toBe("2018-01-01");
    expect(r.capitalisations[0].interetsIncorpores).toBeCloseTo(5000, 6);
    expect(r.totalInterets).toBeCloseTo(5000 + 5250, 6);
  });

  it("aucune capitalisation avant un an révolu", () => {
    const r = calculerInterets({
      base: 100000,
      dateDebut: "2017-01-01",
      dateFin: "2017-11-30",
      doublement: false,
      anatocisme: true,
      dateAnatocisme: "2017-01-01",
      categorieCreancier: "particulier",
      taux: fixtureConstante5,
    });
    expect(r.capitalisations).toHaveLength(0);
  });
});

describe("calculerInterets — catégorie de créancier (seed officiel S2 2026)", () => {
  const tauxSeed = tauxData.taux as LigneTauxLegal[];

  it("particulier applique 6,84 % sur S2 2026", () => {
    const r = calculerInterets({
      base: 100000,
      dateDebut: "2026-07-01",
      dateFin: "2026-12-31",
      doublement: false,
      anatocisme: false,
      dateAnatocisme: null,
      categorieCreancier: "particulier",
      taux: tauxSeed,
    });
    expect(r.segments[0].tauxAnnuel).toBe(6.84);
  });

  it("autres applique 2,75 % sur S2 2026", () => {
    const r = calculerInterets({
      base: 100000,
      dateDebut: "2026-07-01",
      dateFin: "2026-12-31",
      doublement: false,
      anatocisme: false,
      dateAnatocisme: null,
      categorieCreancier: "autres",
      taux: tauxSeed,
    });
    expect(r.segments[0].tauxAnnuel).toBe(2.75);
  });
});
