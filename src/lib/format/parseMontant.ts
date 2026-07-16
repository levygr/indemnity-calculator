/**
 * Parseur tolérant pour les montants en euros saisis manuellement ou copiés
 * depuis Excel / Word.
 *
 * Accepte : virgule décimale, point décimal, espaces (normal, U+00A0 insécable,
 * U+202F insécable étroit), symbole €, signes − / – / — normalisés en `-`.
 *
 * Distingue explicitement :
 *   - `""` (vide) → { ok: true, value: null }
 *   - `"0"`       → { ok: true, value: 0 }
 *   - `"abc"`     → { ok: false }
 *
 * Ne convertit jamais silencieusement une saisie invalide en 0.
 */

const MINUS_LIKE = /[−–—]/g;

export type ParseMontantResult =
  | { ok: true; value: number | null }
  | { ok: false };

export function parseMontant(raw: string | null | undefined): ParseMontantResult {
  if (raw == null) return { ok: true, value: null };
  let s = String(raw).trim();
  if (s === "") return { ok: true, value: null };
  s = s.replace(MINUS_LIKE, "-");
  s = s.replace(/[\s\u00A0\u202F€]/g, "");
  if (s === "" || s === "-" || s === "+") return { ok: false };

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    if (s.indexOf(",") !== s.lastIndexOf(",")) return { ok: false };
    s = s.replace(",", ".");
  } else if (hasDot) {
    if (s.indexOf(".") !== s.lastIndexOf(".")) return { ok: false };
  }

  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return { ok: false };
  const n = Number(s);
  if (!isFinite(n)) return { ok: false };
  return { ok: true, value: n };
}

/** Format d'affichage FR sans symbole € (utilisé dans les inputs au blur). */
const NUM_FR = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMontantFR(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "";
  return NUM_FR.format(v);
}
