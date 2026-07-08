/**
 * Recalcul explicite d'un dossier : bascule les éditions épinglées sur
 * les éditions actuellement actives, uniquement pour les référentiels
 * où l'utilisateur constate un écart. L'opération est journalisée dans
 * `journal_audit` et enregistrée comme un événement de dossier via
 * `dossier_events` pour permettre l'audit côté cabinet.
 *
 * Aucun chiffre du dossier n'est modifié par cette fonction : elle ne
 * touche qu'à la table `dossier_editions` (le pin des éditions). Les
 * calculs sont refaits automatiquement lors de la prochaine ouverture
 * du dossier par les modules de calcul.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export const recalculDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ dossierId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ updated: number }> => {
    const supabase = context.supabase;

    // Vérifier l'accès au dossier (RLS + membre).
    const { data: dossier, error: derr } = await supabase
      .from("dossiers")
      .select("id, organisation_id")
      .eq("id", data.dossierId)
      .maybeSingle();
    if (derr) throw new Error(derr.message);
    if (!dossier) throw new Error("Dossier introuvable ou accès refusé.");

    // Éditions actuellement épinglées.
    const { data: pinned, error: perr } = await supabase
      .from("dossier_editions")
      .select("id, referentiel_id, edition_id")
      .eq("dossier_id", data.dossierId);
    if (perr) throw new Error(perr.message);
    if (!pinned || pinned.length === 0) return { updated: 0 };

    const refIds = pinned.map((p) => p.referentiel_id as string);
    const { data: currents, error: cerr } = await supabase
      .from("editions")
      .select("id, referentiel_id")
      .in("referentiel_id", refIds)
      .eq("statut", "actif");
    if (cerr) throw new Error(cerr.message);
    const currentByRef = new Map<string, string>();
    for (const c of currents ?? []) {
      currentByRef.set(c.referentiel_id as string, c.id as string);
    }

    const changes: {
      referentielId: string;
      previousEditionId: string;
      newEditionId: string;
      pinId: string;
    }[] = [];
    for (const p of pinned) {
      const refId = p.referentiel_id as string;
      const newId = currentByRef.get(refId);
      if (!newId) continue;
      const prev = p.edition_id as string;
      if (newId === prev) continue;
      changes.push({
        referentielId: refId,
        previousEditionId: prev,
        newEditionId: newId,
        pinId: p.id as string,
      });
    }
    if (changes.length === 0) return { updated: 0 };

    // Mise à jour des pins.
    for (const c of changes) {
      const { error: uerr } = await supabase
        .from("dossier_editions")
        .update({ edition_id: c.newEditionId })
        .eq("id", c.pinId);
      if (uerr) throw new Error(uerr.message);
    }

    // Trace côté dossier.
    await supabase.from("dossier_events").insert({
      dossier_id: data.dossierId,
      user_id: context.userId,
      type: "recalcul_referentiels",
      payload: {
        changes: changes.map((c) => ({
          referentielId: c.referentielId,
          from: c.previousEditionId,
          to: c.newEditionId,
        })),
      } as unknown as Json,
    });

    // Trace côté audit référentiels (une ligne par changement).
    const auditRows = changes.map((c) => ({
      referentiel_id: c.referentielId,
      edition_id: c.newEditionId,
      action: "dossier_recalcule",
      details: {
        dossierId: data.dossierId,
        remplace: c.previousEditionId,
      } as unknown as Json,
      user_id: context.userId,
    }));
    await supabase.from("journal_audit").insert(auditRows);

    return { updated: changes.length };
  });
