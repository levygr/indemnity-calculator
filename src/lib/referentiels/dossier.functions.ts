/**
 * Server functions liant un dossier aux éditions actives des référentiels.
 *
 * - `pinCurrentEditionsForDossier` : pour chaque référentiel possédant une
 *   édition active, insère une ligne `dossier_editions` si elle manque.
 *   NE MODIFIE JAMAIS une édition déjà épinglée : c'est le point clé pour
 *   garantir la stabilité des chiffres du dossier lorsqu'une nouvelle
 *   édition est activée par un administrateur.
 *
 * - `getRecalculStatus` : liste, pour un dossier, les référentiels dont
 *   l'édition épinglée diffère de l'édition actuellement active. Utilisé
 *   par le bandeau « Recalcul disponible ».
 *
 * Accès : membre du cabinet propriétaire du dossier (contrôle RLS +
 *  vérification `is_org_member`).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertMembre(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  dossierId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("dossiers")
    .select("id, organisation_id")
    .eq("id", dossierId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Dossier introuvable ou accès refusé.");
  return data.organisation_id as string;
}

/**
 * Ajoute, pour ce dossier, une ligne `dossier_editions` pour chaque
 * référentiel disposant d'une édition active mais non encore épinglé.
 * Idempotente : rien n'est modifié pour les référentiels déjà épinglés.
 */
export const pinCurrentEditionsForDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ dossierId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    await assertMembre(supabase, data.dossierId);

    const { data: refs, error: refErr } = await supabase
      .from("referentiels")
      .select("id");
    if (refErr) throw new Error(refErr.message);
    if (!refs || refs.length === 0) return { pinned: 0 };

    const { data: already, error: alrErr } = await supabase
      .from("dossier_editions")
      .select("referentiel_id")
      .eq("dossier_id", data.dossierId);
    if (alrErr) throw new Error(alrErr.message);
    const dejaPinned = new Set((already ?? []).map((r) => r.referentiel_id as string));

    const missingRefIds = refs
      .map((r) => r.id as string)
      .filter((rid) => !dejaPinned.has(rid));
    if (missingRefIds.length === 0) return { pinned: 0 };

    const { data: eds, error: edErr } = await supabase
      .from("editions")
      .select("id, referentiel_id")
      .in("referentiel_id", missingRefIds)
      .eq("statut", "actif");
    if (edErr) throw new Error(edErr.message);

    const rows = (eds ?? []).map((e) => ({
      dossier_id: data.dossierId,
      referentiel_id: e.referentiel_id as string,
      edition_id: e.id as string,
    }));
    if (rows.length === 0) return { pinned: 0 };

    const { error: insErr } = await supabase.from("dossier_editions").insert(rows);
    if (insErr) throw new Error(insErr.message);
    return { pinned: rows.length };
  });

export interface RecalculDiff {
  referentielId: string;
  code: string;
  libelle: string;
  pinnedEditionId: string;
  pinnedLibelle: string;
  pinnedActivatedAt: string | null;
  currentEditionId: string;
  currentLibelle: string;
  currentActivatedAt: string | null;
}

export interface RecalculStatus {
  dossierId: string;
  diffs: RecalculDiff[];
}

/**
 * Retourne la liste des référentiels dont l'édition épinglée sur le
 * dossier diffère de l'édition actuellement active. Un tableau vide
 * signifie que le dossier est à jour.
 */
export const getRecalculStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ dossierId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<RecalculStatus> => {
    const supabase = context.supabase;
    await assertMembre(supabase, data.dossierId);

    const { data: pinned, error } = await supabase
      .from("dossier_editions")
      .select(
        "referentiel_id, edition_id, editions:edition_id(id, libelle, activated_at), referentiels:referentiel_id(id, code, libelle)",
      )
      .eq("dossier_id", data.dossierId);
    if (error) throw new Error(error.message);
    if (!pinned || pinned.length === 0) return { dossierId: data.dossierId, diffs: [] };

    const refIds = pinned.map((p) => p.referentiel_id as string);
    const { data: currents, error: curErr } = await supabase
      .from("editions")
      .select("id, referentiel_id, libelle, activated_at")
      .in("referentiel_id", refIds)
      .eq("statut", "actif");
    if (curErr) throw new Error(curErr.message);
    const currentByRef = new Map<
      string,
      { id: string; libelle: string; activated_at: string | null }
    >();
    for (const c of currents ?? []) {
      currentByRef.set(c.referentiel_id as string, {
        id: c.id as string,
        libelle: c.libelle as string,
        activated_at: (c.activated_at as string | null) ?? null,
      });
    }

    const diffs: RecalculDiff[] = [];
    for (const p of pinned) {
      const cur = currentByRef.get(p.referentiel_id as string);
      if (!cur) continue; // référentiel sans édition active courante : rien à proposer
      if (cur.id === p.edition_id) continue;
      const ed = p.editions as unknown as {
        id: string;
        libelle: string;
        activated_at: string | null;
      } | null;
      const ref = p.referentiels as unknown as {
        id: string;
        code: string;
        libelle: string;
      } | null;
      diffs.push({
        referentielId: p.referentiel_id as string,
        code: ref?.code ?? "",
        libelle: ref?.libelle ?? "",
        pinnedEditionId: p.edition_id as string,
        pinnedLibelle: ed?.libelle ?? "",
        pinnedActivatedAt: ed?.activated_at ?? null,
        currentEditionId: cur.id,
        currentLibelle: cur.libelle,
        currentActivatedAt: cur.activated_at,
      });
    }
    return { dossierId: data.dossierId, diffs };
  });
