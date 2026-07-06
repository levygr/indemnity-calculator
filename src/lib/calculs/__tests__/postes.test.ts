import { describe, expect, it } from "vitest";
import { calculerDSAPonctuelles, calculerDSARecurrentes } from "../postes/dsa";
import { calculerATPTemp } from "../postes/atpTemp";
import { calculerPGPA } from "../postes/pgpa";
import { calculerDFT } from "../postes/dft";

describe("DSA ponctuelles", () => {
  it("reste = dépense − TP, revalo 'non' identique", () => {
    const r = calculerDSAPonctuelles(
      [
        { id: "1", date: "2024-01-01", libelle: "x", depense: 1000, tiersPayeur: 300, modeRevalo: "non" },
        { id: "2", date: null, libelle: "vide", depense: 500, tiersPayeur: 0, modeRevalo: "non" },
      ],
      "2025-01-01",
    );
    expect(r.lignes).toHaveLength(1);
    expect(r.totalDepenseRevalorisee).toBe(1000);
    expect(r.totalTpRevalorise).toBe(300);
    expect(r.totalResteRevalorise).toBe(700);
  });
});

describe("DSA récurrentes", () => {
  it("annualise puis multiplie par la durée", () => {
    const r = calculerDSARecurrentes(
      [
        { id: "1", debut: "2024-01-01", fin: "2024-12-31", libelle: "x", montant: 100, periodicite: "mois", tiersPayeur: 0, modeRevalo: "non" },
      ],
      "2025-01-01",
    );
    // 100 €/mois × 12 = 1200 €/an ; durée ≈ 1 an
    expect(r.totalDepenseRevalorisee).toBeGreaterThan(1150);
    expect(r.totalDepenseRevalorisee).toBeLessThan(1250);
  });
});

describe("ATP temporaire", () => {
  it("Taux × h/j × jours × (facteur/365)", () => {
    const r = calculerATPTemp([
      { id: "1", debut: "2024-01-01", fin: "2024-01-10", heuresParJour: 2, tauxHoraire: 20, facteurJours: 412 },
    ]);
    // 10 j × 2 h × 20 €/h × 412/365
    const attendu = 10 * 2 * 20 * (412 / 365);
    expect(r.total).toBeCloseTo(attendu, 4);
  });
  it("Ignore les lignes incomplètes", () => {
    const r = calculerATPTemp([
      { id: "1", debut: null, fin: null, heuresParJour: 2, tauxHoraire: 20, facteurJours: 412 },
    ]);
    expect(r.total).toBe(0);
  });
});

describe("PGPA — 3 méthodes", () => {
  it("Forfait", () => {
    const r = calculerPGPA(
      { methode: "forfait", revenuReference: 0, anneeReference: null, indice: "ipc", debut: null, fin: null, periodes: [], forfait: 1234, ij: 200 },
      "2025-01-01",
    );
    expect(r.perte).toBe(1234);
    expect(r.resteACharge).toBe(1034);
  });
  it("Périodes", () => {
    const r = calculerPGPA(
      { methode: "periodes", revenuReference: 0, anneeReference: null, indice: "ipc", debut: null, fin: null, periodes: [
        { id: "a", debut: "2024-01-01", fin: "2024-01-31", perte: 500 },
        { id: "b", debut: "2024-02-01", fin: "2024-02-28", perte: 500 },
      ], forfait: 0, ij: 100 },
      "2025-01-01",
    );
    expect(r.perte).toBe(1000);
    expect(r.resteACharge).toBe(900);
  });
  it("Référence : revenu actualisé × années", () => {
    const r = calculerPGPA(
      { methode: "reference", revenuReference: 20000, anneeReference: 2020, indice: "ipc", debut: "2024-01-01", fin: "2024-06-30", periodes: [], forfait: 0, ij: 0 },
      "2025-01-01",
    );
    expect(r.perte).toBeGreaterThan(0);
  });
});

describe("DFT — jours pondérés × taux journalier", () => {
  it("30 jours × 100 % × 30 €", () => {
    const r = calculerDFT(
      [{ id: "1", debut: "2024-01-01", fin: "2024-01-30", taux: 1 }],
      30,
    );
    expect(r.joursTotaux).toBe(30);
    expect(r.montant).toBe(900);
  });
  it("50 % → moitié", () => {
    const r = calculerDFT(
      [{ id: "1", debut: "2024-01-01", fin: "2024-01-30", taux: 0.5 }],
      30,
    );
    expect(r.montant).toBe(450);
  });
});
