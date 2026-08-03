import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getRecalculStatus,
  pinCurrentEditionsForDossier,
} from "@/lib/referentiels/dossier.functions";
import { recalculDossier } from "@/lib/referentiels/recalcul.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Bandeau affiché en tête de dossier si l'édition d'un référentiel
 * épinglée sur le dossier diffère de l'édition actuellement active.
 *
 * L'utilisateur peut :
 *  - masquer le bandeau (purement local à la session) ;
 *  - déclencher un recalcul explicite qui bascule les pins vers les
 *    éditions actives. L'opération est journalisée (`journal_audit` et
 *    `dossier_events`).
 *
 * Effet secondaire à l'ouverture : épingle les éditions actives
 * manquantes (idempotent, jamais destructif).
 */
export function RecalculBanner({ dossierId }: { dossierId: string }) {
  const pin = useServerFn(pinCurrentEditionsForDossier);
  const status = useServerFn(getRecalculStatus);
  const recalculer = useServerFn(recalculDossier);
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);

  const pinMutation = useMutation({
    mutationFn: () => pin({ data: { dossierId } }),
    onSuccess: (res) => {
      if (res.pinned > 0) {
        queryClient.invalidateQueries({
          queryKey: ["recalcul-status", dossierId],
        });
      }
    },
  });

  useEffect(() => {
    pinMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossierId]);

  const query = useQuery({
    queryKey: ["recalcul-status", dossierId],
    queryFn: () => status({ data: { dossierId } }),
    staleTime: 60_000,
  });

  const recalcMutation = useMutation({
    mutationFn: () => recalculer({ data: { dossierId } }),
    onSuccess: (res) => {
      toast.success(
        res.updated > 0
          ? `Recalcul effectué : ${res.updated} référentiel(s) mis à jour.`
          : "Rien à recalculer.",
      );
      queryClient.invalidateQueries({ queryKey: ["recalcul-status", dossierId] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Échec du recalcul.");
    },
  });

  if (dismissed) return null;
  if (query.isLoading || query.error || !query.data) return null;
  if (query.data.diffs.length === 0) return null;

  const n = query.data.diffs.length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6" role="status" aria-live="polite" aria-atomic="true">
      <div className="vp-note vp-note-vigilance">
        <p className="font-display text-[13px] font-semibold">
          Nouvelle édition disponible pour {n} référentiel{n > 1 ? "s" : ""}
        </p>
        <p className="mt-1 text-[13px]">
          Ce dossier est actuellement liquidé avec l'édition épinglée à son
          ouverture. Le recalcul remplacera cette édition par l'édition en
          vigueur : les montants capitalisés et revalorisés du dossier seront
          recalculés, les saisies restent inchangées, et l'opération est tracée.
        </p>
        <ul className="mt-2 list-disc pl-5 text-[13px] space-y-0.5">
          {query.data.diffs.map((d) => (
            <li key={d.referentielId}>
              <span className="font-medium">{d.libelle}</span> — épinglée :{" "}
              <span className="italic">{d.pinnedLibelle || "—"}</span> • en
              vigueur : <span className="italic">{d.currentLibelle}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center gap-4">
          <Button
            size="sm"
            className="min-h-11"
            onClick={() => recalcMutation.mutate()}
            disabled={recalcMutation.isPending}
          >
            {recalcMutation.isPending ? "Recalcul en cours…" : "Recalculer le dossier"}
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-[13px] underline underline-offset-4 text-muted-foreground hover:text-foreground min-h-11"
          >
            Conserver l'édition épinglée
          </button>
        </div>
      </div>
    </div>
  );
}
