/**
 * Import CSV pour les référentiels matriciels (PER et AIPP) sur une
 * édition en statut « brouillon ».
 *
 * - `previewCsv` : parse le CSV, reconstruit la payload, calcule le diff
 *   cellule par cellule contre la payload actuelle du brouillon. Ne
 *   modifie rien.
 * - `applyCsv` : rejoue la même reconstruction et remplace la ligne
 *   unique `{ type: "full" }` du brouillon. Une entrée `journal_audit`
 *   récapitule le nombre de cellules modifiées.
 *
 * Le format et les dimensions doivent correspondre exactement à la
 * payload actuelle du brouillon (ou, à défaut, à la payload seedée) :
 * seule la valeur des cellules peut différer.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { getMatrixHandler, type CellDiff } from "./csv";
import { REGISTRY } from "./registry";

type SupaClient = import("@supabase/supabase-js").SupabaseClient;

async function loadDraftPayload(
  supabase: SupaClient,
  editionId: string,
  code: string,
) {
  const { data: ed, error } = await supabase
    .from("editions")
    .select("id, statut, referentiel_id")
    .eq("id", editionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!ed) throw new Error("Édition introuvable.");
  if (ed.statut !== "brouillon")
    throw new Error("Seul un brouillon peut être importé.");

  const def = REGISTRY.find((d) => d.code === code);
  if (!def) throw new Error(`Référentiel « ${code} » inconnu.`);

  const { data: rows, error: rerr } = await supabase
    .from("valeurs")
    .select("id, cle, valeur")
    .eq("edition_id", editionId);
  if (rerr) throw new Error(rerr.message);

  let payload: unknown = def.payload;
  const fullRow = (rows ?? []).find(
    (r) =>
      r.cle &&
      typeof r.cle === "object" &&
      (r.cle as { type?: string }).type === "full",
  );
  if (fullRow) payload = fullRow.valeur as unknown;

  return { edition: ed, def, currentPayload: payload, fullRowId: fullRow?.id as string | undefined };
}

export interface CsvPreview {
  diffs: CellDiff[];
  total: number;
}

export const previewCsvImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        editionId: z.string().uuid(),
        code: z.string().min(1),
        csv: z.string().min(1).max(2_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<CsvPreview> => {
    const supabase = context.supabase;
    const handler = getMatrixHandler(data.code);
    if (!handler)
      throw new Error(
        "Import CSV disponible uniquement pour les barèmes PER et AIPP.",
      );
    const { currentPayload } = await loadDraftPayload(
      supabase,
      data.editionId,
      data.code,
    );
    const next = handler.fromCsv(data.csv, currentPayload);
    const diffs = handler.diff(currentPayload, next);
    return { diffs, total: diffs.length };
  });

export const applyCsvImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        editionId: z.string().uuid(),
        code: z.string().min(1),
        csv: z.string().min(1).max(2_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ changed: number }> => {
    const supabase = context.supabase;
    const { data: canEdit } = await supabase.rpc("can_edit_referentiels", {
      _user: context.userId,
    });
    if (!canEdit) throw new Error("Accès refusé (administrateur requis).");

    const handler = getMatrixHandler(data.code);
    if (!handler)
      throw new Error(
        "Import CSV disponible uniquement pour les barèmes PER et AIPP.",
      );

    const { edition, currentPayload, fullRowId } = await loadDraftPayload(
      supabase,
      data.editionId,
      data.code,
    );
    const next = handler.fromCsv(data.csv, currentPayload);
    const diffs = handler.diff(currentPayload, next);

    if (fullRowId) {
      const { error } = await supabase
        .from("valeurs")
        .update({ valeur: next as unknown as Json })
        .eq("id", fullRowId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("valeurs").insert({
        edition_id: data.editionId,
        cle: { type: "full" } as unknown as Json,
        valeur: next as unknown as Json,
      });
      if (error) throw new Error(error.message);
    }

    await supabase.from("journal_audit").insert({
      referentiel_id: edition.referentiel_id as string,
      edition_id: data.editionId,
      action: "csv_importe",
      details: {
        cellules_modifiees: diffs.length,
        exemples: diffs.slice(0, 10),
      } as unknown as Json,
      user_id: context.userId,
    });

    return { changed: diffs.length };
  });
