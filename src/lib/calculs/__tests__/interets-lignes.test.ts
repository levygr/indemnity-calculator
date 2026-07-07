import { describe, it, expect } from "vitest";
import {
  calculerLigneInterets,
  phasesPourLigne,
  ajouterMois,
  defaultLigneInterets,
  TauxLegalManquantError,
  type LigneTauxLegal,
  type LigneInterets,
} from "@/lib/calculs/interets";

// Fixture à taux constant 4 % sur 2015-2040.
const fixture4: LigneTauxLegal[] = [];
for (let y = 2015; y <= 2040; y++) {
  fixture4.push({ debut: `${y}-01-01`, fin: `${y}-06-30`, tauxParticulier: 4, tauxAutres: 4, reference: "F4" });
  fixture4.push({ debut: `${y}-07-01`, fin: `${y}-12-31`, tauxParticulier: 4, tauxAutres: 4, reference: "F4" });
}

// Fixture qui change au milieu : 4 % en 2020 S1, 8 % à partir de 2020 S2.
const fixtureChange: LigneTauxLegal[] = [];
for (let y = 2019; y <= 2025; y++) {
  fixtureChange.push({ debut: `${y}-01-01`, fin: `${y}-06-30`, tauxParticulier: y >= 2020 && y > 2020 ? 8 : 4, tauxAutres: 4, reference: `S1-${y}` });
  fixtureChange.push({ debut: `${y}-07-01`, fin: `${y}-12-31`, tauxParticulier: y >= 2020 ? 8 : 4, tauxAutres: 4, reference: `S2-${y}` });
}

function ligne(over: Partial<LigneInterets>): LigneInterets {
  return { ...defaultLigneInterets("test"), ...over };
}

describe("ajouterMois", () => {
  it("ajoute 2 mois en respectant les fins de mois", () => {
    expect(ajouterMois("2024-01-15", 2)).toBe("2024-03-15");
    expect(ajouterMois("2024-01-31", 1)).toBe("2024-02-29"); // clamp
    expect(ajouterMois("2024-12-31", 2)).toBe("2025-02-28");
  });
});

describe("Régime decision_5pts : majoration ADDITIVE de 5 points", () => {
  it("4 % avant bascule, 9 % après (pas 4×5)", () => {
    const l = ligne({
      regime: "decision_5pts",
      base: 100000,
      dateDebut: "2020-01-01",
      dateFin: "2020-12-31",
      dateDecision: "2020-01-01",
      dateExecutoire: "2020-01-01",
      delaiMajorationMois: 2,
    });
    const phases = phasesPourLigne(l)!;
    const r = calculerLigneInterets({
      base: l.base,
      dateDebut: l.dateDebut!,
      dateFin: l.dateFin!,
      phases,
      anatocisme: false,
      dateAnatocisme: null,
      categorieCreancier: "particulier",
      taux: fixture4,
    });
    const seg1 = r.segments.find((s) => s.debut === "2020-01-01")!;
    expect(seg1.tauxAnnuel).toBe(4);
    const segAvril = r.segments.find((s) => s.debut === "2020-03-01")!;
    expect(segAvril.tauxAnnuel).toBe(9);
    expect(segAvril.multiplicateur).toBe(1);
    expect(segAvril.majorationPoints).toBe(5);
  });
});

describe("Régime badinter_apres : trois phases ×1, ×1,5, ×2", () => {
  it("applique les bons multiplicateurs aux bonnes dates", () => {
    const l = ligne({
      regime: "badinter_apres",
      base: 100000,
      dateDebut: "2020-01-01",
      dateFin: "2020-12-31",
      dateDecision: "2020-01-01",
      delaiBadinter1Mois: 2,
      delaiBadinter2Mois: 4,
    });
    const phases = phasesPourLigne(l)!;
    const r = calculerLigneInterets({
      base: 100000, dateDebut: "2020-01-01", dateFin: "2020-12-31",
      phases, anatocisme: false, dateAnatocisme: null,
      categorieCreancier: "particulier", taux: fixture4,
    });
    expect(r.segments.find((s) => s.debut === "2020-01-01")!.tauxAnnuel).toBe(4);
    expect(r.segments.find((s) => s.debut === "2020-03-01")!.tauxAnnuel).toBe(6);
    expect(r.segments.find((s) => s.debut === "2020-05-01")!.tauxAnnuel).toBe(8);
  });
});

