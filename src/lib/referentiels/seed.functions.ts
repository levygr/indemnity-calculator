/**
 * Server functions de seed et de lecture des référentiels centralisés.
 *
 * Le seed est idempotent : pour chaque référentiel du registre,
 *  - insère la ligne `referentiels` si elle n'existe pas ;
 *  - si aucune édition n'est encore active, crée une édition
 *    « Seed initial » (statut `actif`) contenant les lignes produites
 *    par `def.toRows(def.payload)`.
 *
 * Le seed ne modifie JAMAIS de valeur existante : si une édition active
 * est déjà en place, il ne fait rien pour ce référentiel.
 *
 * Accès : réservé aux administrateurs (`can_edit_referentiels`).
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REGISTRY, type ReferentielRow } from "./registry";

interface SeedReport {
  code: string;
  libelle: string;
  action: "seedee" | "existe";
  editionId: string;
  lignes: number;
}

export const seedReferentiels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SeedReport[]> => {
    const supabase = context.supabase;

    // Vérification stricte : seul un administrateur peut lancer le seed.
    const { data: canEdit } = await supabase.rpc("can_edit_referentiels", {
      _user: context.userId,
    });
    if (!canEdit) throw new Error("Accès refusé (administrateur requis).");

    const rapports: SeedReport[] = [];

    for (const def of REGISTRY) {
      // 1) upsert du référentiel
      const { data: existingRef } = await supabase
        .from("referentiels")
        .select("id")
        .eq("code", def.code)
        .maybeSingle();

      let referentielId: string;
      if (existingRef) {
        referentielId = existingRef.id as string;
      } else {
        const { data: created, error } = await supabase
          .from("referentiels")
          .insert({
            code: def.code,
            libelle: def.libelle,
            kind: def.kind,
            description: def.description,
          })
          .select("id")
          .single();
        if (error) throw new Error(`referentiels.${def.code}: ${error.message}`);
        referentielId = created.id as string;
      }

      // 2) une édition active existe-t-elle déjà ?
      const { data: activeEdition } = await supabase
        .from("editions")
        .select("id")
        .eq("referentiel_id", referentielId)
        .eq("statut", "actif")
        .maybeSingle();

      if (activeEdition) {
        rapports.push({
          code: def.code,
          libelle: def.libelle,
          action: "existe",
          editionId: activeEdition.id as string,
          lignes: 0,
        });
        continue;
      }

      // 3) création de l'édition « Seed initial »
      const { data: edition, error: edErr } = await supabase
        .from("editions")
        .insert({
          referentiel_id: referentielId,
          libelle: "Seed initial",
          source: def.source,
          statut: "actif",
          activated_at: new Date().toISOString(),
          activated_by: context.userId,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (edErr) throw new Error(`editions.${def.code}: ${edErr.message}`);
      const editionId = edition.id as string;

      // 4) insertion des lignes
      const rows = def.toRows(def.payload);
      if (rows.length > 0) {
        type Json = import("@/integrations/supabase/types").Json;
        const payload = rows.map((r) => ({
          edition_id: editionId,
          cle: r.cle as unknown as Json,
          valeur: r.valeur as unknown as Json,
          commentaire: r.commentaire ?? null,
        }));
        const { error: valErr } = await supabase.from("valeurs").insert(payload);
        if (valErr) throw new Error(`valeurs.${def.code}: ${valErr.message}`);
      }

      // 5) trace d'audit
      await supabase.from("journal_audit").insert({
        referentiel_id: referentielId,
        edition_id: editionId,
        action: "seed_initial",
        details: { code: def.code, lignes: rows.length },
        user_id: context.userId,
      });

      rapports.push({
        code: def.code,
        libelle: def.libelle,
        action: "seedee",
        editionId,
        lignes: rows.length,
      });
    }

    return rapports;
  });

/**
 * Renvoie, pour chaque référentiel, les lignes de l'édition active.
 * Utilisé par les blocs suivants (couche d'accès + UI admin).
 */
type Json = import("@/integrations/supabase/types").Json;

export interface ReferentielSnapshotRow {
  cle: Json;
  valeur: Json;
  commentaire: string | null;
}

export interface ReferentielSnapshot {
  code: string;
  libelle: string;
  kind: string;
  source: string;
  description: string;
  editionId: string | null;
  editionLibelle: string | null;
  editionActivatedAt: string | null;
  rows: ReferentielSnapshotRow[];
}

export const listReferentielsActifs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReferentielSnapshot[]> => {
    const supabase = context.supabase;
    const { data: refs, error } = await supabase
      .from("referentiels")
      .select("id, code, libelle, kind, description")
      .order("libelle", { ascending: true });
    if (error) throw new Error(error.message);
    if (!refs || refs.length === 0) return [];

    const out: ReferentielSnapshot[] = [];
    for (const r of refs) {
      const { data: ed } = await supabase
        .from("editions")
        .select("id, libelle, source, activated_at")
        .eq("referentiel_id", r.id)
        .eq("statut", "actif")
        .maybeSingle();
      let rows: ReferentielSnapshotRow[] = [];
      if (ed) {
        const { data: vals } = await supabase
          .from("valeurs")
          .select("cle, valeur, commentaire")
          .eq("edition_id", ed.id);
        rows = (vals ?? []).map((v) => ({
          cle: v.cle as Json,
          valeur: v.valeur as Json,
          commentaire: v.commentaire,
        }));
      }
      out.push({
        code: r.code as string,
        libelle: r.libelle as string,
        kind: r.kind as string,
        source: (ed?.source as string | null) ?? "",
        description: (r.description as string | null) ?? "",
        editionId: (ed?.id as string | null) ?? null,
        editionLibelle: (ed?.libelle as string | null) ?? null,
        editionActivatedAt: (ed?.activated_at as string | null) ?? null,
        rows,
      });
    }
    return out;
  });
