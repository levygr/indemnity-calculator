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
import { defaultDossierData } from "@/lib/calculs/types";

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

  // Hydratation initiale (deep-merge partiel pour compatibilité avec les anciens dossiers)
  useEffect(() => {
    if (row && !local) {
      const base = defaultDossierData();
      const raw = (row.data ?? {}) as Partial<DossierData>;
      const merged: DossierData = {
        ...base,
        ...raw,
        postesTemp: { ...base.postesTemp, ...(raw.postesTemp ?? {}) },
        postesPerm: {
          ...base.postesPerm,
          ...(raw.postesPerm ?? {}),
          atpPerm: { ...base.postesPerm.atpPerm, ...(raw.postesPerm?.atpPerm ?? {}) },
          pgpf: { ...base.postesPerm.pgpf, ...(raw.postesPerm?.pgpf ?? {}) },
          ip: { ...base.postesPerm.ip, ...(raw.postesPerm?.ip ?? {}) },
          dfp: { ...base.postesPerm.dfp, ...(raw.postesPerm?.dfp ?? {}) },
          agrement: { ...base.postesPerm.agrement, ...(raw.postesPerm?.agrement ?? {}) },
          sexuel: { ...base.postesPerm.sexuel, ...(raw.postesPerm?.sexuel ?? {}) },
          esthetiquePerm: { ...base.postesPerm.esthetiquePerm, ...(raw.postesPerm?.esthetiquePerm ?? {}) },
          etablissement: { ...base.postesPerm.etablissement, ...(raw.postesPerm?.etablissement ?? {}) },
          pathologiesEvo: { ...base.postesPerm.pathologiesEvo, ...(raw.postesPerm?.pathologiesEvo ?? {}) },
        },
        postesDeces: {
          ...base.postesDeces,
          ...(raw.postesDeces ?? {}),
          proches: (raw.postesDeces?.proches ?? []).map((p) => ({
            pensionReversionAnnuelle: 0,
            ...p,
          })),
        },
        postesSurvie: { ...base.postesSurvie, ...(raw.postesSurvie ?? {}) },
      };

      setLocal(merged);
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
