import { describe, it, expect } from "vitest";
import {
  calculerLigneInterets,
  phasesPourLigne,
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

function ligne(over: Partial<LigneInterets>): LigneInterets {
  return { ...defaultLigneInterets("test"), ...over };
}

function segAt(r: ReturnType<typeof calculerLigneInterets>, debut: string) {
  const s = r.segments.find((x) => x.debut === debut);
  if (!s) throw new Error(`Aucun segment au ${debut}. Segments: ${r.segments.map((x) => x.debut).join(", ")}`);
  return s;
}

describe("phasesPourLigne — régimes avant jugement", () => {
  it("taux_legal → une phase ×1 sans majoration", () => {
    const l = ligne({ regime: "taux_legal", dateDebut: "2020-01-01", dateFin: "2020-12-31" });
    const phases = phasesPourLigne(l)!;
    expect(phases).toHaveLength(1);
    expect(phases[0].multiplicateur).toBe(1);
    expect(phases[0].majorationPoints).toBe(0);
  });

  it("badinter_avant → une phase ×2 sans majoration", () => {
    const l = ligne({ regime: "badinter_avant", dateDebut: "2020-01-01", dateFin: "2020-12-31" });
    const phases = phasesPourLigne(l)!;
    expect(phases).toHaveLength(1);
    expect(phases[0].multiplicateur).toBe(2);
    expect(phases[0].majorationPoints).toBe(0);
  });

  it("sans dateDebut → null", () => {
    expect(phasesPourLigne(ligne({ dateDebut: null }))).toBeNull();
  });
});

describe("Calcul avant jugement", () => {
  it("doublement Badinter sur une année complète à 4 % = 8 000 € sur 100 000 €", () => {
    const l = ligne({
      regime: "badinter_avant",
      base: 100000,
      dateDebut: "2020-01-01",
      dateFin: "2020-12-31",
    });
    const r = calculerLigneInterets({
      base: l.base, dateDebut: l.dateDebut!, dateFin: l.dateFin!,
      phases: phasesPourLigne(l)!,
      anatocisme: false, dateAnatocisme: null,
      categorieCreancier: "particulier", taux: fixture4,
    });
    expect(segAt(r, "2020-01-01").tauxAnnuel).toBe(8);
    expect(r.totalInterets).toBeCloseTo(8000, 6);
  });
});

describe("Migration des anciens régimes post-jugement", () => {
  it("« decision_5pts » → taux_legal, champs post-jugement purgés", () => {
    const oldLine = {
      id: "L1", libelle: "", base: 100000,
      categorieCreancier: "particulier",
      regime: "decision_5pts",
      dateDebut: "2020-01-01", dateFin: "2020-12-31",
      anatocisme: false, dateAnatocisme: null,
      dateDecision: "2020-01-01",
      dateExecutoire: "2020-01-01",
      delaiMajorationMois: 2,
    };
    const hydrated = hydraterDossier({ lignesInterets: [oldLine] });
    const l = hydrated.lignesInterets[0] as LigneInterets & Record<string, unknown>;
    expect(l.regime).toBe("taux_legal");
    // Champs post-jugement absents du modèle unifié
    expect(l.dateDecision).toBeUndefined();
    expect(l.dateExecutoire).toBeUndefined();
    expect(l.delaiMajorationMois).toBeUndefined();
    expect(l.l211_17Actif).toBeUndefined();
    expect(l.l313_3Actif).toBeUndefined();
  });

  it("« badinter_apres » et « apres_decision » retombent aussi sur taux_legal", () => {
    const hydrated = hydraterDossier({
      lignesInterets: [
        { id: "A", regime: "badinter_apres", base: 1000, dateDebut: "2020-01-01", dateFin: "2020-12-31" },
        { id: "B", regime: "apres_decision", base: 1000, dateDebut: "2020-01-01", dateFin: "2020-12-31" },
      ],
    });
    expect(hydrated.lignesInterets[0].regime).toBe("taux_legal");
    expect(hydrated.lignesInterets[1].regime).toBe("taux_legal");
  });

  it("les lignes taux_legal et badinter_avant existantes sont préservées", () => {
    const hydrated = hydraterDossier({
      lignesInterets: [
        { id: "A", regime: "taux_legal", base: 1000, dateDebut: "2020-01-01", dateFin: "2020-12-31" },
        { id: "B", regime: "badinter_avant", base: 2000, dateDebut: "2019-01-01", dateFin: "2019-12-31" },
      ],
    });
    expect(hydrated.lignesInterets[0].regime).toBe("taux_legal");
    expect(hydrated.lignesInterets[1].regime).toBe("badinter_avant");
    expect(hydrated.lignesInterets[1].base).toBe(2000);
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
