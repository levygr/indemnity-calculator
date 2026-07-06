/** Formatage FR pour affichage. Aucun arrondi appliqué en amont dans le moteur. */

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUM2 = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUM0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function formatEuros(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return EUR.format(v);
}

export function formatNombre(v: number | null | undefined, decimales = 2): string {
  if (v == null || !isFinite(v)) return "—";
  return decimales === 0 ? NUM0.format(v) : NUM2.format(v);
}

export function formatDateFR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatPourcentage(v: number | null | undefined, decimales = 0): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: decimales })} %`;
}
