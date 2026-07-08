/**
 * Server functions gérant le cycle de vie des éditions de référentiels :
 * brouillon → actif → archivé, ainsi que l'édition cellule par cellule
 * des lignes d'une édition en statut « brouillon ».
 *
 * Règles :
 *  - seuls les administrateurs (`can_edit_referentiels`) peuvent créer,
 *    modifier, activer, archiver ou supprimer une édition ;
 *  - une édition en statut `actif` ou `archive` est en lecture seule :
 *    toute mutation de ses lignes est refusée ;
 *  - l'activation d'une édition brouillon archive automatiquement
 *    l'édition précédemment active du même référentiel ;
 *  - chaque changement d'état est tracé dans `journal_audit`.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

type SupaClient = import("@supabase/supabase-js").SupabaseClient;

async function assertAdmin(supabase: SupaClient, userId: string) {
  const { data: canEdit } = await supabase.rpc("can_edit_referentiels", {
    _user: userId,
  });
  if (!canEdit) throw new Error("Accès refusé (administrateur requis).");
}

async function loadEdition(supabase: SupaClient, editionId: string) {
  const { data, error } = await supabase
    .from("editions")
    .select("id, referentiel_id, statut, libelle")
    .eq("id", editionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Édition introuvable.");
  return data;
}

/* -------------------------------------------------------------------------- */
/*  Listing                                                                    */
/* -------------------------------------------------------------------------- */

export interface EditionListItem {
  id: string;
  libelle: string;
  statut: string;
  source: string | null;
  activated_at: string | null;
  created_at: string;
  created_by: string | null;
  activated_by: string | null;
}

export const listEditionsForRef = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<EditionListItem[]> => {
    const supabase = context.supabase;
    const { data: ref, error: rerr } = await supabase
      .from("referentiels")
      .select("id")
      .eq("code", data.code)
      .maybeSingle();
    if (rerr) throw new Error(rerr.message);
    if (!ref) return [];
    const { data: eds, error } = await supabase
      .from("editions")
      .select(
        "id, libelle, statut, source, activated_at, created_at, created_by, activated_by",
      )
      .eq("referentiel_id", ref.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (eds ?? []) as EditionListItem[];
  });

export interface EditionRowItem {
  id: string;
  cle: Json;
  valeur: Json;
  commentaire: string | null;
}

export const getEditionRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ editionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<EditionRowItem[]> => {
    const supabase = context.supabase;
    const { data: rows, error } = await supabase
      .from("valeurs")
      .select("id, cle, valeur, commentaire")
      .eq("edition_id", data.editionId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as EditionRowItem[];
  });

/* -------------------------------------------------------------------------- */
/*  Création d'un brouillon                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Crée une nouvelle édition en statut « brouillon », en copiant les lignes
 * de l'édition actuellement active (ou d'une édition explicitement
 * choisie). Ne touche à aucune autre édition.
 */
