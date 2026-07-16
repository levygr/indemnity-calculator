import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Fait défiler vers l'élément désigné par le hash de l'URL et applique une
 * mise en évidence visuelle temporaire (~2 s) pour signaler l'arrivée depuis
 * un lien contextuel (avertissements, badge sidebar).
 */
export function useAnchorHighlight() {
  const hash = useRouterState({ select: (s) => s.location.hash });
  useEffect(() => {
    if (!hash) return;
    const id = hash.replace(/^#/, "");
    if (!id) return;
    // Léger délai pour laisser la page se rendre
    const timeoutFind = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("vp-anchor-flash");
      const timeoutClear = window.setTimeout(() => {
        el.classList.remove("vp-anchor-flash");
      }, 2000);
      return () => window.clearTimeout(timeoutClear);
    }, 50);
    return () => window.clearTimeout(timeoutFind);
  }, [hash]);
}
