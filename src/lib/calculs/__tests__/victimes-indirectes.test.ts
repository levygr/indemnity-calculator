import { describe, it, expect } from "vitest";
import {
  calculerPerteRevenusFoyer,
  calculerPerteRevenusSurvie,
  calculerFraisDivers,
  totalAffection,
  totalAffectionSurvie,
  totalPEPSurvie,
  perViager,
  perTemporaire,
  defaultPostesDeces,
  defaultPostesSurvie,
  type PostesDeces,
} from "@/lib/calculs";

const ctx = { dateLiquidation: "2025-01-01", bareme: "prospectif" as const };

describe("Décès — perte de revenus du foyer", () => {
  it("répartit revenu foyer entre conjoint et enfants selon les parts", () => {
    const d: PostesDeces = {
      ...defaultPostesDeces(),
      revenuAnnuelDefunt: 40000,
      partConsommeeDefunt: 0.3,
      proches: [
        { id: "c", lien: "conjoint", prenom: "A", dateNaissance: "1985-01-01", sexe: "F", partFoyer: 2, ageFinEtudes: 25, affection: 0 },
        { id: "e1", lien: "enfant", prenom: "B", dateNaissance: "2015-01-01", sexe: "M", partFoyer: 1, ageFinEtudes: 25, affection: 0 },
      ],
    };
    const r = calculerPerteRevenusFoyer(d, ctx);
    expect(r.revenuFoyer).toBeCloseTo(28000, 3);
    // conjoint 2/3, enfant 1/3
    expect(r.lignes[0].renteAnnuelle).toBeCloseTo((2 / 3) * 28000, 3);
    expect(r.lignes[1].renteAnnuelle).toBeCloseTo((1 / 3) * 28000, 3);
    // conjoint viager
    expect(r.lignes[0].per).toBeCloseTo(perViager(40, "prospectif", "F"), 3);
    // enfant temporaire jusqu'à 25 (âge 10)
    expect(r.lignes[1].per).toBeCloseTo(perTemporaire(10, 25, "prospectif", "M"), 3);
  });

  it("renvoie 0 si aucun proche éligible", () => {
    const d: PostesDeces = { ...defaultPostesDeces(), revenuAnnuelDefunt: 40000, partConsommeeDefunt: 0.3 };
    const r = calculerPerteRevenusFoyer(d, ctx);
    expect(r.totalCapital).toBe(0);
  });

  it("ignore proche sans date de naissance", () => {
    const d: PostesDeces = {
      ...defaultPostesDeces(),
      revenuAnnuelDefunt: 40000,
      partConsommeeDefunt: 0.3,
      proches: [{ id: "c", lien: "conjoint", prenom: "", dateNaissance: null, sexe: "F", partFoyer: 1, ageFinEtudes: 25, affection: 0 }],
    };
    const r = calculerPerteRevenusFoyer(d, ctx);
    expect(r.lignes).toHaveLength(0);
    expect(r.totalCapital).toBe(0);
  });

  it("borne partConsommee entre 0 et 1", () => {
    const d: PostesDeces = { ...defaultPostesDeces(), revenuAnnuelDefunt: 10000, partConsommeeDefunt: 1.5 };
    const r = calculerPerteRevenusFoyer(d, ctx);
    expect(r.revenuFoyer).toBe(0);
  });
});

describe("Survie proches — perte de revenus", () => {
  it("capitalise en viager sur âge du proche", () => {
    const r = calculerPerteRevenusSurvie(
      [{ id: "c", prenom: "X", lien: "conjoint", dateNaissance: "1985-01-01", sexe: "F", perteRevenusAnnuelle: 5000, perteRevenusTP: 0, affection: 0, pep: 0 }],
      ctx,
    );
    expect(r.lignes).toHaveLength(1);
    expect(r.lignes[0].per).toBeCloseTo(perViager(40, "prospectif", "F"), 3);
    expect(r.totalCapital).toBeCloseTo(5000 * perViager(40, "prospectif", "F"), 3);
  });

  it("ignore lignes sans perte", () => {
    const r = calculerPerteRevenusSurvie(
      [{ id: "x", prenom: "", lien: "", dateNaissance: "1985-01-01", sexe: "I", perteRevenusAnnuelle: 0, perteRevenusTP: 0, affection: 0, pep: 0 }],
      ctx,
    );
    expect(r.totalCapital).toBe(0);
  });

  it("droit de préférence : reste = capital − capitalTP", () => {
    const r = calculerPerteRevenusSurvie(
      [{ id: "c", prenom: "X", lien: "conjoint", dateNaissance: "1985-01-01", sexe: "F", perteRevenusAnnuelle: 5000, perteRevenusTP: 1000, affection: 0, pep: 0 }],
      ctx,
    );
    const per = perViager(40, "prospectif", "F");
    expect(r.totalTP).toBeCloseTo(1000 * per, 3);
    expect(r.totalReste).toBeCloseTo(4000 * per, 3);
  });
});

describe("Agrégats affection / PEP / frais", () => {
  it("cumule les montants d'affection en ignorant 0", () => {
    const proches = defaultPostesDeces().proches;
    expect(totalAffection(proches)).toBe(0);
  });

  it("frais divers : totaux corrects", () => {
    const r = calculerFraisDivers([
      { id: "a", libelle: "x", montant: 100, tiersPayeur: 30 },
      { id: "b", libelle: "y", montant: 0, tiersPayeur: 0 }, // ignoré
      { id: "c", libelle: "z", montant: 50, tiersPayeur: 0 },
    ]);
    expect(r.totalMontant).toBe(150);
    expect(r.totalTP).toBe(30);
    expect(r.totalReste).toBe(120);
  });

  it("survie: totalAffection & totalPEP ignorent 0", () => {
    expect(totalAffectionSurvie(defaultPostesSurvie().proches)).toBe(0);
    expect(totalPEPSurvie(defaultPostesSurvie().proches)).toBe(0);
  });
});
