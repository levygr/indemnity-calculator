/**
 * Test de parité : pour chaque référentiel du registre,
 * `fromRows(toRows(payload))` doit reproduire strictement la payload
 * d'origine (comparaison JSON.stringify → byte à byte).
 *
 * Ce test garantit que le seed initial ne perd ni ne modifie AUCUNE
 * valeur des fichiers `src/data/*` lors de l'aller-retour DB.
 */

import { describe, it, expect } from "vitest";
import { REGISTRY } from "../registry";

describe("Référentiels — parité round-trip", () => {
  for (const def of REGISTRY) {
    it(`${def.code} : toRows → fromRows conserve la payload`, () => {
      const rows = def.toRows(def.payload);
      expect(rows.length).toBeGreaterThan(0);
      const rebuilt = def.fromRows(rows);
      expect(JSON.stringify(rebuilt)).toBe(JSON.stringify(def.payload));
    });
  }

  it("aucun code n'est dupliqué dans le registre", () => {
    const codes = REGISTRY.map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("chaque référentiel expose kind et libellé non vides", () => {
    for (const d of REGISTRY) {
      expect(d.code).toMatch(/^[a-z0-9_]+$/);
      expect(d.libelle.length).toBeGreaterThan(0);
      expect(["monolithique", "incremental"]).toContain(d.kind);
    }
  });
});