describe("Découpage semestriel dans une phase majorée", () => {
  it("le multiplicateur suit le nouveau taux légal après changement", () => {
    // Phase unique ×1,5 sur toute la période, mais taux passe de 4 à 8 le 2020-07-01.
    const r = calculerLigneInterets({
      base: 100000, dateDebut: "2020-01-01", dateFin: "2020-12-31",
      phases: [{ aPartirDe: "2020-01-01", multiplicateur: 1.5, majorationPoints: 0 }],
      anatocisme: false, dateAnatocisme: null,
      categorieCreancier: "particulier", taux: fixtureChange,
    });
    const s1 = r.segments.find((s) => s.debut === "2020-01-01")!;
    const s2 = r.segments.find((s) => s.debut === "2020-07-01")!;
    expect(s1.tauxAnnuel).toBe(6); // 4×1,5
    expect(s2.tauxAnnuel).toBe(12); // 8×1,5
  });
});

describe("Capitalisation sur régime decision_5pts (majoration incluse)", () => {
  it("incorpore les intérêts (avec la part majorée) à la base l'année suivante", () => {
    // 100 000 € du 2020-01-01 au 2021-12-31 ; bascule +5 pts au 2020-03-01.
    // Année 1 : ~2 mois à 4 % + ~10 mois à 9 % ≈ base 100 000 × moyenne.
    // Capitalisation le 2021-01-01 → base année 2 = base + intérêts année 1.
    const r = calculerLigneInterets({
      base: 100000, dateDebut: "2020-01-01", dateFin: "2021-12-31",
      phases: [
        { aPartirDe: "2020-01-01", multiplicateur: 1, majorationPoints: 0 },
        { aPartirDe: "2020-03-01", multiplicateur: 1, majorationPoints: 5 },
      ],
      anatocisme: true, dateAnatocisme: "2020-01-01",
      categorieCreancier: "particulier", taux: fixture4,
    });
    expect(r.capitalisations).toHaveLength(1);
    const inteAn1 = r.capitalisations[0].interetsIncorpores;
    const segsAn1 = r.segments.filter((s) => s.debut < "2021-01-01");
    const sommeAn1 = segsAn1.reduce((a, s) => a + s.interets, 0);
    expect(inteAn1).toBeCloseTo(sommeAn1, 6);
    // Base année 2 = 100 000 + intérêts année 1
    const segAn2 = r.segments.find((s) => s.debut === "2021-01-01")!;
    expect(segAn2.base).toBeCloseTo(100000 + inteAn1, 6);
  });
});

describe("Taux manquant sur une phase", () => {
  it("lève TauxLegalManquantError si un segment traverse un taux null", () => {
    const trouee: LigneTauxLegal[] = [
      { debut: "2020-01-01", fin: "2020-06-30", tauxParticulier: null, tauxAutres: null, reference: null },
      { debut: "2020-07-01", fin: "2020-12-31", tauxParticulier: 3, tauxAutres: 3, reference: "ok" },
    ];
    expect(() =>
      calculerLigneInterets({
        base: 100000, dateDebut: "2020-01-01", dateFin: "2020-12-31",
        phases: [{ aPartirDe: "2020-01-01", multiplicateur: 1, majorationPoints: 0 }],
        anatocisme: false, dateAnatocisme: null,
        categorieCreancier: "particulier", taux: trouee,
      }),
    ).toThrow(TauxLegalManquantError);
  });
});