export const createDraftEdition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().min(1),
        libelle: z.string().min(1).max(200),
        source: z.string().max(500).optional(),
        fromEditionId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ editionId: string }> => {
    const supabase = context.supabase;
    await assertAdmin(supabase, context.userId);

    const { data: ref, error: rerr } = await supabase
      .from("referentiels")
      .select("id")
      .eq("code", data.code)
      .maybeSingle();
    if (rerr) throw new Error(rerr.message);
    if (!ref) throw new Error(`Référentiel « ${data.code} » inconnu.`);

    // édition source (par défaut : l'édition active)
    let sourceEditionId: string | null = data.fromEditionId ?? null;
    let sourceLabel: string | null = null;
    if (!sourceEditionId) {
      const { data: active } = await supabase
        .from("editions")
        .select("id, source")
        .eq("referentiel_id", ref.id)
        .eq("statut", "actif")
        .maybeSingle();
      sourceEditionId = (active?.id as string | null) ?? null;
      sourceLabel = (active?.source as string | null) ?? null;
    } else {
      const { data: src } = await supabase
        .from("editions")
        .select("source")
        .eq("id", sourceEditionId)
        .maybeSingle();
      sourceLabel = (src?.source as string | null) ?? null;
    }

    const { data: created, error: cerr } = await supabase
      .from("editions")
      .insert({
        referentiel_id: ref.id,
        libelle: data.libelle,
        source: data.source ?? sourceLabel,
        statut: "brouillon",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (cerr) throw new Error(cerr.message);
    const editionId = created.id as string;

    // Copie des lignes de l'édition source, si présente.
    if (sourceEditionId) {
      const { data: srcRows, error: srerr } = await supabase
        .from("valeurs")
        .select("cle, valeur, commentaire")
        .eq("edition_id", sourceEditionId);
      if (srerr) throw new Error(srerr.message);
      if (srcRows && srcRows.length > 0) {
        const payload = srcRows.map((r) => ({
          edition_id: editionId,
          cle: r.cle as Json,
          valeur: r.valeur as Json,
          commentaire: r.commentaire ?? null,
        }));
        const { error: ierr } = await supabase.from("valeurs").insert(payload);
        if (ierr) throw new Error(ierr.message);
      }
    }

    await supabase.from("journal_audit").insert({
      referentiel_id: ref.id,
      edition_id: editionId,
      action: "brouillon_cree",
      details: {
        libelle: data.libelle,
        fromEditionId: sourceEditionId,
      },
      user_id: context.userId,
    });

    return { editionId };
  });

/* -------------------------------------------------------------------------- */
/*  Mutations sur les lignes (brouillon uniquement)                            */
/* -------------------------------------------------------------------------- */

async function assertDraft(supabase: SupaClient, editionId: string) {
  const ed = await loadEdition(supabase, editionId);
  if (ed.statut !== "brouillon") {
    throw new Error(
      "Cette édition n'est pas modifiable (elle doit être en statut « brouillon »).",
    );
  }
  return ed;
}

export const upsertValeurRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        editionId: z.string().uuid(),
        rowId: z.string().uuid().optional(),
        cle: z.unknown(),
        valeur: z.unknown(),
        commentaire: z.string().max(1000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const supabase = context.supabase;
    await assertAdmin(supabase, context.userId);
    const ed = await assertDraft(supabase, data.editionId);

    if (data.rowId) {
      const { data: updated, error } = await supabase
        .from("valeurs")
        .update({
          cle: data.cle as Json,
          valeur: data.valeur as Json,
          commentaire: data.commentaire ?? null,
        })
        .eq("id", data.rowId)
        .eq("edition_id", data.editionId)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await supabase.from("journal_audit").insert({
        referentiel_id: ed.referentiel_id,
        edition_id: data.editionId,
        action: "valeur_modifiee",
        details: { rowId: data.rowId, cle: data.cle as Json },
        user_id: context.userId,
      });
      return { id: updated.id as string };
    }

    const { data: inserted, error: ierr } = await supabase
      .from("valeurs")
      .insert({
        edition_id: data.editionId,
        cle: data.cle as Json,
        valeur: data.valeur as Json,
        commentaire: data.commentaire ?? null,
      })
      .select("id")
      .single();
    if (ierr) throw new Error(ierr.message);
    await supabase.from("journal_audit").insert({
      referentiel_id: ed.referentiel_id,
      edition_id: data.editionId,
      action: "valeur_ajoutee",
      details: { rowId: inserted.id, cle: data.cle as Json },
      user_id: context.userId,
    });
    return { id: inserted.id as string };
  });

