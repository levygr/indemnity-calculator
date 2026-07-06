import { describe, it, expect } from "vitest";
import {
  buildContexte,
  calculerATPPerm,
  calculerDSFRecurrentes,
  calculerEchus,
  calculerPGPF,
  perViager,
} from "@/lib/calculs";

function ctxWith(dateConsolidation: string, dateLiquidation: string) {
  return buildContexte({
    dateNaissance: "1995-01-01",
    dateConsolidation,
    dateLiquidation,
    bareme: "prospectif",
    sexe: "M",
    methodeRente: "habituelle",
    tableMortalite: "2023-2025",
    tauxAIPP: 20,
  });
}

describe("calculerEchus", () => {
  it("2 ans entre consolidation et liquidation → fraction ≈ 2", () => {
    const e = calculerEchus(10000, 4000, "2023-01-01", "2025-01-01");
    expect(e.fractionAnnees).toBeCloseTo(2, 2);
    expect(e.montant).toBeCloseTo(20000, 0);
    expect(e.tp).toBeCloseTo(8000, 0);
    expect(e.reste).toBeCloseTo(12000, 0);
  });

  it("dates égales → tout à 0", () => {
    const e = calculerEchus(10000, 1000, "2025-01-01", "2025-01-01");
    expect(e.fractionAnnees).toBe(0);
    expect(e.montant).toBe(0);
  });

  it("dates manquantes → tout à 0", () => {
    const e = calculerEchus(10000, 0, null, "2025-01-01");
    expect(e.montant).toBe(0);
  });
});

describe("ATP permanente : échus + à échoir", () => {
  it("total = échus + capital à échoir", () => {
    const ctx = ctxWith("2023-01-01", "2025-01-01");
    const r = calculerATPPerm(
      { heuresParJour: 4, tauxHoraire: 20, facteurJours: 412, capitalisation: "viager", ageFin: null, tiersPayeur: 0 },
      ctx,
    );
    expect(r.echus.fractionAnnees).toBeCloseTo(2, 2);
    expect(r.total.montant).toBeCloseTo(r.echus.montant + r.aEchoir.capital, 6);
    expect(r.capital).toBeCloseTo(r.total.montant, 6);
  });

  it("dates égales : échus nul, capital = à échoir seul", () => {
    const ctx = ctxWith("2025-01-01", "2025-01-01");
    const r = calculerATPPerm(
      { heuresParJour: 4, tauxHoraire: 20, facteurJours: 412, capitalisation: "viager", ageFin: null, tiersPayeur: 0 },
      ctx,
    );
    expect(r.echus.montant).toBe(0);
    expect(r.capital).toBeCloseTo(r.aEchoir.capital, 6);
  });
});

describe("PGPF : pas d'échus si différée future", () => {
  it("rente différée à un âge postérieur : échus = 0", () => {
    const ctx = ctxWith("2023-01-01", "2025-01-01"); // liquidation à 30 ans
    const r = calculerPGPF(
      { renteAnnuelle: 20000, capitalisation: "differee", ageDebut: 62, ageFin: null, tiersPayeur: 0 },
      ctx,
    );
    expect(r.echus.montant).toBe(0);
    expect(r.capital).toBeCloseTo(r.aEchoir.capital, 6);
  });

  it("rente viagère : échus > 0 sur 2 ans", () => {
    const ctx = ctxWith("2023-01-01", "2025-01-01");
    const r = calculerPGPF(
      { renteAnnuelle: 20000, capitalisation: "viager", ageDebut: null, ageFin: null, tiersPayeur: 0 },
      ctx,
    );
    expect(r.echus.montant).toBeCloseTo(40000, 0);
    expect(r.capital).toBeCloseTo(20000 * perViager(30, "prospectif", "M") + r.echus.montant, 3);
  });
});

describe("DSF récurrentes : échus par ligne", () => {
  it("annualise et applique la fraction d'années échues", () => {
    const ctx = ctxWith("2023-01-01", "2025-01-01");
    const r = calculerDSFRecurrentes(
      [{ id: "x", libelle: "kiné", montant: 100, periodicite: "mois", tiersPayeur: 0, capitalisation: "viager", ageFin: null }],
      ctx,
    );
    expect(r.totalEchus.montant).toBeCloseTo(1200 * 2, 0);
    expect(r.totalDette).toBeCloseTo(r.totalAEchoir.montant + r.totalEchus.montant, 3);
  });
});
