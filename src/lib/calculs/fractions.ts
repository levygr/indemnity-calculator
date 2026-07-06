/**
 * Fractions de réduction (faute, perte de chance) et répartition victime / tiers payeur.
 * La règle du droit de préférence de la victime s'applique partout où une créance TP existe.
 */

/** Dette du responsable pour un poste. */
export function detteResponsable(montant: number, fFaute: number, fChance: number): number {
  return montant * fFaute * fChance;
}

/**
 * Règle du droit de préférence de la victime.
 * @param montant Montant du poste (M)
 * @param tiersPayeur Créance du tiers payeur (TP)
 * @param dette Dette du responsable (D)
 * @returns { victime, tiersPayeur }
 */
export function repartition(
  montant: number,
  tiersPayeur: number,
  dette: number,
): { victime: number; tiersPayeur: number } {
  const V = Math.min(Math.max(0, montant - tiersPayeur), dette);
  const T = Math.min(Math.max(0, dette - V), tiersPayeur);
  return { victime: V, tiersPayeur: T };
}
