/**
 * Utilitaires de dates : parsing ISO, DATEDIF "Y" (années révolues), DATEDIF "d" (jours).
 * Aucun arrondi intermédiaire. Retourne null si l'une des dates est absente/invalide.
 */

export function parseISO(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  // YYYY-MM-DD → date UTC minuit pour éviter tout décalage de fuseau.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return isNaN(d.getTime()) ? null : d;
}

export function toISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const j = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${j}`;
}

/** Équivalent DATEDIF(a, b, "Y") : années entières révolues entre a et b. */
export function anneesRevolues(a: string | null, b: string | null): number | null {
  const da = parseISO(a);
  const db = parseISO(b);
  if (!da || !db) return null;
  let ans = db.getUTCFullYear() - da.getUTCFullYear();
  const anniv = new Date(
    Date.UTC(db.getUTCFullYear(), da.getUTCMonth(), da.getUTCDate()),
  );
  if (db.getTime() < anniv.getTime()) ans -= 1;
  return ans;
}

/** Équivalent DATEDIF(a, b, "d") : différence en jours entiers. */
export function joursEntre(a: string | null, b: string | null): number | null {
  const da = parseISO(a);
  const db = parseISO(b);
  if (!da || !db) return null;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function ajouterJours(iso: string, jours: number): string {
  const d = parseISO(iso);
  if (!d) return iso;
  d.setUTCDate(d.getUTCDate() + jours);
  return toISODate(d);
}

export function anneeDe(iso: string | null): number | null {
  const d = parseISO(iso);
  return d ? d.getUTCFullYear() : null;
}

export function moisDe(iso: string | null): number | null {
  const d = parseISO(iso);
  return d ? d.getUTCMonth() + 1 : null; // 1..12
}
