import { describe, it, expect } from "vitest";
import {
  calculerLigneInterets,
  calculerDateExecutoire,
  phasesPourLigne,
  ajouterMois,
  defaultLigneInterets,
  TauxLegalManquantError,
  type LigneTauxLegal,
  type LigneInterets,
} from "@/lib/calculs/interets";
import { hydraterDossier } from "@/lib/calculs/hydratation";

// Fixture à taux constant 4 % sur 2015-2040.
const fixture4: LigneTauxLegal[] = [];
for (let y = 2015; y <= 2040; y++) {
  fixture4.push({ debut: `${y}-01-01`, fin: `${y}-06-30`, tauxParticulier: 4, tauxAutres: 4, reference: "F4" });
  fixture4.push({ debut: `${y}-07-01`, fin: `${y}-12-31`, tauxParticulier: 4, tauxAutres: 4, reference: "F4" });
}

// Fixture qui change au milieu : 4 % en 2020 S1, 8 % à partir de 2020 S2.
const fixtureChange: LigneTauxLegal[] = [];
for (let y = 2019; y <= 2027; y++) {
  fixtureChange.push({
    debut: `${y}-01-01`, fin: `${y}-06-30`,
    tauxParticulier: y >= 2020 && y > 2020 ? 8 : 4, tauxAutres: 4, reference: `S1-${y}`,
  });
  fixtureChange.push({
    debut: `${y}-07-01`, fin: `${y}-12-31`,
    tauxParticulier: y >= 2020 ? 8 : 4, tauxAutres: 4, reference: `S2-${y}`,
  });
}

function ligne(over: Partial<LigneInterets>): LigneInterets {
  return { ...defaultLigneInterets("test"), ...over };
}

function segAt(r: ReturnType<typeof calculerLigneInterets>, debut: string) {
  const s = r.segments.find((x) => x.debut === debut);
  if (!s) throw new Error(`Aucun segment au ${debut}. Segments: ${r.segments.map((x) => x.debut).join(", ")}`);
  return s;
}

describe("ajouterMois", () => {
  it("ajoute des mois calendaires en respectant les fins de mois", () => {
    expect(ajouterMois("2026-01-13", 2)).toBe("2026-03-13");
    expect(ajouterMois("2024-01-31", 1)).toBe("2024-02-29");
    expect(ajouterMois("2024-12-31", 2)).toBe("2025-02-28");
  });
});

describe("Exemple de référence L. 211-17 seul (décision 13/01/2026)", () => {
  const l = ligne({
    regime: "apres_decision",
    base: 100000,
    dateDebut: "2026-01-13",
    dateFin: "2026-12-31",
    dateDecision: "2026-01-13",
    l211_17Actif: true,
    l313_3Actif: false,
  });

  it("borne les phases au jour près : ×1 jusqu'au 12/03 inclus, ×1,5 du 13/03 au 12/05, ×2 depuis 13/05", () => {
    const phases = phasesPourLigne(l)!;
    const r = calculerLigneInterets({
      base: 100000, dateDebut: l.dateDebut!, dateFin: l.dateFin!,
      phases, anatocisme: false, dateAnatocisme: null,
      categorieCreancier: "particulier", taux: fixture4,
    });
    // Trois segments dans la même moitié de semestre + un semestriel
    // Vérifie que le segment ×1 finit bien au 12/03/2026 inclus.
    const seg1 = segAt(r, "2026-01-13");
    expect(seg1.multiplicateur).toBe(1);
    expect(seg1.majorationPoints).toBe(0);
    expect(seg1.fin).toBe("2026-03-12");
    const seg2 = segAt(r, "2026-03-13");
    expect(seg2.multiplicateur).toBe(1.5);
    expect(seg2.fin).toBe("2026-05-12");
    const seg3 = segAt(r, "2026-05-13");
    expect(seg3.multiplicateur).toBe(2);
  });
});

