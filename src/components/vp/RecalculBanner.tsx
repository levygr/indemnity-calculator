import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getRecalculStatus,
  pinCurrentEditionsForDossier,
} from "@/lib/referentiels/dossier.functions";
import { recalculDossier } from "@/lib/referentiels/recalcul.functions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, X, RefreshCw } from "lucide-react";
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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
      <Alert className="border-primary/50 bg-primary/5">
        <AlertTriangle className="w-4 h-4 text-primary" />
        <div className="flex-1">
          <AlertTitle className="text-sm">
            Nouvelle édition disponible pour {query.data.diffs.length} référentiel
            {query.data.diffs.length > 1 ? "s" : ""}
          </AlertTitle>
          <AlertDescription className="text-xs space-y-2 mt-2">
            <p>
              Les montants de ce dossier restent calculés avec l'édition
              épinglée. Cliquez sur « Recalculer » pour basculer sur les
              éditions actives. L'opération est tracée.
            </p>
            <ul className="list-disc list-inside pl-1">
              {query.data.diffs.map((d) => (
                <li key={d.referentielId}>
                  <span className="font-medium">{d.libelle}</span> — épinglée :{" "}
                  <span className="italic">{d.pinnedLibelle || "—"}</span> •
                  disponible : <span className="italic">{d.currentLibelle}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2">
              <Button
                size="sm"
                onClick={() => recalcMutation.mutate()}
                disabled={recalcMutation.isPending}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 mr-2 ${
                    recalcMutation.isPending ? "animate-spin" : ""
                  }`}
                />
                Recalculer le dossier
              </Button>
            </div>
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Masquer"
          onClick={() => setDismissed(true)}
          className="h-6 w-6 shrink-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </Alert>
    </div>
  );
}
