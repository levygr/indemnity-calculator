/** Annualisation d'un montant selon la périodicité (5.8). */

export type Periodicite = "jour" | "semaine" | "mois" | "an";

export function annualiser(montant: number, periodicite: Periodicite): number {
  switch (periodicite) {
    case "jour":
      return montant * 365.25;
    case "semaine":
      return montant * 52.18;
    case "mois":
      return montant * 12;
    case "an":
      return montant;
  }
}
