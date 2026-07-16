import { describe, expect, it } from "vitest";
import { parseMontant, formatMontantFR } from "../parseMontant";

describe("parseMontant", () => {
  it("distingue vide et zéro", () => {
    expect(parseMontant("")).toEqual({ ok: true, value: null });
    expect(parseMontant("   ")).toEqual({ ok: true, value: null });
    expect(parseMontant(null)).toEqual({ ok: true, value: null });
    expect(parseMontant("0")).toEqual({ ok: true, value: 0 });
  });

  it("accepte format français avec virgule et espace", () => {
    expect(parseMontant("1 234,56")).toEqual({ ok: true, value: 1234.56 });
    expect(parseMontant("1\u00A0234,56")).toEqual({ ok: true, value: 1234.56 });
    expect(parseMontant("1\u202F234,56")).toEqual({ ok: true, value: 1234.56 });
  });

  it("accepte le symbole euro", () => {
    expect(parseMontant("1 234,56 €")).toEqual({ ok: true, value: 1234.56 });
    expect(parseMontant("€1234.56")).toEqual({ ok: true, value: 1234.56 });
  });

  it("accepte format anglais avec point", () => {
    expect(parseMontant("12.34")).toEqual({ ok: true, value: 12.34 });
    expect(parseMontant("1,234.56")).toEqual({ ok: true, value: 1234.56 });
  });

  it("accepte les négatifs (variantes de tirets)", () => {
    expect(parseMontant("-42")).toEqual({ ok: true, value: -42 });
    expect(parseMontant("−42")).toEqual({ ok: true, value: -42 });
    expect(parseMontant("−1 234,56")).toEqual({ ok: true, value: -1234.56 });
  });

  it("rejette les saisies invalides", () => {
    expect(parseMontant("abc")).toEqual({ ok: false });
    expect(parseMontant("1,2,3")).toEqual({ ok: false });
    expect(parseMontant("1..2")).toEqual({ ok: false });
    expect(parseMontant("-")).toEqual({ ok: false });
    expect(parseMontant("12abc")).toEqual({ ok: false });
  });

  it("supporte des grands nombres", () => {
    expect(parseMontant("1 000 000,00")).toEqual({ ok: true, value: 1000000 });
  });
});

describe("formatMontantFR", () => {
  it("affiche vide pour null", () => {
    expect(formatMontantFR(null)).toBe("");
    expect(formatMontantFR(undefined)).toBe("");
  });

  it("formate avec espace insécable et virgule", () => {
    const s = formatMontantFR(1234.56);
    expect(s.replace(/\u00A0|\u202F/g, " ")).toBe("1 234,56");
  });

  it("formate 0 avec deux décimales", () => {
    const s = formatMontantFR(0);
    expect(s).toBe("0,00");
  });
});
