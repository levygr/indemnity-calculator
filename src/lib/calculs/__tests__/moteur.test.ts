import { describe, expect, it } from "vitest";
import {
  anneesRevolues,
  joursEntre,
  ajouterJours,
} from "../dates";
import { detteResponsable, repartition } from "../fractions";
import { annualiser } from "../annualisation";
import {
  ipcAnnuel,
  actualiserRevenu,
  revaloriserReste,
} from "../revalorisation";
import { esperanceVieAnnees, esperanceVieJours } from "../esperance";
import { perViager, perTemporaire, perRenteDifferee } from "../capitalisation";

describe("dates", () => {
  it("années révolues (DATEDIF Y)", () => {
    expect(anneesRevolues("1990-06-15", "2020-06-14")).toBe(29);
    expect(anneesRevolues("1990-06-15", "2020-06-15")).toBe(30);
    expect(anneesRevolues("1990-06-15", "2020-06-16")).toBe(30);
  });
  it("jours entre (DATEDIF d)", () => {
    expect(joursEntre("2024-01-01", "2024-01-31")).toBe(30);
    expect(joursEntre("2024-02-01", "2024-03-01")).toBe(29);
  });
  it("ajouterJours", () => {
    expect(ajouterJours("2024-02-28", 1)).toBe("2024-02-29");
  });
});

describe("fractions et répartition victime / tiers payeur", () => {
  it("dette = M × fFaute × fChance", () => {
    expect(detteResponsable(1000, 0.5, 1)).toBe(500);
    expect(detteResponsable(1000, 0.8, 0.5)).toBe(400);
  });
  it("V = MIN(MAX(0, M − TP), D) ; T = MIN(MAX(0, D − V), TP)", () => {
    // Cas classique : TP couvre partie, victime reçoit reste dans limite dette
    expect(repartition(1000, 300, 800)).toEqual({ victime: 700, tiersPayeur: 100 });
    // Dette < TP : la victime touche uniquement M − TP jusqu'à concurrence de D
    expect(repartition(1000, 900, 500)).toEqual({ victime: 100, tiersPayeur: 400 });
    // TP > M : la victime ne touche rien, TP absorbe dette
    expect(repartition(1000, 1500, 800)).toEqual({ victime: 0, tiersPayeur: 800 });
  });
});

describe("annualisation", () => {
  it("facteurs de conversion", () => {
    expect(annualiser(1, "jour")).toBeCloseTo(365.25);
    expect(annualiser(1, "semaine")).toBeCloseTo(52.18);
    expect(annualiser(1, "mois")).toBe(12);
    expect(annualiser(1, "an")).toBe(1);
  });
});

describe("indices IPC et actualisation", () => {
  it("ipc annuel présent", () => {
    expect(ipcAnnuel(2015)).toBe(100);
    expect(ipcAnnuel(2025)).toBe(119.82);
  });
  it("actualiser revenu 2015 vers 2025 (IPC)", () => {
    expect(actualiserRevenu(1000, 2015, 2025, "ipc")).toBeCloseTo(1198.2, 4);
  });
  it("revaloriser dépense (mode non)", () => {
    expect(revaloriserReste(500, "2020-05-01", "2025-06-01", "non")).toBe(500);
  });
});

describe("espérance de vie", () => {
  it("EV homme âge 30 table 2020-2022", () => {
    const ev = esperanceVieAnnees(30, "M", "2020-2022");
    expect(ev).toBeGreaterThan(40);
  });
  it("EV en jours = trunc(EV × 365,25)", () => {
    const evAns = esperanceVieAnnees(30, "F", "2023-2025")!;
    expect(esperanceVieJours(30, "F", "2023-2025")).toBe(Math.trunc(evAns * 365.25));
  });
});

describe("PER — cas de contrôle du prompt", () => {
  it("Femme, table stationnaire, âge 30 → PER viager = 47,919", () => {
    // valeur à la colonne 104 (viagère stationnaire)
    expect(perViager(30, "stationnaire", "F")).toBeCloseTo(47.919, 3);
  });
  it("Homme, table prospective, âge 30 → PER viager = 51,328", () => {
    // valeur à la colonne 90 (viagère prospective)
    expect(perViager(30, "prospectif", "M")).toBeCloseTo(51.328, 3);
  });
});

describe("PER — temporaire, différé, prospectif > 90", () => {
  it("PER temporaire cohérent avec table (femme stat, 30 → 65)", () => {
    const v = perTemporaire(30, 65, "stationnaire", "F");
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(perViager(30, "stationnaire", "F"));
  });
  it("prospectif : ageFin > 90 retombe sur viager", () => {
    const viager = perViager(30, "prospectif", "M");
    expect(perTemporaire(30, 95, "prospectif", "M")).toBe(viager);
  });
  it("rente différée — méthode habituelle = viager(âgeDébut)", () => {
    const v = perRenteDifferee(40, 62, "stationnaire", "F", "habituelle");
    expect(v).toBe(perViager(62, "stationnaire", "F"));
  });
  it("rente différée — méthode exacte = viager(liq) − temp(liq→début)", () => {
    const v = perRenteDifferee(40, 62, "stationnaire", "F", "exacte");
    const attendu = perViager(40, "stationnaire", "F") - perTemporaire(40, 62, "stationnaire", "F");
    expect(v).toBeCloseTo(attendu, 6);
  });
});
