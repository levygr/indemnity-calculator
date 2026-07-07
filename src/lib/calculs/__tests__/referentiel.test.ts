import { describe, it, expect } from "vitest";
import { AIPP_META, valeurPointAIPP } from "@/data/bareme_aipp";
import {
  REFERENTIEL,
  fourchettePourDegre,
  fourchetteAffection,
} from "@/data/referentiel_evaluation";
import { collecterAvertissements, defaultDossierData } from "@/lib/calculs";

describe("Référentiels versionnés (édition septembre 2025)", () => {
  it("les éditions officielles sont renseignées", () => {
    expect(AIPP_META.edition).toBe("septembre 2025");
    expect(REFERENTIEL.edition).toBe("septembre 2025");
  });

  it("fourchettePourDegre(SE, 4) retourne 8000-20000, non approximé", () => {
    const f = fourchettePourDegre("SE", 4);
    expect(f).toEqual({ min: 8000, max: 20000, approximation: false });
  });

  it("fourchettePourDegre(SE, 3.5) retourne 4000-20000, approximé", () => {
    const f = fourchettePourDegre("SE", 3.5);
    expect(f).toEqual({ min: 4000, max: 20000, approximation: true });
  });

  it("fourchettePourDegre(PET, 3) retourne null", () => {
    expect(fourchettePourDegre("PET", 3)).toBeNull();
  });

  it("fourchetteAffection(conjoint) retourne 20000-30000", () => {
    const f = fourchetteAffection("conjoint");
    expect(f?.min).toBe(20000);
    expect(f?.max).toBe(30000);
  });

  it("fourchetteAffection(code_inconnu) retourne null", () => {
    expect(fourchetteAffection("code_inconnu")).toBeNull();
  });

  it("valeurPointAIPP(32, 25) = 3740 (exemple de contrôle du référentiel)", () => {
    expect(valeurPointAIPP(32, 25)).toBe(3740);
  });

  it("REFERENTIEL_NON_VERSIONNE ne se déclenche plus", () => {
    const av = collecterAvertissements(defaultDossierData());
    expect(av.some((a) => a.code === "REFERENTIEL_NON_VERSIONNE")).toBe(false);
  });
});
