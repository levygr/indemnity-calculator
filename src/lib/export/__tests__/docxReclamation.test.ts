import { describe, it, expect } from "vitest";
import {
  buildFilename,
  buildReclamationDocx,
  formatEurosDocx,
} from "@/lib/export/docxReclamation";
import { calculerSynthese, defaultDossierData, hydraterDossier } from "@/lib/calculs";
import type { DossierData } from "@/lib/calculs";

describe("formatEurosDocx", () => {
  it("1234567.5 → \"1 234 567,50 €\"", () => {
    expect(formatEurosDocx(1234567.5)).toBe("1\u00A0234\u00A0567,50\u00A0€");
  });
  it("0 → \"0,00 €\"", () => {
    expect(formatEurosDocx(0)).toBe("0,00\u00A0€");
  });
  it("null / NaN → \"—\"", () => {
    expect(formatEurosDocx(null)).toBe("—");
    expect(formatEurosDocx(NaN)).toBe("—");
  });
  it("valeurs négatives préfixées d'un signe moins", () => {
    expect(formatEurosDocx(-1500)).toBe("−1\u00A0500,00\u00A0€");
  });
});

describe("buildFilename", () => {
  it("assemble reclamation-{ref}-{date}.docx", () => {
    expect(buildFilename("Dupont c. AXA", "2026-07-15")).toBe(
      "reclamation-Dupont_c._AXA-2026-07-15.docx",
    );
  });
});

// --- Fixtures ---------------------------------------------------------------

function dossierMinimal(): DossierData {
  const d = defaultDossierData();
  d.reference = "Test";
  return d;
}

/** Dossier avec quelques postes patrimoniaux temporaires et permanents. */
function dossierAvecPostes(): DossierData {
  const d = hydraterDossier({
    reference: "Fixture",
    dateAccident: "2020-01-01",
    dateConsolidation: "2022-01-01",
    dateLiquidation: "2024-01-01",
    dateNaissance: "1980-01-01",
    tableMortalite: "2020-2022",
    bareme: "stationnaire",
    postesTemp: {
      dsaPonctuelles: [
        { id: "a", libelle: "Consultation", date: "2020-02-01", montant: 500, tiersPayeur: 300 },
      ],
      se: { montant: 5000 },
    },
    postesPerm: {
      atpPerm: {
        heuresParJour: 2,
        tauxHoraire: 20,
        facteurJours: 365,
        tiersPayeur: 0,
        capitalisation: "viager",
        ageFin: null,
      },
    },
  });
  return d;
}

describe("buildReclamationDocx — structure", () => {
  it("un dossier vide n'a que le récapitulatif comme section", () => {
    const d = dossierMinimal();
    const s = calculerSynthese(d);
    const r = buildReclamationDocx({ dossier: d, synthese: s, dateEdition: "2026-07-15" });
    expect(r.categoriesRendues).toEqual([]);
    // Récap seul, pas d'avertissement, pas de section catégorie
    expect(r.nbSections).toBe(1);
    expect(r.aPointsDeVigilance).toBe(false);
    expect(r.demonstrationCodes).toEqual([]);
  });

  it("les catégories effectivement peuplées sont rendues", () => {
    const d = dossierAvecPostes();
    const s = calculerSynthese(d);
    const r = buildReclamationDocx({ dossier: d, synthese: s, dateEdition: "2026-07-15" });
    // PT (DSA) et PP (ATP-P) au minimum
    expect(r.categoriesRendues).toContain("PT");
    expect(r.categoriesRendues).toContain("PP");
    // Chaque poste capitalisé non nul déclenche un encadré de démonstration.
    // ATP-P est capitalisable et présent avec un montant > 0.
    expect(r.demonstrationCodes).toContain("ATP-P");
    // La DSA n'est pas capitalisée : pas de bloc de démonstration pour elle.
    expect(r.demonstrationCodes).not.toContain("DSA");
  });

  it("la page Points de vigilance n'apparaît que si des avertissements existent", () => {
    // Provisions > totalVictime déclenche un avertissement.
    const d = dossierAvecPostes();
    d.provisions = [{ id: "p1", date: "2024-01-01", montant: 999999, debiteur: "AXA" }];
    const s = calculerSynthese(d);
    expect(s.avertissements.length).toBeGreaterThan(0);
    const r = buildReclamationDocx({ dossier: d, synthese: s });
    expect(r.aPointsDeVigilance).toBe(true);
  });

  it("aucune page Points de vigilance si aucun avertissement", () => {
    const d = dossierMinimal();
    const s = calculerSynthese(d);
    expect(s.avertissements).toEqual([]);
    const r = buildReclamationDocx({ dossier: d, synthese: s });
    expect(r.aPointsDeVigilance).toBe(false);
  });
});
