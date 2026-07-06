import { describe, it, expect } from "vitest";
import {
  calculerSynthese,
  calculerRecoursTP,
  defaultDossierData,
} from "@/lib/calculs";

describe("Recours des tiers payeurs", () => {
  it("ventilation cohérente avec le TP du poste : pas d'écart", () => {
    const d = defaultDossierData();
    d.postesTemp.dsaPonctuelles = [
      { id: "1", date: "2024-01-01", libelle: "hôpital", depense: 1000, tiersPayeur: 400, modeRevalo: "non" },
    ];
    d.organismesTP = [{ id: "o1", nom: "CPAM 38", type: "cpam" }];
    d.creancesTP = [
      { id: "c1", organismeId: "o1", posteCode: "DSA", libelle: "hosp", montantEchu: 400, montantAEchoir: 0 },
    ];
    const s = calculerSynthese(d);
    expect(s.recoursTP.ecarts).toHaveLength(0);
    expect(s.avertissements.some((a) => a.code === "ECART_CREANCES_TP")).toBe(false);
    expect(s.recoursTP.parOrganisme[0].totaux.total).toBe(400);
  });

  it("écart > 1 € déclenche ECART_CREANCES_TP", () => {
    const d = defaultDossierData();
    d.postesTemp.dsaPonctuelles = [
      { id: "1", date: "2024-01-01", libelle: "hôpital", depense: 1000, tiersPayeur: 400, modeRevalo: "non" },
    ];
    d.organismesTP = [{ id: "o1", nom: "CPAM", type: "cpam" }];
    d.creancesTP = [
      { id: "c1", organismeId: "o1", posteCode: "DSA", libelle: "", montantEchu: 300, montantAEchoir: 0 },
    ];
    const s = calculerSynthese(d);
    expect(s.recoursTP.ecarts).toHaveLength(1);
    expect(s.recoursTP.ecarts[0].posteCode).toBe("DSA");
    expect(s.avertissements.some((a) => a.code === "ECART_CREANCES_TP")).toBe(true);
  });

  it("totaux croisés organisme × poste et total général", () => {
    const d = defaultDossierData();
    d.organismesTP = [
      { id: "o1", nom: "CPAM", type: "cpam" },
      { id: "o2", nom: "Mut", type: "mutuelle" },
    ];
    d.creancesTP = [
      { id: "c1", organismeId: "o1", posteCode: "DSA", libelle: "", montantEchu: 100, montantAEchoir: 50 },
      { id: "c2", organismeId: "o1", posteCode: "DSF", libelle: "", montantEchu: 200, montantAEchoir: 0 },
      { id: "c3", organismeId: "o2", posteCode: "DSA", libelle: "", montantEchu: 30, montantAEchoir: 20 },
    ];
    const s = calculerSynthese(d);
    const r = calculerRecoursTP(d, s);
    const o1 = r.parOrganisme.find((x) => x.organisme.id === "o1")!;
    expect(o1.totaux.total).toBe(350);
    expect(o1.parPoste["DSA"].total).toBe(150);
    expect(o1.parPoste["DSF"].total).toBe(200);
    const o2 = r.parOrganisme.find((x) => x.organisme.id === "o2")!;
    expect(o2.totaux.total).toBe(50);
    expect(r.totalGeneral.total).toBe(400);
    expect(r.totalGeneral.echu).toBe(330);
    expect(r.totalGeneral.aEchoir).toBe(70);
  });
});