describe("Cumul L. 211-17 + L. 313-3 : formule (taux × mult) + majoration", () => {
  it("+5 en pleine phase ×1,5 → segments T1 / T1,5 / T1,5+5 / T2+5 avec (4×1,5)+5 = 11", () => {
    // Décision 01/01/2026 ; passage ×1,5 au 01/03/2026, ×2 au 01/05/2026.
    // Exécutoire 01/02/2026, +5 pts au 01/04/2026 (dans la phase ×1,5).
    const l = ligne({
      regime: "apres_decision",
      base: 100000,
      dateDebut: "2026-01-01",
      dateFin: "2026-12-31",
      dateDecision: "2026-01-01",
      dateExecutoire: "2026-02-01",
      dateExecutoireManuelle: true,
      l211_17Actif: true,
      l313_3Actif: true,
    });
    const phases = phasesPourLigne(l)!;
    const r = calculerLigneInterets({
      base: l.base, dateDebut: l.dateDebut!, dateFin: l.dateFin!,
      phases, anatocisme: false, dateAnatocisme: null,
      categorieCreancier: "particulier", taux: fixture4,
    });
    expect(segAt(r, "2026-01-01").tauxAnnuel).toBe(4);
    expect(segAt(r, "2026-03-01").tauxAnnuel).toBe(6); // 4×1,5
    const cum = segAt(r, "2026-04-01");
    expect(cum.multiplicateur).toBe(1.5);
    expect(cum.majorationPoints).toBe(5);
    expect(cum.tauxAnnuel).toBe(11); // (4×1,5)+5, JAMAIS (4+5)×1,5 = 13,5
    const cum2 = segAt(r, "2026-05-01");
    expect(cum2.tauxAnnuel).toBe(13); // (4×2)+5
  });

  it("+5 en phase ×2 → séquence T1 / T1,5 / T2 / T2+5", () => {
    const l = ligne({
      regime: "apres_decision",
      base: 100000,
      dateDebut: "2026-01-01",
      dateFin: "2026-12-31",
      dateDecision: "2026-01-01",
      dateExecutoire: "2026-05-01",
      dateExecutoireManuelle: true,
      l211_17Actif: true,
      l313_3Actif: true,
    });
    const phases = phasesPourLigne(l)!;
    const r = calculerLigneInterets({
      base: l.base, dateDebut: l.dateDebut!, dateFin: l.dateFin!,
      phases, anatocisme: false, dateAnatocisme: null,
      categorieCreancier: "particulier", taux: fixture4,
    });
    expect(segAt(r, "2026-01-01").tauxAnnuel).toBe(4);
    expect(segAt(r, "2026-03-01").tauxAnnuel).toBe(6);
    expect(segAt(r, "2026-05-01").tauxAnnuel).toBe(8);
    expect(segAt(r, "2026-07-01").tauxAnnuel).toBe(13); // (4×2)+5 après 01/07 = execut+2mo
  });

  it("+5 en phase ×1 (exécution provisoire) → T1 / T1+5 / T1,5+5 / T2+5", () => {
    // Exécutoire avant décision : +5 pts au 01/02/2026, avant même ×1,5 (01/03).
    const l = ligne({
      regime: "apres_decision",
      base: 100000,
      dateDebut: "2025-12-01",
      dateFin: "2026-12-31",
      dateDecision: "2026-01-01",
      dateExecutoire: "2025-12-01",
      dateExecutoireManuelle: true,
      l211_17Actif: true,
      l313_3Actif: true,
    });
    const phases = phasesPourLigne(l)!;
    const r = calculerLigneInterets({
      base: l.base, dateDebut: l.dateDebut!, dateFin: l.dateFin!,
      phases, anatocisme: false, dateAnatocisme: null,
      categorieCreancier: "particulier", taux: fixture4,
    });
    expect(segAt(r, "2025-12-01").tauxAnnuel).toBe(4);
    expect(segAt(r, "2026-02-01").tauxAnnuel).toBe(9);   // (4×1)+5
    expect(segAt(r, "2026-03-01").tauxAnnuel).toBe(11);  // (4×1,5)+5
    expect(segAt(r, "2026-05-01").tauxAnnuel).toBe(13);  // (4×2)+5
  });
});

describe("L. 313-3 seul", () => {
  it("aucune phase multipliée : T1 puis T1+5", () => {
    const l = ligne({
      regime: "apres_decision",
      base: 100000,
      dateDebut: "2026-01-01",
      dateFin: "2026-12-31",
      dateDecision: "2026-01-01",
      dateExecutoire: "2026-01-01",
      dateExecutoireManuelle: true,
      l211_17Actif: false,
      l313_3Actif: true,
    });
    const phases = phasesPourLigne(l)!;
    const r = calculerLigneInterets({
      base: l.base, dateDebut: l.dateDebut!, dateFin: l.dateFin!,
      phases, anatocisme: false, dateAnatocisme: null,
      categorieCreancier: "particulier", taux: fixture4,
    });
    expect(segAt(r, "2026-01-01").tauxAnnuel).toBe(4);
    expect(segAt(r, "2026-03-01").tauxAnnuel).toBe(9);
    // Aucun segment ne doit avoir un multiplicateur ≠ 1.
    expect(r.segments.every((s) => s.multiplicateur === 1)).toBe(true);
  });
});

