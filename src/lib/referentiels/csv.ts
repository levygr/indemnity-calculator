/**
 * Import / export CSV pour les référentiels matriciels (PER et AIPP).
 *
 * Formats supportés :
 *  - `bareme_*_2025` (PER) : première colonne `age_liquidation`, puis
 *    les âges de fin de rente (`ages_fin_de_rente`) puis `viagere`.
 *  - `bareme_aipp` : première colonne = libellé de tranche de taux
 *    (`min-max`), puis une colonne par tranche d'âge.
 *
 * Le parseur/sérialiseur est volontairement strict : la structure et
 * les dimensions doivent correspondre exactement à l'édition source,
 * sinon l'import est refusé. Cela garantit qu'un diff ne modifie que
 * des cellules et jamais la topologie du barème.
 */

import { REGISTRY } from "./registry";
import type { AippPayload } from "./registry";

export type MatrixKind = "per" | "aipp";

export function detectMatrixKind(code: string): MatrixKind | null {
  if (code === "bareme_aipp") return "aipp";
  if (code.startsWith("bareme_") && code.endsWith("_2025")) return "per";
  return null;
}

/* -------------------------------------------------------------------------- */
/*  CSV utilitaires                                                            */
/* -------------------------------------------------------------------------- */

function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === "," || c === ";" || c === "\t") {
      cur.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\n" || c === "\r") {
      cur.push(field);
      field = "";
      rows.push(cur);
      cur = [];
      if (c === "\r" && text[i + 1] === "\n") i += 2;
      else i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows
    .filter((r) => !(r.length === 1 && r[0].trim() === ""))
    .map((r) => r.map((f) => f.trim()));
}

function toCsvText(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((f) => {
          const s = String(f);
          if (/[",;\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
          return s;
        })
        .join(","),
    )
    .join("\n");
}

function parseNumberOrNull(raw: string): number | null {
  const s = raw.replace(/\s/g, "").replace(",", ".");
  if (s === "" || s.toLowerCase() === "null") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`Nombre invalide : « ${raw} »`);
  return n;
}

function parseNumber(raw: string): number {
  const n = parseNumberOrNull(raw);
  if (n === null) throw new Error("Cellule vide");
  return n;
}

function fmtNumeric(v: number | null): string | number {
  return v === null ? "" : v;
}

/* -------------------------------------------------------------------------- */
/*  PER                                                                        */
/* -------------------------------------------------------------------------- */

interface PerPayload {
  description: string;
  colonne_viagere: number;
  ages_fin_de_rente: number[];
  lignes: { age_liquidation: number; prix: (number | null)[] }[];
}

export function perToCsv(payload: PerPayload): string {
  const header = [
    "age_liquidation",
    ...payload.ages_fin_de_rente.map((a) => String(a)),
    "viagere",
  ];
  const rows: (string | number)[][] = [header];
  for (const ligne of payload.lignes) {
    const prixHead = ligne.prix.slice(0, payload.ages_fin_de_rente.length);
    const viagere = ligne.prix[ligne.prix.length - 1];
    rows.push([
      ligne.age_liquidation,
      ...prixHead.map(fmtNumeric),
      fmtNumeric(viagere),
    ]);
  }
  return toCsvText(rows);
}

export function perFromCsv(csv: string, reference: PerPayload): PerPayload {
  const rows = parseCsvText(csv);
  if (rows.length < 2) throw new Error("Le CSV doit contenir un en-tête et au moins une ligne.");
  const header = rows[0];
  const expectedHeader = [
    "age_liquidation",
    ...reference.ages_fin_de_rente.map((a) => String(a)),
    "viagere",
  ];
  if (header.length !== expectedHeader.length) {
    throw new Error(
      `En-tête invalide : ${header.length} colonnes reçues, ${expectedHeader.length} attendues.`,
    );
  }
  for (let i = 0; i < header.length; i++) {
    if (header[i] !== expectedHeader[i]) {
      throw new Error(
        `Colonne ${i + 1} attendue « ${expectedHeader[i]} », reçue « ${header[i] || "vide"} ».`,
      );
    }
  }
  const body = rows.slice(1);
  if (body.length !== reference.lignes.length) {
    throw new Error(
      `${body.length} lignes reçues, ${reference.lignes.length} attendues.`,
    );
  }
  const lignes = body.map((row, idx) => {
    if (row.length !== expectedHeader.length) {
      throw new Error(
        `Ligne ${idx + 2} : ${row.length} colonnes, ${expectedHeader.length} attendues.`,
      );
    }
    const ageLiq = parseNumber(row[0]);
    const expectedAge = reference.lignes[idx].age_liquidation;
    if (ageLiq !== expectedAge) {
      throw new Error(
        `Ligne ${idx + 2} : âge de liquidation « ${row[0]} » ≠ « ${expectedAge} ».`,
      );
    }
    const prix: (number | null)[] = [];
    for (let j = 1; j < row.length; j++) {
      prix.push(parseNumberOrNull(row[j]));
    }
    return { age_liquidation: ageLiq, prix };
  });
  return {
    description: reference.description,
    colonne_viagere: reference.colonne_viagere,
    ages_fin_de_rente: reference.ages_fin_de_rente,
    lignes,
  };
}

