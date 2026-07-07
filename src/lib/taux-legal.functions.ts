/**
 * Server functions pour la gestion des taux d'intérêt légal.
 * Les taux sont communs à l'utilisateur (pas rattachés à un dossier).
 * Au premier accès, la table est seedée depuis src/data/taux_legal.json.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import tauxSeed from "@/data/taux_legal.json";

export interface TauxLegalRow {
  id: string;
  debut: string;
  fin: string;
  tauxParticulier: number | null;
  tauxAutres: number | null;
  reference: string | null;
  updated_at: string;
}

interface SupabaseRow {
  id: string;
  debut: string;
  fin: string;
  taux_particulier: number | string | null;
  taux_autres: number | string | null;
  reference: string | null;
  updated_at: string;
}

function toRow(r: SupabaseRow): TauxLegalRow {
  return {
    id: r.id,
    debut: r.debut,
    fin: r.fin,
    tauxParticulier: r.taux_particulier == null ? null : Number(r.taux_particulier),
    tauxAutres: r.taux_autres == null ? null : Number(r.taux_autres),
    reference: r.reference,
    updated_at: r.updated_at,
  };
}

/**
 * Renvoie la liste des taux de l'utilisateur, en seedant la table depuis
 * le JSON si elle est vide.
 */
export const listTauxLegal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("taux_legal")
      .select("id, debut, fin, taux_particulier, taux_autres, reference, updated_at")
      .order("debut", { ascending: true });
    if (error) throw new Error(error.message);
    if (rows && rows.length > 0) return (rows as SupabaseRow[]).map(toRow);

    // Seed initial depuis src/data/taux_legal.json
    const seed = (tauxSeed.taux as Array<{
      debut: string;
      fin: string;
      tauxParticulier: number | null;
      tauxAutres: number | null;
      reference: string | null;
    }>).map((l) => ({
      user_id: context.userId,
      debut: l.debut,
      fin: l.fin,
      taux_particulier: l.tauxParticulier,
      taux_autres: l.tauxAutres,
      reference: l.reference,
    }));
    const { data: inserted, error: insErr } = await context.supabase
      .from("taux_legal")
      .insert(seed)
      .select("id, debut, fin, taux_particulier, taux_autres, reference, updated_at");
    if (insErr) throw new Error(insErr.message);
    return (inserted as SupabaseRow[])
      .map(toRow)
      .sort((a, b) => a.debut.localeCompare(b.debut));
  });

export const updateTauxLegal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        tauxParticulier: z.number().nullable(),
        tauxAutres: z.number().nullable(),
        reference: z.string().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("taux_legal")
      .update({
        taux_particulier: data.tauxParticulier,
        taux_autres: data.tauxAutres,
        reference: data.reference,
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id, debut, fin, taux_particulier, taux_autres, reference, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return toRow(row as SupabaseRow);
  });

/**
 * Ajoute le semestre civil suivant le dernier enregistré.
 * Refuse d'inventer un taux : les valeurs restent null.
 */
export const addNextSemestreTauxLegal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("taux_legal")
      .select("debut, fin")
      .order("debut", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const last = rows?.[0];
    let debut: string;
    let fin: string;
    if (!last) {
      debut = "2015-01-01";
      fin = "2015-06-30";
    } else {
      const [y, m] = last.debut.split("-").map(Number);
      if (m === 1) {
        debut = `${y}-07-01`;
        fin = `${y}-12-31`;
      } else {
        debut = `${y + 1}-01-01`;
        fin = `${y + 1}-06-30`;
      }
    }
    const { data: row, error: insErr } = await context.supabase
      .from("taux_legal")
      .insert({
        user_id: context.userId,
        debut,
        fin,
        taux_particulier: null,
        taux_autres: null,
        reference: null,
      })
      .select("id, debut, fin, taux_particulier, taux_autres, reference, updated_at")
      .single();
    if (insErr) throw new Error(insErr.message);
    return toRow(row as SupabaseRow);
  });
