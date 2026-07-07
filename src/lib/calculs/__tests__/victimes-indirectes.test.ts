import { describe, it, expect } from "vitest";
import {
  calculerPerteRevenusFoyer,
  calculerFraisDivers,
  totalAffection,
  totalAffectionSurvie,
  totalPEPSurvie,
  perViager,
  perTemporaire,
  perRenteDifferee,
  defaultPostesDeces,
  defaultPostesSurvie,
  type PostesDeces,
  type ContexteDeces,
} from "@/lib/calculs";
import { calculerPerteRevenusSurvie } from "@/lib/calculs/postes/survieProches";

const ctx: ContexteDeces = {
  dateLiquidation: "2025-01-01",
  bareme: "prospectif",
  methodeRente: "habituelle",
};

describe("Décès — perte de revenus du foyer (calcul séquencé)", () => {
  it("nouvelle formule : perteAnnuelleFoyer = (Rd+Rc)(1−p) − Rc", () => {
    const d: PostesDeces = {
      ...defaultPostesDeces(),
      revenuAnnuelDefunt: 40000,
      revenuAnnuelConjoint: 12000,
      partConsommeeDefunt: 0.3,
      proches: [
        { id: "c", lien: "conjoint", prenom: "A", dateNaissance: "1985-01-01", sexe: "F", partFoyer: 2, ageFinEtudes: 25, affection: 0, pensionReversionAnnuelle: 0 },
      ],
    };
    const r = calculerPerteRevenusFoyer(d, ctx);
    expect(r.perteAnnuelleFoyer).toBeCloseTo(24400, 3);
    expect(r.revenuFoyer).toBeCloseTo(24400, 3);
  });

  it("foyer sans enfant → une période viagère unique", () => {
    const d: PostesDeces = {
      ...defaultPostesDeces(),
      revenuAnnuelDefunt: 40000,
      revenuAnnuelConjoint: 0,
      partConsommeeDefunt: 0.3,
      proches: [
        { id: "c", lien: "conjoint", prenom: "A", dateNaissance: "1985-01-01", sexe: "F", partFoyer: 1, ageFinEtudes: 25, affection: 0, pensionReversionAnnuelle: 0 },
      ],
    };
    const r = calculerPerteRevenusFoyer(d, ctx);
    expect(r.periodes).toHaveLength(1);
    expect(r.periodes[0].fin).toBeNull();
    expect(r.periodes[0].debut).toBe(0);
    const per = perViager(40, "prospectif", "F");
    expect(r.totalCapital).toBeCloseTo(28000 * per, 3);
    expect(r.lignes).toHaveLength(1);
    expect(r.lignes[0].per).toBeCloseTo(per, 3);
  });

  it("foyer conjoint + 2 enfants : nb de périodes et croissance de la part du conjoint", () => {
    const d: PostesDeces = {
      ...defaultPostesDeces(),
      revenuAnnuelDefunt: 40000,
      revenuAnnuelConjoint: 0,
      partConsommeeDefunt: 0.3,
      proches: [
        // conjoint 40 ans (part 2)
        { id: "c", lien: "conjoint", prenom: "A", dateNaissance: "1985-01-01", sexe: "F", partFoyer: 2, ageFinEtudes: 25, affection: 0, pensionReversionAnnuelle: 0 },
        // enfant A : 10 ans, fin études 23 → sortie Δ=13
        { id: "eA", lien: "enfant", prenom: "B", dateNaissance: "2015-01-01", sexe: "M", partFoyer: 1, ageFinEtudes: 23, affection: 0, pensionReversionAnnuelle: 0 },
        // enfant B : 5 ans, fin études 25 → sortie Δ=20
        { id: "eB", lien: "enfant", prenom: "C", dateNaissance: "2020-01-01", sexe: "F", partFoyer: 1, ageFinEtudes: 25, affection: 0, pensionReversionAnnuelle: 0 },
      ],
    };
    const r = calculerPerteRevenusFoyer(d, ctx);
    // 3 périodes : [0,13], [13,20], [20,∞)
    expect(r.periodes).toHaveLength(3);
    expect(r.periodes[0].debut).toBe(0);
    expect(r.periodes[0].fin).toBe(13);
    expect(r.periodes[1].debut).toBe(13);
    expect(r.periodes[1].fin).toBe(20);
    expect(r.periodes[2].debut).toBe(20);
    expect(r.periodes[2].fin).toBeNull();

    const conjPart1 = r.periodes[0].membres.find((m) => m.procheId === "c")!.part;
    const conjPart2 = r.periodes[1].membres.find((m) => m.procheId === "c")!.part;
    const conjPart3 = r.periodes[2].membres.find((m) => m.procheId === "c")!.part;
    expect(conjPart1).toBeCloseTo(2 / 4, 6); // 3 présents, parts 2/1/1
    expect(conjPart2).toBeCloseTo(2 / 3, 6); // 2 présents (conjoint + enfantB)
    expect(conjPart3).toBeCloseTo(1, 6);
    // Croissance stricte
    expect(conjPart2).toBeGreaterThan(conjPart1);
    expect(conjPart3).toBeGreaterThan(conjPart2);

    // Enfant A absent des périodes 2 et 3
    expect(r.periodes[1].membres.some((m) => m.procheId === "eA")).toBe(false);
    expect(r.periodes[2].membres.some((m) => m.procheId === "eA")).toBe(false);

    // Somme des capitaux membres = totalCapital
    const somme = r.periodes.reduce(
      (a, p) => a + p.membres.reduce((s, m) => s + m.capital, 0),
      0,
    );
    expect(somme).toBeCloseTo(r.totalCapital, 6);
  });

  it("PRF avec pension de réversion : capitalTP calculé période par période sur le conjoint", () => {
    const d: PostesDeces = {
      ...defaultPostesDeces(),
      revenuAnnuelDefunt: 40000,
      revenuAnnuelConjoint: 0,
      partConsommeeDefunt: 0.3,
      proches: [
        {
          id: "c", lien: "conjoint", prenom: "A",
          dateNaissance: "1985-01-01", sexe: "F",
          partFoyer: 1, ageFinEtudes: 25, affection: 0,
          pensionReversionAnnuelle: 5000,
        },
      ],
    };
    const r = calculerPerteRevenusFoyer(d, ctx);
    const per = perViager(40, "prospectif", "F");
    expect(r.totalCapital).toBeCloseTo(28000 * per, 3);
    expect(r.totalTP).toBeCloseTo(5000 * per, 3);
    expect(r.totalReste).toBeCloseTo(23000 * per, 3);
  });

  it("renvoie 0 si aucun proche éligible", () => {
    const d: PostesDeces = { ...defaultPostesDeces(), revenuAnnuelDefunt: 40000, partConsommeeDefunt: 0.3 };
    const r = calculerPerteRevenusFoyer(d, ctx);
    expect(r.totalCapital).toBe(0);
    expect(r.periodes).toHaveLength(0);
  });

  it("ignore proche sans date de naissance", () => {
    const d: PostesDeces = {
      ...defaultPostesDeces(),
      revenuAnnuelDefunt: 40000,
      partConsommeeDefunt: 0.3,
      proches: [{ id: "c", lien: "conjoint", prenom: "", dateNaissance: null, sexe: "F", partFoyer: 1, ageFinEtudes: 25, affection: 0, pensionReversionAnnuelle: 0 }],
    };
    const r = calculerPerteRevenusFoyer(d, ctx);
    expect(r.lignes).toHaveLength(0);
    expect(r.totalCapital).toBe(0);
  });

  it("borne partConsommee entre 0 et 1", () => {
    const d: PostesDeces = { ...defaultPostesDeces(), revenuAnnuelDefunt: 10000, partConsommeeDefunt: 1.5 };
    const r = calculerPerteRevenusFoyer(d, ctx);
    expect(r.perteAnnuelleFoyer).toBe(0);
  });

  it("silencieux : méthode exacte utilisée pour le viager différé du conjoint", () => {
    const ctxExacte: ContexteDeces = { ...ctx, methodeRente: "exacte" };
    const d: PostesDeces = {
      ...defaultPostesDeces(),
      revenuAnnuelDefunt: 40000,
      partConsommeeDefunt: 0.3,
      proches: [
        { id: "c", lien: "conjoint", prenom: "A", dateNaissance: "1985-01-01", sexe: "F", partFoyer: 1, ageFinEtudes: 25, affection: 0, pensionReversionAnnuelle: 0 },
        { id: "e", lien: "enfant", prenom: "B", dateNaissance: "2015-01-01", sexe: "M", partFoyer: 1, ageFinEtudes: 25, affection: 0, pensionReversionAnnuelle: 0 },
      ],
    };
    const r = calculerPerteRevenusFoyer(d, ctxExacte);
    // Période finale viagère différée : PER conjoint période 3 = perRenteDifferee(40, 55, exacte)
    const perDiff = perRenteDifferee(40, 55, "prospectif", "F", "exacte");
    const conjLignePer3 = r.periodes[1].membres.find((m) => m.procheId === "c")!.per;
    expect(conjLignePer3).toBeCloseTo(perDiff, 6);
  });
});

