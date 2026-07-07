/**
 * Server functions pour la gestion des dossiers d'indemnisation.
 * Toutes les fonctions requièrent une session Supabase authentifiée (RLS par user_id).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { defaultDossierData, type DossierData } from "@/lib/calculs/types";
import { calculerSynthese } from "@/lib/calculs";
import type { Synthese } from "@/lib/calculs/postes/synthese";
import { hydraterDossier } from "@/lib/calculs/hydratation";

export interface DossierRow {
  id: string;
  reference: string;
  data: DossierData;
  created_at: string;
  updated_at: string;
}

export interface SnapshotRow {
  id: string;
  dossier_id: string;
  nom: string;
  created_at: string;
  data: DossierData;
  synthese: Synthese;
}

// La colonne `data` est un jsonb côté DB. Le moteur de calcul est la source de
// vérité de la forme ; on cast à la lecture et à l'écriture.
type Jsonish = Parameters<typeof JSON.stringify>[0];

export const listDossiers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("dossiers")
      .select("id, reference, data, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as DossierRow[];
  });

export const getDossier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("dossiers")
      .select("id, reference, data, created_at, updated_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Dossier introuvable");
    return row as unknown as DossierRow;
  });

export const createDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ reference: z.string().min(1).max(200).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const initial = defaultDossierData();
    if (data.reference) initial.reference = data.reference;
    const { data: row, error } = await context.supabase
      .from("dossiers")
      .insert({
        user_id: context.userId,
        reference: initial.reference,
        data: initial as unknown as Jsonish,
      })
      .select("id, reference, data, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as DossierRow;
  });

export const updateDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        reference: z.string().min(1).max(200),
        // On stocke le champ jsonb en bloc. La validation fine relève du moteur de calcul.
        data: z.record(z.string(), z.unknown()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("dossiers")
      .update({ reference: data.reference, data: data.data as unknown as Jsonish })
      .eq("id", data.id)
      .select("id, reference, data, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as DossierRow;
  });

export const deleteDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("dossiers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const duplicateDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: source, error } = await context.supabase
      .from("dossiers")
      .select("reference, data")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!source) throw new Error("Dossier source introuvable");

    const { data: row, error: insErr } = await context.supabase
      .from("dossiers")
      .insert({
        user_id: context.userId,
        reference: `${source.reference} (copie)`,
        data: source.data,
      })
      .select("id, reference, data, created_at, updated_at")
      .single();
    if (insErr) throw new Error(insErr.message);
    return row as unknown as DossierRow;
  });

// ============================================================================
// Snapshots — chiffrages figés datés
// ============================================================================

async function assertOwnsDossier(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  dossierId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("dossiers")
    .select("id")
    .eq("id", dossierId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Dossier introuvable");
}

export const createSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        dossierId: z.string().uuid(),
        nom: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwnsDossier(context.supabase, data.dossierId, context.userId);
    const { data: dossierRow, error: dErr } = await context.supabase
      .from("dossiers")
      .select("data")
      .eq("id", data.dossierId)
      .single();
    if (dErr) throw new Error(dErr.message);
    const dossier = hydraterDossier((dossierRow.data ?? {}) as Record<string, unknown>);
    const synthese = calculerSynthese(dossier);
    const { data: row, error } = await context.supabase
      .from("dossier_snapshots")
      .insert({
        dossier_id: data.dossierId,
        user_id: context.userId,
        nom: data.nom,
        data: dossier as unknown as Jsonish,
        synthese: synthese as unknown as Jsonish,
      })
      .select("id, dossier_id, nom, created_at, data, synthese")
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as SnapshotRow;
  });

export const listSnapshots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ dossierId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("dossier_snapshots")
      .select("id, dossier_id, nom, created_at, synthese")
      .eq("dossier_id", data.dossierId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as Array<
      Pick<SnapshotRow, "id" | "dossier_id" | "nom" | "created_at" | "synthese">
    >;
  });

export const getSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("dossier_snapshots")
      .select("id, dossier_id, nom, created_at, data, synthese")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Chiffrage figé introuvable");
    return row as unknown as SnapshotRow;
  });

export const deleteSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("dossier_snapshots")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
