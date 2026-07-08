import { describe, it, expect } from "vitest";
import {
  aippDiff,
  aippFromCsv,
  aippToCsv,
  detectMatrixKind,
  getMatrixHandler,
  perDiff,
  perFromCsv,
  perToCsv,
} from "../csv";
import { REGISTRY } from "../registry";
import type { AippPayload } from "../registry";

const PER_CODE = "bareme_femme_stationnaire_2025";
const perDef = REGISTRY.find((d) => d.code === PER_CODE)!;
const perPayload = perDef.payload as {
  description: string;
  colonne_viagere: number;
  ages_fin_de_rente: number[];
  lignes: { age_liquidation: number; prix: number[] }[];
};

const aippDef = REGISTRY.find((d) => d.code === "bareme_aipp")!;
const aippPayload = aippDef.payload as AippPayload;

describe("csv — detection", () => {
  it("détecte PER et AIPP", () => {
    expect(detectMatrixKind("bareme_femme_stationnaire_2025")).toBe("per");
    expect(detectMatrixKind("bareme_aipp")).toBe("aipp");
    expect(detectMatrixKind("taux_legal")).toBeNull();
  });
});

describe("csv — PER round-trip", () => {
  it("toCsv puis fromCsv restitue la payload identique", () => {
    const csv = perToCsv(perPayload);
    const back = perFromCsv(csv, perPayload);
    expect(back).toEqual(perPayload);
    expect(perDiff(perPayload, back)).toEqual([]);
  });

  it("détecte une modification de cellule", () => {
    const csv = perToCsv(perPayload);
    const lines = csv.split("\n");
    // ligne 3 = age_liquidation index 1 ; deuxième colonne prix
    const cells = lines[2].split(",");
    const original = Number(cells[1]);
    cells[1] = String(original + 42);
    lines[2] = cells.join(",");
    const modified = perFromCsv(lines.join("\n"), perPayload);
    const diffs = perDiff(perPayload, modified);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].before).toBe(original);
    expect(diffs[0].after).toBe(original + 42);
  });

  it("refuse un en-tête invalide", () => {
    const csv = perToCsv(perPayload).replace("age_liquidation", "age");
    expect(() => perFromCsv(csv, perPayload)).toThrow(/attendue/i);
  });

  it("refuse un nombre de lignes incorrect", () => {
    const csv = perToCsv(perPayload);
    const truncated = csv.split("\n").slice(0, 5).join("\n");
    expect(() => perFromCsv(truncated, perPayload)).toThrow(/lignes reçues/);
  });
});

describe("csv — AIPP round-trip", () => {
  it("toCsv puis fromCsv restitue la payload identique", () => {
    const csv = aippToCsv(aippPayload);
    const back = aippFromCsv(csv, aippPayload);
    expect(back).toEqual(aippPayload);
    expect(aippDiff(aippPayload, back)).toEqual([]);
  });

  it("détecte plusieurs modifications de cellules", () => {
    const csv = aippToCsv(aippPayload);
    const lines = csv.split("\n");
    // modif ligne 2 (index 1 dans le body), colonnes 2 et 3
    const cells = lines[1].split(",");
    cells[1] = String(Number(cells[1]) + 10);
    cells[2] = String(Number(cells[2]) - 5);
    lines[1] = cells.join(",");
    const modified = aippFromCsv(lines.join("\n"), aippPayload);
    const diffs = aippDiff(aippPayload, modified);
    expect(diffs).toHaveLength(2);
  });

  it("refuse un libellé de tranche incorrect", () => {
    const csv = aippToCsv(aippPayload);
    const bad = csv.replace(/^1-5,/m, "1-4,");
    expect(() => aippFromCsv(bad, aippPayload)).toThrow(/tranche/);
  });
});

describe("csv — handler unifié", () => {
  it("route vers le bon parseur selon le code", () => {
    const h = getMatrixHandler(PER_CODE)!;
    expect(h.kind).toBe("per");
    const csv = h.toCsv(perPayload);
    const back = h.fromCsv(csv, perPayload);
    expect(h.diff(perPayload, back)).toEqual([]);
  });
});
