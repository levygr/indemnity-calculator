/**
 * Espérance de vie INSEE — lookup par âge, sexe, table.
 * Valeur en jours = ENT(EV en années × 365,25).
 */

import table2020 from "@/data/mortalite_2020_2022.json";
import table2023 from "@/data/mortalite_2023_2025.json";
import type { Sexe, TableMortalite } from "./types";

interface LigneMortalite {
  age: number;
  ensemble_esperance: number;
  femmes_esperance: number;
  hommes_esperance: number;
}

const TABLES: Record<TableMortalite, LigneMortalite[]> = {
  "2020-2022": table2020 as LigneMortalite[],
  "2023-2025": table2023 as LigneMortalite[],
};

export function esperanceVieAnnees(
  age: number | null,
  sexe: Sexe,
  table: TableMortalite,
): number | null {
  if (age == null || age < 0) return null;
  const rows = TABLES[table];
  const bornedAge = Math.min(Math.max(0, Math.floor(age)), 104);
  const row = rows.find((r) => r.age === bornedAge);
  if (!row) return null;
  if (sexe === "M") return row.hommes_esperance;
  if (sexe === "F") return row.femmes_esperance;
  return row.ensemble_esperance;
}

export function esperanceVieJours(
  age: number | null,
  sexe: Sexe,
  table: TableMortalite,
): number | null {
  const ans = esperanceVieAnnees(age, sexe, table);
  return ans == null ? null : Math.trunc(ans * 365.25);
}
