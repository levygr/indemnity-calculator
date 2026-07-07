/**
 * Server functions pour la gestion des dossiers d'indemnisation.
 * Toutes les fonctions requièrent une session Supabase authentifiée.
 * L'accès (personnel / organisation) est arbitré par RLS.
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
  organisation_id: string | null;
  user_id: string;
}

export interface SnapshotRow {
  id: string;
  dossier_id: string;
  nom: string;
  created_at: string;
  data: DossierData;
  synthese: Synthese;
}

export interface DossierEventRow {
  id: string;
  dossier_id: string;
  user_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}


type Jsonish = Parameters<typeof JSON.stringify>[0];

// Journalisation : écrite côté serveur uniquement (pas de politique INSERT).
async function logEvent(
  dossierId: string,
  userId: string,
  action: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("dossier_events").insert({
      dossier_id: dossierId,
      user_id: userId,
      action,
      details: (details ?? null) as unknown as Jsonish,
    });
  } catch {
    // Non bloquant : le journal ne doit jamais empêcher l'action métier.
  }
}

export const listDossiers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("dossiers")
      .select("id, reference, data, created_at, updated_at, organisation_id, user_id")
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
      .select("id, reference, data, created_at, updated_at, organisation_id, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Dossier introuvable");
    return row as unknown as DossierRow;
  });

export const createDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        reference: z.string().min(1).max(200).optional(),
        organisationId: z.string().uuid().optional(),
      })
      .parse(input),
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
        organisation_id: data.organisationId ?? null,
      })
      .select("id, reference, data, created_at, updated_at, organisation_id, user_id")
      .single();
    if (error) throw new Error(error.message);
    await logEvent(row.id, context.userId, "create");
    return row as unknown as DossierRow;
  });

export const updateDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        reference: z.string().min(1).max(200),
        data: z.record(z.string(), z.unknown()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Lecture préalable pour calculer les clés de premier niveau modifiées.
    const { data: prev } = await context.supabase
      .from("dossiers")
      .select("data, reference")
      .eq("id", data.id)
      .maybeSingle();
    const prevData = ((prev?.data ?? {}) as Record<string, unknown>) || {};
    const changedKeys = new Set<string>();
    const allKeys = new Set<string>([...Object.keys(prevData), ...Object.keys(data.data)]);
    for (const k of allKeys) {
      const a = JSON.stringify(prevData[k] ?? null);
      const b = JSON.stringify((data.data as Record<string, unknown>)[k] ?? null);
      if (a !== b) changedKeys.add(k);
    }
    if (prev && prev.reference !== data.reference) changedKeys.add("reference");

    const { data: row, error } = await context.supabase
      .from("dossiers")
      .update({ reference: data.reference, data: data.data as unknown as Jsonish })
      .eq("id", data.id)
      .select("id, reference, data, created_at, updated_at, organisation_id, user_id")
      .single();
    if (error) throw new Error(error.message);
    if (changedKeys.size > 0) {
      await logEvent(data.id, context.userId, "update", { keys: Array.from(changedKeys) });
    }
    return row as unknown as DossierRow;
  });

export const deleteDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Journaliser avant suppression (cascade supprimerait les events).
    await logEvent(data.id, context.userId, "delete");
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
      .select("reference, data, organisation_id")
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
        organisation_id: source.organisation_id,
      })
      .select("id, reference, data, created_at, updated_at, organisation_id, user_id")
      .single();
    if (insErr) throw new Error(insErr.message);
    await logEvent(row.id, context.userId, "create", { source: data.id });
    return row as unknown as DossierRow;
  });

export const attachDossierToOrganisation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        dossierId: z.string().uuid(),
        organisationId: z.string().uuid().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Vérifier que l'utilisateur est propriétaire (seul le propriétaire peut partager).
    const { data: d } = await context.supabase
      .from("dossiers")
      .select("id, user_id")
      .eq("id", data.dossierId)
      .maybeSingle();
    if (!d) throw new Error("Dossier introuvable");
    if (d.user_id !== context.userId)
      throw new Error("Seul le propriétaire peut modifier le partage");

    const { error } = await context.supabase
      .from("dossiers")
      .update({ organisation_id: data.organisationId })
      .eq("id", data.dossierId);
    if (error) throw new Error(error.message);
    await logEvent(data.dossierId, context.userId, data.organisationId ? "share" : "unshare", {
      organisation_id: data.organisationId,
    });
    return { ok: true as const };
  });

// ============================================================================
// Snapshots
// ============================================================================

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
    const { data: dossierRow, error: dErr } = await context.supabase
      .from("dossiers")
      .select("data")
      .eq("id", data.dossierId)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!dossierRow) throw new Error("Dossier introuvable");
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
    await logEvent(data.dossierId, context.userId, "snapshot_create", { nom: data.nom });
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
    const { data: snap } = await context.supabase
      .from("dossier_snapshots")
      .select("dossier_id, nom")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("dossier_snapshots")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (snap) {
      await logEvent(snap.dossier_id, context.userId, "snapshot_delete", { nom: snap.nom });
    }
    return { ok: true as const };
  });

// ============================================================================
// Journal d'activité
// ============================================================================

export interface DossierEventWithUser extends DossierEventRow {
  user_email: string | null;
}

export const listDossierEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ dossierId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("dossier_events")
      .select("id, dossier_id, user_id, action, details, created_at")
      .eq("dossier_id", data.dossierId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    // Enrichir avec emails (service role — lecture seule).
    const userIds = Array.from(
      new Set((rows ?? []).map((r) => r.user_id).filter((v): v is string => !!v)),
    );
    const emails = new Map<string, string>();
    if (userIds.length > 0) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: users } = await supabaseAdmin
          .schema("auth")
          .from("users")
          .select("id, email")
          .in("id", userIds);
        for (const u of users ?? []) {
          if (u.email) emails.set(u.id as string, u.email as string);
        }
      } catch {
        // ignore
      }
    }
    return (rows ?? []).map((r) => ({
      ...(r as unknown as DossierEventRow),
      user_email: r.user_id ? emails.get(r.user_id) ?? null : null,
    })) as DossierEventWithUser[];
  });

export const logDossierAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        dossierId: z.string().uuid(),
        action: z.enum(["export_pdf", "export_word"]),
        details: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // RLS vérifie l'accès en lecture ; on relit pour confirmer.
    const { data: d } = await context.supabase
      .from("dossiers")
      .select("id")
      .eq("id", data.dossierId)
      .maybeSingle();
    if (!d) throw new Error("Dossier introuvable");
    await logEvent(data.dossierId, context.userId, data.action, data.details);
    return { ok: true as const };
  });
