import { useEffect } from "react";
import type { SaveStatus } from "./useDossier";

/**
 * Bloque la fermeture de l'onglet quand des modifications sont en cours ou
 * en cours d'enregistrement. Le navigateur affiche son propre message
 * (non personnalisable) ; le garde est retiré dès que le statut repasse à
 * `saved` ou `idle`.
 */
export function useUnsavedChangesGuard(status: SaveStatus) {
  useEffect(() => {
    if (status !== "dirty" && status !== "saving") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Les navigateurs modernes ignorent le message personnalisé mais
      // affichent leur boîte de confirmation dès que returnValue est défini.
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);
}
