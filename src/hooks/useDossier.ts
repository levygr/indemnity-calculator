/**
 * Hook central de gestion d'un dossier : lecture, mise à jour locale immédiate,
 * sauvegarde automatique avec debounce de 2 s vers Lovable Cloud.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDossier,
  updateDossier,
  type DossierRow,
} from "@/lib/dossiers.functions";
import type { DossierData } from "@/lib/calculs/types";
import { hydraterDossier } from "@/lib/calculs/hydratation";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export function useDossier(id: string) {
  const qc = useQueryClient();
  const fetchGet = useServerFn(getDossier);
  const fetchUpdate = useServerFn(updateDossier);

  const { data: row, isLoading } = useQuery({
    queryKey: ["dossier", id],
    queryFn: () => fetchGet({ data: { id } }),
  });

  const [local, setLocal] = useState<DossierData | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<number | null>(null);

  // Hydratation initiale (deep-merge unifié via hydraterDossier)
  useEffect(() => {
    if (row && !local) {
      setLocal(hydraterDossier(row.data ?? {}));
    }
  }, [row, local]);

  const mUpdate = useMutation({
    mutationFn: (payload: { reference: string; data: DossierData }) =>
      fetchUpdate({
        data: {
          id,
          reference: payload.reference,
          data: payload.data as unknown as Record<string, unknown>,
        },
      }),
    onSuccess: (updated: DossierRow) => {
      setStatus("saved");
      qc.setQueryData(["dossier", id], updated);
      qc.invalidateQueries({ queryKey: ["dossiers"] });
    },
    onError: () => setStatus("error"),
  });

  const scheduleSave = useCallback(
    (next: DossierData) => {
      setStatus("dirty");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setStatus("saving");
        mUpdate.mutate({ reference: next.reference, data: next });
      }, 2000);
    },
    [mUpdate],
  );

  const update = useCallback(
    (patch: Partial<DossierData> | ((prev: DossierData) => DossierData)) => {
      setLocal((prev) => {
        if (!prev) return prev;
        const next =
          typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  return {
    row,
    dossier: local,
    isLoading: isLoading || !local,
    status,
    update,
  };
}
