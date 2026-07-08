/**
 * Server functions pour la gestion des organisations (cabinets).
 * L'ajout de membres par email nécessite le service role pour lire auth.users.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OrgRole = "admin" | "avocat" | "assistant";

export interface OrganisationRow {
  id: string;
  nom: string;
  created_at: string;
}

export interface OrganisationMembre {
  organisation_id: string;
  user_id: string;
  role: OrgRole;
  email: string | null;
  created_at: string;
}

/**
 * Récupère la (première) organisation dont l'utilisateur est membre,
 * ou null s'il n'appartient à aucune.
 */
export const getMyOrganisation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: mem, error: mErr } = await context.supabase
      .from("organisation_membres")
      .select("organisation_id, role")
      .eq("user_id", context.userId)
      .limit(1)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!mem) return null;

    const { data: org, error } = await context.supabase
      .from("organisations")
      .select("id, nom, created_at")
      .eq("id", mem.organisation_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!org) return null;
    return {
      organisation: org as OrganisationRow,
      role: mem.role as OrgRole,
    };
  });

export const createOrganisation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ nom: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("create_organisation", {
      _nom: data.nom,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error("Création du cabinet impossible");
    return row as OrganisationRow;
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organisationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("organisation_membres")
      .select("organisation_id, user_id, role, created_at")
      .eq("organisation_id", data.organisationId);
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.user_id);
    const emails = new Map<string, string>();
    if (ids.length > 0) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        for (const uid of ids) {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
          if (u?.user?.email) emails.set(uid, u.user.email);
        }
      } catch {
        // ignore
      }
    }
    return (rows ?? []).map((r) => ({
      ...r,
      role: r.role as OrgRole,
      email: emails.get(r.user_id) ?? null,
    })) as OrganisationMembre[];
  });

async function assertAdmin(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  organisationId: string,
  userId: string,
): Promise<void> {
  const { data } = await supabase
    .from("organisation_membres")
    .select("role")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.role !== "admin")
    throw new Error("Seul un admin peut effectuer cette action");
}

export const addMemberByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organisationId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(["admin", "avocat", "assistant"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, data.organisationId, context.userId);

    // Trouver l'utilisateur par email via l'API admin.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let targetId: string | null = null;
    let page = 1;
    const perPage = 200;
    const wanted = data.email.trim().toLowerCase();
    // Boucle bornée à ~2000 comptes ; suffisant pour un cabinet.
    for (let i = 0; i < 10 && !targetId; i++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) throw new Error(error.message);
      const found = list.users.find((u) => (u.email ?? "").toLowerCase() === wanted);
      if (found) targetId = found.id;
      if (list.users.length < perPage) break;
      page++;
    }
    if (!targetId) {
      const { data: invited, error: inviteError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(wanted);
      if (inviteError || !invited?.user?.id)
        throw new Error(
          inviteError?.message ?? "Impossible d'inviter cette adresse email",
        );
      targetId = invited.user.id;
    }

    const { error } = await context.supabase.from("organisation_membres").insert({
      organisation_id: data.organisationId,
      user_id: targetId,
      role: data.role,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organisationId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.enum(["admin", "avocat", "assistant"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, data.organisationId, context.userId);
    const { error } = await context.supabase
      .from("organisation_membres")
      .update({ role: data.role })
      .eq("organisation_id", data.organisationId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organisationId: z.string().uuid(),
        userId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, data.organisationId, context.userId);
    if (data.userId === context.userId)
      throw new Error("Un admin ne peut pas se retirer lui-même");
    const { error } = await context.supabase
      .from("organisation_membres")
      .delete()
      .eq("organisation_id", data.organisationId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