export const deleteValeurRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        editionId: z.string().uuid(),
        rowId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    await assertAdmin(supabase, context.userId);
    const ed = await assertDraft(supabase, data.editionId);

    const { error } = await supabase
      .from("valeurs")
      .delete()
      .eq("id", data.rowId)
      .eq("edition_id", data.editionId);
    if (error) throw new Error(error.message);

    await supabase.from("journal_audit").insert({
      referentiel_id: ed.referentiel_id,
      edition_id: data.editionId,
      action: "valeur_supprimee",
      details: { rowId: data.rowId },
      user_id: context.userId,
    });
    return { ok: true };
  });

/* -------------------------------------------------------------------------- */
/*  Transitions d'état                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Passe une édition brouillon en statut « actif ». L'édition précédemment
 * active du même référentiel (s'il y en a une) est automatiquement passée
 * en « archive » et son `activated_at` est conservé pour l'historique.
 */
export const activateEdition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ editionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    await assertAdmin(supabase, context.userId);
    const ed = await loadEdition(supabase, data.editionId);
    if (ed.statut !== "brouillon") {
      throw new Error("Seule une édition en brouillon peut être activée.");
    }

    // Archive de l'ancienne active
    const { data: previous } = await supabase
      .from("editions")
      .select("id")
      .eq("referentiel_id", ed.referentiel_id)
      .eq("statut", "actif")
      .maybeSingle();
    if (previous) {
      const { error: aerr } = await supabase
        .from("editions")
        .update({ statut: "archive" })
        .eq("id", previous.id);
      if (aerr) throw new Error(aerr.message);
      await supabase.from("journal_audit").insert({
        referentiel_id: ed.referentiel_id,
        edition_id: previous.id as string,
        action: "archivee_automatiquement",
        details: { remplacee_par: data.editionId },
        user_id: context.userId,
      });
    }

    const nowIso = new Date().toISOString();
    const { error: uerr } = await supabase
      .from("editions")
      .update({
        statut: "actif",
        activated_at: nowIso,
        activated_by: context.userId,
      })
      .eq("id", data.editionId);
    if (uerr) throw new Error(uerr.message);

    await supabase.from("journal_audit").insert({
      referentiel_id: ed.referentiel_id,
      edition_id: data.editionId,
      action: "activee",
      details: { activated_at: nowIso },
      user_id: context.userId,
    });
    return { ok: true };
  });

export const archiveEdition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ editionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    await assertAdmin(supabase, context.userId);
    const ed = await loadEdition(supabase, data.editionId);
    if (ed.statut === "archive") return { ok: true };
    if (ed.statut === "actif") {
      throw new Error(
        "Impossible d'archiver l'édition active. Activez d'abord une autre édition.",
      );
    }
    const { error } = await supabase
      .from("editions")
      .update({ statut: "archive" })
      .eq("id", data.editionId);
    if (error) throw new Error(error.message);
    await supabase.from("journal_audit").insert({
      referentiel_id: ed.referentiel_id,
      edition_id: data.editionId,
      action: "archivee",
      user_id: context.userId,
    });
    return { ok: true };
  });

export const deleteDraftEdition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ editionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    await assertAdmin(supabase, context.userId);
    const ed = await loadEdition(supabase, data.editionId);
    if (ed.statut !== "brouillon") {
      throw new Error("Seule une édition en brouillon peut être supprimée.");
    }
    // Les lignes valeurs sont supprimées en cascade côté schéma.
    const { error } = await supabase
      .from("editions")
      .delete()
      .eq("id", data.editionId);
    if (error) throw new Error(error.message);
    await supabase.from("journal_audit").insert({
      referentiel_id: ed.referentiel_id,
      edition_id: null,
      action: "brouillon_supprime",
      details: { editionId: data.editionId, libelle: ed.libelle },
      user_id: context.userId,
    });
    return { ok: true };
  });

/* -------------------------------------------------------------------------- */
/*  Droits                                                                     */
/* -------------------------------------------------------------------------- */

export const canEditReferentiels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { data } = await context.supabase.rpc("can_edit_referentiels", {
      _user: context.userId,
    });
    return Boolean(data);
  });
