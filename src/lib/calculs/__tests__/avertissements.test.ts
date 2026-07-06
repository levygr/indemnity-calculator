import { describe, it, expect } from "vitest";
import { collecterAvertissements, defaultDossierData } from "@/lib/calculs";

describe("Avertissements de calcul", () => {
  it("aucun avertissement sur dossier vide", () => {
    const a = collecterAvertissements(defaultDossierData());
    expect(a).toEqual([]);
  });

  // ---- a) PER_NUL ----
  it("PER_NUL : PGPF avec rente mais date de naissance manquante", () => {
    const d = defaultDossierData();
    d.dateLiquidation = "2025-01-01";
    d.postesPerm.pgpf.renteAnnuelle = 20000;
    d.postesPerm.pgpf.capitalisation = "viager";
    const a = collecterAvertissements(d);
    expect(a.some((x) => x.code === "PER_NUL" && x.poste === "PGPF")).toBe(true);
  });

  it("PER_NUL : PGPF sain si dates et âge cohérents", () => {
    const d = defaultDossierData();
    d.dateNaissance = "1985-01-01";
    d.dateLiquidation = "2025-01-01";
    d.sexe = "M";
    d.bareme = "prospectif";
    d.postesPerm.pgpf.renteAnnuelle = 20000;
    d.postesPerm.pgpf.capitalisation = "viager";
    const a = collecterAvertissements(d);
    expect(a.some((x) => x.code === "PER_NUL")).toBe(false);
  });

  // ---- b) DATES_INCOHERENTES ----
  it("DATES_INCOHERENTES : consolidation avant accident", () => {
    const d = defaultDossierData();
    d.dateAccident = "2024-06-01";
    d.dateConsolidation = "2024-01-01";
    const a = collecterAvertissements(d);
    expect(a.some((x) => x.code === "DATES_INCOHERENTES")).toBe(true);
  });

  it("DATES_INCOHERENTES : dates ordonnées OK", () => {
    const d = defaultDossierData();
    d.dateAccident = "2024-01-01";
    d.dateConsolidation = "2024-06-01";
    d.dateLiquidation = "2025-01-01";
    const a = collecterAvertissements(d);
    expect(a.some((x) => x.code === "DATES_INCOHERENTES")).toBe(false);
  });

  // ---- c) PERIODES_CHEVAUCHANTES ----
  it("PERIODES_CHEVAUCHANTES : DFT chevauchant", () => {
    const d = defaultDossierData();
    d.periodesDFT = [
      { id: "a", debut: "2024-01-01", fin: "2024-06-30", taux: 1 },
      { id: "b", debut: "2024-06-15", fin: "2024-09-30", taux: 0.5 },
    ];
    const a = collecterAvertissements(d);
    expect(a.some((x) => x.code === "PERIODES_CHEVAUCHANTES" && x.poste === "DFT")).toBe(true);
  });

  it("PERIODES_CHEVAUCHANTES : DFT disjointes OK", () => {
    const d = defaultDossierData();
    d.periodesDFT = [
      { id: "a", debut: "2024-01-01", fin: "2024-06-30", taux: 1 },
      { id: "b", debut: "2024-07-01", fin: "2024-09-30", taux: 0.5 },
    ];
    const a = collecterAvertissements(d);
    expect(a.some((x) => x.code === "PERIODES_CHEVAUCHANTES")).toBe(false);
  });

  // ---- d) AIPP_HORS_BORNES ----
  it("AIPP_HORS_BORNES : taux 150", () => {
    const d = defaultDossierData();
    d.tauxAIPP = 150;
    const a = collecterAvertissements(d);
    expect(a.some((x) => x.code === "AIPP_HORS_BORNES")).toBe(true);
  });

  it("AIPP_HORS_BORNES : taux 20 OK", () => {
    const d = defaultDossierData();
    d.tauxAIPP = 20;
    const a = collecterAvertissements(d);
    expect(a.some((x) => x.code === "AIPP_HORS_BORNES")).toBe(false);
  });
});