describe("Survie proches — perte de revenus", () => {
  it("capitalise en viager sur âge du proche", () => {
    const r = calculerPerteRevenusSurvie(
      [{ id: "c", prenom: "X", lien: "conjoint", dateNaissance: "1985-01-01", sexe: "F", perteRevenusAnnuelle: 5000, perteRevenusTP: 0, affection: 0, pep: 0 }],
      { dateLiquidation: ctx.dateLiquidation, bareme: ctx.bareme },
    );
    expect(r.lignes).toHaveLength(1);
    expect(r.lignes[0].per).toBeCloseTo(perViager(40, "prospectif", "F"), 3);
    expect(r.totalCapital).toBeCloseTo(5000 * perViager(40, "prospectif", "F"), 3);
  });

  it("ignore lignes sans perte", () => {
    const r = calculerPerteRevenusSurvie(
      [{ id: "x", prenom: "", lien: "", dateNaissance: "1985-01-01", sexe: "I", perteRevenusAnnuelle: 0, perteRevenusTP: 0, affection: 0, pep: 0 }],
      { dateLiquidation: ctx.dateLiquidation, bareme: ctx.bareme },
    );
    expect(r.totalCapital).toBe(0);
  });

  it("droit de préférence : reste = capital − capitalTP", () => {
    const r = calculerPerteRevenusSurvie(
      [{ id: "c", prenom: "X", lien: "conjoint", dateNaissance: "1985-01-01", sexe: "F", perteRevenusAnnuelle: 5000, perteRevenusTP: 1000, affection: 0, pep: 0 }],
      { dateLiquidation: ctx.dateLiquidation, bareme: ctx.bareme },
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
      { id: "b", libelle: "y", montant: 0, tiersPayeur: 0 },
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

describe("Hydratation rétro-compatible", () => {
  it("revenuAnnuelConjoint absent → 0", async () => {
    const { hydraterDossier } = await import("@/lib/calculs/hydratation");
    const d = hydraterDossier({ postesDeces: { revenuAnnuelDefunt: 30000 } });
    expect(d.postesDeces.revenuAnnuelConjoint).toBe(0);
    expect(d.postesDeces.revenuAnnuelDefunt).toBe(30000);
  });
});