describe("Assistant date exécutoire", () => {
  it("signification + 1 mois pré-calcule la date, la saisie manuelle prime", () => {
    expect(calculerDateExecutoire("2026-02-10", "1m")).toBe("2026-03-10");
    expect(calculerDateExecutoire("2026-02-10", "15j")).toBe("2026-02-25");
    expect(calculerDateExecutoire(null, "1m")).toBeNull();

    // Ligne avec assistant, puis surcharge manuelle.
    const l = ligne({
      regime: "apres_decision",
      base: 100000,
      dateDebut: "2026-01-01",
      dateFin: "2026-12-31",
      dateDecision: "2026-01-01",
      dateSignification: "2026-02-10",
      delaiRecours: "1m",
      dateExecutoire: null,
      dateExecutoireManuelle: false,
      l211_17Actif: false,
      l313_3Actif: true,
    });
    // Assistant → exécutoire = 10/03/2026, +5 pts au 10/05/2026.
    const p1 = phasesPourLigne(l)!;
    expect(p1.some((p) => p.aPartirDe === "2026-05-10" && p.majorationPoints === 5)).toBe(true);
    // Surcharge : la saisie manuelle prime.
    const l2 = { ...l, dateExecutoire: "2026-04-01", dateExecutoireManuelle: true };
    const p2 = phasesPourLigne(l2)!;
    expect(p2.some((p) => p.aPartirDe === "2026-06-01" && p.majorationPoints === 5)).toBe(true);
    expect(p2.some((p) => p.aPartirDe === "2026-05-10")).toBe(false);
  });
});

describe("Changement de taux légal au milieu d'une phase cumulée", () => {
  it("le segment est recoupé et la formule s'applique au nouveau taux", () => {
    // Phase (×1,5, +5) constante sur 2020 : taux 4 en S1 → segment (4×1,5)+5 = 11.
    // Taux passe à 8 le 01/07 → segment (8×1,5)+5 = 17.
    const r = calculerLigneInterets({
      base: 100000, dateDebut: "2020-01-01", dateFin: "2020-12-31",
      phases: [{ aPartirDe: "2020-01-01", multiplicateur: 1.5, majorationPoints: 5 }],
      anatocisme: false, dateAnatocisme: null,
      categorieCreancier: "particulier", taux: fixtureChange,
    });
    expect(segAt(r, "2020-01-01").tauxAnnuel).toBe(11);
    expect(segAt(r, "2020-07-01").tauxAnnuel).toBe(17);
  });
});

describe("Migration des anciens régimes", () => {
  it("« decision_5pts » → apres_decision avec L. 313-3 seul actif, même total", () => {
    const oldLine = {
      id: "L1", libelle: "", base: 100000,
      categorieCreancier: "particulier",
      regime: "decision_5pts",
      dateDebut: "2020-01-01", dateFin: "2020-12-31",
      anatocisme: false, dateAnatocisme: null,
      dateDecision: "2020-01-01",
      dateExecutoire: "2020-01-01",
      delaiMajorationMois: 2,
      delaiBadinter1Mois: 2,
      delaiBadinter2Mois: 4,
    };
    const hydrated = hydraterDossier({ lignesInterets: [oldLine] });
    const l = hydrated.lignesInterets[0];
    expect(l.regime).toBe("apres_decision");
    expect(l.l313_3Actif).toBe(true);
    expect(l.l211_17Actif).toBe(false);
    const phases = phasesPourLigne(l)!;
    const r = calculerLigneInterets({
      base: l.base, dateDebut: l.dateDebut!, dateFin: l.dateFin!,
      phases, anatocisme: false, dateAnatocisme: null,
      categorieCreancier: "particulier", taux: fixture4,
    });
    // Attendu : ~2 mois à 4 % (01/01→29/02) puis 10 mois à 9 %.
    expect(segAt(r, "2020-01-01").tauxAnnuel).toBe(4);
    expect(segAt(r, "2020-03-01").tauxAnnuel).toBe(9);
  });

  it("« badinter_apres » → apres_decision avec L. 211-17 seul actif, même total", () => {
    const oldLine = {
      id: "L2", libelle: "", base: 100000,
      categorieCreancier: "particulier",
      regime: "badinter_apres",
      dateDebut: "2020-01-01", dateFin: "2020-12-31",
      anatocisme: false, dateAnatocisme: null,
      dateDecision: "2020-01-01",
      delaiBadinter1Mois: 2,
      delaiBadinter2Mois: 4,
      delaiMajorationMois: 2,
    };
    const hydrated = hydraterDossier({ lignesInterets: [oldLine] });
    const l = hydrated.lignesInterets[0];
    expect(l.regime).toBe("apres_decision");
    expect(l.l211_17Actif).toBe(true);
    expect(l.l313_3Actif).toBe(false);
    const phases = phasesPourLigne(l)!;
    const r = calculerLigneInterets({
      base: l.base, dateDebut: l.dateDebut!, dateFin: l.dateFin!,
      phases, anatocisme: false, dateAnatocisme: null,
      categorieCreancier: "particulier", taux: fixture4,
    });
    expect(segAt(r, "2020-01-01").tauxAnnuel).toBe(4);
    expect(segAt(r, "2020-03-01").tauxAnnuel).toBe(6);
    expect(segAt(r, "2020-05-01").tauxAnnuel).toBe(8);
  });
});

describe("Capitalisation sur apres_decision (majoration incluse)", () => {
  it("incorpore les intérêts (avec la part majorée) à la base l'année suivante", () => {
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
    const segAn2 = segAt(r, "2021-01-01");
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
