import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppSidebar } from "@/components/vp/AppSidebar";
import { useDossier } from "@/hooks/useDossier";
import type { SaveStatus } from "@/hooks/useDossier";
import { Check, CircleDashed, Cloud, CloudOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dossiers/$id")({
  component: DossierLayout,
});

function DossierLayout() {
  const { id } = Route.useParams();
  const { dossier, status, isLoading } = useDossier(id);

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar id={id} reference={dossier?.reference ?? ""} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b bg-card flex items-center justify-end px-6 gap-4">
          <SaveIndicator status={status} />
        </header>
        <main className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-muted-foreground">Chargement du dossier…</div>
          ) : (
            <Outlet />
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
    <div className={`flex items-center gap-2 text-xs font-display ${s.className}`}>
      {s.icon}
      <span>{s.label}</span>
    </div>
  );
}
