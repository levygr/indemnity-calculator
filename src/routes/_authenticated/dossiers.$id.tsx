import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppSidebar, DOSSIER_PAGES_ORDER } from "@/components/vp/AppSidebar";
import { useDossier } from "@/hooks/useDossier";
import type { SaveStatus } from "@/hooks/useDossier";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useAnchorHighlight } from "@/hooks/useAnchorHighlight";
import { Check, ChevronLeft, ChevronRight, CircleDashed, Cloud, CloudOff, Menu, Search } from "lucide-react";
import { collecterAvertissements } from "@/lib/calculs";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { RecalculBanner } from "@/components/vp/RecalculBanner";

export const Route = createFileRoute("/_authenticated/dossiers/$id")({
  component: DossierLayout,
});

function DossierLayout() {
  const { id } = Route.useParams();
  const { dossier, status, isLoading } = useDossier(id);
  useUnsavedChangesGuard(status);
  useAnchorHighlight();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const nbAvertissements = useMemo(
    () => (dossier ? collecterAvertissements(dossier).length : 0),
    [dossier],
  );

  const currentPage = useMemo(() => {
    const rel = pathname.replace(`/dossiers/${id}`, "") || "/";
    const found = DOSSIER_PAGES_ORDER.find((p) => {
      const rest = p.path.replace("/dossiers/$id", "") || "/";
      return rest === rel;
    });
    return found ?? DOSSIER_PAGES_ORDER[0];
  }, [pathname, id]);

  const currentIndex = DOSSIER_PAGES_ORDER.findIndex((p) => p.key === currentPage.key);
  const prev = currentIndex > 0 ? DOSSIER_PAGES_ORDER[currentIndex - 1] : null;
  const next =
    currentIndex >= 0 && currentIndex < DOSSIER_PAGES_ORDER.length - 1
      ? DOSSIER_PAGES_ORDER[currentIndex + 1]
      : null;

  /** Pages à tableaux larges : elles conservent leur pleine largeur. */
  const isWidePage = ["synthese", "comparateur", "tp", "interets", "activite"].includes(
    currentPage.key,
  );


  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar desktop */}
      <div className="hidden lg:block">
        <AppSidebar
          id={id}
          reference={dossier?.reference ?? ""}
          nbAvertissements={nbAvertissements}
          dossier={dossier}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-card flex items-center px-3 sm:px-6 gap-2 sm:gap-4 sticky top-0 z-30">
          {/* Menu mobile */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden min-h-11 min-w-11"
                aria-label="Ouvrir le menu du dossier"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar border-r-0">
              <VisuallyHidden>
                <SheetTitle>Navigation du dossier</SheetTitle>
              </VisuallyHidden>
              <AppSidebar
                id={id}
                reference={dossier?.reference ?? ""}
                nbAvertissements={nbAvertissements}
                dossier={dossier}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          {/* Fil d'ariane */}
          <nav aria-label="Fil d'ariane" className="flex-1 min-w-0 flex items-center gap-1.5 text-sm">
            <Link to="/dossiers" className="text-muted-foreground hover:text-foreground shrink-0 hidden sm:inline">
              Dossiers
            </Link>
            <span className="text-muted-foreground/50 hidden sm:inline">/</span>
            <span className="font-display font-medium truncate">{dossier?.reference || "Dossier"}</span>
            <span className="text-muted-foreground/50 shrink-0">/</span>
            <span className="text-muted-foreground truncate">{currentPage.label}</span>
          </nav>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("vp:open-command-palette"))}
            className="hidden md:inline-flex items-center gap-2 shrink-0 text-xs text-muted-foreground hover:text-foreground border rounded px-2 min-h-9"
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            Rechercher — Ctrl + K
          </button>

          <SaveIndicator status={status} />

        </header>

        <main
          id="main-content"
          className={`flex-1 overflow-y-auto overflow-x-hidden ${isWidePage ? "" : "vp-reading"}`}
        >

          {isLoading ? (
            <div className="p-6 sm:p-8 text-muted-foreground">Chargement du dossier…</div>
          ) : (
            <>
              <RecalculBanner dossierId={id} />
              <Outlet />
              {/* Parcours guidé : étape précédente / suivante, en liens sobres */}
              {(prev || next) && (
                <nav
                  aria-label="Parcours du dossier"
                  className="max-w-6xl mx-auto px-4 sm:px-6 pb-10 pt-6 mt-6 border-t flex items-center justify-between gap-4 text-sm"
                >
                  {prev ? (
                    <Link
                      to={prev.path as "/dossiers/$id"}
                      params={{ id }}
                      className="inline-flex items-center gap-2 min-h-11 text-muted-foreground hover:text-foreground underline underline-offset-4 max-w-[48%]"
                    >
                      <ChevronLeft className="w-4 h-4 shrink-0" />
                      <span className="truncate">Étape précédente : {prev.label}</span>
                    </Link>
                  ) : (
                    <span />
                  )}
                  {next ? (
                    <Link
                      to={next.path as "/dossiers/$id"}
                      params={{ id }}
                      className="inline-flex items-center gap-2 min-h-11 font-medium text-primary underline underline-offset-4 max-w-[48%]"
                    >
                      <span className="truncate">Étape suivante : {next.label}</span>
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              )}

            </>
          )}
        </main>
      </div>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const map: Record<SaveStatus, { icon: React.ReactNode; label: string; className: string }> = {
    idle: { icon: <Cloud className="w-4 h-4" />, label: "Prêt", className: "text-muted-foreground" },
    dirty: { icon: <CircleDashed className="w-4 h-4" />, label: "Modifications non enregistrées", className: "text-muted-foreground" },
    saving: { icon: <CircleDashed className="w-4 h-4 animate-spin" />, label: "Enregistrement…", className: "text-muted-foreground" },
    saved: { icon: <Check className="w-4 h-4" />, label: "Enregistré", className: "text-success" },
    error: { icon: <CloudOff className="w-4 h-4" />, label: "Erreur d'enregistrement", className: "text-destructive" },
  };
  const s = map[status];
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 text-xs font-display shrink-0 ${s.className}`}
      title={s.label}
    >
      {s.icon}
      <span className="hidden sm:inline">{s.label}</span>
    </div>
  );
}

