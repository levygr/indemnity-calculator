import { describe, it, expect, afterEach } from "vitest";
import { AIPP_META } from "@/data/bareme_aipp";
import { REFERENTIEL } from "@/data/referentiel_evaluation";
import { collecterAvertissements, defaultDossierData } from "@/lib/calculs";

describe("Versionnement des référentiels", () => {
  const savedAipp = AIPP_META.edition;
  const savedRef = REFERENTIEL.edition;

  afterEach(() => {
    AIPP_META.edition = savedAipp;
    REFERENTIEL.edition = savedRef;
  });

  it("déclenche REFERENTIEL_NON_VERSIONNE quand AIPP_META.edition est null", () => {
    AIPP_META.edition = null;
    REFERENTIEL.edition = "septembre 2025";
    const av = collecterAvertissements(defaultDossierData());
    const aipp = av.filter((a) => a.code === "REFERENTIEL_NON_VERSIONNE");
    expect(aipp.some((a) => a.message.includes("AIPP"))).toBe(true);
    expect(aipp.some((a) => a.message.includes("Mornet"))).toBe(false);
  });

  it("déclenche REFERENTIEL_NON_VERSIONNE quand REFERENTIEL.edition est null", () => {
    AIPP_META.edition = "2024";
    REFERENTIEL.edition = null;
    const av = collecterAvertissements(defaultDossierData());
    const refs = av.filter((a) => a.code === "REFERENTIEL_NON_VERSIONNE");
    expect(refs.some((a) => a.message.includes("Mornet"))).toBe(true);
    expect(refs.some((a) => a.message.includes("AIPP"))).toBe(false);
  });

  it("aucun avertissement quand les deux éditions sont renseignées", () => {
    AIPP_META.edition = "2024";
    REFERENTIEL.edition = "septembre 2025";
    const av = collecterAvertissements(defaultDossierData());
    expect(av.some((a) => a.code === "REFERENTIEL_NON_VERSIONNE")).toBe(false);
  });
});
