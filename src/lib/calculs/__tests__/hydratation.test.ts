import { describe, it, expect } from "vitest";
import { hydraterDossier } from "../hydratation";
import { defaultDossierData } from "../types";

describe("hydraterDossier", () => {
  it("retourne les valeurs par défaut sur un objet vide", () => {
    const d = hydraterDossier({});
    expect(d).toEqual(defaultDossierData());
  });

  it("retourne les valeurs par défaut sur une entrée invalide", () => {
    expect(hydraterDossier(null)).toEqual(defaultDossierData());
    expect(hydraterDossier(42)).toEqual(defaultDossierData());
  });

  it("hydrate un JSON partiel sans postesPerm.atpPerm ni postesDeces", () => {
    const partial = {
      reference: "Test",
      tauxAIPP: 25,
      postesPerm: {
        pgpf: { renteAnnuelle: 10000 },
        // atpPerm absent
      },
      // postesDeces absent
    };
    const d = hydraterDossier(partial);

    expect(d.reference).toBe("Test");
    expect(d.tauxAIPP).toBe(25);

    // Champs conservés
    expect(d.postesPerm.pgpf.renteAnnuelle).toBe(10000);

    // Valeurs par défaut restaurées
    expect(d.postesPerm.atpPerm).toEqual({
      heuresParJour: 0,
      tauxHoraire: 20,
      facteurJours: 412,
      capitalisation: "viager",
      ageFin: null,
      tiersPayeur: 0,
    });
    expect(d.postesPerm.pgpf.capitalisation).toBe("viager");
    expect(d.postesPerm.pgpf.tiersPayeur).toBe(0);
    expect(d.postesPerm.ip.forfait).toBe(0);
    expect(d.postesPerm.dfp.methode).toBe("point");

    expect(d.postesDeces.proches).toEqual([]);
    expect(d.postesDeces.fraisDivers).toEqual([]);
    expect(d.postesSurvie.proches).toEqual([]);
  });

  it("remplace les tableaux absents par []", () => {
    const d = hydraterDossier({ postesTemp: { pgpa: {} } });
    expect(d.periodesDFT).toEqual([]);
    expect(d.postesTemp.dsaPonctuelles).toEqual([]);
    expect(d.postesTemp.dsaRecurrentes).toEqual([]);
    expect(d.postesTemp.atpTemp).toEqual([]);
    expect(d.postesTemp.pgpa.periodes).toEqual([]);
    expect(d.postesPerm.dsfPonctuelles).toEqual([]);
    expect(d.postesPerm.logement).toEqual([]);
    expect(d.postesPerm.vehicule).toEqual([]);
  });

  it("injecte pensionReversionAnnuelle=0 sur les proches déces existants", () => {
    const d = hydraterDossier({
      postesDeces: {
        proches: [
          { id: "1", lienParente: "conjoint", partRevenu: 0.4, affection: 30000 },
        ],
      },
    });
    expect(d.postesDeces.proches[0].pensionReversionAnnuelle).toBe(0);
    expect(d.postesDeces.proches[0].affection).toBe(30000);
  });

  it("migre l'ancien poste pathologiesEvo vers pathologiesEvolutives", () => {
    const d = hydraterDossier({
      postesPerm: {
        pathologiesEvo: { montant: 12000, cotation: 4 },
      },
    });
    expect(d.postesPerm.pathologiesEvolutives).toEqual({ montant: 12000, cotation: 4 });
    expect(d.postesPerm.permanentExceptionnel).toEqual({ montant: 0, cotation: 0 });
  });

  it("conserve pathologiesEvolutives et permanentExceptionnel déjà scindés", () => {
    const d = hydraterDossier({
      postesPerm: {
        pathologiesEvolutives: { montant: 8000, cotation: 3 },
        permanentExceptionnel: { montant: 15000, cotation: 5 },
      },
    });
    expect(d.postesPerm.pathologiesEvolutives.montant).toBe(8000);
    expect(d.postesPerm.permanentExceptionnel.montant).toBe(15000);
  });

  it("initialise psu par défaut", () => {
    const d = hydraterDossier({});
    expect(d.postesPerm.psu).toEqual({ montant: 0, note: "" });
  });
});

