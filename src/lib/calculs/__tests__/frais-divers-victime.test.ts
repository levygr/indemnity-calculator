import { describe, it, expect } from "vitest";
import { calculerFraisDiversVictime } from "../postes/fraisDiversVictime";
import type { FraisDiversVictime } from "../types";

function mk(overrides: Partial<FraisDiversVictime> = {}): FraisDiversVictime {
  return {
    id: overrides.id ?? "l1",
    date: overrides.date ?? "2024-01-01",
    libelle: overrides.libelle ?? "Test",
    montant: overrides.montant ?? 1000,
    tiersPayeur: overrides.tiersPayeur ?? 0,
    modeRevalo: overrides.modeRevalo ?? "aucun",
  };
}

describe("calculerFraisDiversVictime", () => {
  it("cas nominal sans revalorisation : reste = montant - TP", () => {
    const r = calculerFraisDiversVictime(
      [mk({ montant: 1000, tiersPayeur: 300, modeRevalo: "aucun" })],
      "2025-06-01",
    );
    expect(r.lignes).toHaveLength(1);
    expect(r.totalDepense).toBe(1000);
    expect(r.totalDepenseRevalorisee).toBe(1000);
    expect(r.totalTP).toBe(300);
    expect(r.totalTpRevalorise).toBe(300);
    expect(r.totalResteRevalorise).toBe(700);
  });

  it("revalorise dépense et TP au même mode (assiette homogène)", () => {
    const r = calculerFraisDiversVictime(
      [mk({ date: "2020-01-01", montant: 1000, tiersPayeur: 400, modeRevalo: "annuel" })],
      "2025-01-01",
    );
    // dépense/TP revalorisés au même facteur → ratio conservé
    const ratio = r.totalDepenseRevalorisee / 1000;
    expect(r.totalTpRevalorise).toBeCloseTo(400 * ratio, 6);
    expect(r.totalResteRevalorise).toBeCloseTo(r.totalDepenseRevalorisee - r.totalTpRevalorise, 6);
    expect(r.totalDepenseRevalorisee).toBeGreaterThan(1000);
  });

  it("ignore les lignes sans date", () => {
    const r = calculerFraisDiversVictime(
      [
        mk({ id: "a", date: null, montant: 500 }),
        mk({ id: "b", date: "2024-01-01", montant: 200 }),
      ],
      "2025-06-01",
    );
    expect(r.lignes).toHaveLength(1);
    expect(r.lignes[0].id).toBe("b");
    expect(r.totalDepense).toBe(200);
  });

  it("ignore les lignes à montant nul ou négatif", () => {
    const r = calculerFraisDiversVictime(
      [mk({ montant: 0 }), mk({ id: "n", montant: -50 })],
      "2025-06-01",
    );
    expect(r.lignes).toHaveLength(0);
    expect(r.totalDepense).toBe(0);
  });

  it("plafonne le reste à 0 quand le TP dépasse le montant", () => {
    const r = calculerFraisDiversVictime(
      [mk({ montant: 500, tiersPayeur: 800, modeRevalo: "aucun" })],
      "2025-06-01",
    );
    expect(r.totalResteRevalorise).toBe(0);
    expect(r.lignes[0].resteRevalorise).toBe(0);
  });
});
