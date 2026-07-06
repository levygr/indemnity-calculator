/**
 * Helper de construction d'URL de recherche Themia.
 *
 * Themia est le moteur de recherche de décisions du cabinet. En l'absence d'API
 * publique, on construit une URL de recherche paramétrée que l'utilisateur peut
 * ouvrir dans un onglet séparé pour retrouver des décisions comparables.
 */

export interface ThemiaContext {
  faitGenerateur?: string;
  age?: number | null;
  tauxAIPP?: number | null;
  cotation?: number | null;
  motsCles?: string[];
}

const BASE = "https://www.themia.legal/rechercher";

export function themiaLink(poste: string, ctx: ThemiaContext): string {
  const parts: string[] = [poste];
  if (ctx.faitGenerateur) parts.push(ctx.faitGenerateur);
  if (ctx.motsCles) parts.push(...ctx.motsCles);
  const q = parts.filter(Boolean).join(" ");
  const params = new URLSearchParams({ q });
  if (ctx.age != null) {
    params.set("ageMin", String(Math.max(0, ctx.age - 5)));
    params.set("ageMax", String(ctx.age + 5));
  }
  if (ctx.tauxAIPP != null && ctx.tauxAIPP > 0) {
    params.set("aippMin", String(Math.max(0, ctx.tauxAIPP - 5)));
    params.set("aippMax", String(Math.min(100, ctx.tauxAIPP + 5)));
  }
  if (ctx.cotation != null && ctx.cotation > 0) {
    params.set("cotationMin", String(Math.max(0, ctx.cotation - 1)));
    params.set("cotationMax", String(Math.min(7, ctx.cotation + 1)));
  }
  return `${BASE}?${params.toString()}`;
}