/* -------------------------------------------------------------------------- */
/*  AIPP                                                                       */
/* -------------------------------------------------------------------------- */

export function aippToCsv(payload: AippPayload): string {
  const header = ["tranche_taux", ...payload.tranchesAge.map((t) => t.label)];
  const rows: (string | number)[][] = [header];
  payload.tranchesTaux.forEach((t, i) => {
    rows.push([t.label, ...payload.valeursPoint[i]]);
  });
  return toCsvText(rows);
}

export function aippFromCsv(csv: string, reference: AippPayload): AippPayload {
  const rows = parseCsvText(csv);
  if (rows.length < 2) throw new Error("Le CSV doit contenir un en-tête et au moins une ligne.");
  const header = rows[0];
  const expectedHeader = ["tranche_taux", ...reference.tranchesAge.map((t) => t.label)];
  if (header.length !== expectedHeader.length) {
    throw new Error(
      `En-tête invalide : ${header.length} colonnes reçues, ${expectedHeader.length} attendues.`,
    );
  }
  for (let i = 0; i < header.length; i++) {
    if (header[i] !== expectedHeader[i]) {
      throw new Error(
        `Colonne ${i + 1} attendue « ${expectedHeader[i]} », reçue « ${header[i]} ».`,
      );
    }
  }
  const body = rows.slice(1);
  if (body.length !== reference.tranchesTaux.length) {
    throw new Error(
      `${body.length} lignes reçues, ${reference.tranchesTaux.length} attendues.`,
    );
  }
  const valeursPoint = body.map((row, idx) => {
    const attendu = reference.tranchesTaux[idx].label;
    if (row[0] !== attendu) {
      throw new Error(
        `Ligne ${idx + 2} : libellé de tranche « ${row[0]} » ≠ « ${attendu} ».`,
      );
    }
    if (row.length !== expectedHeader.length) {
      throw new Error(
        `Ligne ${idx + 2} : ${row.length} colonnes, ${expectedHeader.length} attendues.`,
      );
    }
    return row.slice(1).map((v) => parseNumber(v));
  });
  return { ...reference, valeursPoint };
}

/* -------------------------------------------------------------------------- */
/*  Diff cellule par cellule                                                   */
/* -------------------------------------------------------------------------- */

export interface CellDiff {
  path: string;
  before: number | null;
  after: number | null;
}

export function perDiff(a: PerPayload, b: PerPayload): CellDiff[] {
  const diffs: CellDiff[] = [];
  const ages = a.ages_fin_de_rente;
  for (let i = 0; i < a.lignes.length; i++) {
    const la = a.lignes[i];
    const lb = b.lignes[i];
    for (let j = 0; j < la.prix.length; j++) {
      if (la.prix[j] !== lb.prix[j]) {
        const colLabel = j < ages.length ? String(ages[j]) : "viagere";
        diffs.push({
          path: `âge liq. ${la.age_liquidation} → fin ${colLabel}`,
          before: la.prix[j],
          after: lb.prix[j],
        });
      }
    }
  }
  return diffs;
}

export function aippDiff(a: AippPayload, b: AippPayload): CellDiff[] {
  const diffs: CellDiff[] = [];
  for (let i = 0; i < a.valeursPoint.length; i++) {
    for (let j = 0; j < a.valeursPoint[i].length; j++) {
      if (a.valeursPoint[i][j] !== b.valeursPoint[i][j]) {
        diffs.push({
          path: `taux ${a.tranchesTaux[i].label} × âge ${a.tranchesAge[j].label}`,
          before: a.valeursPoint[i][j],
          after: b.valeursPoint[i][j],
        });
      }
    }
  }
  return diffs;
}

/* -------------------------------------------------------------------------- */
/*  API unifiée                                                                */
/* -------------------------------------------------------------------------- */

export interface MatrixHandler {
  kind: MatrixKind;
  toCsv: (payload: unknown) => string;
  fromCsv: (csv: string, ref: unknown) => unknown;
  diff: (a: unknown, b: unknown) => CellDiff[];
  refPayload: unknown;
}

export function getMatrixHandler(code: string): MatrixHandler | null {
  const kind = detectMatrixKind(code);
  if (!kind) return null;
  const def = REGISTRY.find((d) => d.code === code);
  if (!def) return null;
  if (kind === "per") {
    return {
      kind,
      toCsv: (p) => perToCsv(p as PerPayload),
      fromCsv: (csv, ref) => perFromCsv(csv, ref as PerPayload),
      diff: (a, b) => perDiff(a as PerPayload, b as PerPayload),
      refPayload: def.payload,
    };
  }
  return {
    kind,
    toCsv: (p) => aippToCsv(p as AippPayload),
    fromCsv: (csv, ref) => aippFromCsv(csv, ref as AippPayload),
    diff: (a, b) => aippDiff(a as AippPayload, b as AippPayload),
    refPayload: def.payload,
  };
}
