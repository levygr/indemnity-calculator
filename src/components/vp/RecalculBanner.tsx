import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getRecalculStatus,
  pinCurrentEditionsForDossier,
} from "@/lib/referentiels/dossier.functions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Bandeau affiché en tête de dossier si l'édition d'un référentiel
 * épinglée sur le dossier diffère de l'édition actuellement active.
 *
 * Bloc B : le bandeau est purement informatif. Le déclenchement du
 * recalcul et la bascule vers la nouvelle édition arriveront au Bloc C.
 *
 * Effet secondaire : à l'ouverture du dossier, épingle les éditions
 * actives manquantes (idempotent, jamais destructif).
 */
export function RecalculBanner({ dossierId }: { dossierId: string }) {
  const pin = useServerFn(pinCurrentEditionsForDossier);
  const status = useServerFn(getRecalculStatus);
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
          <AlertDescription className="text-xs space-y-1 mt-2">
            <p>
              Les montants de ce dossier restent calculés avec l'édition
              épinglée. Le recalcul explicite arrivera prochainement.
            </p>
            <ul className="list-disc list-inside pl-1 pt-1">
              {query.data.diffs.map((d) => (
                <li key={d.referentielId}>
                  <span className="font-medium">{d.libelle}</span> — épinglée :{" "}
                  <span className="italic">{d.pinnedLibelle || "—"}</span> •
                  disponible : <span className="italic">{d.currentLibelle}</span>
                </li>
              ))}
            </ul>
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
