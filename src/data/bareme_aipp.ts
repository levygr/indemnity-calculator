/**
 * Référentiel Intercours — valeur du point d'AIPP.
 * Lignes : tranches de taux (%). Colonnes : tranches d'âge à la consolidation.
 * Intégré en dur (petit tableau, non versionné dans les JSON).
 */

export const AIPP_TRANCHES_TAUX: Array<{ min: number; max: number; label: string }> = [
  { min: 1, max: 5, label: "1-5" },
  { min: 6, max: 10, label: "6-10" },
  { min: 11, max: 15, label: "11-15" },
  { min: 16, max: 20, label: "16-20" },
  { min: 21, max: 25, label: "21-25" },
  { min: 26, max: 30, label: "26-30" },
  { min: 31, max: 35, label: "31-35" },
  { min: 36, max: 40, label: "36-40" },
  { min: 41, max: 45, label: "41-45" },
  { min: 46, max: 50, label: "46-50" },
  { min: 51, max: 55, label: "51-55" },
  { min: 56, max: 60, label: "56-60" },
  { min: 61, max: 65, label: "61-65" },
  { min: 66, max: 70, label: "66-70" },
  { min: 71, max: 75, label: "71-75" },
  { min: 76, max: 80, label: "76-80" },
  { min: 81, max: 85, label: "81-85" },
  { min: 86, max: 90, label: "86-90" },
  { min: 91, max: 95, label: "91-95" },
  { min: 96, max: 100, label: "96+" },
];

export const AIPP_TRANCHES_AGE: Array<{ min: number; max: number; label: string }> = [
  { min: 0, max: 10, label: "0-10" },
  { min: 11, max: 20, label: "11-20" },
  { min: 21, max: 30, label: "21-30" },
  { min: 31, max: 40, label: "31-40" },
  { min: 41, max: 50, label: "41-50" },
  { min: 51, max: 60, label: "51-60" },
  { min: 61, max: 70, label: "61-70" },
  { min: 71, max: 80, label: "71-80" },
  { min: 81, max: 200, label: "81+" },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const AIPP_VALEURS_POINT: number[][] = [
  [2310, 2150, 1960, 1770, 1580, 1400, 1210, 1050, 880],
  [2670, 2475, 2255, 2035, 1800, 1560, 1320, 1130, 935],
  [3025, 2800, 2550, 2300, 2025, 1730, 1430, 1210, 990],
  [3380, 3135, 2850, 2560, 2245, 1890, 1540, 1290, 1045],
  [3740, 3465, 3145, 2830, 2465, 2060, 1650, 1375, 1100],
  [4100, 3795, 3445, 3090, 2685, 2220, 1760, 1455, 1155],
  [4455, 4125, 3740, 3355, 2905, 2390, 1870, 1540, 1210],
  [4810, 4455, 4035, 3620, 3125, 2550, 1980, 1620, 1265],
  [5170, 4785, 4335, 3885, 3345, 2715, 2090, 1705, 1320],
  [5530, 5115, 4630, 4150, 3565, 2880, 2200, 1790, 1375],
  [5885, 5445, 4930, 4410, 3785, 3045, 2310, 1870, 1430],
  [6240, 5775, 5225, 4675, 4005, 3210, 2420, 1950, 1485],
  [6600, 6105, 5520, 4940, 4225, 3375, 2530, 2035, 1540],
  [6955, 6435, 5820, 5205, 4445, 3540, 2640, 2115, 1595],
  [7315, 6765, 6115, 5470, 4665, 3705, 2750, 2200, 1650],
  [7670, 7095, 6415, 5730, 4885, 3870, 2860, 2280, 1705],
  [8030, 7425, 6710, 5995, 5105, 4035, 2970, 2365, 1760],
  [8385, 7755, 7005, 6260, 5325, 4200, 3080, 2445, 1815],
  [8745, 8085, 7305, 6525, 5545, 4365, 3190, 2530, 1870],
  [9020, 8415, 7600, 6785, 5765, 4530, 3300, 2610, 1925],
];

/** Retourne la valeur du point d'AIPP pour un taux et un âge donnés, ou 0 si hors bornes. */
export function valeurPointAIPP(tauxPct: number, ageConsolidation: number): number {
  if (!(tauxPct > 0) || ageConsolidation < 0) return 0;
  const i = AIPP_TRANCHES_TAUX.findIndex((t) => tauxPct >= t.min && tauxPct <= t.max);
  const j = AIPP_TRANCHES_AGE.findIndex((t) => ageConsolidation >= t.min && ageConsolidation <= t.max);
  if (i < 0 || j < 0) return 0;
  return AIPP_VALEURS_POINT[i][j];
}
