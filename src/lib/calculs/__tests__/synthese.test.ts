import { describe, it, expect } from "vitest";
import {
  calculerSynthese,
  defaultDossierData,
  perViager,
} from "@/lib/calculs";

describe("Synthèse", () => {
  it("dossier vide : tous totaux à 0", () => {
    const s = calculerSynthese(defaultDossierData());
    expect(s.totalMontant).toBe(0);
    expect(s.totalDette).toBe(0);
    expect(s.totalVictime).toBe(0);
  });

  it("applique fFaute × fChance sur la dette", () => {
    const d = defaultDossierData();
    d.postesTemp.se.montant = 10000;
    d.fFaute = 0.5;
    d.fChance = 0.8;
    const s = calculerSynthese(d);
    const se = s.lignes.find((l) => l.code === "SE")!;
    expect(se.montant).toBe(10000);
    expect(se.dette).toBeCloseTo(10000 * 0.5 * 0.8, 3);
    expect(se.partVictime).toBeCloseTo(4000, 3);
  });

  it("droit de préférence : victime servie avant TP", () => {
    const d = defaultDossierData();
    d.dateNaissance = "1995-01-01";
    d.dateLiquidation = "2025-01-01";
    d.bareme = "prospectif";
    d.sexe = "M";
    d.postesPerm.pgpf = { renteAnnuelle: 20000, capitalisation: "viager", ageDebut: null, ageFin: null, tiersPayeur: 5000 };
    d.fFaute = 1; d.fChance = 1;
    const s = calculerSynthese(d);
    const pgpf = s.lignes.find((l) => l.code === "PGPF")!;
    const per = perViager(30, "prospectif", "M");
    expect(pgpf.montant).toBeCloseTo(20000 * per, 3);
    expect(pgpf.tiersPayeur).toBeCloseTo(5000 * per, 3);
    expect(pgpf.partVictime).toBeCloseTo(15000 * per, 3);
    expect(pgpf.partTP).toBeCloseTo(5000 * per, 3);
  });

  it("sous-totaux par catégorie cohérents avec les lignes", () => {
    const d = defaultDossierData();
    d.postesTemp.se.montant = 5000;
    d.postesTemp.pet.montant = 2000;
    d.postesPerm.agrement.montant = 8000;
    const s = calculerSynthese(d);
    const ept = s.sousTotaux.find((x) => x.categorie === "EPT")!;
    const epp = s.sousTotaux.find((x) => x.categorie === "EPP")!;
    expect(ept.montant).toBe(7000);
    expect(epp.montant).toBe(8000);
    expect(s.totalMontant).toBe(15000);
  });
});

describe("Provisions", () => {
  it("totalProvisions = somme et soldeVictime = totalVictime − totalProvisions", () => {
    const d = defaultDossierData();
    d.postesTemp.se.montant = 10000;
    d.provisions = [
      { id: "1", date: "2024-06-01", montant: 3000, debiteur: "Assureur" },
      { id: "2", date: "2024-12-01", montant: 2000, debiteur: "FGAO" },
    ];
    const s = calculerSynthese(d);
    expect(s.totalProvisions).toBe(5000);
    expect(s.soldeVictime).toBeCloseTo(s.totalVictime - 5000, 6);
    expect(s.avertissements.some((a) => a.code === "PROVISIONS_SUPERIEURES")).toBe(false);
  });

  it("avertissement PROVISIONS_SUPERIEURES si provisions > part victime", () => {
    const d = defaultDossierData();
    d.postesTemp.se.montant = 1000;
    d.provisions = [{ id: "1", date: "2024-06-01", montant: 5000, debiteur: "Assureur" }];
    const s = calculerSynthese(d);
    expect(s.soldeVictime).toBeLessThan(0);
    expect(s.avertissements.some((a) => a.code === "PROVISIONS_SUPERIEURES")).toBe(true);
  });

  it("montants négatifs ou invalides ignorés", () => {
    const d = defaultDossierData();
    d.provisions = [
      { id: "1", date: null, montant: -100, debiteur: "" },
      { id: "2", date: null, montant: 500, debiteur: "" },
    ];
    const s = calculerSynthese(d);
    expect(s.totalProvisions).toBe(500);
  });
});
